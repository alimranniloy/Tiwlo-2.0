export const ADMIN_SESSION_SECURITY_SETTING_KEY = 'admin_session_security_policy';

export const DEFAULT_ADMIN_SESSION_POLICY = Object.freeze({
  enforceIdleTimeout: false,
  idleTimeoutMinutes: 60,
  enforceMaxSessionAge: false,
  maxSessionAgeHours: 168,
  singleActiveSessionOnly: false,
  strictIpBinding: false,
  requireReauthForSecurityChanges: true,
  revokeOtherSessionsOnPasswordChange: true,
  notifyOnNewAdminLogin: true
});

const POLICY_CACHE_TTL_MS = 15 * 1000;
let cachedPolicy = null;
let cachedPolicyAt = 0;

function clampInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  return Math.min(max, Math.max(min, rounded));
}

export function normalizeAdminSessionPolicy(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enforceIdleTimeout: src.enforceIdleTimeout === true,
    idleTimeoutMinutes: clampInt(
      src.idleTimeoutMinutes,
      DEFAULT_ADMIN_SESSION_POLICY.idleTimeoutMinutes,
      5,
      1440
    ),
    enforceMaxSessionAge: src.enforceMaxSessionAge === true,
    maxSessionAgeHours: clampInt(
      src.maxSessionAgeHours,
      DEFAULT_ADMIN_SESSION_POLICY.maxSessionAgeHours,
      1,
      720
    ),
    singleActiveSessionOnly: src.singleActiveSessionOnly === true,
    strictIpBinding: src.strictIpBinding === true,
    requireReauthForSecurityChanges:
      src.requireReauthForSecurityChanges === undefined
        ? DEFAULT_ADMIN_SESSION_POLICY.requireReauthForSecurityChanges
        : src.requireReauthForSecurityChanges === true,
    revokeOtherSessionsOnPasswordChange:
      src.revokeOtherSessionsOnPasswordChange === undefined
        ? DEFAULT_ADMIN_SESSION_POLICY.revokeOtherSessionsOnPasswordChange
        : src.revokeOtherSessionsOnPasswordChange === true,
    notifyOnNewAdminLogin:
      src.notifyOnNewAdminLogin === undefined
        ? DEFAULT_ADMIN_SESSION_POLICY.notifyOnNewAdminLogin
        : src.notifyOnNewAdminLogin === true
  };
}

export function invalidateAdminSessionPolicyCache() {
  cachedPolicy = null;
  cachedPolicyAt = 0;
}

export async function getAdminSessionPolicy({ queryPg, bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cachedPolicy && now - cachedPolicyAt < POLICY_CACHE_TTL_MS) {
    return { ...cachedPolicy };
  }
  if (typeof queryPg !== 'function') {
    return { ...DEFAULT_ADMIN_SESSION_POLICY };
  }
  try {
    const res = await queryPg(
      `SELECT settings FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [ADMIN_SESSION_SECURITY_SETTING_KEY]
    );
    const stored = res?.rows?.[0]?.settings;
    const normalized = normalizeAdminSessionPolicy(stored || {});
    cachedPolicy = normalized;
    cachedPolicyAt = now;
    return { ...normalized };
  } catch {
    return { ...DEFAULT_ADMIN_SESSION_POLICY };
  }
}

export async function saveAdminSessionPolicy({ queryPg, policy }) {
  const normalized = normalizeAdminSessionPolicy(policy);
  if (typeof queryPg === 'function') {
    await queryPg(
      `INSERT INTO system_settings (setting_key, settings, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE
         SET settings = EXCLUDED.settings,
             updated_at = CURRENT_TIMESTAMP`,
      [ADMIN_SESSION_SECURITY_SETTING_KEY, JSON.stringify(normalized)]
    );
  }
  cachedPolicy = normalized;
  cachedPolicyAt = Date.now();
  return { ...normalized };
}

function normalizeComparableIp(ip) {
  const raw = String(ip || '').split(',')[0].trim();
  if (!raw) return '';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  if (raw === '::1') return '127.0.0.1';
  return raw;
}

/**
 * Evaluate strict admin session policy against a resolved session metadata row.
 * Does NOT validate User-Agent / viewport so mobile "Desktop Site" toggles stay authenticated.
 */
export function evaluateAdminSessionPolicy({
  policy,
  sessionRow,
  requestIp = '',
  nowMs = Date.now()
} = {}) {
  const p = normalizeAdminSessionPolicy(policy);
  if (!sessionRow) {
    return { allowed: true, reason: null };
  }

  if (p.enforceIdleTimeout) {
    const lastActiveRef = sessionRow.last_active_at || sessionRow.lastActiveAt || sessionRow.created_at || sessionRow.createdAt;
    const lastActiveMs = lastActiveRef ? Date.parse(String(lastActiveRef)) : NaN;
    if (Number.isFinite(lastActiveMs)) {
      const maxIdleMs = p.idleTimeoutMinutes * 60 * 1000;
      if (nowMs - lastActiveMs > maxIdleMs) {
        return {
          allowed: false,
          code: 'ADMIN_SESSION_IDLE_TIMEOUT',
          reason: `Admin session expired after ${p.idleTimeoutMinutes} minute(s) of inactivity.`
        };
      }
    }
  }

  if (p.enforceMaxSessionAge) {
    const createdRef = sessionRow.created_at || sessionRow.createdAt;
    const createdMs = createdRef ? Date.parse(String(createdRef)) : NaN;
    if (Number.isFinite(createdMs)) {
      const maxAgeMs = p.maxSessionAgeHours * 60 * 60 * 1000;
      if (nowMs - createdMs > maxAgeMs) {
        return {
          allowed: false,
          code: 'ADMIN_SESSION_MAX_AGE_EXCEEDED',
          reason: `Admin session exceeded maximum lifetime of ${p.maxSessionAgeHours} hour(s).`
        };
      }
    }
  }

  if (p.strictIpBinding) {
    const storedIp = normalizeComparableIp(sessionRow.ip);
    const currentIp = normalizeComparableIp(requestIp);
    if (storedIp && currentIp && storedIp !== currentIp) {
      return {
        allowed: false,
        code: 'ADMIN_SESSION_IP_MISMATCH',
        reason: 'Admin session IP changed while Strict Admin IP Binding is enabled.'
      };
    }
  }

  return { allowed: true, reason: null };
}
