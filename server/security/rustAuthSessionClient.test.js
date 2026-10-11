import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashSecuritySubject } from '../db/securityPersistence.js';
import {
  checkAuthRateLimitWithRust,
  createAuthSessionWithRust,
  clearAuthRateLimitWithRust,
  completeEmailVerificationWithRust,
  consumeSecureGrantWithRust,
  createSecureGrantWithRust,
  completeMfaLoginWithRust,
  completeMfaSetupWithRust,
  deleteOtpSessionWithRust,
  generateOtpWithRust,
  hashPasswordWithRust,
  getOtpSessionWithRust,
  recordAuthRateLimitFailureWithRust,
  resolveAuthSessionWithRust,
  revokeAuthSessionWithRust,
  revokeUserAuthSessionsWithRust,
  updatePasswordAndRevokeSessionsWithRust,
  verifyOtpWithRust,
  verifyPasswordWithRust
} from './rustAuthSessionClient.js';

const RUST_ENV_KEYS = [
  'TIWLO_RUST_BACKEND_URL',
  'TIWLO_INTERNAL_IDENTITY_SECRET',
  'ABUSE_HASH_SECRET',
  'SECURITY_SECRET'
];

function restoreEnvironment(previous) {
  for (const key of RUST_ENV_KEYS) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

test('auth session client proxies lifecycle calls to Rust with signed identity', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100/';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const payload = url.endsWith('/v1/auth/sessions')
      ? { sessionToken: 'issued-session', expiresAt: '2030-01-01T00:00:00Z' }
      : url.endsWith('/resolve')
        ? {
          authenticated: true,
          sessionToken: 'issued-session',
          userId: 'user-1',
          tiwiId: 'store-1',
          email: 'user@example.com',
          expiresAt: '2030-01-01T00:00:00Z'
        }
        : { success: true };
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: true
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-browser' },
    cookies: { uids_device: 'device-1' }
  };

  assert.deepEqual(
    await createAuthSessionWithRust({ user, tiwiId: 'store-1', email: user.email, request }),
    { sessionToken: 'issued-session', expiresAt: '2030-01-01T00:00:00Z' }
  );
  const resolved = await resolveAuthSessionWithRust({ token: 'issued-session', request });
  assert.equal(resolved.userId, 'user-1');
  assert.equal(resolved.storeId, 'store-1');
  assert.equal(
    resolved.fingerprint,
    createHash('sha256').update('test-browser').digest('hex')
  );
  await revokeAuthSessionWithRust('issued-session');
  await revokeUserAuthSessionsWithRust('user/1');
  await updatePasswordAndRevokeSessionsWithRust(
    'user/1',
    'scrypt$16384:8:1$salt$hash',
    'keep-session'
  );

  assert.deepEqual(calls.map(({ url, options }) => [options.method, url]), [
    ['POST', 'http://rust:7100/v1/auth/sessions'],
    ['POST', 'http://rust:7100/v1/auth/sessions/resolve'],
    ['POST', 'http://rust:7100/v1/auth/sessions/revoke'],
    ['POST', 'http://rust:7100/v1/auth/users/user%2F1/sessions/revoke'],
    ['PUT', 'http://rust:7100/v1/auth/users/user%2F1/password']
  ]);
  const createIdentity = calls[0].options.headers['x-tiwlo-identity'];
  assert.match(createIdentity, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    tiwi_id: 'store-1',
    email: 'user@example.com',
    user_agent: 'test-browser'
  });
  const servicePayload = JSON.parse(
    Buffer.from(calls[1].options.headers['x-tiwlo-identity'].split('.')[0], 'base64url')
  );
  assert.equal(servicePayload.user_id, 'tiwlo-internal-auth-service');
  assert.deepEqual(JSON.parse(calls[4].options.body), {
    password_hash: 'scrypt$16384:8:1$salt$hash',
    except_token: 'keep-session'
  });
});

test('auth session client preserves Rust errors and treats invalid sessions as unauthenticated', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  let fetchResponse = new Response(
    JSON.stringify({ authenticated: false }),
    { status: 200 }
  );
  t.mock.method(globalThis, 'fetch', async () => fetchResponse);
  assert.equal(await resolveAuthSessionWithRust({ token: 'expired-token' }), null);

  fetchResponse = new Response(
    JSON.stringify({ error: 'session_service_unavailable' }),
    { status: 503 }
  );
  await assert.rejects(
    revokeAuthSessionWithRust('some-token'),
    error => error.statusCode === 503 && error.message === 'session_service_unavailable'
  );
});

test('password operations run through Rust and validate their response contracts', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  const hash = `scrypt$16384:8:1$${'a'.repeat(32)}$${'b'.repeat(128)}`;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const payload = url.endsWith('/hash')
      ? { passwordHash: hash }
      : { valid: true, rehashPerformed: false };
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  assert.equal(await hashPasswordWithRust('correct horse battery staple'), hash);
  assert.deepEqual(
    await verifyPasswordWithRust('user-1', 'correct horse battery staple'),
    { valid: true, rehashPerformed: false }
  );
  assert.deepEqual(calls.map(({ url, options }) => [
    url,
    JSON.parse(options.body)
  ]), [
    [
      'http://rust:7100/v1/auth/passwords/hash',
      { password: 'correct horse battery staple' }
    ],
    [
      'http://rust:7100/v1/auth/users/user-1/password/verify',
      { password: 'correct horse battery staple' }
    ]
  ]);
  assert.ok(calls.every(({ options }) =>
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(options.headers['x-tiwlo-identity'])
  ));
});

test('OTP challenges and reset grants are fully proxied to Rust', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  const token = `tok_${'a'.repeat(48)}`;
  const grant = `grant_${'b'.repeat(64)}`;
  const expiresAt = 1_800_000_000_000;
  const calls = [];
  let mfaPayload = { valid: true, email: 'owner@example.com', error: null, notFound: false };
  let mfaLoginPayload = {
    valid: true,
    email: 'owner@example.com',
    error: null,
    notFound: false,
    sessionToken: 'd'.repeat(128),
    userId: 'owner',
    tiwiId: 'TIW-OWNER',
    expiresAt: '2026-11-10T00:00:00Z'
  };
  let emailVerificationPayload = {
    valid: true,
    email: 'owner@example.com',
    error: null,
    notFound: false
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    let payload;
    if (url.endsWith('/otp')) {
      payload = { code: '123456', token, expiresAt };
    } else if (url.endsWith('/otp/verify')) {
      payload = { valid: true, email: 'owner@example.com', error: null };
    } else if (url.endsWith('/mfa/setup/complete')) {
      payload = mfaPayload;
    } else if (url.endsWith('/mfa/login/complete')) {
      payload = mfaLoginPayload;
    } else if (url.endsWith('/email/verify')) {
      payload = emailVerificationPayload;
    } else if (url.endsWith('/otp/session/get')) {
      payload = {
        session: {
          email: 'owner@example.com',
          type: 'email_verify',
          attempts: 1,
          max_attempts: 5,
          expires_at: expiresAt
        }
      };
    } else if (url.endsWith('/grants')) {
      payload = { token: grant };
    } else if (url.endsWith('/grants/consume')) {
      payload = { email: 'owner@example.com' };
    } else {
      payload = { success: true };
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  assert.deepEqual(await generateOtpWithRust('Owner@Example.com', 'email_verify', 15), {
    code: '123456',
    token,
    expiresAt
  });
  assert.deepEqual(await verifyOtpWithRust(token, ' 123 456 ', 'email_verify'), {
    valid: true,
    email: 'owner@example.com'
  });
  assert.deepEqual(await completeMfaSetupWithRust(token, '123456'), {
    valid: true,
    email: 'owner@example.com'
  });
  assert.deepEqual(await completeMfaLoginWithRust(token, '123456', {
    headers: { 'user-agent': 'Test mobile app' }
  }), {
    valid: true,
    email: 'owner@example.com',
    sessionToken: 'd'.repeat(128),
    userId: 'owner',
    tiwiId: 'TIW-OWNER',
    expiresAt: '2026-11-10T00:00:00Z'
  });
  assert.equal(
    JSON.parse(calls.find(({ url }) => url.endsWith('/mfa/login/complete')).options.body).user_agent,
    'Test mobile app'
  );
  mfaLoginPayload = {
    valid: false,
    email: null,
    error: 'Invalid 6-digit code. 4 attempt(s) remaining.',
    notFound: false,
    sessionToken: null,
    userId: null,
    tiwiId: null,
    expiresAt: null
  };
  assert.deepEqual(await completeMfaLoginWithRust(token, 'wrong-code'), {
    valid: false,
    error: 'Invalid 6-digit code. 4 attempt(s) remaining.',
    notFound: false
  });
  mfaPayload = { valid: false, email: null, error: 'User account not found.', notFound: true };
  assert.deepEqual(await completeMfaSetupWithRust(token, '123456'), {
    valid: false,
    error: 'User account not found.',
    notFound: true
  });
  assert.deepEqual(await completeEmailVerificationWithRust(token, '123456'), {
    valid: true,
    email: 'owner@example.com'
  });
  emailVerificationPayload = {
    valid: false,
    email: null,
    error: 'User account not found.',
    notFound: true
  };
  assert.deepEqual(await completeEmailVerificationWithRust(token, '123456'), {
    valid: false,
    error: 'User account not found.',
    notFound: true
  });
  assert.deepEqual(await getOtpSessionWithRust(token), {
    email: 'owner@example.com',
    type: 'email_verify',
    attempts: 1,
    max_attempts: 5,
    expires_at: new Date(expiresAt)
  });
  await deleteOtpSessionWithRust(token);
  assert.equal(
    await createSecureGrantWithRust('owner@example.com', 'password_reset_grant', 15),
    grant
  );
  assert.equal(
    await consumeSecureGrantWithRust(grant, 'password_reset_grant'),
    'owner@example.com'
  );

  assert.deepEqual(calls.map(({ url, options }) => [options.method, url]), [
    ['POST', 'http://rust:7100/v1/auth/otp'],
    ['POST', 'http://rust:7100/v1/auth/otp/verify'],
    ['POST', 'http://rust:7100/v1/auth/mfa/setup/complete'],
    ['POST', 'http://rust:7100/v1/auth/mfa/login/complete'],
    ['POST', 'http://rust:7100/v1/auth/mfa/login/complete'],
    ['POST', 'http://rust:7100/v1/auth/mfa/setup/complete'],
    ['POST', 'http://rust:7100/v1/auth/email/verify'],
    ['POST', 'http://rust:7100/v1/auth/email/verify'],
    ['POST', 'http://rust:7100/v1/auth/otp/session/get'],
    ['POST', 'http://rust:7100/v1/auth/otp/session/delete'],
    ['POST', 'http://rust:7100/v1/auth/grants'],
    ['POST', 'http://rust:7100/v1/auth/grants/consume']
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: 'Owner@Example.com',
    type: 'email_verify',
    expiry_minutes: 15
  });
  assert.ok(calls.every(({ options }) =>
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(options.headers['x-tiwlo-identity'])
  ));
});

test('auth rate-limit client sends only blinded normalized keys to Rust', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  process.env.SECURITY_SECRET = 's'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  const calls = [];
  let payload = { locked: true, remainingSeconds: 60 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/failure')) {
      payload = {
        count: 5,
        firstAttempt: 1_800_000_000_000,
        lockedUntil: 1_800_000_900_000,
        maxAttempts: 5,
        remainingAttempts: 0
      };
    } else if (url.endsWith('/clear')) {
      payload = { success: true };
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  });

  assert.deepEqual(await checkAuthRateLimitWithRust('::ffff:192.0.2.1, proxy'), {
    isLocked: true,
    remainingSeconds: 60
  });
  assert.deepEqual(
    await recordAuthRateLimitFailureWithRust('OWNER@EXAMPLE.COM'),
    {
      count: 5,
      firstAttempt: 1_800_000_000_000,
      lockedUntil: 1_800_000_900_000,
      maxAttempts: 5,
      remainingAttempts: 0
    }
  );
  await clearAuthRateLimitWithRust('::1');

  const expectedHashes = ['192.0.2.1', 'owner@example.com', '127.0.0.1']
    .map(hashSecuritySubject);
  assert.deepEqual(calls.map(({ url, options }) => [
    url,
    JSON.parse(options.body).key_hash
  ]), [
    ['http://rust:7100/v1/auth/rate-limits/check', expectedHashes[0]],
    ['http://rust:7100/v1/auth/rate-limits/failure', expectedHashes[1]],
    ['http://rust:7100/v1/auth/rate-limits/clear', expectedHashes[2]]
  ]);
  assert.ok(calls.every(({ options }) =>
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(options.headers['x-tiwlo-identity'])
  ));
});

test('auth rate-limit client rejects malformed Rust responses', async t => {
  const previous = Object.fromEntries(RUST_ENV_KEYS.map(key => [key, process.env[key]]));
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  process.env.SECURITY_SECRET = 's'.repeat(32);
  t.after(() => restoreEnvironment(previous));

  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ locked: true, remainingSeconds: 'soon' }), { status: 200 })
  );
  await assert.rejects(
    checkAuthRateLimitWithRust('owner@example.com'),
    /invalid rate-limit check response/
  );
});
