import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import {
  createUserAccountRouter,
  isValidAvatarUrl,
  validateImageMagicBytes,
  hasSensitiveAccountChange,
  toSafeUserProfile,
  maskEmail,
  USER_ACCOUNT_OTP_PURPOSE
} from './userAccountRoutes.js';

function createMockHarness(initialUser = {}, initialPrefs = {}) {
  let currentUser = {
    id: 'usr_100',
    tiwiId: 'tiwi_100',
    storeId: 'tiwi_100',
    name: 'Tariq Rahman',
    storeName: 'Dhaka Mart',
    email: 'tariq@example.com',
    phone: '+8801711000000',
    avatar: '/uploads/old-avatar.png',
    coverPhoto: '',
    address: 'Banani, Dhaka',
    dateOfBirth: '1994-05-12',
    password: 'scrypt$salt$secret_hash_never_leak',
    twoFactorEnabled: false,
    emailVerified: true,
    identityVerified: true,
    authMethod: 'credentials',
    role: 'owner',
    planId: 'pro',
    planName: 'Pro Business',
    subdomain: 'dhakamart',
    ...initialUser
  };

  const stateDocs = new Map();
  if (Object.keys(initialPrefs).length > 0) {
    stateDocs.set(`user_account_preferences:${currentUser.id}`, { ...initialPrefs });
  }

  let otpCounter = 0;
  const otpChallenges = new Map();
  const sentEmails = [];
  const storedMediaCalls = [];
  const socialUpdates = [];
  const pgQueries = [];
  let passwordUpdates = [];

  const deps = {
    isPgActive: () => false,
    masterDb: {
      async getSession(token) {
        if (token !== 'valid-session-token') return null;
        return {
          session: { sessionToken: token, userId: currentUser.id },
          user: { ...currentUser }
        };
      },
      async updateUser(userId, updates) {
        assert.equal(userId, currentUser.id);
        currentUser = { ...currentUser, ...updates };
        return { ...currentUser };
      },
      async updatePasswordAndRevokeSessions(userId, passwordHash, exceptToken) {
        assert.equal(userId, currentUser.id);
        passwordUpdates.push({ userId, passwordHash, exceptToken });
        currentUser = { ...currentUser, password: passwordHash };
      },
      async revokeUserSessions() {}
    },
    socialDb: {
      async updateProfile(userId, updates) {
        socialUpdates.push({ userId, updates });
      }
    },
    queryPg: async (sql, params) => {
      pgQueries.push({ sql, params });
      if (/FROM system_sessions/i.test(sql)) {
        return {
          rows: [
            {
              token_ref: 'valid-session-token',
              ip: '203.0.113.10',
              user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0',
              created_at: '2026-11-15T10:00:00.000Z',
              expires_at: '2026-12-15T10:00:00.000Z'
            },
            {
              token_ref: 'other-session-token-xyz',
              ip: '198.51.100.42',
              user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
              created_at: '2026-11-14T10:00:00.000Z',
              expires_at: '2026-12-14T10:00:00.000Z'
            }
          ]
        };
      }
      if (/FROM system_account_security/i.test(sql)) {
        return { rows: [{ strikes: 0, cooldown_until: null, permanently_disabled: false, last_reason: null }] };
      }
      return { rows: [] };
    },
    readState: async (namespace, key, initial) => {
      const k = `${namespace}:${key}`;
      return stateDocs.has(k) ? structuredClone(stateDocs.get(k)) : structuredClone(initial);
    },
    saveState: async (namespace, key, data) => {
      stateDocs.set(`${namespace}:${key}`, structuredClone(data));
      return data;
    },
    generateSecureOtp: async (email, type, expiryMinutes) => {
      assert.equal(type, USER_ACCOUNT_OTP_PURPOSE);
      otpCounter += 1;
      const code = String(100000 + otpCounter);
      const token = `tok_${String(otpCounter).padStart(48, '0')}`;
      const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
      otpChallenges.set(token, { email, type, code, expiresAt });
      return { code, token, expiresAt };
    },
    verifySecureOtp: async (token, code, expectedType) => {
      assert.equal(expectedType, USER_ACCOUNT_OTP_PURPOSE);
      const entry = otpChallenges.get(token);
      if (!entry || entry.type !== expectedType || entry.code !== String(code)) {
        return { valid: false, error: 'Invalid or expired verification code' };
      }
      otpChallenges.delete(token);
      return { valid: true, email: entry.email };
    },
    sendTwoFactorOtpEmail: async (payload) => {
      sentEmails.push(payload);
      return { success: true, delivered: true };
    },
    verifyPasswordWithRust: async (_userId, password) => {
      const valid = password === 'CurrentPass123!';
      return { valid, rehashPerformed: false };
    },
    hashPasswordWithRust: async (newPassword) => `scrypt$mock$${newPassword}`,
    scanAndSanitizeImage: async (buffer) => ({ safe: true, sanitizedBuffer: buffer }),
    storeMedia: async (payload) => {
      storedMediaCalls.push(payload);
    },
    getPublicMediaUrl: async (url) => url,
    logActivity: async () => {}
  };

  return {
    deps,
    getUser: () => currentUser,
    sentEmails,
    storedMediaCalls,
    socialUpdates,
    pgQueries,
    passwordUpdates
  };
}

async function withApp(t, deps) {
  const app = express();
  app.use(express.json());
  app.use('/api', createUserAccountRouter(deps));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, options = {}) => fetch(`${base}${path}`, options);
}

test('pure helpers validate avatar URLs, magic bytes, masking, and sensitive changes', () => {
  assert.equal(isValidAvatarUrl('/uploads/avatar.png'), true);
  assert.equal(isValidAvatarUrl('/api/upload/avatar.jpg'), true);
  assert.equal(isValidAvatarUrl('https://drive.tiwlo.com/uploads/pic.webp'), true);
  assert.equal(isValidAvatarUrl('http://insecure.example.com/pic.png'), false);
  assert.equal(isValidAvatarUrl('javascript:alert(1)'), false);
  assert.equal(isValidAvatarUrl('/uploads/../etc/passwd'), false);

  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const badBytes = Buffer.from('<html>not an image</html>');

  assert.deepEqual(validateImageMagicBytes(validPng), { valid: true, format: 'image/png' });
  assert.deepEqual(validateImageMagicBytes(validJpeg), { valid: true, format: 'image/jpeg' });
  assert.deepEqual(validateImageMagicBytes(badBytes), { valid: false, format: null });

  assert.equal(maskEmail('tariq@example.com'), 't***q@example.com');

  const baseUser = { email: 'tariq@example.com', phone: '+8801711000000', twoFactorEnabled: false };
  assert.equal(hasSensitiveAccountChange(baseUser, { name: 'New Name' }, { requireOtp: false }), false);
  assert.equal(hasSensitiveAccountChange(baseUser, { email: 'other@example.com' }, { requireOtp: false }), true);
  assert.equal(hasSensitiveAccountChange(baseUser, { newPassword: 'NewPassword123' }, { requireOtp: false }), true);
  assert.equal(hasSensitiveAccountChange(baseUser, { twoFactorEnabled: true }, { requireOtp: false }), true);
  assert.equal(hasSensitiveAccountChange(baseUser, { phone: '+8801999999999' }, { requireOtp: false }), true);
  assert.equal(hasSensitiveAccountChange(baseUser, { name: 'New Name' }, { requireOtp: true }), true);

  const safeProfile = toSafeUserProfile({ ...baseUser, id: 'u1', password: 'scrypt$secret' });
  assert.equal('password' in safeProfile, false);
  assert.equal(safeProfile.hasPassword, true);
});

test('auth guard rejects unauthenticated requests with 401', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);

  const resGet = await call('/api/user/account/settings');
  assert.equal(resGet.status, 401);

  const resOtp = await call('/api/user/account/otp-request', { method: 'POST' });
  assert.equal(resOtp.status, 401);

  const resPut = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker' })
  });
  assert.equal(resPut.status, 401);

  const resBadToken = await call('/api/user/account/settings', {
    headers: { Authorization: 'Bearer wrong-token' }
  });
  assert.equal(resBadToken.status, 401);
});

test('GET /api/user/account/settings returns safe profile and scoped session summaries', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);

  const res = await call('/api/user/account/settings', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.user.email, 'tariq@example.com');
  assert.equal(data.user.password, undefined);
  assert.equal(data.user.hasPassword, true);
  assert.equal(data.sessions.length, 2);
  assert.equal(data.sessions[0].isCurrent, true);
  assert.equal(data.sessions[1].isCurrent, false);
  assert.equal(data.sessions[0].token, undefined);
  assert.ok(data.sessions[0].id && !data.sessions[0].id.includes('valid-session-token'));
});

test('PUT /api/user/account/settings enforces Email OTP for sensitive changes and allows full OTP flow', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  // Non-sensitive profile update works when requireOtp is false
  const nonSensitive = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Tariq Updated', address: 'Gulshan 2, Dhaka' })
  });
  assert.equal(nonSensitive.status, 200);
  const nonSensitiveBody = await nonSensitive.json();
  assert.equal(nonSensitiveBody.user.name, 'Tariq Updated');

  // Sensitive change without OTP -> 403 requiresOtp: true
  const blockedSensitive = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      email: 'new-email@example.com',
      twoFactorEnabled: true
    })
  });
  assert.equal(blockedSensitive.status, 403);
  const blockedBody = await blockedSensitive.json();
  assert.equal(blockedBody.requiresOtp, true);
  assert.match(blockedBody.error, /Email OTP verification required/i);

  // Request Email OTP -> never returns plain OTP
  const otpReq = await call('/api/user/account/otp-request', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(otpReq.status, 200);
  const otpReqBody = await otpReq.json();
  assert.equal(otpReqBody.success, true);
  assert.equal(otpReqBody.maskedEmail, 't***q@example.com');
  assert.equal(otpReqBody.code, undefined);
  assert.equal(otpReqBody.otpCode, undefined);
  assert.equal(harness.sentEmails.length, 1);
  const sentCode = harness.sentEmails[0].code;
  assert.match(sentCode, /^\d{6}$/);

  // Wrong OTP -> 403
  const wrongOtpRes = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      twoFactorEnabled: true,
      otpCode: '999999',
      otpToken: otpReqBody.otpToken
    })
  });
  assert.equal(wrongOtpRes.status, 403);

  // Valid OTP + wrong current password -> 401
  const badPwdRes = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'WrongPassword!',
      newPassword: 'BrandNewPassword99!',
      otpCode: sentCode,
      otpToken: otpReqBody.otpToken
    })
  });
  assert.equal(badPwdRes.status, 401);

  // Valid OTP + valid current password + sensitive email/2FA/password update -> 200
  const okRes = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      email: 'verified-new@example.com',
      twoFactorEnabled: true,
      currentPassword: 'CurrentPass123!',
      newPassword: 'BrandNewPassword99!',
      preferences: { requireOtp: true, emailNotifications: true },
      otpCode: sentCode,
      otpToken: otpReqBody.otpToken
    })
  });
  assert.equal(okRes.status, 200);
  const okBody = await okRes.json();
  assert.equal(okBody.success, true);
  assert.equal(okBody.user.email, 'verified-new@example.com');
  assert.equal(okBody.user.twoFactorEnabled, true);
  assert.equal(okBody.preferences.requireOtp, true);
  assert.equal(harness.passwordUpdates.length, 1);
  assert.equal(harness.passwordUpdates[0].passwordHash, 'scrypt$mock$BrandNewPassword99!');
  assert.ok(harness.pgQueries.some(q => /system_account_security/i.test(q.sql)));

  // Reusing the same OTP must fail
  const replayRes = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Replay Attempt',
      otpCode: sentCode,
      otpToken: otpReqBody.otpToken
    })
  });
  assert.equal(replayRes.status, 403);
});

test('POST /api/user/account/avatar validates magic bytes and saves image via mediaStorage', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);

  // Invalid magic bytes disguised as image/png -> 415
  const badForm = new FormData();
  badForm.append('avatar', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'evil.png');
  const badRes = await call('/api/user/account/avatar', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-session-token' },
    body: badForm
  });
  assert.equal(badRes.status, 415);

  // Valid PNG -> 200
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]);
  const goodForm = new FormData();
  goodForm.append('avatar', new Blob([pngBytes], { type: 'image/png' }), 'profile.png');
  const goodRes = await call('/api/user/account/avatar', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-session-token' },
    body: goodForm
  });
  assert.equal(goodRes.status, 200);
  const goodBody = await goodRes.json();
  assert.equal(goodBody.success, true);
  assert.match(goodBody.avatar, /^\/uploads\/.+\.png$/);
  assert.equal(harness.storedMediaCalls.length, 1);
  assert.equal(harness.storedMediaCalls[0].purpose, 'user_avatar');
  assert.equal(harness.getUser().avatar, goodBody.avatar);
  assert.equal(harness.socialUpdates.length, 1);
});
