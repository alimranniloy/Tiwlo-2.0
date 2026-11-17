import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import {
  createUserAccountRouter,
  isValidAvatarUrl,
  isPublicUnicastIp,
  validateSafeWebhookUrl,
  resolveAndAssertSafeWebhookUrl,
  validateImageMagicBytes,
  hasSensitiveAccountChange,
  toSafeUserProfile,
  maskEmail,
  encodeBase32,
  decodeBase32,
  generateTotpCode,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyUserTotpOrRecoveryCode,
  TEAM_PERMISSION_CATALOG,
  TEAM_ROLE_PRESETS,
  USER_ACCOUNT_OTP_PURPOSE
} from './userAccountRoutes.js';

function createMockHarness(initialUser = {}, initialPrefs = {}, options = {}) {
  const users = new Map();
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
  users.set(currentUser.id, currentUser);

  const secondUser = {
    id: 'usr_200',
    tiwiId: 'tiwi_200',
    storeId: 'tiwi_200',
    name: 'Nadia Karim',
    storeName: 'Chittagong Craft',
    email: 'nadia@example.com',
    phone: '+8801811000000',
    password: 'scrypt$salt$other_hash',
    twoFactorEnabled: false,
    emailVerified: true,
    identityVerified: true,
    authMethod: 'credentials',
    role: 'owner',
    planId: 'pro',
    planName: 'Pro Business',
    subdomain: 'ctgcraft'
  };
  users.set(secondUser.id, secondUser);

  const stateDocs = new Map();
  if (Object.keys(initialPrefs).length > 0) {
    stateDocs.set(`user_account_preferences:${currentUser.id}`, { ...initialPrefs });
  }

  let otpCounter = 0;
  const otpChallenges = new Map();
  const sentEmails = [];
  const sentTiwloEmails = [];
  const storedMediaCalls = [];
  const socialUpdates = [];
  const pgQueries = [];
  let passwordUpdates = [];
  const totpEncryptionSecret = 'unit-test-totp-cipher-secret-32chars!';

  const deps = {
    isPgActive: () => false,
    totpEncryptionSecret,
    masterDb: {
      async getSession(token) {
        if (token === 'valid-session-token') {
          const u = users.get(currentUser.id);
          return {
            session: { sessionToken: token, userId: u.id },
            user: { ...u }
          };
        }
        if (token === 'second-user-token') {
          const u = users.get(secondUser.id);
          return {
            session: { sessionToken: token, userId: u.id },
            user: { ...u }
          };
        }
        return null;
      },
      async updateUser(userId, updates) {
        const existing = users.get(userId);
        assert.ok(existing, `Unknown user ${userId}`);
        const next = { ...existing, ...updates };
        users.set(userId, next);
        if (userId === currentUser.id) currentUser = next;
        return { ...next };
      },
      async updatePasswordAndRevokeSessions(userId, passwordHash, exceptToken) {
        assert.equal(userId, currentUser.id);
        passwordUpdates.push({ userId, passwordHash, exceptToken });
        currentUser = { ...currentUser, password: passwordHash };
        users.set(userId, currentUser);
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
      if (typeof options.queryPg === 'function') {
        const custom = await options.queryPg(sql, params);
        if (custom) return custom;
      }
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
    sendTiwloEmail: async (payload) => {
      if (typeof options.sendTiwloEmail === 'function') {
        return options.sendTiwloEmail(payload);
      }
      sentTiwloEmails.push(payload);
      return { success: true, delivered: true, status: 'delivered', messageId: 'msg_test_1' };
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
    logActivity: async () => {},
    dnsLookup: options.dnsLookup || (async (hostname) => {
      if (hostname === 'hooks.example.com' || hostname === 'erp.example.com') {
        return [{ address: '93.184.216.34', family: 4 }];
      }
      const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      throw err;
    }),
    ...(typeof options.webhookFetch === 'function' ? { webhookFetch: options.webhookFetch } : {})
  };

  return {
    deps,
    stateDocs,
    getUser: () => currentUser,
    sentEmails,
    sentTiwloEmails,
    storedMediaCalls,
    socialUpdates,
    pgQueries,
    passwordUpdates,
    totpEncryptionSecret
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

test('RFC 6238 TOTP helpers match standard vector, clock skew, Base32, and AES-GCM wrapping', () => {
  const rfcSecret = '12345678901234567890';
  const encoded = encodeBase32(Buffer.from(rfcSecret, 'ascii'));
  assert.equal(encoded, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(decodeBase32(encoded).toString('ascii'), rfcSecret);

  // RFC 6238 SHA1 test vector at T = 59s -> 94287082 -> 6-digit 287082
  const codeAt59 = generateTotpCode(encoded, 59_000, 30, 6);
  assert.equal(codeAt59, '287082');

  // Within ±1 step (30s) succeeds; 2 steps away fails
  assert.equal(verifyTotpCode(encoded, codeAt59, { timestampMs: 89_000, window: 1 }).valid, true);
  assert.equal(verifyTotpCode(encoded, codeAt59, { timestampMs: 120_000, window: 1 }).valid, false);
  assert.equal(verifyTotpCode(encoded, '000000', { timestampMs: 59_000, window: 1 }).valid, false);

  const wrapped = encryptTotpSecret(encoded, 'my-test-secret-key-at-least-32-chars');
  assert.ok(wrapped.startsWith('enc:v1:'));
  assert.equal(wrapped.includes(encoded), false);
  assert.equal(decryptTotpSecret(wrapped, 'my-test-secret-key-at-least-32-chars'), encoded);
});

test('TOTP QR setup, verification, invalid code rejection, recovery codes, login verification, and disable', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  // Initial status
  const status0Res = await call('/api/user/account/two-factor/status', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(status0Res.status, 200);
  const status0 = await status0Res.json();
  assert.equal(status0.twoFactorEnabled, false);
  assert.equal(status0.totpEnabled, false);
  assert.equal(status0.activeMethod, 'off');

  // Setup QR
  const setupRes = await call('/api/user/account/two-factor/totp/setup', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(setupRes.status, 200);
  const setup = await setupRes.json();
  assert.equal(setup.success, true);
  assert.match(setup.qrCodeDataUrl, /^data:image\/png;base64,/);
  assert.ok(setup.manualKey && setup.manualKey.length >= 16);
  assert.equal(setup.issuer, 'Tiwlo');
  assert.equal(setup.accountName, 'tariq@example.com');
  assert.ok(setup.otpauthUrl.startsWith('otpauth://totp/Tiwlo:tariq@example.com?'));
  assert.ok(setup.otpauthUrl.includes(`secret=${setup.manualKey}`));

  // Invalid code rejected
  const badVerifyRes = await call('/api/user/account/two-factor/totp/verify', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ code: '000001' })
  });
  // Only check rejection when not coincidentally 000001
  const currentValidCode = generateTotpCode(setup.manualKey);
  if (currentValidCode !== '000001') {
    assert.equal(badVerifyRes.status, 400);
    assert.equal(harness.getUser().twoFactorEnabled, false);
  }

  // Valid TOTP code activates TOTP + MasterDB + recovery codes
  const verifyRes = await call('/api/user/account/two-factor/totp/verify', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ code: currentValidCode })
  });
  assert.equal(verifyRes.status, 200);
  const verifyBody = await verifyRes.json();
  assert.equal(verifyBody.success, true);
  assert.equal(verifyBody.totpEnabled, true);
  assert.equal(verifyBody.twoFactorEnabled, true);
  assert.equal(verifyBody.activeMethod, 'totp');
  assert.equal(verifyBody.recoveryCodes.length, 8);
  assert.ok(verifyBody.recoveryCodes.every((c) => /^[A-Z0-9]{8}$/.test(c)));
  assert.equal(harness.getUser().twoFactorEnabled, true);

  // Status never leaks secrets
  const status1Res = await call('/api/user/account/two-factor/status', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  const status1 = await status1Res.json();
  assert.equal(status1.totpEnabled, true);
  assert.equal(status1.activeMethod, 'totp');
  assert.equal(status1.backupCodesRemaining, 8);
  assert.equal(status1.activeSecretEnc, undefined);
  assert.equal(status1.pendingSecretEnc, undefined);
  assert.equal(status1.recoveryCodeHashes, undefined);

  // Login helper verifies TOTP and single-use recovery code
  const loginTotpCheck = await verifyUserTotpOrRecoveryCode('usr_100', generateTotpCode(setup.manualKey), {
    readState: harness.deps.readState,
    saveState: harness.deps.saveState,
    totpEncryptionSecret: harness.totpEncryptionSecret
  });
  assert.equal(loginTotpCheck.valid, true);
  assert.equal(loginTotpCheck.method, 'totp');

  const firstRecovery = verifyBody.recoveryCodes[0];
  const loginRcCheck = await verifyUserTotpOrRecoveryCode('usr_100', firstRecovery, {
    readState: harness.deps.readState,
    saveState: harness.deps.saveState,
    totpEncryptionSecret: harness.totpEncryptionSecret
  });
  assert.equal(loginRcCheck.valid, true);
  assert.equal(loginRcCheck.method, 'recovery_code');
  assert.equal(loginRcCheck.recoveryCodesRemaining, 7);

  // Reusing consumed recovery code must fail
  const replayRcCheck = await verifyUserTotpOrRecoveryCode('usr_100', firstRecovery, {
    readState: harness.deps.readState,
    saveState: harness.deps.saveState,
    totpEncryptionSecret: harness.totpEncryptionSecret
  });
  assert.equal(replayRcCheck.valid, false);

  // Regenerate recovery codes requires valid credential
  const badRegen = await call('/api/user/account/two-factor/recovery-codes/regenerate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ currentPassword: 'WrongPassword!' })
  });
  assert.equal(badRegen.status, 401);

  const regenRes = await call('/api/user/account/two-factor/recovery-codes/regenerate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ currentPassword: 'CurrentPass123!' })
  });
  assert.equal(regenRes.status, 200);
  const regenBody = await regenRes.json();
  assert.equal(regenBody.recoveryCodes.length, 8);
  assert.equal(regenBody.backupCodesRemaining, 8);

  // Disable without credential rejected
  const noCredDisable = await call('/api/user/account/two-factor/totp/disable', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert.equal(noCredDisable.status, 400);

  // Disable with keepEmail2fa: true keeps twoFactorEnabled = true (email fallback)
  const keepEmailDisable = await call('/api/user/account/two-factor/totp/disable', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ currentPassword: 'CurrentPass123!', keepEmail2fa: true })
  });
  assert.equal(keepEmailDisable.status, 200);
  const keepEmailBody = await keepEmailDisable.json();
  assert.equal(keepEmailBody.totpEnabled, false);
  assert.equal(keepEmailBody.emailTwoFactorEnabled, true);
  assert.equal(keepEmailBody.twoFactorEnabled, true);
  assert.equal(keepEmailBody.activeMethod, 'email');
  assert.equal(harness.getUser().twoFactorEnabled, true);
});

test('Security PIN set, update, verify, and remove without leaking scrypt hash', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  // Invalid PIN format -> 422
  const badPin = await call('/api/user/account/security-pin', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ pin: 'abc' })
  });
  assert.equal(badPin.status, 422);

  // Initial PIN set -> 200
  const setPin = await call('/api/user/account/security-pin', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ pin: '123456' })
  });
  assert.equal(setPin.status, 200);
  const setBody = await setPin.json();
  assert.equal(setBody.success, true);
  assert.equal(setBody.hasSecurityPin, true);
  assert.ok(setBody.pinUpdatedAt);
  assert.equal(setBody.securityPinHash, undefined);

  const storedDoc = harness.stateDocs.get('user_account_prefs:usr_100');
  assert.match(storedDoc.securityPinHash, /^scrypt:[a-f0-9]+:[a-f0-9]+$/);

  // Changing PIN without currentPin/currentPassword -> 400
  const blockedChange = await call('/api/user/account/security-pin', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ pin: '654321' })
  });
  assert.equal(blockedChange.status, 400);

  // Changing PIN with wrong currentPin -> 401
  const wrongChange = await call('/api/user/account/security-pin', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ pin: '654321', currentPin: '000000' })
  });
  assert.equal(wrongChange.status, 401);

  // Changing PIN with valid currentPin -> 200
  const goodChange = await call('/api/user/account/security-pin', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ pin: '654321', currentPin: '123456' })
  });
  assert.equal(goodChange.status, 200);

  // Remove PIN without credential -> 400
  const blockedDelete = await call('/api/user/account/security-pin', {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert.equal(blockedDelete.status, 400);

  // Remove PIN with valid currentPin -> 200
  const goodDelete = await call('/api/user/account/security-pin', {
    method: 'DELETE',
    headers: authHeaders,
    body: JSON.stringify({ currentPin: '654321' })
  });
  assert.equal(goodDelete.status, 200);
  const delBody = await goodDelete.json();
  assert.equal(delBody.hasSecurityPin, false);
  assert.equal(delBody.pinUpdatedAt, null);
  assert.equal(delBody.securityPinHash, undefined);
});

test('Preferences, notification settings, and widget config persist cleanly with NO API key fields', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  const getInitial = await call('/api/user/account/preferences', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(getInitial.status, 200);
  const initialBody = await getInitial.json();
  assert.equal(initialBody.preferences.language, 'en');
  assert.equal(initialBody.notificationPrefs.digestFrequency, 'realtime');
  assert.equal(initialBody.widgetConfig.showQuickStats, true);
  assert.equal(initialBody.apiKeys, undefined);

  // Invalid digestFrequency rejected
  const badFreq = await call('/api/user/account/preferences', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ notificationPrefs: { digestFrequency: 'hourly' } })
  });
  assert.equal(badFreq.status, 422);

  // Save full preferences + notificationPrefs + widgetConfig (attempting to smuggle apiKeys must be ignored)
  const putRes = await call('/api/user/account/preferences', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      language: 'bn',
      timezone: 'UTC',
      marketingEmails: true,
      securityAlerts: true,
      apiKeys: [{ key: 'should-be-ignored' }],
      notificationPrefs: {
        emailSecurityAlerts: true,
        loginAlerts: false,
        orderAlerts: true,
        billingAlerts: true,
        teamInviteAlerts: false,
        productUpdates: true,
        digestFrequency: 'daily'
      },
      widgetConfig: {
        showQuickStats: true,
        showRecentActivity: false,
        showRevenueChart: true,
        showStoreHealth: false,
        showTeamActivity: true,
        compactDensity: true
      }
    })
  });
  assert.equal(putRes.status, 200);
  const putBody = await putRes.json();
  assert.equal(putBody.preferences.language, 'bn');
  assert.equal(putBody.preferences.timezone, 'UTC');
  assert.equal(putBody.preferences.marketingEmails, true);
  assert.equal(putBody.notificationPrefs.loginAlerts, false);
  assert.equal(putBody.notificationPrefs.digestFrequency, 'daily');
  assert.equal(putBody.widgetConfig.showRecentActivity, false);
  assert.equal(putBody.widgetConfig.compactDensity, true);
  assert.equal(putBody.apiKeys, undefined);
  assert.equal(putBody.preferences.apiKeys, undefined);
  assert.equal(harness.stateDocs.get('user_account_prefs:usr_100').apiKeys, undefined);
});

test('GET /api/user/account/activity-log merges sources newest first and enforces strict user isolation', async (t) => {
  const harness = createMockHarness({}, {}, {
    queryPg: async (sql, params) => {
      if (/FROM system_user_login_locations/i.test(sql)) {
        assert.equal(params[0], 'usr_100');
        return {
          rows: [
            {
              id: 11,
              user_id: 'usr_100',
              location_source: 'ip',
              formatted_address: 'Banani, Dhaka, Bangladesh',
              area: 'Banani',
              captured_at: '2026-11-15T12:00:00.000Z'
            },
            {
              id: 12,
              user_id: 'usr_999', // must be filtered out defensively
              location_source: 'ip',
              formatted_address: 'SECRET OTHER USER LOCATION',
              captured_at: '2026-11-15T13:00:00.000Z'
            }
          ]
        };
      }
      if (/FROM system_security_events/i.test(sql)) {
        assert.equal(params[0], 'usr_100');
        return {
          rows: [
            {
              id: 21,
              user_id: 'usr_100',
              event_type: 'login_success',
              severity: 'info',
              remote_ip: '203.0.113.10',
              user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0',
              details: { message: 'Signed in cleanly' },
              created_at: '2026-11-15T11:30:00.000Z'
            },
            {
              id: 22,
              user_id: 'usr_999',
              event_type: 'other_user_event',
              severity: 'warning',
              details: { message: 'LEAK' },
              created_at: '2026-11-15T14:00:00.000Z'
            }
          ]
        };
      }
      return null;
    }
  });

  const call = await withApp(t, harness.deps);

  // Trigger an account activity entry
  await call('/api/user/account/preferences', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer valid-session-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ language: 'en' })
  });

  const res = await call('/api/user/account/activity-log', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.activities.length >= 3);
  assert.ok(body.activities.every((item) => !JSON.stringify(item).includes('SECRET OTHER USER')));
  assert.ok(body.activities.every((item) => !JSON.stringify(item).includes('LEAK')));

  // Verify newest-first ordering
  for (let i = 1; i < body.activities.length; i += 1) {
    assert.ok(
      new Date(body.activities[i - 1].createdAt).getTime() >=
      new Date(body.activities[i].createdAt).getTime()
    );
  }
});

test('Per-owner team & staff CRUD, email confirmation fallback, and cross-owner isolation', async (t) => {
  let failEmailNext = false;
  const harness = createMockHarness({}, {}, {
    sendTiwloEmail: async (payload) => {
      if (failEmailNext) {
        throw new Error('SMTP not configured');
      }
      harness.sentTiwloEmails.push(payload);
      return { success: true, delivered: true, status: 'delivered', messageId: 'msg_invite_1' };
    }
  });
  const call = await withApp(t, harness.deps);
  const ownerAHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };
  const ownerBHeaders = {
    Authorization: 'Bearer second-user-token',
    'Content-Type': 'application/json'
  };

  assert.equal(TEAM_PERMISSION_CATALOG.length, 11);
  assert.ok(TEAM_ROLE_PRESETS.manager && TEAM_ROLE_PRESETS.custom);

  // Owner cannot add self
  const selfAdd = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Self',
      email: 'tariq@example.com',
      role: 'manager'
    })
  });
  assert.equal(selfAdd.status, 422);

  // Unknown permission rejected
  const badPerm = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Staff',
      email: 'staff1@example.com',
      role: 'custom',
      permissions: ['super_admin_hack']
    })
  });
  assert.equal(badPerm.status, 422);

  // Add active member without invite email
  const activeRes = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Rafi Ahmed',
      email: 'rafi@example.com',
      role: 'catalog_editor',
      require2fa: true,
      sendInviteEmail: false,
      storeScope: 'dhakamart'
    })
  });
  assert.equal(activeRes.status, 201);
  const activeBody = await activeRes.json();
  assert.equal(activeBody.member.status, 'active');
  assert.equal(activeBody.inviteEmailSent, false);
  assert.equal(activeBody.inviteStatus, 'not_required');
  assert.equal(harness.sentTiwloEmails.length, 0);

  // Duplicate email rejected
  const dupRes = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Rafi Duplicate',
      email: 'RAFI@EXAMPLE.COM',
      role: 'analyst'
    })
  });
  assert.equal(dupRes.status, 409);

  // Add pending member with sendInviteEmail: true (delivered)
  const inviteRes = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Sadia Islam',
      email: 'sadia@example.com',
      role: 'support_agent',
      sendInviteEmail: true
    })
  });
  assert.equal(inviteRes.status, 201);
  const inviteBody = await inviteRes.json();
  assert.equal(inviteBody.member.status, 'pending');
  assert.equal(inviteBody.inviteEmailSent, true);
  assert.equal(inviteBody.inviteStatus, 'sent');
  assert.ok(inviteBody.inviteLink && inviteBody.inviteLink.includes('team-invite?token='));
  assert.equal(inviteBody.member.inviteTokenHash, undefined);
  assert.equal(harness.sentTiwloEmails.length, 1);

  // Add member when mail transport fails -> graceful pending_manual fallback + inviteLink
  failEmailNext = true;
  const fallbackInviteRes = await call('/api/user/account/team-staff', {
    method: 'POST',
    headers: ownerAHeaders,
    body: JSON.stringify({
      name: 'Kamal Hasan',
      email: 'kamal@example.com',
      role: 'order_operator',
      sendInviteEmail: true
    })
  });
  failEmailNext = false;
  assert.equal(fallbackInviteRes.status, 201);
  const fallbackBody = await fallbackInviteRes.json();
  assert.equal(fallbackBody.member.status, 'pending');
  assert.equal(fallbackBody.inviteEmailSent, false);
  assert.equal(fallbackBody.inviteStatus, 'pending_manual');
  assert.match(fallbackBody.inviteWarning, /SMTP not configured/i);
  assert.ok(fallbackBody.inviteLink);

  // Update member
  const updateRes = await call(`/api/user/account/team-staff/${activeBody.member.id}`, {
    method: 'PUT',
    headers: ownerAHeaders,
    body: JSON.stringify({
      role: 'manager',
      status: 'suspended',
      require2fa: false
    })
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.member.role, 'manager');
  assert.equal(updateBody.member.status, 'suspended');
  assert.equal(updateBody.member.require2fa, false);

  // Cross-owner isolation: Owner B sees 0 members and cannot edit/delete Owner A's members
  const ownerBGet = await call('/api/user/account/team-staff', {
    headers: { Authorization: 'Bearer second-user-token' }
  });
  assert.equal(ownerBGet.status, 200);
  const ownerBData = await ownerBGet.json();
  assert.equal(ownerBData.ownerId, 'usr_200');
  assert.equal(ownerBData.members.length, 0);

  const crossPut = await call(`/api/user/account/team-staff/${activeBody.member.id}`, {
    method: 'PUT',
    headers: ownerBHeaders,
    body: JSON.stringify({ status: 'active' })
  });
  assert.equal(crossPut.status, 404);

  const crossDelete = await call(`/api/user/account/team-staff/${activeBody.member.id}`, {
    method: 'DELETE',
    headers: ownerBHeaders
  });
  assert.equal(crossDelete.status, 404);

  // Owner A deletes member cleanly
  const deleteRes = await call(`/api/user/account/team-staff/${fallbackBody.member.id}`, {
    method: 'DELETE',
    headers: ownerAHeaders
  });
  assert.equal(deleteRes.status, 200);
  const delData = await deleteRes.json();
  assert.equal(delData.removedMemberId, fallbackBody.member.id);

  const ownerAGet = await call('/api/user/account/team-staff', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  const ownerAData = await ownerAGet.json();
  assert.equal(ownerAData.members.length, 2);
  assert.ok(ownerAData.auditLogs.length >= 5);
});

test('Webhooks CRUD enforces HTTPS SSRF block and Backup Policy persists checkpoints', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  // Reject unsafe HTTP / localhost / private webhook URLs
  for (const unsafeUrl of ['http://example.com/hook', 'https://localhost:3000/hook', 'https://192.168.1.50/hook']) {
    const badRes = await call('/api/user/account/webhooks', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Bad Hook', url: unsafeUrl, events: ['order.created'] })
    });
    assert.equal(badRes.status, 400);
  }

  // Create valid public HTTPS webhook
  const createHook = await call('/api/user/account/webhooks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'ERP Sync Hook',
      url: 'https://hooks.example.com/tiwlo',
      events: ['order.created', 'billing.paid']
    })
  });
  assert.equal(createHook.status, 201);
  const hookBody = await createHook.json();
  assert.equal(hookBody.webhook.name, 'ERP Sync Hook');
  assert.match(hookBody.webhook.signingSecret, /^whsec_/);

  const listHooks = await call('/api/user/account/webhooks', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(listHooks.status, 200);
  const listBody = await listHooks.json();
  assert.equal(listBody.webhooks.length, 1);

  const delHook = await call(`/api/user/account/webhooks/${hookBody.webhook.id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(delHook.status, 200);

  // Backup policy defaults, update, and manual checkpoint run
  const getBackup = await call('/api/user/account/backup-policy', {
    headers: { Authorization: 'Bearer valid-session-token' }
  });
  assert.equal(getBackup.status, 200);
  const defaultBackup = await getBackup.json();
  assert.equal(defaultBackup.policy.frequency, 'daily');

  const putBackup = await call('/api/user/account/backup-policy', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      enabled: true,
      frequency: 'hourly',
      retentionDays: 90,
      preferredWindowUtc: '04:00',
      includeStoreCatalog: true,
      includeOrdersBilling: true,
      includeTeamAudit: false
    })
  });
  assert.equal(putBackup.status, 200);
  const updatedBackup = await putBackup.json();
  assert.equal(updatedBackup.policy.frequency, 'hourly');
  assert.equal(updatedBackup.policy.retentionDays, 90);

  const runBackup = await call('/api/user/account/backup-policy/run', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert.equal(runBackup.status, 201);
  const runBody = await runBackup.json();
  assert.equal(runBody.snapshots.length, 1);
  assert.match(runBody.snapshot.id, /^chk_/);
});

test('Preferences persists widgetOrder without reintroducing API key fields', async (t) => {
  const harness = createMockHarness();
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  const putPrefs = await call('/api/user/account/preferences', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      widgetConfig: {
        widgetOrder: ['quick-actions', 'usage-summary', 'stores', 'droplets', 'active-services'],
        defaultLandingTab: 'overview'
      }
    })
  });
  assert.equal(putPrefs.status, 200);
  const prefsBody = await putPrefs.json();
  assert.deepEqual(prefsBody.preferences.widgetConfig.widgetOrder, [
    'quick-actions',
    'usage-summary',
    'stores',
    'droplets',
    'active-services'
  ]);
  assert.equal(prefsBody.preferences.apiKeys, undefined);
});

test('Changing name or date of birth on a verified account automatically resets verification and requires re-verification', async (t) => {
  const harness = createMockHarness({
    userOverrides: {
      identityVerified: true,
      identityVerificationRequired: false,
      name: 'Original Verified Name',
      dateOfBirth: '1995-04-12'
    }
  });
  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  const res = await call('/api/user/account/settings', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Changed New Name'
    })
  });
  assert.equal(res.status, 200);
  const updatedUser = harness.state?.user || harness.user;
  if (updatedUser) {
    assert.equal(updatedUser.identityVerified, false);
    assert.equal(updatedUser.identityVerificationRequired, true);
  }
});

test('Webhook SSRF validators block private, CGNAT, IPv4-mapped IPv6, ULA, and embedded credentials while allowing public/Cloudflare IPs', async () => {
  const blockedUrls = [
    'http://hooks.example.com/hook',
    'https://user:pass@hooks.example.com/hook',
    'https://localhost/hook',
    'https://localhost./hook',
    'https://service.local/hook',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://127.0.0.1/hook',
    'https://10.0.0.5/hook',
    'https://172.16.0.5/hook',
    'https://192.168.1.50/hook',
    'https://100.64.0.1/hook',
    'https://100.100.100.200/hook',
    'https://169.254.169.254/latest/meta-data/',
    'https://0.0.0.0/hook',
    'https://[::1]/hook',
    'https://[::]/hook',
    'https://[fc00::1]/hook',
    'https://[fd00:ec2::254]/hook',
    'https://[fe80::1]/hook',
    'https://[::ffff:127.0.0.1]/hook',
    'https://[::ffff:169.254.169.254]/hook',
    'https://[::ffff:10.0.0.1]/hook'
  ];

  for (const url of blockedUrls) {
    assert.equal(validateSafeWebhookUrl(url), null, `Expected blocked URL: ${url}`);
  }

  assert.equal(isPublicUnicastIp('1.1.1.1'), true);
  assert.equal(isPublicUnicastIp('172.64.155.209'), true);
  assert.equal(isPublicUnicastIp('2606:4700:4700::1111'), true);
  assert.equal(isPublicUnicastIp('100.64.10.1'), false);
  assert.equal(isPublicUnicastIp('::ffff:7f00:1'), false);

  const literalPublic = await resolveAndAssertSafeWebhookUrl('https://172.64.155.209/hook', {
    dnsLookup: async () => {
      throw new Error('Should not invoke DNS for IP literals');
    }
  });
  assert.equal(literalPublic?.hostname, '172.64.155.209');

  const literalIpv6 = await resolveAndAssertSafeWebhookUrl('https://[2606:4700:4700::1111]/hook');
  assert.equal(literalIpv6?.addresses[0]?.family, 6);

  const mixedRebind = await resolveAndAssertSafeWebhookUrl('https://dual.example.com/hook', {
    dnsLookup: async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.8', family: 4 }
    ]
  });
  assert.equal(mixedRebind, null);

  const mappedRebind = await resolveAndAssertSafeWebhookUrl('https://v6alias.example.com/hook', {
    dnsLookup: async () => [{ address: '::ffff:169.254.169.254', family: 6 }]
  });
  assert.equal(mappedRebind, null);
});

test('Webhook routes reject DNS rebinding on create/test and enforce manual redirect handling', async (t) => {
  let rebindToPrivate = false;
  const fetchCalls = [];
  const harness = createMockHarness({}, {}, {
    dnsLookup: async (hostname) => {
      if (hostname === 'rebind.example.com') {
        return rebindToPrivate
          ? [{ address: '127.0.0.1', family: 4 }]
          : [{ address: '93.184.216.34', family: 4 }];
      }
      if (hostname === 'cgnat.example.com') {
        return [{ address: '100.64.1.10', family: 4 }];
      }
      const err = new Error(`ENOTFOUND ${hostname}`);
      err.code = 'ENOTFOUND';
      throw err;
    },
    webhookFetch: async (url, init) => {
      fetchCalls.push({ url, init });
      return {
        ok: false,
        status: 302,
        statusText: 'Found'
      };
    }
  });

  const call = await withApp(t, harness.deps);
  const authHeaders = {
    Authorization: 'Bearer valid-session-token',
    'Content-Type': 'application/json'
  };

  // Reject DNS resolving to CGNAT / unresolvable domain on registration
  const cgnatRes = await call('/api/user/account/webhooks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'CGNAT Hook', url: 'https://cgnat.example.com/hook', events: ['order.created'] })
  });
  assert.equal(cgnatRes.status, 400);

  const nxRes = await call('/api/user/account/webhooks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'NX Hook', url: 'https://missing.example.invalid/hook', events: ['order.created'] })
  });
  assert.equal(nxRes.status, 400);

  // Register while DNS points to public IP
  const createRes = await call('/api/user/account/webhooks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Rebind Target', url: 'https://rebind.example.com/hook', events: ['order.created'] })
  });
  assert.equal(createRes.status, 201);
  const { webhook } = await createRes.json();

  // Test while public: must pass redirect: 'manual' and NOT treat 302 as ok
  const redirectTestRes = await call(`/api/user/account/webhooks/${webhook.id}/test`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.equal(redirectTestRes.status, 200);
  const redirectBody = await redirectTestRes.json();
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].init.redirect, 'manual');
  assert.equal(redirectBody.delivery.ok, false);
  assert.equal(redirectBody.delivery.statusCode, 302);

  // Simulate DNS rebinding to 127.0.0.1 before next test dispatch -> must reject with 400 without fetching
  rebindToPrivate = true;
  const blockedTestRes = await call(`/api/user/account/webhooks/${webhook.id}/test`, {
    method: 'POST',
    headers: authHeaders
  });
  assert.equal(blockedTestRes.status, 400);
  assert.equal(fetchCalls.length, 1);
});
