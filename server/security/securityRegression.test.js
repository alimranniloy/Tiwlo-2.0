import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-security-test-'));
process.env.TIWLO_DATA_DIR = dataDir;
const { MasterDB } = await import('../db/multiTenant.js');
const { getPgPool } = await import('../db/postgres.js');
const { BruteForceShield, SsoSecurity } = await import('./cryptoSecurity.js');
const { getActiveTiwiId } = await import('../db/storeDataAdapter.js');
const { default: authRoutes, authorizeEmailCorrection } = await import('../routes/authRoutes.js');
const { default: securityRoutes } = await import('./securityRoutes.js');
const { requireAdmin } = await import('../administrator/adminRoutes.js');
const { default: socialRoutes } = await import('../social/socialRoutes.js');
const { SocialDB } = await import('../social/socialDb.js');
const { executeSocialGraphQL } = await import('../social/socialSchema.js');

after(async () => {
  await getPgPool().end();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function withServer(run) {
  const app = express();
  // Only this loopback test server trusts synthetic source IPs.
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (req.headers.authorization === 'Bearer owner-session') {
      req.activeUser = { id: 'owner', email: 'owner@example.com' };
    }
    next();
  });
  app.get('/admin-check', requireAdmin, (_req, res) => res.sendStatus(204));
  app.use('/api', authRoutes, securityRoutes);
  app.use('/api/social', socialRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('unverified social identity claims cannot initiate account or MFA flows', async (t) => {
  t.mock.method(getPgPool(), 'query', async () => {
    assert.fail('Unverified social identity claims must not reach account storage');
  });
  await withServer(async base => {
    const response = await fetch(`${base}/api/auth/social-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'victim@example.com',
        name: 'Victim',
        provider: 'Google'
      })
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Google and GitHub sign-in are unavailable until provider identity tokens can be verified securely.'
    });
  });
});

test('social MFA state and displayed email come only from the server-side challenge', async (t) => {
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, ...args) => {
    if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url, ...args);
    return new Response(JSON.stringify({
      session: {
        email: 'owner@example.com',
        type: 'login_2fa',
        attempts: 0,
        max_attempts: 5,
        expires_at: Date.now() + 60_000
      }
    }), { status: 200 });
  });
  await withServer(async base => {
    const withoutCookie = await fetch(
      `${base}/api/auth/social/mfa-challenge?social_challenge=login&social_email=attacker@example.com`
    );
    assert.equal(withoutCookie.status, 401);
    assert.equal(withoutCookie.headers.get('cache-control'), 'no-store');

    const withCookie = await fetch(
      `${base}/api/auth/social/mfa-challenge?social_challenge=setup&social_email=attacker@example.com`,
      { headers: { Cookie: 'tiwlo_oauth_mfa=valid-server-challenge' } }
    );
    assert.equal(withCookie.status, 200);
    assert.deepEqual(await withCookie.json(), {
      success: true,
      challenge: 'login',
      emailMasked: 'o***r@example.com'
    });
  });
});

test('OTP challenge tokens alone cannot change an account email', async (t) => {
  t.mock.method(getPgPool(), 'query', async () => { throw new Error('Unauthenticated request reached the database'); });
  t.mock.method(MasterDB, 'updateUser', async () => assert.fail('Account must not be mutated'));
  await withServer(async base => {
    const response = await fetch(`${base}/api/auth/change-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken: 'victim-password-reset-challenge', newEmail: 'attacker@example.com' })
    });
    assert.equal(response.status, 401);
  });
});

test('email changes reject another account challenge and wrong challenge types', async (t) => {
  let challenge;
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, ...args) => {
    if (String(url).startsWith('http://127.0.0.1:')) {
      return nativeFetch(url, ...args);
    }
    return new Response(JSON.stringify({
      session: {
        email: challenge.email,
        type: challenge.type,
        attempts: 0,
        max_attempts: 5,
        expires_at: Date.now() + 60_000
      }
    }), { status: 200 });
  });
  t.mock.method(MasterDB, 'findUserByIdentifier', async () => ({ id: 'victim', email: 'victim@example.com' }));
  t.mock.method(MasterDB, 'updateUser', async () => assert.fail('Account must not be mutated'));
  await withServer(async base => {
    for (challenge of [
      { email: 'victim@example.com', type: 'email_verify' },
      { email: 'owner@example.com', type: 'password_reset' }
    ]) {
      const response = await fetch(`${base}/api/auth/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner-session' },
        body: JSON.stringify({ tempToken: 'challenge', newEmail: 'attacker@example.com', password: 'wrong-password' })
      });
      assert.equal(response.status, 403);
    }
  });
});

test('email correction requires the actual password and preserves verified-account and 2FA protections', async (t) => {
  const password = 'correct-test-password';
  const account = { id: 'owner', email: 'owner@example.com', password: 'legacy-password' };
  let user = account;
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/otp/session/get')) {
      return new Response(JSON.stringify({
        session: {
          email: 'owner@example.com',
          type: 'email_verify',
          attempts: 0,
          max_attempts: 5,
          expires_at: Date.now() + 60_000
        }
      }), { status: 200 });
    }
    if (url.endsWith('/hash')) {
      return new Response(JSON.stringify({
        passwordHash: `scrypt$16384:8:1$${'a'.repeat(32)}$${'b'.repeat(128)}`
      }), { status: 200 });
    }
    const { password: candidate } = JSON.parse(options.body);
    const valid = candidate === password;
    return new Response(JSON.stringify({ valid, rehashPerformed: valid }), { status: 200 });
  });
  t.mock.method(MasterDB, 'findUserByIdentifier', async () => user);
  t.mock.method(MasterDB, 'updateUser', async (_id, updates) => Object.assign(user, updates));
  t.mock.method(BruteForceShield, 'isLocked', async () => false);
  const failure = t.mock.method(BruteForceShield, 'recordFailure', async () => {});
  async function check(candidate, suppliedPassword) {
    user = candidate;
    let status = 200;
    let allowed = false;
    const req = { body: { tempToken: 'email-challenge', password: suppliedPassword } };
    const res = { status(value) { status = value; return this; }, json() {} };
    await authorizeEmailCorrection(req, res, error => {
      if (error) throw error;
      allowed = true;
    });
    return { status, allowed };
  }
  assert.deepEqual(await check(account, 'wrong-password'), { status: 401, allowed: false });
  assert.equal(failure.mock.callCount(), 1);
  assert.deepEqual(await check(account, password), { status: 200, allowed: true });
  for (const restriction of ['emailVerified', 'twoFactorEnabled', 'isBanned']) {
    assert.deepEqual(await check({ ...account, [restriction]: true }, password), { status: 403, allowed: false });
  }
});

test('admin authorization uses persisted roles, rejects banned admins and email impersonation', async (t) => {
  let user;
  t.mock.method(MasterDB, 'getSession', async () => ({ user }));
  await withServer(async base => {
    for (const [candidate, status] of [
      [{ role: 'owner', email: 'tiwloltd@gmail.com' }, 403],
      [{ role: 'super_admin', email: 'admin@example.com' }, 204],
      [{ role: 'admin', isBanned: true }, 403]
    ]) {
      user = candidate;
      const response = await fetch(`${base}/admin-check`, { headers: { Authorization: 'Bearer test-session' } });
      assert.equal(response.status, status);
    }
  });
});

test('public account creation never promotes an email or caller-supplied role', async (t) => {
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [] }));
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const passwordHash = `scrypt$16384:8:1$${'a'.repeat(32)}$${'b'.repeat(128)}`;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    if (!payload.password) {
      return new Response(JSON.stringify({ error: 'invalid_password' }), { status: 400 });
    }
    assert.deepEqual(payload, { password: 'scrypt$literal-password' });
    return new Response(JSON.stringify({ passwordHash }), { status: 200 });
  });
  for (const [index, email] of ['tiwloltd@gmail.com', 'ordinary@example.com'].entries()) {
    const user = await MasterDB.createUser({ id: `user-${index}`, email, password: 'scrypt$literal-password', role: 'super_admin' });
    assert.equal(user.role, 'owner');
    assert.equal(user.password, passwordHash);
  }
  await assert.rejects(MasterDB.createUser({ email: 'missing-password@example.com' }), /invalid_password/);
});

test('failed database inserts cannot leave runtime accounts or tenant stores behind', async (t) => {
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    passwordHash: `scrypt$16384:8:1$${'a'.repeat(32)}$${'b'.repeat(128)}`
  }), { status: 200 }));
  t.mock.method(getPgPool(), 'query', async sql => {
    if (sql.includes('INSERT INTO system_users')) throw Object.assign(new Error('duplicate mailbox'), { code: '23505' });
    return { rows: [] };
  });
  const before = structuredClone(await MasterDB.getMasterData());
  await assert.rejects(MasterDB.createUser({
    email: 'failure@example.com', password: 'test-password', accountType: 'business', tiwiId: 'TIW-FAILURE'
  }), { code: '23505' });
  assert.deepEqual((await MasterDB.getMasterData()), before);
  assert.equal(fs.existsSync(path.join(dataDir, 'db', 'stores', 'TIW-FAILURE.json')), false);
});

test('mailbox availability fails closed when its database cannot be queried', async (t) => {
  t.mock.method(getPgPool(), 'query', async () => { throw new Error('database unavailable'); });
  await assert.rejects(SocialDB.isEmailTaken('user@example.com'), /database unavailable/);
});

test('GraphQL registration aliases cannot bypass protected signup', async (t) => {
  t.mock.method(SocialDB, 'registerUser', () => assert.fail('Unprotected registration was called'));
  const result = await executeSocialGraphQL(`mutation {
    attempt: register(name: "Test", email: "test@example.com", handle: "test", password: "password") { token }
  }`);
  assert.match(result.errors[0].message, /\/api\/auth\/register/);
});

function mockSignupCounters(t) {
  const counters = new Map();
  t.mock.method(getPgPool(), 'query', async (sql, params) => {
    if (sql.includes('INSERT INTO system_security_rate_limits')) {
      const key = `${params[0]}:${params[1]}`;
      const count = (counters.get(key) || 0) + 1;
      counters.set(key, count);
      return { rows: [{ hitCount: count, expiresAt: new Date(Date.now() + 3600000) }] };
    }
    if (sql.includes('INSERT INTO system_security_events')) return { rows: [{ id: 1 }] };
    assert.fail('A throttled or invalid signup reached account storage');
  });
  return counters;
}

test('both signup APIs share mailbox limits across IP changes and Gmail aliases', async (t) => {
  const counters = mockSignupCounters(t);
  await withServer(async base => {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(`${base}${i % 2 ? '/api/social/register' : '/api/auth/register'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i + 1}` },
        body: JSON.stringify({ email: `test.user+${i}@${i % 2 ? 'googlemail.com' : 'gmail.com'}`, name: 'Test', password: '' })
      });
      assert.equal(response.status, i < 5 ? 400 : 429);
      if (i === 5) assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
  });
  assert.equal([...counters.entries()].filter(([key, count]) => key.startsWith('auth_registration_mailbox:') && count === 6).length, 1);
});

test('browser limits survive changing both email and IP across signup APIs', async (t) => {
  const counters = mockSignupCounters(t);
  await withServer(async base => {
    let cookie;
    for (let i = 0; i < 6; i++) {
      const response = await fetch(`${base}${i % 2 ? '/api/social/register' : '/api/auth/register'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${i + 1}`, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ email: `person${i}@example.com`, name: 'Test', password: '' })
      });
      if (!cookie) cookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal(response.status, i < 5 ? 400 : 429);
    }
  });
  assert.equal([...counters.entries()].filter(([key, count]) => key.startsWith('auth_registration_browser:') && count === 6).length, 1);
});

test('anonymous uploads and inspection endpoints reject requests before processing', async () => {
  await withServer(async base => {
    for (const route of ['upload', 'upload-single', 'upload-base64', 'upload-async', 'security/request-upload-token']) {
      const response = await fetch(`${base}/api/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      assert.equal(response.status, 401, route);
    }
  });
});

test('tenant identity cannot fall back to client-selected identifiers', () => {
  const spoofed = { headers: { 'x-tiwi-id': 'victim' }, query: { tiwiId: 'victim' }, body: { tiwiId: 'victim' } };
  assert.equal(getActiveTiwiId(spoofed), null);
  assert.equal(getActiveTiwiId({ ...spoofed, activeUser: { id: 'no-tenant' } }), null);
  assert.equal(getActiveTiwiId({ ...spoofed, activeUser: { tiwiId: 'own-tenant' } }), 'own-tenant');
});

test('SSO rejects altered email and trust claims while allowing one use of the original ticket', async (t) => {
  let consumed = false;
  const previousRustEnv = {
    TIWLO_RUST_BACKEND_URL: process.env.TIWLO_RUST_BACKEND_URL,
    TIWLO_INTERNAL_IDENTITY_SECRET: process.env.TIWLO_INTERNAL_IDENTITY_SECRET,
    TIWI_APP_TRUST_KEY: process.env.TIWI_APP_TRUST_KEY
  };
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.TIWI_APP_TRUST_KEY = 'trusted-app';
  t.after(() => {
    for (const [key, value] of Object.entries(previousRustEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const ssoToken = `${Buffer.from('signed-payload').toString('base64url')}.${'a'.repeat(64)}`;
  const nonce = `sso_nonce_${'b'.repeat(48)}`;
  const deviceFingerprint = {
    hash: 'c'.repeat(64),
    platform: 'mobile',
    osVersion: 'unknown',
    deviceModel: 'unknown_device',
    appVersion: '1.0.0',
    networkType: 'cellular/wifi',
    ip: '127.0.0.1',
    capturedAt: '2026-10-11T00:00:00.000Z'
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/tickets')) {
      return new Response(JSON.stringify({
        ssoToken,
        nonce,
        expiresAt: Date.now() + 60_000,
        isAppTrusted: true,
        deviceFingerprint
      }), { status: 201 });
    }
    const request = JSON.parse(options.body);
    if (!consumed && request.sso_token === ssoToken && request.nonce === nonce) {
      consumed = true;
      return new Response(JSON.stringify({
        valid: true,
        user: { id: 'owner', tiwiId: 'TIW-OWNER', email: 'owner@example.com' },
        origin: 'tiwi_mobile_app',
        isAppTrusted: true,
        deviceFingerprint
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      valid: false,
      error: request.nonce !== nonce
        ? 'Nonce mismatch in token payload'
        : 'Cryptographic signature verification failed: invalid or forged SSO token'
    }), { status: 200 });
  });
  const ticket = await SsoSecurity.generateHandshakeTicket({
    userId: 'owner',
    tiwiId: 'TIW-OWNER',
    email: 'owner@example.com',
    appTrustToken: 'trusted-app'
  });
  assert.equal(ticket.isAppTrusted, true);
  assert.equal(
    (await SsoSecurity.verifyAndConsumeTicket({
      ssoToken: `${ticket.ssoToken}tampered`,
      nonce: ticket.nonce
    })).valid,
    false
  );
  assert.equal(consumed, false);
  assert.equal((await SsoSecurity.verifyAndConsumeTicket({
    ssoToken: ticket.ssoToken,
    nonce: 'wrong-nonce'
  })).valid, false);
  assert.equal(consumed, false);
  assert.equal((await SsoSecurity.verifyAndConsumeTicket(ticket)).valid, true);
  assert.equal((await SsoSecurity.verifyAndConsumeTicket(ticket)).valid, false);
});
