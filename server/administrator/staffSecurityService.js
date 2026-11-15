import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createSecureGrant } from '../db/emailService.js';
import { queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { normalizeClientIp } from '../security/freeTierAbuseGuard.js';

export const SUPER_ADMIN_EMAIL = 'tiwloltd@gmail.com';
export const ADMIN_IP_DENIED_ERROR = 'Your IP is not whitelisted';
export const ADMIN_IP_DENIED_CODE = 'ADMIN_IP_NOT_ALLOWED';
export const PIN_MAX_FAILED_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const ADMIN_PERMISSION_CATALOG = [
  {
    key: 'view_financials',
    label: 'View Financials',
    description: 'Read revenue, net profit, currency rates, and billing analytics.',
    category: 'Finance'
  },
  {
    key: 'manage_orders',
    label: 'Manage Orders & Appeals',
    description: 'Review system orders, transactions, and PICK account appeals.',
    category: 'Operations'
  },
  {
    key: 'view_stores',
    label: 'View Merchants & Stores',
    description: 'Inspect merchant stores, catalog counts, and tenant health.',
    category: 'Stores'
  },
  {
    key: 'manage_stores',
    label: 'Manage Stores & Plans',
    description: 'Upgrade plans, adjust store status, and edit store settings.',
    category: 'Stores'
  },
  {
    key: 'delete_stores',
    label: 'Delete Stores',
    description: 'Permanently delete merchant stores and tenant workspaces.',
    category: 'Stores'
  },
  {
    key: 'manage_packages_promos',
    label: 'Packages & Promos',
    description: 'Configure subscription packages, add-ons, promo codes, and credits.',
    category: 'Billing'
  },
  {
    key: 'manage_users_security',
    label: 'Users, KYC & Security Logs',
    description: 'Inspect user clusters, require KYC verification, and view security logs.',
    category: 'Trust & Safety'
  },
  {
    key: 'ban_users',
    label: 'Ban / Unban Users',
    description: 'Suspend or restore user accounts and linked abuse clusters.',
    category: 'Trust & Safety'
  },
  {
    key: 'manage_dns_domains',
    label: 'DNS & Domains',
    description: 'Manage platform DNS zones, records, and custom domains.',
    category: 'Infrastructure'
  },
  {
    key: 'manage_servers',
    label: 'Servers & Storage',
    description: 'Manage cloud servers, storage providers, and media sync jobs.',
    category: 'Infrastructure'
  },
  {
    key: 'manage_staff_roles',
    label: 'Manage Staff & Roles',
    description: 'Create internal support staff, assign role presets, and enforce IP whitelists.',
    category: 'Administration'
  },
  {
    key: 'manage_system_settings',
    label: 'System Settings & Gateways',
    description: 'Modify root platform settings, payment gateways, and social login providers.',
    category: 'Administration'
  }
];

const ALL_PERMISSION_KEYS = ADMIN_PERMISSION_CATALOG.map((item) => item.key);
const VALID_PERMISSION_SET = new Set(ALL_PERMISSION_KEYS);

const LEGACY_ADMIN_DEFAULT_PERMISSIONS = [
  'view_financials',
  'manage_orders',
  'view_stores',
  'manage_stores',
  'manage_packages_promos',
  'manage_users_security',
  'ban_users',
  'manage_dns_domains',
  'manage_servers',
  'manage_system_settings'
];

export const ADMIN_ROLE_PRESETS = {
  super_admin: {
    key: 'super_admin',
    label: 'Super Admin',
    title: 'Super Admin — Full Control',
    description: 'Full unrestricted control across stores, billing, infrastructure, security policies, and staff roles.',
    badgeTone: 'emerald',
    permissions: [...ALL_PERMISSION_KEYS]
  },
  operations_admin: {
    key: 'operations_admin',
    label: 'Operations Admin',
    title: 'Operations Admin',
    description: 'Stores, plan upgrades, packages, promos, credits, DNS/domains, and servers. No store deletion, staff role changes, or root system settings.',
    badgeTone: 'blue',
    permissions: [
      'view_financials',
      'manage_orders',
      'view_stores',
      'manage_stores',
      'manage_packages_promos',
      'manage_users_security',
      'ban_users',
      'manage_dns_domains',
      'manage_servers'
    ]
  },
  support_lead: {
    key: 'support_lead',
    label: 'Support Lead',
    title: 'Support Lead',
    description: 'View orders, manage/edit stores, handle PICK appeals, view users & logs, and assist merchants. No deletions or pricing/gateways.',
    badgeTone: 'violet',
    permissions: [
      'manage_orders',
      'view_stores',
      'manage_stores',
      'manage_users_security'
    ]
  },
  trust_safety: {
    key: 'trust_safety',
    label: 'Trust & Safety Moderator',
    title: 'Trust & Safety Moderator',
    description: 'Meta cluster inspection, ban/unban users & linked clusters, require KYC, PICK appeals, and security logs.',
    badgeTone: 'amber',
    permissions: [
      'view_stores',
      'manage_users_security',
      'ban_users'
    ]
  },
  finance_analyst: {
    key: 'finance_analyst',
    label: 'Finance & Billing Analyst',
    title: 'Finance & Billing Analyst',
    description: 'Read-only access to financials, Net Profit, System Orders, Currency Rates, and merchant stores.',
    badgeTone: 'cyan',
    permissions: [
      'view_financials',
      'view_stores'
    ]
  },
  support_agent: {
    key: 'support_agent',
    label: 'Support Agent',
    title: 'Dedicated Support Staff',
    description: 'Read merchants/stores, review system orders, and process PICK account appeals.',
    badgeTone: 'neutral',
    permissions: [
      'view_stores',
      'manage_orders'
    ]
  }
};

let schemaEnsured = false;
let schemaPromise = null;

export function resetStaffSchemaCache() {
  schemaEnsured = false;
  schemaPromise = null;
}

export async function ensureStaffSecuritySchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await queryPg(`
        CREATE TABLE IF NOT EXISTS system_admin_staff_profiles (
          user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
          role_key VARCHAR(48) NOT NULL DEFAULT 'support_agent',
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          allowed_ips JSONB NOT NULL DEFAULT '[]'::jsonb,
          pin_hash TEXT,
          pin_set_at TIMESTAMPTZ,
          pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
          pin_locked_until TIMESTAMPTZ,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_by VARCHAR(64),
          updated_by VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPg(`
        CREATE INDEX IF NOT EXISTS idx_admin_staff_active_role
        ON system_admin_staff_profiles(is_active, role_key)
      `);
      schemaEnsured = true;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
}

export function isSuperAdminUser(user) {
  if (!user || user.isBanned) return false;
  const email = String(user.email || '').trim().toLowerCase();
  return user.role === 'super_admin' || (user.role === 'admin' && email === SUPER_ADMIN_EMAIL);
}

export function isValidAdminPin(pin) {
  if (typeof pin !== 'string') return false;
  return /^\d{4,8}$/.test(pin.trim());
}

export function hashAdminPin(pin) {
  if (!isValidAdminPin(pin)) {
    throw new TypeError('Security PIN must be 4 to 8 numeric digits.');
  }
  const cleanPin = pin.trim();
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(cleanPin, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyAdminPin(pin, storedHash) {
  if (!isValidAdminPin(pin) || typeof storedHash !== 'string' || !storedHash) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex || !/^[a-f0-9]+$/i.test(expectedHex)) return false;

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = scryptSync(pin.trim(), salt, expectedBuf.length);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function normalizeAllowedIps(input) {
  if (input === undefined || input === null || input === '') return [];
  let tokens;
  if (Array.isArray(input)) {
    tokens = input.map((item) => String(item ?? '').trim()).filter(Boolean);
  } else if (typeof input === 'string') {
    tokens = input
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    throw new TypeError('Allowed IPs must be an array or comma/newline separated string.');
  }

  const normalizedSet = new Set();
  for (const rawToken of tokens) {
    const normalized = normalizeClientIp(rawToken);
    if (!normalized) {
      throw new TypeError(`Invalid IP address in whitelist: "${rawToken}"`);
    }
    normalizedSet.add(normalized);
  }
  return Array.from(normalizedSet);
}

export function extractRequestClientIp(req) {
  if (!req) return null;
  const headers = req.headers || {};
  const getHeader = (name) => String(req.get?.(name) ?? headers[name] ?? '').trim();
  const cfConnecting = getHeader('cf-connecting-ip');
  const realIp = getHeader('x-real-ip');
  const forwardedFirst = getHeader('x-forwarded-for').split(',')[0]?.trim();

  const candidates = [req.ip, cfConnecting, realIp, forwardedFirst, req.socket?.remoteAddress];
  for (const candidate of candidates) {
    const normalized = normalizeClientIp(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function checkStaffIpAccess(profile, reqIp) {
  const rawAllowed = parseJsonArray(profile?.allowedIps ?? profile?.allowed_ips);
  if (!rawAllowed.length) {
    return { allowed: true };
  }

  const normalizedAllowed = rawAllowed
    .map((ip) => normalizeClientIp(String(ip || '')))
    .filter(Boolean);

  if (!normalizedAllowed.length) {
    return { allowed: true };
  }

  const normalizedReqIp = normalizeClientIp(reqIp);
  if (normalizedReqIp && normalizedAllowed.includes(normalizedReqIp)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    statusCode: 403,
    error: ADMIN_IP_DENIED_ERROR,
    code: ADMIN_IP_DENIED_CODE
  };
}

export function normalizePermissionsList(input, fallbackRoleKey = 'support_agent') {
  if (input === undefined || input === null) {
    const preset = ADMIN_ROLE_PRESETS[fallbackRoleKey];
    return preset ? [...preset.permissions] : [];
  }
  if (!Array.isArray(input)) {
    throw new TypeError('Permissions must be an array of permission keys.');
  }
  const unique = new Set();
  for (const key of input) {
    const cleanKey = String(key || '').trim();
    if (VALID_PERMISSION_SET.has(cleanKey)) {
      unique.add(cleanKey);
    }
  }
  return Array.from(unique);
}

export function resolveEffectivePermissions(user, profile) {
  if (!user || user.isBanned) return [];
  if (isSuperAdminUser(user)) return [...ALL_PERMISSION_KEYS];

  if (profile) {
    if (profile.isActive === false || profile.is_active === false) {
      return [];
    }
    const profilePerms = parseJsonArray(profile.permissions)
      .map((key) => String(key || '').trim())
      .filter((key) => VALID_PERMISSION_SET.has(key));
    if (profilePerms.length > 0) {
      return Array.from(new Set(profilePerms));
    }
    const roleKey = profile.roleKey || profile.role_key || 'support_agent';
    return [...(ADMIN_ROLE_PRESETS[roleKey]?.permissions || [])];
  }

  if (user.role === 'admin') {
    return [...LEGACY_ADMIN_DEFAULT_PERMISSIONS];
  }
  return [];
}

export function hasAdminPermission(user, profile, permKey) {
  if (!user || user.isBanned) return false;
  if (isSuperAdminUser(user)) return true;
  if (!permKey) return false;
  const effective = resolveEffectivePermissions(user, profile);
  return effective.includes(permKey);
}

function mapProfileRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    roleKey: row.role_key || 'support_agent',
    permissions: parseJsonArray(row.permissions).filter((key) => VALID_PERMISSION_SET.has(key)),
    allowedIps: parseJsonArray(row.allowed_ips)
      .map((ip) => normalizeClientIp(String(ip || '')))
      .filter(Boolean),
    hasPin: Boolean(row.pin_hash),
    pinHash: row.pin_hash || null,
    pinSetAt: row.pin_set_at || null,
    pinFailedAttempts: Number(row.pin_failed_attempts || 0),
    pinLockedUntil: row.pin_locked_until || null,
    isActive: row.is_active !== false,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

export async function getStaffSecurityProfile(userId) {
  if (!userId) return null;
  await ensureStaffSecuritySchema();
  const { rows } = await queryPg(
    `SELECT user_id, role_key, permissions, allowed_ips, pin_hash, pin_set_at,
            pin_failed_attempts, pin_locked_until, is_active,
            created_by, updated_by, created_at, updated_at
     FROM system_admin_staff_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [String(userId)]
  );
  return mapProfileRow(rows[0]);
}

export function getStaffSecurityState(user, profile, clientIp = null) {
  const superAdmin = isSuperAdminUser(user);
  const effectiveRoleKey = superAdmin
    ? 'super_admin'
    : (profile?.roleKey || (user?.role === 'admin' ? 'operations_admin' : 'support_agent'));
  const hasPin = Boolean(profile?.hasPin || profile?.pinHash);
  const allowedIps = profile?.allowedIps || [];
  const ipCheck = profile?.isActive === false
    ? { allowed: false, statusCode: 403, error: 'Staff access is disabled.', code: 'ADMIN_STAFF_DISABLED' }
    : checkStaffIpAccess(profile, clientIp);

  return {
    roleKey: effectiveRoleKey,
    permissions: resolveEffectivePermissions(user, profile),
    hasPin,
    requiresPinSetup: !hasPin,
    isSuperAdmin: superAdmin,
    isActive: superAdmin ? true : (profile ? profile.isActive !== false : user?.role === 'admin'),
    allowedIpsConfigured: allowedIps.length > 0,
    allowedIpsCount: allowedIps.length,
    lockedUntil: profile?.pinLockedUntil || null,
    failedAttempts: Number(profile?.pinFailedAttempts || 0),
    ipCheck
  };
}

/**
 * Enforces IP whitelist for any user with an active record in system_admin_staff_profiles
 * that specifies non-empty allowed_ips. Used at BOTH login and admin route boundaries.
 */
export async function enforceStaffIpForLogin(user, req) {
  if (!user?.id) return { allowed: true, profile: null };
  const profile = await getStaffSecurityProfile(user.id);
  if (!profile || profile.isActive === false) {
    return { allowed: true, profile };
  }
  const clientIp = extractRequestClientIp(req);
  const check = checkStaffIpAccess(profile, clientIp);
  if (!check.allowed) {
    await recordSecurityEvent({
      eventType: 'admin.ip_whitelist_blocked',
      severity: 'warning',
      userId: user.id,
      subject: user.email,
      ip: clientIp,
      userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent'],
      details: {
        roleKey: profile.roleKey,
        path: String(req?.originalUrl || req?.path || '').slice(0, 120)
      }
    }).catch(() => {});
  }
  return { ...check, profile };
}

export async function setupInitialAdminPin(user, { pin, confirmPin, secondConfirmation, confirmedTwice } = {}) {
  if (!user?.id) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  await ensureStaffSecuritySchema();
  const existing = await getStaffSecurityProfile(user.id);
  if (existing?.pinHash) {
    const err = new Error('Security PIN is already set. Use Forgot PIN to reset it.');
    err.statusCode = 409;
    throw err;
  }

  const cleanPin = typeof pin === 'string' ? pin.trim() : '';
  const cleanConfirm = typeof confirmPin === 'string' ? confirmPin.trim() : '';
  const cleanSecond = typeof secondConfirmation === 'string' ? secondConfirmation.trim() : '';

  if (!isValidAdminPin(cleanPin)) {
    const err = new Error('Security PIN must be 4 to 8 numeric digits.');
    err.statusCode = 400;
    throw err;
  }
  if (cleanPin !== cleanConfirm) {
    const err = new Error('Security PIN and confirmation PIN do not match.');
    err.statusCode = 400;
    throw err;
  }
  const hasSecondConfirm = secondConfirmation !== undefined && secondConfirmation !== null
    ? cleanSecond === cleanPin
    : confirmedTwice === true;
  if (!hasSecondConfirm) {
    const err = new Error('Complete the second PIN confirmation step before saving.');
    err.statusCode = 400;
    throw err;
  }

  const pinHash = hashAdminPin(cleanPin);
  const defaultRoleKey = isSuperAdminUser(user)
    ? 'super_admin'
    : (existing?.roleKey || 'operations_admin');
  const defaultPerms = existing?.permissions?.length
    ? existing.permissions
    : resolveEffectivePermissions(user, existing);
  const allowedIps = existing?.allowedIps || [];

  await queryPg(
    `INSERT INTO system_admin_staff_profiles
       (user_id, role_key, permissions, allowed_ips, pin_hash, pin_set_at,
        pin_failed_attempts, pin_locked_until, is_active, created_by, updated_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, CURRENT_TIMESTAMP, 0, NULL, TRUE, $1, $1)
     ON CONFLICT (user_id) DO UPDATE SET
       pin_hash = EXCLUDED.pin_hash,
       pin_set_at = CURRENT_TIMESTAMP,
       pin_failed_attempts = 0,
       pin_locked_until = NULL,
       updated_by = $1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      user.id,
      defaultRoleKey,
      JSON.stringify(defaultPerms),
      JSON.stringify(allowedIps),
      pinHash
    ]
  );

  await recordSecurityEvent({
    eventType: 'admin.pin_configured',
    severity: 'info',
    userId: user.id,
    subject: user.email
  }).catch(() => {});

  return { success: true, hasPin: true, requiresPinSetup: false };
}

export async function verifyAdminPinForUser(user, pin, clientMeta = {}) {
  if (!user?.id || !user?.email) {
    return { valid: false, statusCode: 401, error: 'Authentication required.' };
  }
  await ensureStaffSecuritySchema();
  const profile = await getStaffSecurityProfile(user.id);
  if (!profile?.pinHash) {
    return {
      valid: false,
      statusCode: 428,
      code: 'ADMIN_PIN_SETUP_REQUIRED',
      error: 'Please set up your Security PIN before verifying admin actions.'
    };
  }

  if (profile.pinLockedUntil) {
    const lockUntilMs = new Date(profile.pinLockedUntil).getTime();
    if (Number.isFinite(lockUntilMs) && lockUntilMs > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 60000));
      return {
        valid: false,
        statusCode: 429,
        code: 'ADMIN_PIN_LOCKED',
        lockedUntil: profile.pinLockedUntil,
        error: `Too many incorrect Security PIN attempts. Try again in ${remainingMinutes} minute(s) or use Forgot PIN.`
      };
    }
  }

  const cleanPin = typeof pin === 'string' ? pin.trim() : '';
  const isMatch = verifyAdminPin(cleanPin, profile.pinHash);

  if (!isMatch) {
    const nextAttempts = Number(profile.pinFailedAttempts || 0) + 1;
    const isNowLocked = nextAttempts >= PIN_MAX_FAILED_ATTEMPTS;
    const lockedUntilDate = isNowLocked ? new Date(Date.now() + PIN_LOCKOUT_DURATION_MS) : null;

    await queryPg(
      `UPDATE system_admin_staff_profiles
       SET pin_failed_attempts = $2,
           pin_locked_until = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [user.id, nextAttempts, lockedUntilDate ? lockedUntilDate.toISOString() : null]
    );

    await recordSecurityEvent({
      eventType: isNowLocked ? 'admin.pin_locked' : 'admin.pin_failed',
      severity: 'warning',
      userId: user.id,
      subject: user.email,
      ip: clientMeta.ip || null,
      userAgent: clientMeta.userAgent || null,
      details: { failedAttempts: nextAttempts }
    }).catch(() => {});

    const remainingAttempts = Math.max(0, PIN_MAX_FAILED_ATTEMPTS - nextAttempts);
    return {
      valid: false,
      statusCode: isNowLocked ? 429 : 401,
      code: isNowLocked ? 'ADMIN_PIN_LOCKED' : 'INVALID_ADMIN_PIN',
      failedAttempts: nextAttempts,
      remainingAttempts,
      lockedUntil: lockedUntilDate ? lockedUntilDate.toISOString() : null,
      error: isNowLocked
        ? 'Security PIN locked for 15 minutes after 5 failed attempts. Use Forgot PIN to reset via email OTP.'
        : `Incorrect Security PIN. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
    };
  }

  await queryPg(
    `UPDATE system_admin_staff_profiles
     SET pin_failed_attempts = 0,
         pin_locked_until = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [user.id]
  );

  const grant = await createSecureGrant(user.email, 'sensitive_action_grant', 5);
  return {
    valid: true,
    grant,
    expiresInSeconds: 300
  };
}

export async function resetAdminPinWithOtp(user, { newPin, confirmPin } = {}) {
  if (!user?.id) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  await ensureStaffSecuritySchema();

  const cleanPin = typeof newPin === 'string' ? newPin.trim() : '';
  const cleanConfirm = typeof confirmPin === 'string' ? confirmPin.trim() : '';

  if (!isValidAdminPin(cleanPin)) {
    const err = new Error('New Security PIN must be 4 to 8 numeric digits.');
    err.statusCode = 400;
    throw err;
  }
  if (cleanPin !== cleanConfirm) {
    const err = new Error('New Security PIN and confirmation do not match.');
    err.statusCode = 400;
    throw err;
  }

  const existing = await getStaffSecurityProfile(user.id);
  const pinHash = hashAdminPin(cleanPin);
  const roleKey = isSuperAdminUser(user)
    ? 'super_admin'
    : (existing?.roleKey || 'operations_admin');
  const perms = existing?.permissions?.length
    ? existing.permissions
    : resolveEffectivePermissions(user, existing);
  const allowedIps = existing?.allowedIps || [];

  await queryPg(
    `INSERT INTO system_admin_staff_profiles
       (user_id, role_key, permissions, allowed_ips, pin_hash, pin_set_at,
        pin_failed_attempts, pin_locked_until, is_active, created_by, updated_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, CURRENT_TIMESTAMP, 0, NULL, TRUE, $1, $1)
     ON CONFLICT (user_id) DO UPDATE SET
       pin_hash = EXCLUDED.pin_hash,
       pin_set_at = CURRENT_TIMESTAMP,
       pin_failed_attempts = 0,
       pin_locked_until = NULL,
       updated_by = $1,
       updated_at = CURRENT_TIMESTAMP`,
    [user.id, roleKey, JSON.stringify(perms), JSON.stringify(allowedIps), pinHash]
  );

  return { success: true, hasPin: true, requiresPinSetup: false };
}

function isProtectedSuperAdminRecord(row) {
  if (!row) return false;
  const email = String(row.email || '').trim().toLowerCase();
  return (
    row.role === 'super_admin' ||
    row.role_key === 'super_admin' ||
    row.roleKey === 'super_admin' ||
    email === SUPER_ADMIN_EMAIL
  );
}

export function sanitizeStaffRecordForActor(row, actorUser) {
  if (!row) return null;
  const actorIsSuperAdmin = isSuperAdminUser(actorUser);
  if (isProtectedSuperAdminRecord(row) && !actorIsSuperAdmin) {
    return null;
  }

  const permissions = parseJsonArray(row.permissions).filter((key) => VALID_PERMISSION_SET.has(key));
  const roleKey = isProtectedSuperAdminRecord(row)
    ? 'super_admin'
    : (row.role_key || row.roleKey || 'operations_admin');
  const effectivePermissions = permissions.length
    ? permissions
    : [...(ADMIN_ROLE_PRESETS[roleKey]?.permissions || LEGACY_ADMIN_DEFAULT_PERMISSIONS)];

  return {
    userId: row.id || row.user_id || row.userId,
    name: row.name || row.store_name || row.email || 'Staff Member',
    email: row.email,
    avatar: row.avatar || null,
    systemRole: row.role || 'admin',
    roleKey,
    roleTitle: ADMIN_ROLE_PRESETS[roleKey]?.title || roleKey,
    permissions: effectivePermissions,
    allowedIps: parseJsonArray(row.allowed_ips ?? row.allowedIps)
      .map((ip) => normalizeClientIp(String(ip || '')))
      .filter(Boolean),
    hasPin: Boolean(row.has_pin ?? row.hasPin ?? row.pin_hash),
    pinSetAt: row.pin_set_at || row.pinSetAt || null,
    isActive: row.is_active !== false && row.isActive !== false && !row.is_banned,
    isBanned: Boolean(row.is_banned),
    isSuperAdmin: isProtectedSuperAdminRecord(row),
    createdAt: row.profile_created_at || row.created_at || null,
    updatedAt: row.profile_updated_at || row.updated_at || null
  };
}

export async function listStaffMembers({ actorUser }) {
  await ensureStaffSecuritySchema();
  const { rows } = await queryPg(`
    SELECT u.id, u.name, u.store_name, u.email, u.avatar, u.role, u.is_banned, u.created_at,
           p.role_key, p.permissions, p.allowed_ips,
           (p.pin_hash IS NOT NULL) AS has_pin,
           p.pin_set_at, p.is_active,
           p.created_at AS profile_created_at,
           p.updated_at AS profile_updated_at
    FROM system_users u
    LEFT JOIN system_admin_staff_profiles p ON p.user_id = u.id
    WHERE u.role IN ('admin', 'super_admin') OR p.user_id IS NOT NULL
    ORDER BY
      CASE WHEN u.role = 'super_admin' OR LOWER(u.email) = $1 THEN 0 ELSE 1 END,
      COALESCE(p.created_at, u.created_at) DESC
  `, [SUPER_ADMIN_EMAIL]);

  return rows
    .map((row) => sanitizeStaffRecordForActor(row, actorUser))
    .filter(Boolean);
}

export async function listStaffSecurityActivityForActor({ actorUser, limit = 50 } = {}) {
  await ensureStaffSecuritySchema();
  const boundedLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
  const actorIsSuperAdmin = isSuperAdminUser(actorUser);
  const { rows } = await queryPg(
    `SELECT e.id, e.event_type, e.severity, e.user_id, e.remote_ip::text AS remote_ip,
            e.details, e.created_at,
            u.email AS user_email, u.role AS user_role, p.role_key AS staff_role_key
     FROM system_security_events e
     LEFT JOIN system_users u ON u.id = e.user_id
     LEFT JOIN system_admin_staff_profiles p ON p.user_id = e.user_id
     WHERE e.event_type LIKE 'admin.%'
     ORDER BY e.id DESC
     LIMIT $1`,
    [boundedLimit]
  );

  return rows
    .filter((row) => {
      if (actorIsSuperAdmin) return true;
      return !isProtectedSuperAdminRecord({
        email: row.user_email,
        role: row.user_role,
        role_key: row.staff_role_key
      });
    })
    .map((row) => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      userEmail: row.user_email || null,
      remoteIp: row.remote_ip || null,
      details: row.details || {},
      createdAt: row.created_at
    }));
}

export async function assertActorCanManageTargetStaff(actorUser, targetUserId, MasterDB) {
  const actorProfile = await getStaffSecurityProfile(actorUser.id);
  if (!hasAdminPermission(actorUser, actorProfile, 'manage_staff_roles')) {
    const err = new Error('Forbidden. Manage Staff & Roles permission is required.');
    err.statusCode = 403;
    throw err;
  }

  if (targetUserId) {
    const targetUser = await MasterDB.findUserByIdentifier(targetUserId);
    const targetProfile = await getStaffSecurityProfile(targetUser?.id || targetUserId);
    if (
      (targetUser && isSuperAdminUser(targetUser)) ||
      (targetProfile && targetProfile.roleKey === 'super_admin')
    ) {
      if (!isSuperAdminUser(actorUser)) {
        const err = new Error('Forbidden. Super Admin accounts are isolated and cannot be viewed or modified.');
        err.statusCode = 403;
        throw err;
      }
    }
    return { actorProfile, targetUser, targetProfile };
  }
  return { actorProfile, targetUser: null, targetProfile: null };
}

export async function upsertStaffMember({
  actorUser,
  targetUserId = null,
  name,
  email,
  password,
  roleKey = 'support_agent',
  permissions,
  allowedIps,
  isActive = true,
  MasterDB
}) {
  await ensureStaffSecuritySchema();
  const { targetUser: existingTarget } = await assertActorCanManageTargetStaff(actorUser, targetUserId, MasterDB);

  const cleanRoleKey = String(roleKey || 'support_agent').trim();
  if (!ADMIN_ROLE_PRESETS[cleanRoleKey]) {
    const err = new Error('Invalid staff role preset.');
    err.statusCode = 400;
    throw err;
  }
  if (cleanRoleKey === 'super_admin' && !isSuperAdminUser(actorUser)) {
    const err = new Error('Only a Super Admin can assign the Super Admin role.');
    err.statusCode = 403;
    throw err;
  }

  const normalizedIps = normalizeAllowedIps(allowedIps);
  const normalizedPerms = normalizePermissionsList(permissions, cleanRoleKey);

  let resolvedUser = existingTarget;
  if (!resolvedUser) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const err = new Error('A valid staff email address is required.');
      err.statusCode = 400;
      throw err;
    }

    const foundByEmail = await MasterDB.findUserByIdentifier(cleanEmail);
    if (foundByEmail) {
      if (isSuperAdminUser(foundByEmail) && !isSuperAdminUser(actorUser)) {
        const err = new Error('Forbidden. Super Admin accounts cannot be modified.');
        err.statusCode = 403;
        throw err;
      }
      resolvedUser = await MasterDB.updateUser(foundByEmail.id, {
        role: cleanRoleKey === 'super_admin' && isSuperAdminUser(actorUser) ? 'super_admin' : 'admin',
        emailVerified: true,
        ...(cleanName ? { name: cleanName } : {})
      });
    } else {
      if (!cleanName) {
        const err = new Error('Staff full name is required.');
        err.statusCode = 400;
        throw err;
      }
      if (!password || String(password).length < 8) {
        const err = new Error('Staff password must be at least 8 characters.');
        err.statusCode = 400;
        throw err;
      }
      const staffCode = `TIW-STF-${randomBytes(3).toString('hex').toUpperCase()}`;
      const created = await MasterDB.createUser({
        id: `stf_${randomUUID()}`,
        tiwiId: staffCode,
        storeId: staffCode,
        storeName: `${cleanName} (Tiwlo Staff)`,
        name: cleanName,
        email: cleanEmail,
        password: String(password),
        emailVerified: true,
        twoFactorEnabled: false,
        authMethod: 'credentials'
      });
      resolvedUser = await MasterDB.updateUser(created.id, {
        role: cleanRoleKey === 'super_admin' && isSuperAdminUser(actorUser) ? 'super_admin' : 'admin',
        emailVerified: true
      });
    }
  } else {
    const desiredSystemRole = isSuperAdminUser(resolvedUser)
      ? 'super_admin'
      : (cleanRoleKey === 'super_admin' && isSuperAdminUser(actorUser) ? 'super_admin' : 'admin');
    const updates = { role: desiredSystemRole };
    if (name && String(name).trim()) updates.name = String(name).trim();
    resolvedUser = await MasterDB.updateUser(resolvedUser.id, updates);
  }

  const activeFlag = isSuperAdminUser(resolvedUser) ? true : Boolean(isActive);

  await queryPg(
    `INSERT INTO system_admin_staff_profiles
       (user_id, role_key, permissions, allowed_ips, is_active, created_by, updated_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       role_key = EXCLUDED.role_key,
       permissions = EXCLUDED.permissions,
       allowed_ips = EXCLUDED.allowed_ips,
       is_active = EXCLUDED.is_active,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      resolvedUser.id,
      isSuperAdminUser(resolvedUser) ? 'super_admin' : cleanRoleKey,
      JSON.stringify(normalizedPerms),
      JSON.stringify(normalizedIps),
      activeFlag,
      actorUser.id
    ]
  );

  if (!activeFlag) {
    await MasterDB.revokeUserSessions?.(resolvedUser.id).catch(() => {});
  }

  const all = await listStaffMembers({ actorUser });
  const staff = all.find((item) => item.userId === resolvedUser.id) || null;
  return staff;
}

export async function removeStaffMember({ actorUser, targetUserId, MasterDB }) {
  await ensureStaffSecuritySchema();
  const { targetUser } = await assertActorCanManageTargetStaff(actorUser, targetUserId, MasterDB);
  if (!targetUser) {
    const err = new Error('Staff account not found.');
    err.statusCode = 404;
    throw err;
  }
  if (targetUser.id === actorUser.id) {
    const err = new Error('You cannot remove your own active staff privileges.');
    err.statusCode = 400;
    throw err;
  }
  if (isSuperAdminUser(targetUser)) {
    const err = new Error('Primary Super Admin privileges cannot be removed.');
    err.statusCode = 403;
    throw err;
  }

  await queryPg('DELETE FROM system_admin_staff_profiles WHERE user_id = $1', [targetUser.id]);
  await MasterDB.updateUser(targetUser.id, { role: 'owner' });
  await MasterDB.revokeUserSessions?.(targetUser.id).catch(() => {});

  return { success: true, userId: targetUser.id };
}
