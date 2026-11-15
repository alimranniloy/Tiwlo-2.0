import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { SIGNUP_BROWSER_COOKIE, verifySignupBrowser } from './signupBrowser.js';

const SIGNAL_SECRET =
  process.env.ABUSE_HASH_SECRET ||
  process.env.SECURITY_SECRET ||
  PLATFORM_CONFIG.primaryDomain ||
  'tiwlo-device-guard';

/** Hash a device or network identifier with a server-side HMAC key. */
export function hashAbuseSignal(label, value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'unknown') return null;
  return createHmac('sha256', SIGNAL_SECRET)
    .update(`${label}:${trimmed}`)
    .digest('hex');
}

/** Normalize raw Express IP strings (strip IPv6-mapped prefix and map loopback uniformly). */
export function normalizeClientIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return null;
  let cleaned = rawIp.trim();
  if (cleaned.startsWith('::ffff:')) cleaned = cleaned.slice(7);
  if (cleaned === '::1') cleaned = '127.0.0.1';
  return isIP(cleaned) ? cleaned : null;
}

/** Derive the LAN / Wi-Fi subnet prefix (/24 IPv4 or /48 IPv6) from a normalized IP. */
export function extractNetworkSubnet(ip) {
  const normalized = normalizeClientIp(ip);
  if (!normalized) return null;
  if (normalized.includes('.')) {
    const octets = normalized.split('.');
    return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24` : null;
  }
  const hextets = normalized.split(':').filter(Boolean);
  return hextets.length >= 3 ? `${hextets.slice(0, 3).join(':')}::/48` : null;
}

/** Extract normalized and keyed-hash device, browser, fingerprint, and network signals from req. */
export function extractClientSignals(req) {
  if (!req) {
    return {
      ip: null,
      ipHash: null,
      subnet: null,
      subnetHash: null,
      fingerprintHash: null,
      deviceTokenHash: null,
      browserCookieHash: null,
      userAgentHash: null,
      clientHintsHash: null,
      platformClass: 'unknown'
    };
  }

  const headers = req.headers || {};
  const getHeader = (name) => String(req.get?.(name) ?? headers[name] ?? '').trim();

  const forwarded = getHeader('x-forwarded-for').split(',')[0]?.trim();
  const ip = normalizeClientIp(req.ip || forwarded || req.socket?.remoteAddress);
  const subnet = extractNetworkSubnet(ip);

  const rawFingerprint = String(
    getHeader('x-tiwlo-fingerprint') ||
    req.body?.deviceFingerprint ||
    ''
  ).trim().slice(0, 256);

  const rawDeviceToken = String(
    getHeader('x-tiwlo-device-id') ||
    req.cookies?.tiwlo_device_token ||
    req.body?.deviceToken ||
    ''
  ).trim().slice(0, 256);

  const cookieToken = req.cookies?.[SIGNUP_BROWSER_COOKIE];
  const verifiedCookieId = verifySignupBrowser(cookieToken);
  const rawBrowserCookie = req.signupBrowserKey || verifiedCookieId || cookieToken || '';

  const userAgent = getHeader('user-agent').slice(0, 512);
  const clientHints = [
    getHeader('sec-ch-ua'),
    getHeader('sec-ch-ua-platform'),
    getHeader('sec-ch-ua-mobile')
  ].join('|');

  const platformClass = /android|iphone|ipad|mobile/i.test(`${clientHints}|${userAgent}`)
    ? 'mobile'
    : userAgent ? 'desktop' : 'unknown';

  return {
    ip,
    ipHash: hashAbuseSignal('ip', ip),
    subnet,
    subnetHash: hashAbuseSignal('subnet', subnet),
    fingerprintHash: hashAbuseSignal('fingerprint', rawFingerprint),
    deviceTokenHash: hashAbuseSignal('device_token', rawDeviceToken),
    browserCookieHash: rawBrowserCookie ? hashAbuseSignal('browser_cookie', String(rawBrowserCookie)) : null,
    userAgentHash: hashAbuseSignal('ua', userAgent),
    clientHintsHash: clientHints !== '||' ? hashAbuseSignal('hints', clientHints) : null,
    platformClass
  };
}

function isFreePackage(selectedPackage) {
  if (!selectedPackage) return true;
  const planId = String(selectedPackage.planId || 'free').trim().toLowerCase();
  const price = Number(selectedPackage.price || 0);
  return planId === 'free' || price <= 0;
}

/**
 * Pure policy evaluation for store creation & multi-account free-tier abuse detection.
 * Used directly by unit tests without requiring PostgreSQL.
 */
export function evaluateFreeStoreEligibility({
  ownerId,
  existingStores = [],
  selectedPackage = { planId: 'free', price: 0 },
  isAdmin = false,
  signals = {},
  priorClaims = [],
  blockedSignals = []
}) {
  if (!isAdmin && blockedSignals.length > 0) {
    const primaryBlock = blockedSignals[0];
    return {
      allowed: false,
      statusCode: 403,
      code: 'DEVICE_OR_NETWORK_BLOCKED',
      reason: primaryBlock.reason || 'Access blocked due to multiple free-account policy violations.',
      shouldBanAccount: true,
      blockSignalTypes: ['fingerprint', 'device_token', 'browser_cookie', 'user']
    };
  }

  const freeRequested = isFreePackage(selectedPackage);
  if (!freeRequested) {
    return { allowed: true, code: 'OK', shouldBanAccount: false };
  }

  const activeFreeStores = (existingStores || []).filter((store) => {
    const status = String(store?.status || 'active').toLowerCase();
    const storePlan = String(store?.planId || 'free').toLowerCase();
    return status !== 'deleted' && storePlan === 'free';
  });

  if (!isAdmin && activeFreeStores.length >= 1) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'FREE_STORE_LIMIT_REACHED',
      reason: 'Each account can only have 1 free store. Choose a paid plan to create another store.',
      shouldBanAccount: false,
      blockSignalTypes: []
    };
  }

  if (isAdmin) {
    return { allowed: true, code: 'OK', shouldBanAccount: false };
  }

  const otherClaims = (priorClaims || []).filter((claim) =>
    claim &&
    claim.user_id !== ownerId &&
    String(claim.status || 'active').toLowerCase() !== 'deleted'
  );

  if (otherClaims.length === 0) {
    return { allowed: true, code: 'OK', shouldBanAccount: false };
  }

  const hardwareMatched = otherClaims.filter((claim) =>
    (signals.fingerprintHash && claim.device_fingerprint_hash === signals.fingerprintHash) ||
    (signals.deviceTokenHash && claim.device_token_hash === signals.deviceTokenHash) ||
    (signals.browserCookieHash && claim.browser_cookie_hash === signals.browserCookieHash)
  );

  if (hardwareMatched.length > 0) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'FREE_TIER_DEVICE_ABUSE',
      reason: 'Suspended: Multiple accounts detected attempting to claim a free store from the same device or browser fingerprint.',
      shouldBanAccount: true,
      matchedUsers: [...new Set(hardwareMatched.map((c) => c.user_id))],
      blockSignalTypes: ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip']
    };
  }

  const sameIpClaims = signals.ipHash
    ? otherClaims.filter((claim) => claim.ip_hash === signals.ipHash)
    : [];
  const sameWifiDeviceClaims = (signals.subnetHash && signals.userAgentHash)
    ? otherClaims.filter((claim) =>
      claim.subnet_hash === signals.subnetHash &&
      claim.user_agent_hash === signals.userAgentHash
    )
    : [];

  const distinctSameIpUsers = [...new Set(sameIpClaims.map((c) => c.user_id))];
  const distinctSameWifiUsers = [...new Set(sameWifiDeviceClaims.map((c) => c.user_id))];

  if (distinctSameIpUsers.length >= 2 || distinctSameWifiUsers.length >= 1) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'FREE_TIER_MULTI_ACCOUNT_BAN',
      reason: 'Suspended: Multiple accounts detected attempting to abuse the Free plan on the same Wi-Fi/IP network and device.',
      shouldBanAccount: true,
      matchedUsers: [...new Set([...distinctSameIpUsers, ...distinctSameWifiUsers])],
      blockSignalTypes: ['user', 'fingerprint', 'device_token', 'ip']
    };
  }

  if (distinctSameIpUsers.length >= 1) {
    return {
      allowed: false,
      statusCode: 403,
      code: 'FREE_TIER_IP_LIMIT_REACHED',
      reason: 'A free store has already been claimed from this IP/Wi-Fi network. Choose a paid plan to create another store.',
      shouldBanAccount: false,
      recordStrike: true,
      matchedUsers: distinctSameIpUsers,
      blockSignalTypes: []
    };
  }

  return { allowed: true, code: 'OK', shouldBanAccount: false };
}

async function queryActiveBlocks(userId, signals) {
  if (!isPgActive()) return [];
  const pairs = [];
  if (userId) pairs.push(['user', hashAbuseSignal('user', String(userId))]);
  if (signals.fingerprintHash) pairs.push(['fingerprint', signals.fingerprintHash]);
  if (signals.deviceTokenHash) pairs.push(['device_token', signals.deviceTokenHash]);
  if (signals.browserCookieHash) pairs.push(['browser_cookie', signals.browserCookieHash]);
  if (signals.ipHash) pairs.push(['ip', signals.ipHash]);

  const validPairs = pairs.filter(([, hash]) => Boolean(hash));
  if (validPairs.length === 0) return [];

  const conditions = validPairs.map((_, idx) => `(signal_type = $${idx * 2 + 1} AND signal_hash = $${idx * 2 + 2})`).join(' OR ');
  const params = validPairs.flat();
  const { rows } = await queryPg(
    `SELECT id, signal_type, signal_hash, reason, source_user_id, strikes
     FROM system_blocked_identities
     WHERE is_active = TRUE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (${conditions})
     ORDER BY strikes DESC, updated_at DESC
     LIMIT 10`,
    params
  );
  return rows;
}

async function queryMatchingFreeClaims(signals) {
  if (!isPgActive()) return [];
  const clauses = [];
  const params = [];

  const pushClause = (col, val) => {
    if (!val) return;
    params.push(val);
    clauses.push(`${col} = $${params.length}`);
  };

  pushClause('device_fingerprint_hash', signals.fingerprintHash);
  pushClause('device_token_hash', signals.deviceTokenHash);
  pushClause('browser_cookie_hash', signals.browserCookieHash);
  pushClause('ip_hash', signals.ipHash);
  pushClause('subnet_hash', signals.subnetHash);

  if (clauses.length === 0) return [];

  const { rows } = await queryPg(
    `SELECT user_id, store_id, plan_id, device_fingerprint_hash, device_token_hash,
            browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status
     FROM system_free_store_claims
     WHERE status <> 'deleted' AND (${clauses.join(' OR ')})
     ORDER BY created_at DESC
     LIMIT 100`,
    params
  );
  return rows;
}

/** Block device/network signals and optionally permanently ban the offending account. */
export async function activateBanAndBlockSignals({
  userId,
  user = null,
  reason,
  signals = {},
  blockSignalTypes = ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
  banAccount = true
}) {
  if (!isPgActive()) return;

  const safeReason = String(reason || 'Account disabled for free-tier multi-account abuse.').slice(0, 500);
  const signalMap = {
    user: userId ? hashAbuseSignal('user', String(userId)) : null,
    fingerprint: signals.fingerprintHash,
    device_token: signals.deviceTokenHash,
    browser_cookie: signals.browserCookieHash,
    ip: signals.ipHash
  };

  for (const signalType of blockSignalTypes) {
    const signalHash = signalMap[signalType];
    if (!signalHash) continue;
    await queryPg(
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
      [signalType, signalHash, safeReason, userId ? String(userId).slice(0, 64) : null]
    );
  }

  if (banAccount && userId && user?.role !== 'admin') {
    await queryPg(
      `UPDATE system_users SET is_banned = TRUE, ban_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [String(userId).slice(0, 64), safeReason]
    );
    await queryPg(
      `INSERT INTO system_account_security (user_id, strikes, cooldown_until, permanently_disabled, last_reason, updated_at)
       VALUES ($1, 3, NULL, TRUE, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         strikes = GREATEST(system_account_security.strikes, 3),
         cooldown_until = NULL,
         permanently_disabled = TRUE,
         last_reason = EXCLUDED.last_reason,
         updated_at = CURRENT_TIMESTAMP`,
      [String(userId).slice(0, 64), safeReason]
    );
    await queryPg('DELETE FROM system_sessions WHERE user_id = $1', [String(userId).slice(0, 64)]);

    if (user && typeof user === 'object') {
      user.isBanned = true;
      user.banReason = safeReason;
    }

    if (user?.email) {
      try {
        const [{ sendAccountDisabledEmail }, { getPlatformUrl }] = await Promise.all([
          import('../db/emailService.js'),
          import('../config/platformConfig.js')
        ]);
        await sendAccountDisabledEmail({
          to: user.email,
          name: user.name || user.storeName || 'Merchant',
          reason: safeReason,
          restoreUrl: getPlatformUrl('account-disabled')
        });
      } catch (err) {
        console.warn('[FreeTierAbuseGuard] Failed to send disabled notice email:', err.message);
      }
    }
  }
}

/** Unblock user and device/IP signals when an administrator restores an account. */
export async function unblockUserAndSignals(userId) {
  if (!isPgActive() || !userId) return;
  const uid = String(userId).slice(0, 64);
  const userHash = hashAbuseSignal('user', uid);
  await queryPg(
    `UPDATE system_blocked_identities
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE source_user_id = $1 OR (signal_type = 'user' AND signal_hash = $2)`,
    [uid, userHash]
  );
  await queryPg(
    `INSERT INTO system_account_security (user_id, strikes, cooldown_until, permanently_disabled, last_reason, updated_at)
     VALUES ($1, 0, NULL, FALSE, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       strikes = 0,
       cooldown_until = NULL,
       permanently_disabled = FALSE,
       last_reason = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [uid]
  );
}

/**
 * Enforces the 1-free-store-per-account limit and device/fingerprint/IP abuse checks.
 * Throws a structured HTTP 403 error and activates the ban/block system when abuse occurs.
 */
export async function enforceFreeStoreCreationPolicy({
  req = null,
  ownerId,
  user = null,
  existingStores = [],
  selectedPackage
}) {
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const signals = extractClientSignals(req);
  const [blockedSignals, priorClaims] = isPgActive()
    ? await Promise.all([
      queryActiveBlocks(ownerId, signals),
      isFreePackage(selectedPackage) ? queryMatchingFreeClaims(signals) : Promise.resolve([])
    ])
    : [[], []];

  const decision = evaluateFreeStoreEligibility({
    ownerId,
    existingStores,
    selectedPackage,
    isAdmin,
    signals,
    priorClaims,
    blockedSignals
  });

  if (decision.allowed) {
    return { allowed: true, signals };
  }

  if (isPgActive()) {
    await recordSecurityEvent({
      eventType: `security.${String(decision.code || 'free_store_blocked').toLowerCase()}`,
      severity: decision.shouldBanAccount ? 'critical' : 'warning',
      userId: ownerId,
      subject: user?.email || ownerId,
      ip: signals.ip,
      userAgent: req?.get?.('user-agent'),
      details: {
        code: decision.code,
        fingerprintHash: signals.fingerprintHash || '',
        deviceTokenHash: signals.deviceTokenHash || '',
        ipHash: signals.ipHash || '',
        subnetHash: signals.subnetHash || '',
        matchedUsers: (decision.matchedUsers || []).join(',')
      }
    }).catch(() => {});

    if (decision.shouldBanAccount) {
      await activateBanAndBlockSignals({
        userId: ownerId,
        user,
        reason: decision.reason,
        signals,
        blockSignalTypes: decision.blockSignalTypes || ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
        banAccount: true
      });
    } else if (decision.recordStrike) {
      try {
        const { recordViolation } = await import('./accountSecurityManager.js');
        await recordViolation({
          user: user || { id: ownerId },
          category: 'FREE_TIER_ABUSE',
          policyName: 'Multi-Account Free Store Protection',
          reason: decision.reason,
          contentType: 'Store Creation',
          isCritical: false
        });
      } catch (err) {
        console.warn('[FreeTierAbuseGuard] Strike recording failed:', err.message);
      }
    }
  }

  const error = new Error(decision.reason);
  error.statusCode = decision.statusCode || 403;
  error.code = decision.code;
  error.banned = Boolean(decision.shouldBanAccount);
  throw error;
}

/** Persist a new free store claim and record device/IP identity links in PostgreSQL. */
export async function recordFreeStoreClaim({ ownerId, storeId, planId = 'free', req = null }) {
  if (!isPgActive() || !ownerId || !storeId) return;
  const signals = extractClientSignals(req);
  await queryPg(
    `INSERT INTO system_free_store_claims
       (user_id, store_id, plan_id, device_fingerprint_hash, device_token_hash, browser_cookie_hash,
        ip_hash, subnet_hash, user_agent_hash, platform_class, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
    [
      String(ownerId).slice(0, 64),
      String(storeId).slice(0, 64),
      String(planId || 'free').slice(0, 64),
      signals.fingerprintHash,
      signals.deviceTokenHash,
      signals.browserCookieHash,
      signals.ipHash || hashAbuseSignal('ip', '127.0.0.1'),
      signals.subnetHash,
      signals.userAgentHash,
      signals.platformClass || 'unknown'
    ]
  );

  await recordDeviceIdentityLink({ userId: ownerId, req, signals });
}

/** Upsert a user <-> device fingerprint/IP association into system_user_device_identities. */
export async function recordDeviceIdentityLink({ userId, req = null, signals = null }) {
  if (!isPgActive() || !userId) return;
  const resolvedSignals = signals || extractClientSignals(req);
  const uid = String(userId).slice(0, 64);
  const ipHash = resolvedSignals.ipHash || hashAbuseSignal('ip', '127.0.0.1');
  const uaHash = resolvedSignals.userAgentHash || hashAbuseSignal('ua', 'unknown');
  const deviceHash = resolvedSignals.fingerprintHash || resolvedSignals.deviceTokenHash || uaHash;
  const identityHash = hashAbuseSignal('identity-link', `${uid}:${deviceHash}`);
  if (!identityHash) return;

  await queryPg(
    `INSERT INTO system_user_device_identities
       (user_id, identity_hash, device_hash, ip_hash, user_agent_hash, client_hints_hash, platform_class)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, identity_hash) DO UPDATE SET
       ip_hash = EXCLUDED.ip_hash,
       user_agent_hash = EXCLUDED.user_agent_hash,
       client_hints_hash = EXCLUDED.client_hints_hash,
       platform_class = EXCLUDED.platform_class,
       last_seen_at = CURRENT_TIMESTAMP,
       login_count = system_user_device_identities.login_count + 1`,
    [
      uid,
      identityHash,
      deviceHash,
      ipHash,
      uaHash,
      resolvedSignals.clientHintsHash,
      resolvedSignals.platformClass || 'unknown'
    ]
  );
}

/** Verify whether a signup or protected mutation comes from an actively blocked device or IP. */
export async function checkActiveBlockForRequest(req, userId = null) {
  if (!isPgActive()) return null;
  if (req?.activeUser?.role === 'admin' || req?.activeUser?.role === 'super_admin') return null;
  const signals = extractClientSignals(req);
  const blocks = await queryActiveBlocks(userId || req?.activeUser?.id, signals);
  return blocks[0] || null;
}

/** Express middleware enforcing active device/IP/fingerprint bans on registration & sensitive creation routes. */
export async function blockBannedDeviceMiddleware(req, res, next) {
  try {
    const activeBlock = await checkActiveBlockForRequest(req);
    if (!activeBlock) return next();

    await recordSecurityEvent({
      eventType: 'security.blocked_device_attempt',
      severity: 'warning',
      userId: req.activeUser?.id || null,
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
      details: {
        path: String(req.originalUrl || req.path || '').slice(0, 120),
        signalType: activeBlock.signal_type
      }
    }).catch(() => {});

    return res.status(403).json({
      error: 'DEVICE_OR_NETWORK_BLOCKED',
      banned: true,
      reason: activeBlock.reason || 'Access from this device or network has been suspended due to policy violations.',
      redirectUrl: '/account-disabled'
    });
  } catch (err) {
    return next();
  }
}

export default {
  hashAbuseSignal,
  normalizeClientIp,
  extractNetworkSubnet,
  extractClientSignals,
  evaluateFreeStoreEligibility,
  activateBanAndBlockSignals,
  unblockUserAndSignals,
  enforceFreeStoreCreationPolicy,
  recordFreeStoreClaim,
  recordDeviceIdentityLink,
  checkActiveBlockForRequest,
  blockBannedDeviceMiddleware
};
