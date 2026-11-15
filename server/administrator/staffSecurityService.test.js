import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { getPgPool } from '../db/postgres.js';
import {
  ADMIN_IP_DENIED_CODE,
  ADMIN_IP_DENIED_ERROR,
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_PRESETS,
  checkStaffIpAccess,
  enforceStaffIpForLogin,
  hasAdminPermission,
  hashAdminPin,
  isSuperAdminUser,
  isValidAdminPin,
  normalizeAllowedIps,
  resetStaffSchemaCache,
  verifyAdminPin
} from './staffSecurityService.js';
import { createAdminStaffRouter } from './adminStaffRoutes.js';

test('hashAdminPin & verifyAdminPin validate 4-8 digit PINs with scrypt and timingSafeEqual', () => {
  assert.equal(isValidAdminPin('1234'), true);
  assert.equal(isValidAdminPin('12345678'), true);
  assert.equal(isValidAdminPin('123'), false);
  assert.equal(isValidAdminPin('123456789'), false);
  assert.equal(isValidAdminPin('12ab'), false);
  assert.equal(isValidAdminPin(1234), false);

  assert.throws(() => hashAdminPin('12a4'), TypeError);
  assert.throws(() => hashAdminPin('123'), TypeError);

  const hashA = hashAdminPin('482910');
  const hashB = hashAdminPin('482910');
  assert.notEqual(hashA, hashB); // distinct random salts
  assert.ok(hashA.startsWith('scrypt$'));

  assert.equal(verifyAdminPin('482910', hashA), true);
  assert.equal(verifyAdminPin('482911', hashA), false);
  assert.equal(verifyAdminPin('482910', 'invalid-hash'), false);
  assert.equal(verifyAdminPin('abc', hashA), false);
});

test('normalizeAllowedIps & checkStaffIpAccess enforce optional IP whitelist with exact 403 message', () => {
  assert.deepEqual(normalizeAllowedIps(''), []);
  assert.deepEqual(normalizeAllowedIps(null), []);
  assert.deepEqual(
    normalizeAllowedIps('::ffff:103.10.20.30, 203.0.113.5\n103.10.20.30 ; ::1'),
    ['103.10.20.30', '203.0.113.5', '127.0.0.1']
  );
  assert.throws(() => normalizeAllowedIps('103.10.20.30, not-an-ip'), TypeError);

  // Empty whitelist allows any IP
  assert.deepEqual(checkStaffIpAccess({ allowedIps: [] }, '198.51.100.4'), { allowed: true });
  assert.deepEqual(checkStaffIpAccess(null, '198.51.100.4'), { allowed: true });

  // Non-empty whitelist checks normalized IP match and blocks others with exact error
  const restricted = { allowedIps: ['103.10.20.30', '2001:db8::1'] };
  assert.deepEqual(checkStaffIpAccess(restricted, '::ffff:103.10.20.30'), { allowed: true });
  assert.deepEqual(checkStaffIpAccess(restricted, '2001:db8::1'), { allowed: true });

  const denied = checkStaffIpAccess(restricted, '198.51.100.99');
  assert.deepEqual(denied, {
    allowed: false,
    statusCode: 403,
    error: 'Your IP is not whitelisted',
    code: 'ADMIN_IP_NOT_ALLOWED'
  });
  assert.equal(denied.error, ADMIN_IP_DENIED_ERROR);
  assert.equal(denied.code, ADMIN_IP_DENIED_CODE);
});

test('Meta-style RBAC presets & super_admin checks enforce least privilege and prevent email impersonation', () => {
  assert.equal(isSuperAdminUser({ role: 'super_admin', email: 'root@tiwlo.com' }), true);
  assert.equal(isSuperAdminUser({ role: 'admin', email: 'tiwloltd@gmail.com' }), true);
  assert.equal(isSuperAdminUser({ role: 'owner', email: 'tiwloltd@gmail.com' }), false);
  assert.equal(isSuperAdminUser({ role: 'super_admin', email: 'tiwloltd@gmail.com', isBanned: true }), false);

  for (const perm of ADMIN_PERMISSION_CATALOG) {
    assert.equal(
      hasAdminPermission({ role: 'super_admin', email: 'root@tiwlo.com' }, null, perm.key),
      true
    );
  }

  const opsProfile = { roleKey: 'operations_admin', permissions: ADMIN_ROLE_PRESETS.operations_admin.permissions, isActive: true };
  const opsUser = { id: 'u1', role: 'admin', email: 'ops@tiwlo.com' };
  assert.equal(hasAdminPermission(opsUser, opsProfile, 'manage_stores'), true);
  assert.equal(hasAdminPermission(opsUser, opsProfile, 'delete_stores'), false);
  assert.equal(hasAdminPermission(opsUser, opsProfile, 'manage_staff_roles'), false);
  assert.equal(hasAdminPermission(opsUser, opsProfile, 'manage_system_settings'), false);

  const financeProfile = { roleKey: 'finance_analyst', permissions: [], isActive: true };
  assert.equal(hasAdminPermission(opsUser, financeProfile, 'view_financials'), true);
  assert.equal(hasAdminPermission(opsUser, financeProfile, 'view_stores'), true);
  assert.equal(hasAdminPermission(opsUser, financeProfile, 'manage_stores'), false);

  const inactiveProfile = { roleKey: 'operations_admin', permissions: ['manage_stores'], isActive: false };
  assert.equal(hasAdminPermission(opsUser, inactiveProfile, 'manage_stores'), false);
});

test('adminStaffRoutes: PIN setup, 5-attempt lockout, grant without Email OTP, Forgot PIN OTP, IP block & super_admin isolation', async (t) => {
  resetStaffSchemaCache();

  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET,
    SECURITY_SECRET: process.env.SECURITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust-auth.local';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 's'.repeat(32);
  process.env.SECURITY_SECRET = 'a'.repeat(32);
  t.after(() => {
    for (const [k, v] of Object.entries(previousRustEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetStaffSchemaCache();
  });

  const users = new Map([
    ['super-1', { id: 'super-1', name: 'Root', email: 'tiwloltd@gmail.com', role: 'super_admin', isBanned: false }],
    ['staff-1', { id: 'staff-1', name: 'Ops Lead', email: 'ops@tiwlo.com', role: 'admin', isBanned: false }],
    ['staff-2', { id: 'staff-2', name: 'Restricted Agent', email: 'agent@tiwlo.com', role: 'admin', isBanned: false }]
  ]);

  const profiles = new Map([
    ['super-1', {
      user_id: 'super-1',
      role_key: 'super_admin',
      permissions: ADMIN_PERMISSION_CATALOG.map((p) => p.key),
      allowed_ips: ['10.0.0.1'],
      pin_hash: null,
      pin_set_at: null,
      pin_failed_attempts: 0,
      pin_locked_until: null,
      is_active: true
    }],
    ['staff-1', {
      user_id: 'staff-1',
      role_key: 'operations_admin',
      permissions: [...ADMIN_ROLE_PRESETS.operations_admin.permissions, 'manage_staff_roles'],
      allowed_ips: [],
      pin_hash: null,
      pin_set_at: null,
      pin_failed_attempts: 0,
      pin_locked_until: null,
      is_active: true
    }],
    ['staff-2', {
      user_id: 'staff-2',
      role_key: 'support_agent',
      permissions: ADMIN_ROLE_PRESETS.support_agent.permissions,
      allowed_ips: ['203.0.113.10'],
      pin_hash: hashAdminPin('7788'),
      pin_set_at: new Date().toISOString(),
      pin_failed_attempts: 0,
      pin_locked_until: null,
      is_active: true
    }]
  ]);

  const securityEvents = [
    { id: 1, event_type: 'admin.pin_configured', severity: 'info', user_id: 'super-1', remote_ip: '10.0.0.1', details: {}, created_at: new Date().toISOString() },
    { id: 2, event_type: 'admin.ip_whitelist_blocked', severity: 'warning', user_id: 'staff-2', remote_ip: '198.51.100.5', details: {}, created_at: new Date().toISOString() }
  ];

  t.mock.method(getPgPool(), 'query', async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { rows: [] };
    }
    if (normalized.includes('FROM system_admin_staff_profiles WHERE user_id = $1')) {
      const row = profiles.get(params[0]);
      return { rows: row ? [row] : [] };
    }
    if (normalized.startsWith('INSERT INTO system_admin_staff_profiles')) {
      const [userId, roleKey, permsJson, ipsJson, pinHash] = params;
      const existing = profiles.get(userId) || {};
      const next = {
        ...existing,
        user_id: userId,
        role_key: roleKey,
        permissions: JSON.parse(permsJson),
        allowed_ips: JSON.parse(ipsJson),
        pin_hash: pinHash || existing.pin_hash || null,
        pin_set_at: pinHash ? new Date().toISOString() : existing.pin_set_at || null,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        is_active: true
      };
      profiles.set(userId, next);
      return { rows: [next] };
    }
    if (normalized.startsWith('UPDATE system_admin_staff_profiles SET pin_failed_attempts')) {
      const [userId, attempts, lockedUntil] = params;
      const row = profiles.get(userId);
      if (row) {
        row.pin_failed_attempts = attempts;
        row.pin_locked_until = lockedUntil;
      }
      return { rows: row ? [row] : [] };
    }
    if (normalized.includes('FROM system_users u LEFT JOIN system_admin_staff_profiles p')) {
      const rows = Array.from(users.values()).map((u) => {
        const p = profiles.get(u.id);
        return {
          id: u.id,
          name: u.name,
          store_name: u.name,
          email: u.email,
          avatar: null,
          role: u.role,
          is_banned: u.isBanned,
          created_at: new Date().toISOString(),
          role_key: p?.role_key || null,
          permissions: p?.permissions || [],
          allowed_ips: p?.allowed_ips || [],
          has_pin: Boolean(p?.pin_hash),
          pin_set_at: p?.pin_set_at || null,
          is_active: p?.is_active !== false
        };
      });
      return { rows };
    }
    if (normalized.includes('FROM system_security_events e')) {
      const rows = [...securityEvents].reverse().map((ev) => {
        const u = users.get(ev.user_id);
        const p = profiles.get(ev.user_id);
        return {
          ...ev,
          user_email: u?.email || null,
          user_role: u?.role || null,
          staff_role_key: p?.role_key || null
        };
      });
      return { rows };
    }
    if (normalized.startsWith('INSERT INTO system_security_events')) {
      const id = securityEvents.length + 1;
      securityEvents.push({
        id,
        event_type: params[0],
        severity: params[1],
        user_id: params[2],
        remote_ip: params[4],
        details: JSON.parse(params[6] || '{}'),
        created_at: new Date().toISOString()
      });
      return { rows: [{ id }] };
    }
    if (normalized.startsWith('INSERT INTO system_email_outbox')) {
      return { rows: [{ id: 1 }] };
    }
    return { rows: [] };
  });

  const issuedGrants = [];
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const urlStr = String(url);
    if (urlStr.startsWith('http://127.0.0.1:')) {
      return nativeFetch(url, init);
    }
    if (urlStr === 'http://rust-auth.local/v1/auth/grants') {
      const body = JSON.parse(init.body);
      const token = `grant_${'f'.repeat(64)}`;
      issuedGrants.push({ email: body.email, type: body.type, token });
      return new Response(JSON.stringify({ token }), { status: 200 });
    }
    if (urlStr === 'http://rust-auth.local/v1/auth/otp') {
      return new Response(JSON.stringify({
        code: '654321',
        token: `tok_${'a'.repeat(48)}`,
        expiresAt: Date.now() + 600000
      }), { status: 200 });
    }
    if (urlStr === 'http://rust-auth.local/v1/auth/otp/verify') {
      const body = JSON.parse(init.body);
      const valid = body.code === '654321';
      return new Response(JSON.stringify(valid
        ? { valid: true, email: 'staff-1@tiwlo.com' === body.email ? body.email : 'ops@tiwlo.com', error: null }
        : { valid: false, email: null, error: 'Invalid OTP' }), { status: 200 });
    }
    throw new Error(`Unexpected external fetch: ${urlStr}`);
  });

  const MasterDB = {
    async findUserByIdentifier(id) {
      for (const u of users.values()) {
        if (u.id === id || u.email.toLowerCase() === String(id).toLowerCase()) return u;
      }
      return null;
    },
    async updateUser(id, updates) {
      const u = users.get(id);
      if (!u) return null;
      Object.assign(u, updates);
      return u;
    },
    async revokeUserSessions() {}
  };

  let activeActor = users.get('staff-1');
  const requireAdmin = (req, _res, next) => {
    req.adminUser = activeActor;
    next();
  };
  const requireRecentReauth = (_req, _res, next) => next();

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/admin', createAdminStaffRouter({ requireAdmin, requireRecentReauth, MasterDB }));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;

  // 1. Admin without PIN sees requiresPinSetup: true
  const meRes = await fetch(`${base}/staff-support/me`);
  assert.equal(meRes.status, 200);
  const meJson = await meRes.json();
  assert.equal(meJson.hasPin, false);
  assert.equal(meJson.requiresPinSetup, true);

  // 2. Setup rejects missing 2nd confirmation and saves on valid 2-step confirmation
  const badSetup = await fetch(`${base}/security-pin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '135790', confirmPin: '135790', secondConfirmation: '000000' })
  });
  assert.equal(badSetup.status, 400);

  const okSetup = await fetch(`${base}/security-pin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '135790', confirmPin: '135790', secondConfirmation: '135790' })
  });
  assert.equal(okSetup.status, 200);
  const setupJson = await okSetup.json();
  assert.equal(setupJson.hasPin, true);
  assert.equal(setupJson.requiresPinSetup, false);

  // Cannot overwrite existing PIN via /setup
  const dupSetup = await fetch(`${base}/security-pin/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '246810', confirmPin: '246810', secondConfirmation: '246810' })
  });
  assert.equal(dupSetup.status, 409);

  // 3. Verify PIN issues sensitive_action_grant without Email OTP
  const verifyOk = await fetch(`${base}/security-pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '135790' })
  });
  assert.equal(verifyOk.status, 200);
  const verifyOkJson = await verifyOk.json();
  assert.ok(verifyOkJson.grant.startsWith('grant_'));
  assert.equal(issuedGrants[0].type, 'sensitive_action_grant');

  // 4. 5 wrong PIN attempts trigger 15-minute lockout (429)
  for (let i = 1; i <= 4; i++) {
    const failRes = await fetch(`${base}/security-pin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '999999' })
    });
    assert.equal(failRes.status, 401);
  }
  const lockRes = await fetch(`${base}/security-pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '999999' })
  });
  assert.equal(lockRes.status, 429);
  const lockJson = await lockRes.json();
  assert.equal(lockJson.code, 'ADMIN_PIN_LOCKED');

  // 5. Forgot PIN OTP reset unlocks account and sets new PIN
  const resetRes = await fetch(`${base}/security-pin/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken: `tok_${'a'.repeat(48)}`,
      otpCode: '654321',
      newPin: '258025',
      confirmPin: '258025'
    })
  });
  assert.equal(resetRes.status, 200);
  const resetJson = await resetRes.json();
  assert.ok(resetJson.grant.startsWith('grant_'));

  // 6. Super Admin Isolation: regular admin cannot see super_admin in list, activity, or target endpoints
  const listAsAdmin = await fetch(`${base}/staff-support`);
  assert.equal(listAsAdmin.status, 200);
  const listAsAdminJson = await listAsAdmin.json();
  assert.equal(listAsAdminJson.staff.some((s) => s.email === 'tiwloltd@gmail.com' || s.roleKey === 'super_admin'), false);

  const actAsAdmin = await fetch(`${base}/staff-support/activity`);
  assert.equal(actAsAdmin.status, 200);
  const actAsAdminJson = await actAsAdmin.json();
  assert.equal(actAsAdminJson.events.some((ev) => ev.userEmail === 'tiwloltd@gmail.com'), false);

  const getSuperTarget = await fetch(`${base}/staff-support/super-1`);
  assert.equal(getSuperTarget.status, 403);

  const editSuperTarget = await fetch(`${base}/staff-support/super-1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleKey: 'support_agent', allowedIps: [] })
  });
  assert.equal(editSuperTarget.status, 403);

  // 7. IP Whitelist blocks non-whitelisted IP on both admin routes and login helper
  activeActor = users.get('staff-2');
  const blockedAdminRes = await fetch(`${base}/staff-support/me`, {
    headers: { 'X-Forwarded-For': '198.51.100.77' }
  });
  assert.equal(blockedAdminRes.status, 403);
  assert.deepEqual(await blockedAdminRes.json(), {
    error: 'Your IP is not whitelisted',
    code: 'ADMIN_IP_NOT_ALLOWED'
  });

  const allowedAdminRes = await fetch(`${base}/staff-support/me`, {
    headers: { 'X-Forwarded-For': '203.0.113.10' }
  });
  assert.equal(allowedAdminRes.status, 200);

  const loginBlocked = await enforceStaffIpForLogin(users.get('staff-2'), {
    ip: '198.51.100.77',
    headers: {}
  });
  assert.equal(loginBlocked.allowed, false);
  assert.equal(loginBlocked.statusCode, 403);
  assert.equal(loginBlocked.error, 'Your IP is not whitelisted');
  assert.equal(loginBlocked.code, 'ADMIN_IP_NOT_ALLOWED');
});
