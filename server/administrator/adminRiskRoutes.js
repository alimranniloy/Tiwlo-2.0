import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import {
  sendAccountDisabledEmail,
  sendAccountRestoredEmail
} from '../db/emailService.js';
import { RestoreSessions } from '../db/restoreSessions.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { getUserAccountHold } from '../security/accountLifecycleEnforcer.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import { listVpsAbuseEvents } from '../security/vpsAbuseGuardService.js';
import {
  buildUserActivityDossier,
  enrichUsersWithRiskIntel,
  executeClusterBanAction,
  isSuperAdminAccount
} from './identityRiskGraph.js';

function toIsoOrNull(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function safeTableExists(tableName) {
  try {
    const { rows } = await queryPg('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]);
    return Boolean(rows?.[0]?.exists);
  } catch {
    return false;
  }
}

async function safeRows(sql, params = []) {
  try {
    const res = await queryPg(sql, params);
    return Array.isArray(res?.rows) ? res.rows : [];
  } catch (err) {
    console.warn('[Admin Abuse Evidence] Query skipped:', err.message);
    return [];
  }
}

function classifyModerationBucket(flag) {
  const haystack = [
    flag?.category,
    flag?.policyName,
    flag?.eventType,
    flag?.reason,
    flag?.contentType
  ]
    .filter(Boolean)
    .join(' ');
  if (/weapon|firearm|explosive|ammo|gun|contraband|drug|narcotic|illegal/i.test(haystack)) {
    return 'weapons_contraband';
  }
  if (/adult|nsfw|porn|nude|explicit|sexual/i.test(haystack)) {
    return 'nsfw_adult';
  }
  return 'policy_moderation';
}

function formatHoldRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id ?? row.userId ?? null,
    holdType: row.hold_type ?? row.holdType ?? null,
    nonRefundable: row.non_refundable !== false && row.nonRefundable !== false,
    pausedAt: toIsoOrNull(row.paused_at ?? row.pausedAt),
    retainUntil: toIsoOrNull(row.retain_until ?? row.retainUntil),
    purgedAt: toIsoOrNull(row.purged_at ?? row.purgedAt),
    reason: row.reason || null,
    snapshot: parseJsonObject(row.snapshot_json ?? row.snapshot),
    updatedAt: toIsoOrNull(row.updated_at ?? row.updatedAt)
  };
}

function summarizeServiceStatus({ items = [], snapshotCount = 0, holdActive = false, holdPurged = false, pausedChecker }) {
  const totalCount = Math.max(items.length, snapshotCount);
  const pausedCount = items.filter(pausedChecker).length;
  let status = 'none';
  if (holdPurged && totalCount > 0) {
    status = 'purged';
  } else if (totalCount === 0) {
    status = holdActive ? 'paused_on_hold' : 'none';
  } else if (pausedCount === totalCount) {
    status = 'paused';
  } else if (pausedCount > 0) {
    status = 'partial_pause';
  } else {
    status = holdActive ? 'paused_on_hold' : 'active';
  }
  return {
    totalCount,
    pausedCount,
    paused: holdActive || pausedCount > 0 || holdPurged,
    status
  };
}

function buildAbuseEvidenceMetrics({ hold, droplets, vpsAbuseEvents, storeFlags, lifecycleAudits, accountSecurity }) {
  let smtpSpamBursts = 0;
  let port25Hits = 0;
  let cryptoMinerStratum = 0;
  let outboundFloodScans = 0;

  for (const ev of vpsAbuseEvents) {
    const evidence = ev.evidence || {};
    const blockedPorts = Array.isArray(evidence.blockedPortHits) ? evidence.blockedPortHits.map(Number) : [];
    const blockedSmtp = Array.isArray(evidence.blockedSmtpHits) ? evidence.blockedSmtpHits.map(Number) : [];
    const stratumPorts = Array.isArray(evidence.detectedStratumPorts) ? evidence.detectedStratumPorts.map(Number) : [];

    const isSmtp =
      ev.ruleType === 'smtp_spam_egress' ||
      Boolean(evidence.smtpBurst) ||
      Number(evidence.smtpAttemptsPerMin) >= 40;
    if (isSmtp) smtpSpamBursts += 1;

    const hitPort25 = blockedPorts.includes(25) || blockedSmtp.includes(25);
    if (hitPort25) {
      port25Hits += Math.max(1, Number(evidence.port25HitCount) || 1);
    }

    const isMiner = ev.ruleType === 'crypto_miner_suspected' || stratumPorts.length > 0;
    if (isMiner) cryptoMinerStratum += 1;

    if (ev.ruleType === 'outbound_flood_scan') outboundFloodScans += 1;
  }

  let nsfwStrikes = 0;
  let weaponStrikes = 0;
  let otherModerationStrikes = 0;
  for (const flag of storeFlags) {
    const bucket = classifyModerationBucket(flag);
    if (bucket === 'nsfw_adult') nsfwStrikes += 1;
    else if (bucket === 'weapons_contraband') weaponStrikes += 1;
    else otherModerationStrikes += 1;
  }

  const activeDropletsCount = droplets.filter((d) => String(d.status || '').toLowerCase() === 'active').length;
  const suspendedDropletsCount = droplets.filter((d) =>
    ['suspended', 'paused', 'terminated'].includes(String(d.status || '').toLowerCase())
  ).length;

  const summaryCounts = {
    totalFlags: vpsAbuseEvents.length + storeFlags.length,
    vpsAbuseCount: vpsAbuseEvents.length,
    smtpSpamBursts,
    port25Hits,
    cryptoMinerStratum,
    outboundFloodScans,
    storeModerationStrikes: storeFlags.length,
    nsfwStrikes,
    weaponStrikes,
    otherModerationStrikes,
    lifecycleAuditCount: lifecycleAudits.length,
    accountStrikes: Number(accountSecurity?.strikes || 0),
    activeDropletsCount,
    suspendedDropletsCount,
    hasActiveHold: Boolean(hold && hold.holdType && hold.holdType !== 'cleared')
  };

  const byCategory = [
    { key: 'smtp_spam', label: 'SMTP Spam', count: smtpSpamBursts, tone: 'critical' },
    { key: 'port_25_hits', label: 'Port 25 Hits', count: port25Hits, tone: 'warning' },
    { key: 'crypto_miner', label: 'Crypto-Miner', count: cryptoMinerStratum, tone: 'critical' },
    { key: 'outbound_flood', label: 'Flood / Scan', count: outboundFloodScans, tone: 'warning' },
    { key: 'nsfw_adult', label: 'NSFW / Adult', count: nsfwStrikes, tone: 'warning' },
    { key: 'weapons_contraband', label: 'Weapons / Prohibited', count: weaponStrikes, tone: 'critical' },
    { key: 'lifecycle_holds', label: 'Holds & Audits', count: lifecycleAudits.length, tone: 'info' }
  ];

  const dateMap = new Map();
  const addToDate = (isoDate, field) => {
    const iso = toIsoOrNull(isoDate);
    if (!iso) return;
    const dayKey = iso.slice(0, 10);
    if (!dateMap.has(dayKey)) {
      const d = new Date(`${dayKey}T00:00:00Z`);
      const label = Number.isNaN(d.getTime())
        ? dayKey
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      dateMap.set(dayKey, { date: dayKey, label, vpsAbuse: 0, storeFlags: 0, lifecycle: 0, total: 0 });
    }
    const bucket = dateMap.get(dayKey);
    bucket[field] += 1;
    bucket.total += 1;
  };

  for (const ev of vpsAbuseEvents) addToDate(ev.createdAt, 'vpsAbuse');
  for (const flag of storeFlags) addToDate(flag.createdAt, 'storeFlags');
  for (const aud of lifecycleAudits) addToDate(aud.createdAt, 'lifecycle');

  const byDate = [...dateMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return {
    summaryCounts,
    chartSeries: {
      byCategory,
      byDate
    }
  };
}

function createFallbackRequireAdmin() {
  return function fallbackRequireAdmin(req, res, next) {
    const token = req.cookies?.tiwlo_host_session ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null) ||
      req.headers?.['x-session-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }

    MasterDB.getSession(token, req).then((sessionData) => {
      if (!sessionData || !sessionData.user) {
        return res.status(401).json({ error: 'Session expired or invalid.' });
      }
      const user = sessionData.user;
      if (user.isBanned || (!isSuperAdminAccount(user) && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
      }
      req.adminUser = user;
      return next();
    }).catch((err) => {
      console.error('[Admin Risk Auth Error]', err);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

export function createAdminRiskRouter({
  requireAdmin = createFallbackRequireAdmin(),
  requireRecentReauth = defaultRequireRecentReauth
} = {}) {
  const router = express.Router();

  // GET /api/admin/users/risk-intel
  router.get('/users/risk-intel', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const rawUsers = await MasterDB.getUsers();
      const sanitizedUsers = rawUsers.map((u) => ({
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'System User',
        email: u.email,
        phone: u.phone || '',
        role: u.role || 'owner',
        planId: u.planId || 'free',
        planName: u.planName || u.planId || 'Free Starter',
        avatar: u.avatar && !String(u.avatar).includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        isBanned: Boolean(u.isBanned),
        banReason: u.banReason || '',
        emailVerified: u.emailVerified === true,
        twoFactorEnabled: u.twoFactorEnabled === true,
        identityVerified: u.identityVerified === true,
        identityVerificationRequired: u.identityVerificationRequired === true,
        createdAt: u.createdAt || null
      }));

      const { users: enrichedUsers, summary, riskByUserId } = await enrichUsersWithRiskIntel(
        sanitizedUsers,
        { viewerIsSuperAdmin }
      );

      const flaggedUsers = enrichedUsers
        .filter((u) => viewerIsSuperAdmin || !isSuperAdminAccount(u))
        .filter((u) =>
          (u.riskIntelligence?.riskScore || 0) > 0 ||
          (u.riskIntelligence?.flags?.length || 0) > 0 ||
          u.isBanned
        )
        .sort((a, b) => (b.riskIntelligence?.riskScore || 0) - (a.riskIntelligence?.riskScore || 0));

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        summary,
        flaggedUsers,
        riskByUserId
      });
    } catch (error) {
      console.error('[Admin Risk Intel Error]', error.message);
      return res.status(500).json({ error: 'Failed to compute identity risk intelligence.' });
    }
  });

  // GET /api/admin/users/:id/activity
  router.get('/users/:id/activity', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const dossier = await buildUserActivityDossier(req.params.id, { viewerIsSuperAdmin });

      if (dossier?.forbidden) {
        return res.status(403).json({ error: dossier.error || 'Forbidden.' });
      }
      if (!dossier) {
        return res.status(404).json({ error: 'User not found in system.' });
      }

      recordSecurityEvent({
        eventType: 'admin.user_activity_dossier_viewed',
        severity: 'info',
        userId: req.adminUser.id,
        ip: req.ip,
        userAgent: req.get?.('user-agent'),
        details: {
          viewedUserId: dossier.user.id,
          riskScore: dossier.riskIntelligence?.riskScore || 0
        }
      }).catch((auditErr) => {
        console.warn('[Admin Risk Dossier] Audit log failed:', auditErr.message);
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        ...dossier
      });
    } catch (error) {
      console.error('[Admin User Activity Error]', error.message);
      return res.status(500).json({ error: 'Failed to load user activity dossier.' });
    }
  });

  // GET /api/admin/users/:id/abuse-evidence
  router.get('/users/:id/abuse-evidence', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const existingUser = await MasterDB.findUserByIdentifier(req.params.id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found in system.' });
      }
      if (isSuperAdminAccount(existingUser) && !viewerIsSuperAdmin) {
        return res.status(403).json({
          error: 'Forbidden. Super Administrator activity and abuse evidence cannot be accessed.'
        });
      }

      const uid = String(existingUser.id);
      let hold = null;
      let vpsAbuseEvents = [];
      let storeFlags = [];
      let lifecycleAudits = [];
      let accountSecurity = null;
      let droplets = [];
      let stores = [];
      let discordBots = [];
      let discordServers = [];
      let discordWorkspaces = [];
      let serviceSubs = [];
      let whatsappSessions = [];

      if (isPgActive()) {
        const [
          hasHolds,
          hasAbuseEvents,
          hasLifecycleAudits,
          hasSecurityEvents,
          hasLegacySecurityEvents,
          hasStoreModerationFlags,
          hasAccountSecurity,
          hasSystemMedia,
          hasDroplets,
          hasStores,
          hasDiscordBots,
          hasDiscordServers,
          hasDiscordWorkspaces,
          hasPlatformSubs,
          hasServiceSubs,
          hasWhatsapp
        ] = await Promise.all([
          safeTableExists('system_account_service_holds'),
          safeTableExists('system_vps_abuse_events'),
          safeTableExists('system_account_lifecycle_audits'),
          safeTableExists('system_security_events'),
          safeTableExists('security_events'),
          safeTableExists('store_moderation_flags'),
          safeTableExists('system_account_security'),
          safeTableExists('system_media'),
          safeTableExists('cloud_droplets'),
          safeTableExists('system_stores'),
          safeTableExists('discord_bots'),
          safeTableExists('discord_servers'),
          safeTableExists('discord_workspace_services'),
          safeTableExists('platform_service_subscriptions'),
          safeTableExists('service_subscriptions'),
          safeTableExists('whatsapp_auth_state')
        ]);

        const [
          holdRows,
          dropletRows,
          auditRows,
          secEventRows,
          legacySecEventRows,
          storeModFlagRows,
          accountSecRows,
          rejectedMediaRows,
          storeRows,
          botRows,
          discordSrvRows,
          discordWsRows,
          platformSubRows,
          serviceSubRows,
          waRows
        ] = await Promise.all([
          hasHolds
            ? safeRows('SELECT * FROM system_account_service_holds WHERE user_id = $1 LIMIT 1', [uid])
            : [],
          hasDroplets
            ? safeRows(
                `SELECT id, name, status, ipv4, ipv6, node_id, tenant_id, monthly_price,
                        suspended_at, next_billing_at, created_at
                 FROM cloud_droplets
                 WHERE user_id = $1
                 ORDER BY created_at DESC`,
                [uid]
              )
            : [],
          hasLifecycleAudits
            ? safeRows(
                `SELECT id, user_id, action, hold_type, non_refundable, reason, details, created_at
                 FROM system_account_lifecycle_audits
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [uid]
              )
            : [],
          hasSecurityEvents
            ? safeRows(
                `SELECT id, event_type, severity, user_id, remote_ip::text AS remote_ip,
                        user_agent, details, created_at
                 FROM system_security_events
                 WHERE user_id = $1
                   AND (
                     event_type LIKE 'moderation.%'
                     OR event_type ~* '(moderation|nsfw|weapon|adult|prohibited|contraband|store_flag|product_flag|abuse|ban_evasion)'
                     OR details::text ~* '(ADULT_CONTENT|WEAPON|FIREARM|DRUGS|NSFW|PROHIBITED|CONTRABAND|moderation|policy_violation)'
                   )
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [uid]
              )
            : [],
          hasLegacySecurityEvents
            ? safeRows(
                `SELECT id, event_type, severity, user_id, details, created_at
                 FROM security_events
                 WHERE user_id = $1
                   AND (
                     event_type LIKE 'moderation.%'
                     OR event_type ~* '(moderation|nsfw|weapon|adult|prohibited|contraband|store_flag|product_flag|abuse)'
                     OR details::text ~* '(ADULT_CONTENT|WEAPON|FIREARM|DRUGS|NSFW|PROHIBITED|CONTRABAND|moderation|policy_violation)'
                   )
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [uid]
              )
            : [],
          hasStoreModerationFlags
            ? safeRows(
                `SELECT * FROM store_moderation_flags WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
                [uid]
              )
            : [],
          hasAccountSecurity
            ? safeRows(
                `SELECT user_id, strikes, cooldown_until, permanently_disabled, last_reason, updated_at
                 FROM system_account_security
                 WHERE user_id = $1
                 LIMIT 1`,
                [uid]
              )
            : [],
          hasSystemMedia
            ? safeRows(
                `SELECT id, content_type, original_filename, purpose, review_status, created_at
                 FROM system_media
                 WHERE owner_id = $1 AND review_status = 'rejected'
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [uid]
              )
            : [],
          hasStores
            ? safeRows('SELECT id, tiwi_id, store_name, status FROM system_stores WHERE owner_id = $1', [uid])
            : [],
          hasDiscordBots
            ? safeRows('SELECT id, name, status FROM discord_bots WHERE user_id = $1', [uid])
            : [],
          hasDiscordServers
            ? safeRows('SELECT id, name, is_suspended FROM discord_servers WHERE user_id = $1', [uid])
            : [],
          hasDiscordWorkspaces
            ? safeRows('SELECT id, status FROM discord_workspace_services WHERE user_id = $1', [uid])
            : [],
          hasPlatformSubs
            ? safeRows('SELECT id, service_type, status, expires_at FROM platform_service_subscriptions WHERE user_id = $1', [uid])
            : [],
          hasServiceSubs
            ? safeRows('SELECT id, service_type, status, expires_at FROM service_subscriptions WHERE user_id = $1', [uid])
            : [],
          hasWhatsapp
            ? safeRows(
                `SELECT state_key, updated_at
                 FROM whatsapp_auth_state
                 WHERE state_key = $1 OR state_key LIKE $2 OR state_key LIKE $3`,
                [uid, `${uid}:%`, `wa_${uid}%`]
              )
            : []
        ]);

        hold = formatHoldRow(holdRows[0] || null);
        droplets = dropletRows.map((d) => ({
          id: d.id,
          name: d.name || d.id,
          status: d.status || 'active',
          ipv4: d.ipv4 || null,
          ipv6: d.ipv6 || null,
          suspendedAt: toIsoOrNull(d.suspended_at),
          nextBillingAt: toIsoOrNull(d.next_billing_at),
          createdAt: toIsoOrNull(d.created_at)
        }));

        const dropletMap = new Map(droplets.map((d) => [String(d.id), d]));
        const dropletIds = droplets.map((d) => String(d.id));

        if (hasAbuseEvents) {
          const abuseRows = dropletIds.length > 0
            ? await safeRows(
                `SELECT * FROM system_vps_abuse_events
                 WHERE user_id = $1 OR droplet_id = ANY($2::text[])
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [uid, dropletIds]
              )
            : await safeRows(
                `SELECT * FROM system_vps_abuse_events
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [uid]
              );
          vpsAbuseEvents = abuseRows.map((row) => ({
            id: row.id,
            dropletId: row.droplet_id,
            dropletName: dropletMap.get(String(row.droplet_id))?.name || row.droplet_id,
            userId: row.user_id || uid,
            ruleType: row.rule_type,
            severity: row.severity || 'high',
            evidence: parseJsonObject(row.evidence_json),
            actionTaken: row.action_taken || 'alert_and_throttle',
            createdAt: toIsoOrNull(row.created_at)
          }));
        }

        lifecycleAudits = auditRows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          action: row.action,
          holdType: row.hold_type || null,
          nonRefundable: row.non_refundable !== false,
          reason: row.reason || null,
          details: parseJsonObject(row.details),
          createdAt: toIsoOrNull(row.created_at)
        }));

        const secRow = accountSecRows[0] || null;
        if (secRow) {
          accountSecurity = {
            strikes: Number(secRow.strikes || 0),
            cooldownUntil: toIsoOrNull(secRow.cooldown_until),
            permanentlyDisabled: Boolean(secRow.permanently_disabled),
            lastReason: secRow.last_reason || null,
            updatedAt: toIsoOrNull(secRow.updated_at)
          };
        }

        const combinedFlags = [];
        for (const ev of [...secEventRows, ...legacySecEventRows]) {
          const details = parseJsonObject(ev.details);
          combinedFlags.push({
            id: `sec_${ev.id}`,
            source: 'security_event',
            eventType: ev.event_type,
            category: details.category || ev.event_type,
            policyName: details.policyName || 'Platform Safety Policy',
            contentType: details.contentType || 'Content',
            actionTaken: details.actionTaken || (ev.severity === 'critical' ? 'DISABLED' : 'FLAGGED'),
            strikes: details.strikes ?? null,
            severity: ev.severity || 'warning',
            reason: details.reason || details.policyName || ev.event_type,
            remoteIp: ev.remote_ip || null,
            details,
            createdAt: toIsoOrNull(ev.created_at)
          });
        }
        for (const mf of storeModFlagRows) {
          const details = parseJsonObject(mf.details || mf.metadata);
          combinedFlags.push({
            id: `mod_${mf.id}`,
            source: 'store_moderation',
            eventType: mf.flag_type || mf.category || 'store.moderation_flag',
            category: mf.category || mf.flag_type || 'PROHIBITED_ITEM',
            policyName: mf.policy_name || 'Store & Product Safety Policy',
            contentType: mf.content_type || 'Product',
            actionTaken: mf.action_taken || 'BLOCKED',
            strikes: mf.strikes ?? null,
            severity: mf.severity || 'critical',
            reason: mf.reason || details.reason || 'Prohibited storefront item detected',
            remoteIp: null,
            details,
            createdAt: toIsoOrNull(mf.created_at)
          });
        }
        for (const media of rejectedMediaRows) {
          combinedFlags.push({
            id: `media_${media.id}`,
            source: 'media_inspection',
            eventType: 'moderation.media_rejected',
            category: 'NSFW_OR_PROHIBITED_MEDIA',
            policyName: 'Media Content Inspection Policy',
            contentType: media.purpose || media.content_type || 'Image',
            actionTaken: 'REJECTED',
            strikes: null,
            severity: 'warning',
            reason: `Rejected upload (${media.original_filename || media.id}) in ${media.purpose || 'public_catalog'}`,
            remoteIp: null,
            details: { originalFilename: media.original_filename, purpose: media.purpose },
            createdAt: toIsoOrNull(media.created_at)
          });
        }

        const dedupFlags = new Map();
        for (const flag of combinedFlags) {
          if (!dedupFlags.has(flag.id)) dedupFlags.set(flag.id, flag);
        }
        storeFlags = [...dedupFlags.values()].sort(
          (a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime())
        );

        stores = storeRows;
        discordBots = botRows;
        discordServers = discordSrvRows;
        discordWorkspaces = discordWsRows;
        serviceSubs = [...platformSubRows, ...serviceSubRows];
        whatsappSessions = waRows;
      } else {
        hold = await getUserAccountHold(uid).catch(() => null);
        vpsAbuseEvents = await listVpsAbuseEvents({ userId: uid, limit: 100 }).catch(() => []);
      }

      if (stores.length === 0) {
        try {
          const masterData = await MasterDB.getMasterData();
          const dirStores = Array.isArray(masterData?.stores) ? masterData.stores : [];
          stores = dirStores
            .filter(
              (s) =>
                String(s.ownerId || '') === uid ||
                (existingUser.tiwiId && String(s.tiwiId || '') === String(existingUser.tiwiId))
            )
            .map((s) => ({
              id: s.id || s.tiwiId,
              tiwi_id: s.tiwiId,
              store_name: s.storeName || s.name || s.tiwiId,
              status: s.lifecycleStatus || s.status || 'active'
            }));
        } catch {
          // ignore hybrid fallback read failure
        }
      }

      const holdActive = Boolean(hold && hold.holdType && hold.holdType !== 'cleared' && !hold.purgedAt);
      const holdPurged = Boolean(hold?.purgedAt);
      const snap = hold?.snapshot || {};

      const discordSubs = serviceSubs.filter((s) => /discord/i.test(String(s.service_type || '')));
      const whatsappSubs = serviceSubs.filter((s) => /whatsapp|wa/i.test(String(s.service_type || '')));

      const snapshotDiscordCount =
        Object.keys(snap.discordBots || {}).length +
        Object.keys(snap.discordServers || {}).length +
        Object.keys(snap.discordWorkspaceServices || {}).length +
        Object.keys(snap.serviceSubscriptions || {}).filter((k) => /discord/i.test(k)).length;
      const snapshotWhatsappCount = Object.keys(snap.serviceSubscriptions || {}).filter((k) =>
        /whatsapp|wa/i.test(k)
      ).length;

      const serviceStates = {
        vps: {
          label: 'VPS / Cloud Droplets',
          ...summarizeServiceStatus({
            items: droplets,
            snapshotCount: Object.keys(snap.droplets || {}).length,
            holdActive,
            holdPurged,
            pausedChecker: (d) => ['suspended', 'paused', 'terminated'].includes(String(d.status || '').toLowerCase())
          })
        },
        ecommerce: {
          label: 'E-Commerce Stores',
          ...summarizeServiceStatus({
            items: stores,
            snapshotCount: Object.keys(snap.stores || {}).length,
            holdActive,
            holdPurged,
            pausedChecker: (s) => ['suspended', 'paused', 'terminated'].includes(String(s.status || '').toLowerCase())
          })
        },
        discordBot: {
          label: 'Discord Bot',
          ...summarizeServiceStatus({
            items: [
              ...discordBots.map((b) => ({ paused: ['paused', 'suspended', 'terminated'].includes(String(b.status || '').toLowerCase()) })),
              ...discordServers.map((s) => ({ paused: Boolean(s.is_suspended) })),
              ...discordWorkspaces.map((w) => ({ paused: ['paused', 'suspended', 'terminated'].includes(String(w.status || '').toLowerCase()) })),
              ...discordSubs.map((s) => ({ paused: ['paused', 'suspended', 'terminated'].includes(String(s.status || '').toLowerCase()) }))
            ],
            snapshotCount: snapshotDiscordCount,
            holdActive,
            holdPurged,
            pausedChecker: (x) => Boolean(x.paused)
          })
        },
        whatsapp: {
          label: 'WhatsApp Automation',
          ...summarizeServiceStatus({
            items: [
              ...whatsappSubs.map((s) => ({ paused: ['paused', 'suspended', 'terminated'].includes(String(s.status || '').toLowerCase()) })),
              ...whatsappSessions.map(() => ({ paused: holdActive || holdPurged }))
            ],
            snapshotCount: snapshotWhatsappCount,
            holdActive,
            holdPurged,
            pausedChecker: (x) => Boolean(x.paused)
          })
        }
      };

      const { summaryCounts, chartSeries } = buildAbuseEvidenceMetrics({
        hold,
        droplets,
        vpsAbuseEvents,
        storeFlags,
        lifecycleAudits,
        accountSecurity
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        user: {
          id: existingUser.id,
          tiwiId: existingUser.tiwiId || existingUser.storeId || '',
          name: existingUser.name || existingUser.storeName || 'System User',
          email: existingUser.email,
          isBanned: Boolean(existingUser.isBanned),
          banReason: existingUser.banReason || ''
        },
        hold,
        accountSecurity,
        droplets,
        serviceStates,
        vpsAbuseEvents,
        storeFlags,
        lifecycleAudits,
        summaryCounts,
        chartSeries
      });
    } catch (error) {
      console.error('[Admin User Abuse Evidence Error]', error.message);
      return res.status(500).json({ error: 'Failed to load forensic abuse evidence.' });
    }
  });

  // POST /api/admin/users/:id/ban-cluster
  router.post('/users/:id/ban-cluster', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const { id } = req.params;
      const {
        isBanned = true,
        reason = '',
        banLinkedCluster = false,
        blockDeviceSignals = false
      } = req.body || {};

      if (typeof isBanned !== 'boolean') {
        return res.status(400).json({ error: 'isBanned must be a boolean value.' });
      }

      const existingUser = await MasterDB.findUserByIdentifier(id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found in system.' });
      }
      if (isSuperAdminAccount(existingUser)) {
        return res.status(403).json({ error: 'Super Administrator accounts cannot be disabled.' });
      }
      if (existingUser.role === 'admin' && !viewerIsSuperAdmin) {
        return res.status(403).json({ error: 'Only a super administrator can change another administrator account.' });
      }

      const result = await executeClusterBanAction({
        targetUser: existingUser,
        actorEmail: req.adminUser.email,
        actorIp: req.ip,
        isBanned,
        reason,
        banLinkedCluster: Boolean(banLinkedCluster),
        blockDeviceSignals: Boolean(blockDeviceSignals)
      });

      // Dispatch notification emails asynchronously without failing the response
      if (isBanned) {
        for (const affected of result.affectedUsers) {
          if (!affected.email) continue;
          try {
            const restoreSession = RestoreSessions.createRestoreSession({
              email: affected.email,
              userId: affected.id,
              reason: result.reason
            });
            sendAccountDisabledEmail({
              to: affected.email,
              name: affected.name || 'Tiwlo User',
              reason: result.reason,
              restoreUrl: restoreSession.url
            }).catch((err) => console.error('[Cluster Ban Email Error]', err.message));
          } catch (err) {
            console.warn('[Cluster Ban RestoreSession Error]', err.message);
          }
        }
      } else if (existingUser.email) {
        try {
          const checkupSession = RestoreSessions.createSecurityCheckupSession({
            email: existingUser.email,
            userId: existingUser.id
          });
          sendAccountRestoredEmail({
            to: existingUser.email,
            name: existingUser.name || existingUser.storeName || 'Tiwlo User',
            checkupUrl: checkupSession.url
          }).catch((err) => console.error('[Cluster Restore Email Error]', err.message));
        } catch (err) {
          console.warn('[Cluster Restore CheckupSession Error]', err.message);
        }
      }

      const affectedCount = result.affectedUsers.length;
      const message = isBanned
        ? (affectedCount > 1
          ? `Disabled ${affectedCount} accounts in cluster${result.blockedSignalsCount ? ` and blocked ${result.blockedSignalsCount} device/network signals` : ''}.`
          : `User ${existingUser.name || existingUser.email} has been disabled${result.blockedSignalsCount ? ` and ${result.blockedSignalsCount} device/network signals were blocked` : ''}.`)
        : `User ${existingUser.name || existingUser.email} has been restored successfully.`;

      return res.json({
        success: true,
        message,
        user: result.affectedUsers[0] || null,
        ...result
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Admin Cluster Ban Error]', error.message);
      return res.status(status).json({ error: status === 500 ? 'Failed to execute cluster ban action.' : error.message });
    }
  });

  return router;
}

export default createAdminRiskRouter();
