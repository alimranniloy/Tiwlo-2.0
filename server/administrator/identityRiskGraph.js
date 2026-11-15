import { isPgActive, queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { hashAbuseSignal, unblockUserAndSignals } from '../security/freeTierAbuseGuard.js';
import { normalizePhoneIdentifier, signupEmailKey } from '../security/signupIdentity.js';

const SUPER_ADMIN_EMAIL = 'tiwloltd@gmail.com';

export function isSuperAdminAccount(user) {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'super_admin';
}

const ANCHOR_META = {
  fingerprint: {
    label: 'Shared Device Fingerprint',
    shortLabel: 'Same Device',
    highConfidence: true,
    isNetwork: false
  },
  device_token: {
    label: 'Shared Device Token',
    shortLabel: 'Device Token',
    highConfidence: true,
    isNetwork: false
  },
  browser_cookie: {
    label: 'Same Persistent Browser',
    shortLabel: 'Same Browser',
    highConfidence: true,
    isNetwork: false
  },
  identity: {
    label: 'Shared Hardware+Browser Identity',
    shortLabel: 'Hardware+Browser',
    highConfidence: true,
    isNetwork: false
  },
  contact: {
    label: 'Alias/Duplicate Contact',
    shortLabel: 'Duplicate Contact',
    highConfidence: true,
    isNetwork: false
  },
  ip: {
    label: 'Same IP Address',
    shortLabel: 'Same IP',
    highConfidence: false,
    isNetwork: true
  },
  subnet: {
    label: 'Same /24 Network Subnet',
    shortLabel: 'Same Subnet',
    highConfidence: false,
    isNetwork: true
  }
};

const ALERT_EVENT_PATTERN = /free_tier|free_store|signup_rate_limit|ban_evasion|blocked_device|duplicate_account|duplicate_browser|promo_abuse|account_disabled|multi_account/i;
const FREE_TIER_ABUSE_PATTERN = /free_tier|free_store|promo_abuse|signup_rate_limit|ban_evasion|blocked_device|multi_account/i;

function emptyRiskIntelligence(extra = {}) {
  return {
    riskScore: 0,
    riskLevel: 'low',
    flags: [],
    matchedSignals: [],
    linkedAccounts: [],
    deviceCount: 0,
    lastIp: null,
    lastLocation: null,
    securityEventCount: 0,
    ...extra
  };
}

function cleanHashValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.toLowerCase() === 'unknown') return null;
  return normalized;
}

function normalizeUserRecord(u) {
  const id = String(u?.id || '').trim();
  const email = u?.email ? String(u.email).trim() : '';
  const phone = u?.phone ? String(u.phone).trim() : '';
  return {
    id,
    tiwiId: u?.tiwiId ?? u?.tiwi_id ?? u?.storeId ?? '',
    name: u?.name ?? u?.storeName ?? u?.store_name ?? 'System User',
    email,
    phone,
    role: String(u?.role || 'owner'),
    isBanned: Boolean(u?.isBanned ?? u?.is_banned),
    banReason: u?.banReason ?? u?.ban_reason ?? '',
    createdAt: u?.createdAt ?? u?.created_at ?? null,
    signupEmailKey: u?.signupEmailKey ?? u?.signup_email_key ?? signupEmailKey(email),
    signupPhoneKey: u?.signupPhoneKey ?? u?.signup_phone_key ?? normalizePhoneIdentifier(phone)
  };
}

function getField(row, ...keys) {
  if (!row || typeof row !== 'object') return null;
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

function isBlockedEntryActive(entry, nowMs) {
  if (!entry) return false;
  if (entry.is_active === false || entry.isActive === false) return false;
  const expiresAt = entry.expires_at ?? entry.expiresAt;
  if (expiresAt) {
    const expMs = new Date(expiresAt).getTime();
    if (Number.isFinite(expMs) && expMs <= nowMs) return false;
  }
  return true;
}

function resolveRiskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function toTimestamp(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Pure deterministic Multi-Account & Ban-Evasion Clustering Engine.
 * Correlates users across device fingerprints, device tokens, persistent signup browsers,
 * hardware+browser identities, IP/subnet hashes, and canonical email/phone aliases.
 */
export function computeRiskClusters({
  users = [],
  deviceIdentities = [],
  signupBrowsers = [],
  freeStoreClaims = [],
  promoClaims = [],
  topupSignals = [],
  blockedIdentities = [],
  loginLocations = [],
  securityEvents = [],
  sessions = [],
  viewerIsSuperAdmin = true
} = {}) {
  const nowMs = Date.now();
  const normalizedUsers = (Array.isArray(users) ? users : [])
    .map(normalizeUserRecord)
    .filter((u) => Boolean(u.id));

  const protectedIds = new Set(
    normalizedUsers.filter((u) => isSuperAdminAccount(u)).map((u) => u.id)
  );
  const visibleUsers = viewerIsSuperAdmin
    ? normalizedUsers
    : normalizedUsers.filter((u) => !protectedIds.has(u.id));

  const userById = new Map(visibleUsers.map((u) => [u.id, u]));
  const isVisibleUserId = (uid) => Boolean(uid && userById.has(String(uid)));

  // Map<anchorKey, { type, value, userIds: Set<string> }>
  const anchorBuckets = new Map();
  // Map<userId, Set<string>> (for blocked identity matching: `${type}:${hash}`)
  const userSignalsById = new Map(visibleUsers.map((u) => [u.id, new Set()]));
  // Map<userId, Set<string>> (unique device hashes per user)
  const deviceSetByUserId = new Map(visibleUsers.map((u) => [u.id, new Set()]));

  const addAnchor = (userId, type, rawValue) => {
    const uid = userId ? String(userId).trim() : '';
    const cleaned = cleanHashValue(rawValue);
    if (!uid || !cleaned || !isVisibleUserId(uid) || !ANCHOR_META[type]) return;
    const bucketKey = `${type}:${cleaned}`;
    let bucket = anchorBuckets.get(bucketKey);
    if (!bucket) {
      bucket = { type, value: cleaned, userIds: new Set() };
      anchorBuckets.set(bucketKey, bucket);
    }
    bucket.userIds.add(uid);
    userSignalsById.get(uid)?.add(bucketKey);
  };

  for (const u of visibleUsers) {
    if (u.signupEmailKey) addAnchor(u.id, 'contact', `email:${u.signupEmailKey}`);
    if (u.signupPhoneKey) addAnchor(u.id, 'contact', `phone:${u.signupPhoneKey}`);
  }

  for (const rawUser of Array.isArray(users) ? users : []) {
    const uid = getField(rawUser, 'id');
    if (!isVisibleUserId(uid)) continue;
    addAnchor(uid, 'fingerprint', getField(rawUser, 'device_fingerprint_hash', 'deviceFingerprintHash', 'device_hash', 'deviceHash'));
    addAnchor(uid, 'device_token', getField(rawUser, 'device_token_hash', 'deviceTokenHash'));
    addAnchor(uid, 'browser_cookie', getField(rawUser, 'browser_cookie_hash', 'browserCookieHash'));
    addAnchor(uid, 'identity', getField(rawUser, 'identity_hash', 'identityHash'));
    addAnchor(uid, 'ip', getField(rawUser, 'ip_hash', 'ipHash'));
    addAnchor(uid, 'subnet', getField(rawUser, 'subnet_hash', 'subnetHash'));
  }

  for (const row of Array.isArray(deviceIdentities) ? deviceIdentities : []) {
    const uid = getField(row, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) continue;
    const deviceHash = cleanHashValue(getField(row, 'device_hash', 'deviceHash', 'device_fingerprint_hash', 'deviceFingerprintHash'));
    const identityHash = cleanHashValue(getField(row, 'identity_hash', 'identityHash'));
    if (deviceHash) {
      addAnchor(uid, 'fingerprint', deviceHash);
      deviceSetByUserId.get(uid)?.add(deviceHash);
    } else if (identityHash) {
      deviceSetByUserId.get(uid)?.add(identityHash);
    }
    addAnchor(uid, 'identity', identityHash);
    addAnchor(uid, 'ip', getField(row, 'ip_hash', 'ipHash'));
    addAnchor(uid, 'subnet', getField(row, 'subnet_hash', 'subnetHash'));
  }

  for (const row of Array.isArray(signupBrowsers) ? signupBrowsers : []) {
    const uid = getField(row, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) continue;
    addAnchor(uid, 'browser_cookie', getField(row, 'key_hash', 'keyHash', 'browser_cookie_hash', 'browserCookieHash'));
  }

  const recordSignalRow = (row, trackDevice = true) => {
    const uid = getField(row, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) return;
    const fp = cleanHashValue(getField(row, 'device_fingerprint_hash', 'deviceFingerprintHash', 'device_hash', 'deviceHash'));
    const token = cleanHashValue(getField(row, 'device_token_hash', 'deviceTokenHash'));
    const cookie = cleanHashValue(getField(row, 'browser_cookie_hash', 'browserCookieHash'));
    addAnchor(uid, 'fingerprint', fp);
    addAnchor(uid, 'device_token', token);
    addAnchor(uid, 'browser_cookie', cookie);
    addAnchor(uid, 'identity', getField(row, 'identity_hash', 'identityHash'));
    addAnchor(uid, 'ip', getField(row, 'ip_hash', 'ipHash'));
    addAnchor(uid, 'subnet', getField(row, 'subnet_hash', 'subnetHash'));
    if (trackDevice && (fp || token)) {
      deviceSetByUserId.get(uid)?.add(fp || token);
    }
  };

  for (const row of Array.isArray(freeStoreClaims) ? freeStoreClaims : []) {
    if (String(row?.status || 'active').toLowerCase() === 'deleted') continue;
    recordSignalRow(row, true);
  }

  for (const row of Array.isArray(promoClaims) ? promoClaims : []) {
    recordSignalRow(row, true);
  }

  for (const row of Array.isArray(topupSignals) ? topupSignals : []) {
    recordSignalRow(row, true);
  }

  for (const row of Array.isArray(sessions) ? sessions : []) {
    const uid = getField(row, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) continue;
    const fp = cleanHashValue(getField(row, 'device_fingerprint', 'deviceFingerprint'));
    if (fp) {
      addAnchor(uid, 'fingerprint', fp);
      deviceSetByUserId.get(uid)?.add(fp);
    }
  }

  // Blocked signals indexing
  const activeBlocks = (Array.isArray(blockedIdentities) ? blockedIdentities : [])
    .filter((b) => isBlockedEntryActive(b, nowMs))
    .filter((b) => {
      const sourceUid = getField(b, 'source_user_id', 'sourceUserId');
      return !sourceUid || viewerIsSuperAdmin || !protectedIds.has(String(sourceUid));
    });

  const blockedUsersBySource = new Set();
  const blockedSignalKeys = new Set();
  for (const b of activeBlocks) {
    const sourceUid = getField(b, 'source_user_id', 'sourceUserId');
    if (sourceUid && isVisibleUserId(sourceUid)) {
      blockedUsersBySource.add(String(sourceUid));
    }
    const signalType = String(getField(b, 'signal_type', 'signalType') || '').trim().toLowerCase();
    const signalHash = cleanHashValue(getField(b, 'signal_hash', 'signalHash'));
    if (signalType && signalHash) {
      blockedSignalKeys.add(`${signalType}:${signalHash}`);
    }
  }

  // Login locations per user (latest)
  const latestLocationByUserId = new Map();
  for (const loc of Array.isArray(loginLocations) ? loginLocations : []) {
    const uid = getField(loc, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) continue;
    const ts = toTimestamp(getField(loc, 'captured_at', 'capturedAt'));
    const prev = latestLocationByUserId.get(uid);
    if (!prev || ts >= prev.ts) {
      const formatted = getField(loc, 'formatted_address', 'formattedAddress') || getField(loc, 'area') || null;
      latestLocationByUserId.set(uid, {
        ts,
        text: formatted ? String(formatted) : null,
        details: {
          formattedAddress: getField(loc, 'formatted_address', 'formattedAddress'),
          area: getField(loc, 'area'),
          source: getField(loc, 'location_source', 'locationSource'),
          latitude: loc.latitude ?? null,
          longitude: loc.longitude ?? null,
          capturedAt: getField(loc, 'captured_at', 'capturedAt')
        }
      });
    }
  }

  // Security events & latest IP per user
  const eventsByUserId = new Map();
  const lastIpByUserId = new Map();

  for (const s of Array.isArray(sessions) ? sessions : []) {
    const uid = getField(s, 'user_id', 'userId');
    const ip = getField(s, 'ip');
    if (!isVisibleUserId(uid) || !ip) continue;
    const ts = toTimestamp(getField(s, 'created_at', 'createdAt'));
    const prev = lastIpByUserId.get(uid);
    if (!prev || ts >= prev.ts) {
      lastIpByUserId.set(uid, { ip: String(ip), ts });
    }
  }

  for (const ev of Array.isArray(securityEvents) ? securityEvents : []) {
    const uid = getField(ev, 'user_id', 'userId');
    if (!isVisibleUserId(uid)) continue;
    const list = eventsByUserId.get(uid) || [];
    list.push(ev);
    eventsByUserId.set(uid, list);
    const ip = getField(ev, 'remote_ip', 'remoteIp', 'ip');
    if (ip) {
      const ts = toTimestamp(getField(ev, 'created_at', 'createdAt'));
      const prev = lastIpByUserId.get(uid);
      if (!prev || ts >= prev.ts) {
        lastIpByUserId.set(uid, { ip: String(ip), ts });
      }
    }
  }

  // Build adjacency edges between visible users: Map<uid, Map<siblingId, { labels: Set, types: Set }>>
  const adjacency = new Map(visibleUsers.map((u) => [u.id, new Map()]));
  for (const bucket of anchorBuckets.values()) {
    if (bucket.userIds.size < 2) continue;
    const members = [...bucket.userIds];
    const meta = ANCHOR_META[bucket.type];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const recordEdge = (from, to) => {
          const map = adjacency.get(from);
          let edge = map.get(to);
          if (!edge) {
            edge = { labels: new Set(), types: new Set() };
            map.set(to, edge);
          }
          edge.labels.add(meta.label);
          edge.types.add(bucket.type);
        };
        recordEdge(a, b);
        recordEdge(b, a);
      }
    }
  }

  const riskByUserId = {};

  for (const u of visibleUsers) {
    const edgeMap = adjacency.get(u.id) || new Map();
    const matchedSignalsSet = new Set();
    const linkedAccounts = [];

    let highConfidenceBannedLinks = 0;
    let networkOnlyBannedLinks = 0;
    let highConfidenceActiveLinks = 0;
    let sharedIpSiblingCount = 0;
    let hasHardwareOrCookieLink = false;
    let hasNetworkLink = false;
    let hasBannedSibling = false;
    const bannedHighConfTypes = new Set();

    for (const [siblingId, edge] of edgeMap.entries()) {
      const sibling = userById.get(siblingId);
      if (!sibling) continue;
      const edgeSignals = [...edge.labels];
      const edgeTypes = [...edge.types];
      edgeSignals.forEach((lbl) => matchedSignalsSet.add(lbl));

      const edgeHasHighConf = edgeTypes.some((t) => ANCHOR_META[t]?.highConfidence);
      const edgeHasNetwork = edgeTypes.some((t) => ANCHOR_META[t]?.isNetwork);

      if (edgeHasHighConf) hasHardwareOrCookieLink = true;
      if (edgeHasNetwork) {
        hasNetworkLink = true;
        sharedIpSiblingCount += 1;
      }

      if (sibling.isBanned) {
        hasBannedSibling = true;
        if (edgeHasHighConf) {
          highConfidenceBannedLinks += 1;
          edgeTypes.filter((t) => ANCHOR_META[t]?.highConfidence).forEach((t) => bannedHighConfTypes.add(t));
        } else {
          networkOnlyBannedLinks += 1;
        }
      } else if (edgeHasHighConf) {
        highConfidenceActiveLinks += 1;
      }

      linkedAccounts.push({
        id: sibling.id,
        tiwiId: sibling.tiwiId,
        name: sibling.name,
        email: sibling.email,
        role: sibling.role,
        isBanned: sibling.isBanned,
        banReason: sibling.banReason,
        matchedSignals: edgeSignals,
        highConfidence: edgeHasHighConf,
        createdAt: sibling.createdAt
      });
    }

    // Sort linked accounts: banned first, then high-confidence, then newest
    linkedAccounts.sort((a, b) => {
      if (a.isBanned !== b.isBanned) return a.isBanned ? -1 : 1;
      if (a.highConfidence !== b.highConfidence) return a.highConfidence ? -1 : 1;
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    });

    // Check blocked signal matches for this user
    const userSignalSet = userSignalsById.get(u.id) || new Set();
    const userHash = hashAbuseSignal('user', u.id);
    const hasBlockedMatch =
      blockedUsersBySource.has(u.id) ||
      (userHash && blockedSignalKeys.has(`user:${userHash}`)) ||
      [...userSignalSet].some((sigKey) => blockedSignalKeys.has(sigKey));

    // Security events evaluation
    const userEvents = eventsByUserId.get(u.id) || [];
    const alertEvents = userEvents.filter((ev) => {
      const evType = String(getField(ev, 'event_type', 'eventType') || '');
      const severity = String(ev?.severity || '').toLowerCase();
      return severity === 'critical' || ALERT_EVENT_PATTERN.test(evType);
    });
    const hasFreeTierAbuseEvent = userEvents.some((ev) => {
      const evType = String(getField(ev, 'event_type', 'eventType') || '');
      return FREE_TIER_ABUSE_PATTERN.test(evType);
    });

    // Risk score calculation (0 - 100)
    let score = 0;

    // 1. Links to banned siblings
    if (highConfidenceBannedLinks > 0) {
      score += 55;
      if (bannedHighConfTypes.size > 1 || highConfidenceBannedLinks > 1) {
        score += 10;
      }
      // Sibling presence bonus on top of banned link
      score += Math.min(20, highConfidenceBannedLinks * 15);
    } else if (networkOnlyBannedLinks > 0) {
      score += 35;
    }

    // 2. Active sibling links via hardware/cookie/identity/contact
    if (highConfidenceActiveLinks > 0) {
      score += Math.min(40, highConfidenceActiveLinks * 20);
      if (hasNetworkLink) {
        score += 10;
      }
    } else if (sharedIpSiblingCount > 0 && highConfidenceBannedLinks === 0 && networkOnlyBannedLinks === 0) {
      // Network-only correlation without hardware/cookie/banned link stays low unless many accounts share IP
      score += Math.min(20, sharedIpSiblingCount >= 3 ? 20 : sharedIpSiblingCount * 10);
    }

    // 3. Blocked signal match
    if (hasBlockedMatch) {
      score += 25;
      matchedSignalsSet.add('Blocked Device/Network Signal');
    }

    // 4. Security alert events
    if (alertEvents.length > 0) {
      const distinctAlertTypes = new Set(
        alertEvents.map((ev) => String(getField(ev, 'event_type', 'eventType') || 'alert'))
      );
      score += Math.min(30, distinctAlertTypes.size * 15);
    }

    const riskScore = Math.min(100, Math.max(0, Math.round(score)));
    const riskLevel = resolveRiskLevel(riskScore);

    const flags = [];
    if (hasBannedSibling) flags.push('BAN_EVASION_RISK');
    if (hasHardwareOrCookieLink) flags.push('MULTI_ACCOUNT_RING');
    if (hasNetworkLink) flags.push('SHARED_IP_CLUSTER');
    if (hasFreeTierAbuseEvent) flags.push('FREE_TIER_ABUSE_SIGNAL');
    if (hasBlockedMatch) flags.push('BLOCKED_SIGNAL_MATCH');

    const latestLoc = latestLocationByUserId.get(u.id);
    const latestIp = lastIpByUserId.get(u.id);

    riskByUserId[u.id] = {
      riskScore,
      riskLevel,
      flags,
      matchedSignals: [...matchedSignalsSet],
      linkedAccounts,
      deviceCount: deviceSetByUserId.get(u.id)?.size || 0,
      lastIp: latestIp?.ip || null,
      lastLocation: latestLoc?.text || null,
      lastLocationDetails: latestLoc?.details || null,
      securityEventCount: userEvents.length
    };
  }

  // Redact super_admin rows when viewer is not super_admin
  const enrichedUsers = (Array.isArray(users) ? users : []).map((rawUser) => {
    const uid = String(rawUser?.id || '').trim();
    const isSuper = isSuperAdminAccount(rawUser);
    if (isSuper && !viewerIsSuperAdmin) {
      const protectedIntel = emptyRiskIntelligence({ protectedAccount: true });
      riskByUserId[uid] = protectedIntel;
      return { ...rawUser, riskIntelligence: protectedIntel };
    }
    const intel = riskByUserId[uid] || emptyRiskIntelligence();
    return { ...rawUser, riskIntelligence: intel };
  });

  // Build connected component clusters (size >= 2)
  const visited = new Set();
  const clusters = [];
  for (const u of visibleUsers) {
    if (visited.has(u.id)) continue;
    const edgeMap = adjacency.get(u.id);
    if (!edgeMap || edgeMap.size === 0) {
      visited.add(u.id);
      continue;
    }
    const queue = [u.id];
    const componentIds = [];
    visited.add(u.id);
    while (queue.length > 0) {
      const curr = queue.shift();
      componentIds.push(curr);
      for (const nextId of (adjacency.get(curr)?.keys() || [])) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }
    if (componentIds.length >= 2) {
      const members = componentIds.map((id) => userById.get(id)).filter(Boolean);
      const maxRiskScore = Math.max(...componentIds.map((id) => riskByUserId[id]?.riskScore || 0));
      const hasBannedMember = members.some((m) => m.isBanned);
      const signals = [...new Set(componentIds.flatMap((id) => riskByUserId[id]?.matchedSignals || []))];
      clusters.push({
        clusterId: `cluster_${componentIds.slice().sort()[0]}`,
        size: members.length,
        maxRiskScore,
        hasBannedMember,
        signals,
        memberIds: componentIds
      });
    }
  }
  clusters.sort((a, b) => b.maxRiskScore - a.maxRiskScore || b.size - a.size);

  const visibleCountable = enrichedUsers.filter((u) => viewerIsSuperAdmin || !isSuperAdminAccount(u));
  const summary = {
    totalUsers: enrichedUsers.length,
    banEvasionCount: visibleCountable.filter((u) => u.riskIntelligence?.flags?.includes('BAN_EVASION_RISK')).length,
    multiAccountRingCount: visibleCountable.filter((u) => u.riskIntelligence?.flags?.includes('MULTI_ACCOUNT_RING')).length,
    highRiskCount: visibleCountable.filter((u) => (u.riskIntelligence?.riskScore || 0) >= 50).length,
    criticalRiskCount: visibleCountable.filter((u) => (u.riskIntelligence?.riskScore || 0) >= 75).length,
    bannedCount: visibleCountable.filter((u) => Boolean(u.isBanned ?? u.is_banned)).length,
    blockedSignalsCount: activeBlocks.length
  };

  return {
    users: enrichedUsers,
    riskByUserId,
    clusters,
    summary
  };
}

async function safeQueryRows(sql, params = []) {
  try {
    const res = await queryPg(sql, params);
    return Array.isArray(res?.rows) ? res.rows : [];
  } catch (err) {
    console.warn('[IdentityRiskGraph] Optional query skipped:', err.message);
    return [];
  }
}

async function loadGraphDataFromPg() {
  const [
    pgUsers,
    deviceIdentities,
    signupBrowsers,
    freeStoreClaims,
    promoClaims,
    topupSignals,
    blockedIdentities,
    loginLocations,
    securityEvents,
    sessions
  ] = await Promise.all([
    safeQueryRows(
      `SELECT id, tiwi_id, name, store_name, email, phone, role, plan_id, plan_name,
              avatar, is_banned, ban_reason, email_verified, two_factor_enabled,
              identity_verified, identity_verification_required, created_at, updated_at
       FROM system_users`
    ),
    safeQueryRows(
      `SELECT user_id, identity_hash, device_hash, ip_hash, user_agent_hash,
              client_hints_hash, platform_class, first_seen_at, last_seen_at, login_count
       FROM system_user_device_identities`
    ),
    safeQueryRows(
      `SELECT key_hash, user_id, created_at FROM system_signup_browsers`
    ),
    safeQueryRows(
      `SELECT user_id, store_id, plan_id, device_fingerprint_hash, device_token_hash,
              browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, platform_class, status, created_at
       FROM system_free_store_claims`
    ),
    safeQueryRows(
      `SELECT user_id, claim_type, promo_code_id, promo_code, amount_usd,
              device_fingerprint_hash, device_token_hash, browser_cookie_hash,
              ip_hash, subnet_hash, status, created_at
       FROM system_promo_claims`
    ),
    safeQueryRows(
      `SELECT id, user_id, provider, mode, amount, currency, status,
              device_fingerprint_hash, device_token_hash, browser_cookie_hash,
              ip_hash, subnet_hash, created_at, paid_at
       FROM cloud_credit_topups`
    ),
    safeQueryRows(
      `SELECT id, signal_type, signal_hash, reason, source_user_id, strikes,
              is_active, expires_at, created_at, updated_at
       FROM system_blocked_identities
       WHERE is_active = TRUE`
    ),
    safeQueryRows(
      `SELECT user_id, location_source, latitude, longitude, accuracy_meters,
              formatted_address, area, postal_code, plus_code, captured_at
       FROM system_user_login_locations
       ORDER BY captured_at DESC
       LIMIT 2000`
    ),
    safeQueryRows(
      `SELECT id, event_type, severity, user_id, remote_ip::text AS remote_ip,
              user_agent, details, created_at
       FROM system_security_events
       ORDER BY id DESC
       LIMIT 5000`
    ),
    safeQueryRows(
      `SELECT token, user_id, ip, user_agent, device_fingerprint, expires_at, created_at
       FROM system_sessions
       WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP`
    )
  ]);

  return {
    pgUsers,
    deviceIdentities,
    signupBrowsers,
    freeStoreClaims,
    promoClaims,
    topupSignals,
    blockedIdentities,
    loginLocations,
    securityEvents,
    sessions
  };
}

/**
 * Enrich user records with PostgreSQL-backed Multi-Account & Ban-Evasion intelligence.
 * Gracefully degrades to clean low-risk records when PostgreSQL is inactive.
 * Strictly isolates super_admin activity when viewerIsSuperAdmin is false.
 */
export async function enrichUsersWithRiskIntel(users = null, { viewerIsSuperAdmin = false } = {}) {
  const inputList = Array.isArray(users) ? users : null;

  if (!isPgActive()) {
    const baseUsers = inputList || [];
    return computeRiskClusters({
      users: baseUsers,
      viewerIsSuperAdmin
    });
  }

  const graphData = await loadGraphDataFromPg();
  const pgUsersById = new Map(graphData.pgUsers.map((u) => [String(u.id), u]));

  // Always include the full system_users graph so siblings outside a filtered page are still correlated
  const mergedGraphUsers = [...graphData.pgUsers];
  if (inputList) {
    for (const u of inputList) {
      const uid = String(u?.id || '').trim();
      if (uid && !pgUsersById.has(uid)) {
        mergedGraphUsers.push(u);
      }
    }
  }

  const clusterResult = computeRiskClusters({
    users: mergedGraphUsers,
    deviceIdentities: graphData.deviceIdentities,
    signupBrowsers: graphData.signupBrowsers,
    freeStoreClaims: graphData.freeStoreClaims,
    promoClaims: graphData.promoClaims,
    topupSignals: graphData.topupSignals,
    blockedIdentities: graphData.blockedIdentities,
    loginLocations: graphData.loginLocations,
    securityEvents: graphData.securityEvents,
    sessions: graphData.sessions,
    viewerIsSuperAdmin
  });

  const targetList = inputList || graphData.pgUsers.map((r) => ({
    id: r.id,
    tiwiId: r.tiwi_id || '',
    name: r.name || r.store_name || 'System User',
    email: r.email,
    role: r.role || 'owner',
    planId: r.plan_id || 'free',
    planName: r.plan_name || r.plan_id || 'Free Starter',
    avatar: r.avatar && !String(r.avatar).includes('unsplash.com') ? r.avatar : '/tiwlo-icon.png',
    isBanned: r.is_banned === true,
    banReason: r.ban_reason || '',
    emailVerified: r.email_verified === true,
    twoFactorEnabled: r.two_factor_enabled === true,
    identityVerified: r.identity_verified === true,
    identityVerificationRequired: r.identity_verification_required === true,
    createdAt: r.created_at || null
  }));

  const enriched = targetList.map((u) => {
    const uid = String(u?.id || '').trim();
    const isSuper = isSuperAdminAccount(u);
    if (isSuper && !viewerIsSuperAdmin) {
      return {
        ...u,
        riskIntelligence: emptyRiskIntelligence({ protectedAccount: true })
      };
    }
    return {
      ...u,
      riskIntelligence: clusterResult.riskByUserId[uid] || emptyRiskIntelligence()
    };
  });

  return {
    users: enriched,
    riskByUserId: clusterResult.riskByUserId,
    clusters: clusterResult.clusters,
    summary: clusterResult.summary
  };
}

/**
 * Build a complete Meta Trust & Safety inspection dossier for a single user.
 * Enforces Super Admin isolation: non-super-admins receive { forbidden: true }.
 */
export async function buildUserActivityDossier(userId, { viewerIsSuperAdmin = false } = {}) {
  const identifier = String(userId || '').trim();
  if (!identifier) return null;
  if (!isPgActive()) return null;

  const userRows = await safeQueryRows(
    `SELECT id, tiwi_id, name, store_name, email, phone, role, plan_id, plan_name,
            avatar, is_banned, ban_reason, email_verified, two_factor_enabled,
            identity_verified, identity_verification_required, address_verified_at,
            address_verified_location, city, country, account_type, business_name,
            created_at, updated_at
     FROM system_users
     WHERE id::text = $1 OR tiwi_id = $1 OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );

  const row = userRows[0];
  if (!row) return null;

  if (isSuperAdminAccount(row) && !viewerIsSuperAdmin) {
    return {
      forbidden: true,
      error: 'Forbidden. Super Administrator activity and login intelligence cannot be accessed.'
    };
  }

  const uid = String(row.id);
  const graphData = await loadGraphDataFromPg();
  const clusterResult = computeRiskClusters({
    users: graphData.pgUsers,
    deviceIdentities: graphData.deviceIdentities,
    signupBrowsers: graphData.signupBrowsers,
    freeStoreClaims: graphData.freeStoreClaims,
    promoClaims: graphData.promoClaims,
    topupSignals: graphData.topupSignals,
    blockedIdentities: graphData.blockedIdentities,
    loginLocations: graphData.loginLocations,
    securityEvents: graphData.securityEvents,
    sessions: graphData.sessions,
    viewerIsSuperAdmin
  });

  const [
    userSecurityEvents,
    userLoginLocations,
    userSessions,
    userFreeStoreClaims,
    userPromoClaims,
    userTopups,
    userDeviceIdentities,
    userBlockedSignals
  ] = await Promise.all([
    safeQueryRows(
      `SELECT id, event_type, severity, user_id, remote_ip::text AS remote_ip, user_agent, details, created_at
       FROM system_security_events
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [uid]
    ),
    safeQueryRows(
      `WITH all_locations AS (
         SELECT user_id, location_source, latitude, longitude, accuracy_meters,
                formatted_address, area, postal_code, plus_code, captured_at, id
         FROM system_user_login_locations
         WHERE user_id = $1
         UNION ALL
         SELECT id AS user_id, 'gps'::varchar(8) AS location_source,
                (address_verified_location->>'latitude')::double precision AS latitude,
                (address_verified_location->>'longitude')::double precision AS longitude,
                (address_verified_location->>'accuracyMeters')::double precision AS accuracy_meters,
                address_verified_location->>'formattedAddress' AS formatted_address,
                address_verified_location->>'area' AS area,
                address_verified_location->>'postalCode' AS postal_code,
                address_verified_location->>'plusCode' AS plus_code,
                address_verified_at AS captured_at, 0::bigint AS id
         FROM system_users
         WHERE id = $1 AND address_verified_at IS NOT NULL AND address_verified_location IS NOT NULL
       )
       SELECT location_source, latitude, longitude, accuracy_meters,
              formatted_address, area, postal_code, plus_code, captured_at
       FROM all_locations
       ORDER BY captured_at DESC, id DESC
       LIMIT 25`,
      [uid]
    ),
    safeQueryRows(
      `SELECT token, ip, user_agent, device_fingerprint, expires_at, created_at
       FROM system_sessions
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    ),
    safeQueryRows(
      `SELECT id, store_id, plan_id, platform_class, status, created_at
       FROM system_free_store_claims
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    ),
    safeQueryRows(
      `SELECT id, claim_type, promo_code_id, promo_code, amount_usd, validity_days,
              expires_at, status, created_at
       FROM system_promo_claims
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    ),
    safeQueryRows(
      `SELECT id, provider, mode, amount, currency, status, transaction_id,
              created_at, paid_at
       FROM cloud_credit_topups
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    ),
    safeQueryRows(
      `SELECT id, platform_class, login_count, first_seen_at, last_seen_at,
              LEFT(device_hash, 12) AS device_preview,
              LEFT(ip_hash, 12) AS ip_preview
       FROM system_user_device_identities
       WHERE user_id = $1
       ORDER BY last_seen_at DESC
       LIMIT 50`,
      [uid]
    ),
    safeQueryRows(
      `SELECT id, signal_type, reason, strikes, is_active, expires_at, created_at, updated_at
       FROM system_blocked_identities
       WHERE source_user_id = $1 AND is_active = TRUE
       ORDER BY updated_at DESC
       LIMIT 25`,
      [uid]
    )
  ]);

  const riskIntelligence = clusterResult.riskByUserId[uid] || emptyRiskIntelligence();

  const sanitizedSessions = userSessions.map((s) => ({
    sessionPreview: s.token ? `${String(s.token).slice(0, 8)}…` : 'session',
    ip: s.ip || null,
    userAgent: s.user_agent || null,
    deviceFingerprintPreview: s.device_fingerprint ? `${String(s.device_fingerprint).slice(0, 12)}…` : null,
    expiresAt: s.expires_at || null,
    createdAt: s.created_at || null
  }));

  const user = {
    id: row.id,
    tiwiId: row.tiwi_id || '',
    name: row.name || row.store_name || 'System User',
    email: row.email,
    phone: row.phone || null,
    role: row.role || 'owner',
    planId: row.plan_id || 'free',
    planName: row.plan_name || row.plan_id || 'Free Starter',
    avatar: row.avatar && !String(row.avatar).includes('unsplash.com') ? row.avatar : '/tiwlo-icon.png',
    isBanned: row.is_banned === true,
    banReason: row.ban_reason || '',
    emailVerified: row.email_verified === true,
    twoFactorEnabled: row.two_factor_enabled === true,
    identityVerified: row.identity_verified === true,
    identityVerificationRequired: row.identity_verification_required === true,
    city: row.city || null,
    country: row.country || null,
    accountType: row.account_type || 'personal',
    businessName: row.business_name || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };

  return {
    user,
    riskIntelligence,
    linkedAccounts: riskIntelligence.linkedAccounts || [],
    securityEvents: userSecurityEvents,
    loginLocations: userLoginLocations,
    activeSessions: sanitizedSessions,
    freeStoreClaims: userFreeStoreClaims,
    promoClaims: userPromoClaims,
    billingOrdersOrTopups: userTopups,
    deviceIdentities: userDeviceIdentities,
    blockedSignals: userBlockedSignals
  };
}

/**
 * Pure helper to determine which accounts can be safely banned in a cluster enforcement action.
 * Never allows banning super_admin or admin siblings when cascading a cluster ban.
 */
export function selectClusterBanTargets({
  targetUser,
  linkedAccounts = [],
  banLinkedCluster = false
}) {
  if (!targetUser?.id) {
    const err = new Error('Target user is required.');
    err.statusCode = 400;
    throw err;
  }
  if (isSuperAdminAccount(targetUser)) {
    const err = new Error('Super Administrator accounts cannot be disabled.');
    err.statusCode = 403;
    throw err;
  }

  const targets = [targetUser];
  const skippedAdmins = [];

  if (banLinkedCluster) {
    const seen = new Set([String(targetUser.id)]);
    for (const sibling of Array.isArray(linkedAccounts) ? linkedAccounts : []) {
      const sid = String(sibling?.id || '').trim();
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      const role = String(sibling.role || '').trim().toLowerCase();
      if (isSuperAdminAccount(sibling) || role === 'admin') {
        skippedAdmins.push({
          id: sid,
          email: sibling.email || '',
          name: sibling.name || '',
          role: sibling.role || 'admin',
          reason: 'Protected administrator account skipped from cluster ban.'
        });
        continue;
      }
      if (!sibling.isBanned) {
        targets.push(sibling);
      }
    }
  }

  return { targets, skippedAdmins };
}

async function collectSignalHashesForUsers(userIds, queryFn) {
  if (!userIds.length) return [];
  const collected = [];
  const push = (signalType, signalHash, sourceUserId) => {
    const cleaned = cleanHashValue(signalHash);
    if (!cleaned) return;
    collected.push({ signalType, signalHash: cleaned, sourceUserId });
  };

  for (const uid of userIds) {
    const userHash = hashAbuseSignal('user', String(uid));
    if (userHash) push('user', userHash, uid);
  }

  const tryCollect = async (sql, mapper) => {
    try {
      const res = await queryFn(sql, [userIds]);
      for (const row of res?.rows || []) {
        mapper(row);
      }
    } catch (err) {
      console.warn('[ClusterBan] Signal collection query skipped:', err.message);
    }
  };

  await Promise.all([
    tryCollect(
      `SELECT user_id, device_hash, ip_hash
       FROM system_user_device_identities
       WHERE user_id = ANY($1::varchar[])`,
      (row) => {
        push('fingerprint', row.device_hash, row.user_id);
        push('ip', row.ip_hash, row.user_id);
      }
    ),
    tryCollect(
      `SELECT user_id, key_hash
       FROM system_signup_browsers
       WHERE user_id = ANY($1::varchar[])`,
      (row) => {
        push('browser_cookie', row.key_hash, row.user_id);
      }
    ),
    tryCollect(
      `SELECT user_id, device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash
       FROM system_free_store_claims
       WHERE user_id = ANY($1::varchar[])`,
      (row) => {
        push('fingerprint', row.device_fingerprint_hash, row.user_id);
        push('device_token', row.device_token_hash, row.user_id);
        push('browser_cookie', row.browser_cookie_hash, row.user_id);
        push('ip', row.ip_hash, row.user_id);
        push('subnet', row.subnet_hash, row.user_id);
      }
    ),
    tryCollect(
      `SELECT user_id, device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash
       FROM system_promo_claims
       WHERE user_id = ANY($1::varchar[])`,
      (row) => {
        push('fingerprint', row.device_fingerprint_hash, row.user_id);
        push('device_token', row.device_token_hash, row.user_id);
        push('browser_cookie', row.browser_cookie_hash, row.user_id);
        push('ip', row.ip_hash, row.user_id);
        push('subnet', row.subnet_hash, row.user_id);
      }
    ),
    tryCollect(
      `SELECT user_id, device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash
       FROM cloud_credit_topups
       WHERE user_id = ANY($1::varchar[])`,
      (row) => {
        push('fingerprint', row.device_fingerprint_hash, row.user_id);
        push('device_token', row.device_token_hash, row.user_id);
        push('browser_cookie', row.browser_cookie_hash, row.user_id);
        push('ip', row.ip_hash, row.user_id);
        push('subnet', row.subnet_hash, row.user_id);
      }
    )
  ]);

  // Deduplicate by (signalType, signalHash)
  const uniqueMap = new Map();
  for (const item of collected) {
    const key = `${item.signalType}:${item.signalHash}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }
  return [...uniqueMap.values()];
}

/**
 * Execute a single-user or cluster-wide ban/unban enforcement action.
 * Updates system_users, optionally bans linked non-admin siblings, blocks hardware/browser/IP
 * signals in system_blocked_identities, revokes system_sessions, and logs system_security_events.
 */
export async function executeClusterBanAction({
  targetUser,
  actorEmail = 'system',
  actorIp = null,
  isBanned = true,
  reason = '',
  banLinkedCluster = false,
  blockDeviceSignals = false,
  linkedAccountsOverride = null,
  deps = {}
}) {
  if (!targetUser?.id) {
    const err = new Error('Target user is required.');
    err.statusCode = 400;
    throw err;
  }
  if (isSuperAdminAccount(targetUser)) {
    const err = new Error('Super Administrator accounts cannot be disabled.');
    err.statusCode = 403;
    throw err;
  }

  const queryFn = deps.query || queryPg;
  const recordEventFn = deps.recordEvent || recordSecurityEvent;
  const unblockFn = deps.unblockSignals || unblockUserAndSignals;
  const pgAvailable = deps.pgActive !== undefined ? deps.pgActive : isPgActive();

  if (!isBanned) {
    if (pgAvailable) {
      await queryFn(
        `UPDATE system_users
         SET is_banned = FALSE, ban_reason = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [String(targetUser.id)]
      );
      await unblockFn(targetUser.id).catch((err) => {
        console.warn('[ClusterBan] Failed to clear blocked signals on unban:', err.message);
      });
      await recordEventFn({
        eventType: 'admin.account_restored',
        severity: 'info',
        userId: targetUser.id,
        subject: targetUser.email || targetUser.id,
        ip: actorIp,
        details: { administrator: actorEmail }
      }).catch(() => {});
    }

    return {
      success: true,
      isBanned: false,
      reason: null,
      bannedAt: null,
      affectedUsers: [
        {
          id: targetUser.id,
          tiwiId: targetUser.tiwiId || '',
          name: targetUser.name || '',
          email: targetUser.email || '',
          isBanned: false,
          banReason: null
        }
      ],
      skippedAdmins: [],
      blockedSignalsCount: 0
    };
  }

  const safeReason = (typeof reason === 'string' && reason.trim())
    ? reason.trim().slice(0, 1000)
    : 'Your account was disabled due to a violation of platform policies.';

  let linkedAccounts = Array.isArray(linkedAccountsOverride) ? linkedAccountsOverride : [];
  if (banLinkedCluster && !Array.isArray(linkedAccountsOverride) && pgAvailable) {
    const dossier = await buildUserActivityDossier(targetUser.id, { viewerIsSuperAdmin: true });
    linkedAccounts = dossier?.linkedAccounts || [];
  }

  const { targets, skippedAdmins } = selectClusterBanTargets({
    targetUser,
    linkedAccounts,
    banLinkedCluster
  });

  const bannedAt = new Date().toISOString();
  const affectedIds = targets.map((t) => String(t.id));
  let blockedSignalsCount = 0;

  if (pgAvailable) {
    for (const target of targets) {
      const uid = String(target.id);
      await queryFn(
        `UPDATE system_users
         SET is_banned = TRUE, ban_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [uid, safeReason]
      );

      await queryFn(
        `INSERT INTO system_account_security
           (user_id, strikes, cooldown_until, permanently_disabled, last_reason, updated_at)
         VALUES ($1, 3, NULL, TRUE, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
           strikes = GREATEST(system_account_security.strikes, 3),
           cooldown_until = NULL,
           permanently_disabled = TRUE,
           last_reason = EXCLUDED.last_reason,
           updated_at = CURRENT_TIMESTAMP`,
        [uid, safeReason]
      ).catch(() => {});

      await queryFn('DELETE FROM system_sessions WHERE user_id = $1', [uid]).catch(() => {});

      // Also revoke via MasterDB/Rust session store if available
      if (!deps.query) {
        import('../db/multiTenant.js')
          .then(({ MasterDB }) => MasterDB.revokeUserSessions(uid))
          .catch(() => {});
      }

      await recordEventFn({
        eventType: uid === String(targetUser.id) ? 'admin.account_disabled' : 'admin.cluster_account_disabled',
        severity: 'warning',
        userId: uid,
        subject: target.email || uid,
        ip: actorIp,
        details: {
          administrator: actorEmail,
          reason: safeReason,
          clusterRootUserId: String(targetUser.id),
          banLinkedCluster: Boolean(banLinkedCluster),
          blockDeviceSignals: Boolean(blockDeviceSignals)
        }
      }).catch(() => {});
    }

    if (blockDeviceSignals) {
      const signalsToBlock = deps.collectSignals
        ? await deps.collectSignals(affectedIds)
        : await collectSignalHashesForUsers(affectedIds, queryFn);

      for (const sig of signalsToBlock) {
        await queryFn(
          `INSERT INTO system_blocked_identities
             (signal_type, signal_hash, reason, source_user_id, strikes, is_active, updated_at)
           VALUES ($1, $2, $3, $4, 3, TRUE, CURRENT_TIMESTAMP)
           ON CONFLICT (signal_type, signal_hash) DO UPDATE SET
             reason = EXCLUDED.reason,
             source_user_id = COALESCE(EXCLUDED.source_user_id, system_blocked_identities.source_user_id),
             strikes = GREATEST(system_blocked_identities.strikes + 1, 3),
             is_active = TRUE,
             expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP`,
          [sig.signalType, sig.signalHash, safeReason.slice(0, 500), String(sig.sourceUserId || targetUser.id).slice(0, 64)]
        );
        blockedSignalsCount += 1;
      }
    }
  }

  return {
    success: true,
    isBanned: true,
    reason: safeReason,
    bannedAt,
    affectedUsers: targets.map((t) => ({
      id: t.id,
      tiwiId: t.tiwiId || '',
      name: t.name || '',
      email: t.email || '',
      role: t.role || 'owner',
      isBanned: true,
      banReason: safeReason,
      bannedAt
    })),
    skippedAdmins,
    blockedSignalsCount
  };
}

export default {
  isSuperAdminAccount,
  computeRiskClusters,
  enrichUsersWithRiskIntel,
  buildUserActivityDossier,
  selectClusterBanTargets,
  executeClusterBanAction
};
