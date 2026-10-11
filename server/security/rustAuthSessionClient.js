import { createHash } from 'node:crypto';
import {
  getRustIdentityHeader,
  getRustServiceIdentityHeader
} from './rustIdentity.js';
import { hashSecuritySubject } from '../db/securityPersistence.js';

const REQUEST_TIMEOUT_MS = 2500;

function getRustBackendUrl() {
  const value = String(process.env.TIWLO_RUST_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('TIWLO_RUST_BACKEND_URL must be configured for auth session services.');
  return value;
}

async function requestRust({ path, method = 'POST', body, headers = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${getRustBackendUrl()}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (cause) {
        const error = new Error('Rust auth session service returned an invalid response.', { cause });
        error.statusCode = response.ok ? 502 : response.status;
        throw error;
      }
    }
    if (!response.ok) {
      const error = new Error(payload?.error || 'Rust auth session operation failed.');
      error.statusCode = response.status;
      error.details = payload || {};
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function getUserAgent(request) {
  return String(request?.headers?.['user-agent'] || 'unknown-client').trim();
}

function requireSuccessPayload(payload, requiredFields, operation) {
  if (!payload || typeof payload !== 'object' ||
      requiredFields.some(field => typeof payload[field] !== 'string' || !payload[field])) {
    throw new Error(`Rust auth session service returned an invalid ${operation} response.`);
  }
  return payload;
}

function requireOperationSuccess(payload, operation) {
  if (!payload || payload.success !== true) {
    throw new Error(`Rust auth session service returned an invalid ${operation} response.`);
  }
  return payload;
}

export async function createAuthSessionWithRust({ user, tiwiId, email, request }) {
  const payload = await requestRust({
    path: '/v1/auth/sessions',
    body: {
      tiwi_id: tiwiId || null,
      email: email || null,
      user_agent: getUserAgent(request)
    },
    headers: getRustIdentityHeader(user, request)
  });
  requireSuccessPayload(payload, ['sessionToken', 'expiresAt'], 'session creation');
  return { sessionToken: payload.sessionToken, expiresAt: payload.expiresAt };
}

export async function resolveAuthSessionWithRust({ token, request }) {
  const payload = await requestRust({
    path: '/v1/auth/sessions/resolve',
    body: { token, user_agent: getUserAgent(request) },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.authenticated !== 'boolean') {
    throw new Error('Rust auth session service returned an invalid session lookup response.');
  }
  if (!payload.authenticated) return null;
  requireSuccessPayload(payload, ['userId', 'expiresAt'], 'session lookup');
  const fingerprint = createHash('sha256').update(getUserAgent(request)).digest('hex');
  return {
    sessionToken: token,
    userId: payload.userId,
    tiwiId: payload.tiwiId,
    storeId: payload.tiwiId,
    email: payload.email,
    fingerprint,
    expiresAt: payload.expiresAt
  };
}

export function revokeAuthSessionWithRust(token) {
  return requestRust({
    path: '/v1/auth/sessions/revoke',
    body: { token },
    headers: getRustServiceIdentityHeader()
  }).then(payload => requireOperationSuccess(payload, 'session revocation'));
}

export function revokeUserAuthSessionsWithRust(userId, exceptToken = null) {
  return requestRust({
    path: `/v1/auth/users/${encodeURIComponent(userId)}/sessions/revoke`,
    body: { token: exceptToken || '' },
    headers: getRustServiceIdentityHeader()
  }).then(payload => requireOperationSuccess(payload, 'user session revocation'));
}

export function updatePasswordAndRevokeSessionsWithRust(userId, passwordHash, exceptToken = null) {
  return requestRust({
    path: `/v1/auth/users/${encodeURIComponent(userId)}/password`,
    method: 'PUT',
    body: { password_hash: passwordHash, except_token: exceptToken },
    headers: getRustServiceIdentityHeader()
  }).then(payload => requireOperationSuccess(payload, 'password update'));
}

export async function hashPasswordWithRust(password) {
  const payload = await requestRust({
    path: '/v1/auth/passwords/hash',
    body: { password },
    headers: getRustServiceIdentityHeader()
  });
  requireSuccessPayload(payload, ['passwordHash'], 'password hashing');
  if (!payload.passwordHash.startsWith('scrypt$')) {
    throw new Error('Rust auth service returned an unsupported password hash.');
  }
  return payload.passwordHash;
}

export async function verifyPasswordWithRust(userId, password) {
  const payload = await requestRust({
    path: `/v1/auth/users/${encodeURIComponent(userId)}/password/verify`,
    body: { password },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean' ||
      typeof payload.rehashPerformed !== 'boolean' ||
      (payload.rehashPerformed && !payload.valid)) {
    throw new Error('Rust auth service returned an invalid password verification response.');
  }
  return { valid: payload.valid, rehashPerformed: payload.rehashPerformed };
}

export async function generateOtpWithRust(email, type = 'login_2fa', expiryMinutes = 10) {
  const payload = await requestRust({
    path: '/v1/auth/otp',
    body: { email, type, expiry_minutes: expiryMinutes },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.code !== 'string' || !/^\d{6}$/.test(payload.code) ||
      typeof payload.token !== 'string' || !/^tok_[a-f0-9]{48}$/.test(payload.token) ||
      !Number.isFinite(payload.expiresAt)) {
    throw new Error('Rust auth service returned an invalid OTP generation response.');
  }
  return { code: payload.code, token: payload.token, expiresAt: payload.expiresAt };
}

export async function verifyOtpWithRust(token, inputCode, expectedType = 'login_2fa') {
  if (!token) return { valid: false, error: 'Verification token is required' };
  const payload = await requestRust({
    path: '/v1/auth/otp/verify',
    body: { token, code: String(inputCode || ''), expected_type: expectedType },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean' ||
      !(payload.email === null || typeof payload.email === 'string') ||
      !(payload.error === null || typeof payload.error === 'string') ||
      (payload.valid && (!payload.email || payload.error))) {
    throw new Error('Rust auth service returned an invalid OTP verification response.');
  }
  if (!payload.valid) {
    return { valid: false, error: payload.error || 'Invalid or expired verification session' };
  }
  return { valid: true, email: payload.email };
}

export async function completeMfaSetupWithRust(token, inputCode) {
  if (!token) return { valid: false, error: 'Verification token is required' };
  const payload = await requestRust({
    path: '/v1/auth/mfa/setup/complete',
    body: { token, code: String(inputCode || '') },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean' ||
      typeof payload.notFound !== 'boolean' ||
      !(payload.email === null || typeof payload.email === 'string') ||
      !(payload.error === null || typeof payload.error === 'string') ||
      (payload.valid && (!payload.email || payload.error || payload.notFound))) {
    throw new Error('Rust auth service returned an invalid MFA setup response.');
  }
  return payload.valid
    ? { valid: true, email: payload.email }
    : {
        valid: false,
        error: payload.error || 'Invalid or expired verification session',
        notFound: payload.notFound
      };
}

export async function completeMfaLoginWithRust(token, inputCode, request = null) {
  if (!token) return { valid: false, error: 'Verification token is required' };
  const payload = await requestRust({
    path: '/v1/auth/mfa/login/complete',
    body: {
      token,
      code: String(inputCode || ''),
      user_agent: getUserAgent(request)
    },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean' ||
      typeof payload.notFound !== 'boolean' ||
      !(payload.email === null || typeof payload.email === 'string') ||
      !(payload.error === null || typeof payload.error === 'string')) {
    throw new Error('Rust auth service returned an invalid MFA login response.');
  }
  if (!payload.valid) {
    if (payload.sessionToken !== null || payload.userId !== null ||
        payload.tiwiId !== null || payload.expiresAt !== null) {
      throw new Error('Rust auth service returned a session for a rejected MFA login.');
    }
    return {
      valid: false,
      error: payload.error || 'Invalid or expired verification session',
      notFound: payload.notFound
    };
  }
  if (typeof payload.sessionToken !== 'string' ||
      !/^[a-f0-9]{128}$/.test(payload.sessionToken) ||
      typeof payload.userId !== 'string' || !payload.userId ||
      !(payload.tiwiId === null || typeof payload.tiwiId === 'string') ||
      typeof payload.expiresAt !== 'string' || !payload.email || payload.error ||
      payload.notFound) {
    throw new Error('Rust auth service returned an incomplete MFA session response.');
  }
  return {
    valid: true,
    email: payload.email,
    sessionToken: payload.sessionToken,
    userId: payload.userId,
    tiwiId: payload.tiwiId,
    expiresAt: payload.expiresAt
  };
}

export async function completeEmailVerificationWithRust(token, inputCode) {
  if (!token) return { valid: false, error: 'Verification token is required' };
  const payload = await requestRust({
    path: '/v1/auth/email/verify',
    body: { token, code: String(inputCode || '') },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean' ||
      typeof payload.notFound !== 'boolean' ||
      !(payload.email === null || typeof payload.email === 'string') ||
      !(payload.error === null || typeof payload.error === 'string') ||
      (payload.valid && (!payload.email || payload.error || payload.notFound))) {
    throw new Error('Rust auth service returned an invalid email verification response.');
  }
  return payload.valid
    ? { valid: true, email: payload.email }
    : {
        valid: false,
        error: payload.error || 'Invalid or expired verification session',
        notFound: payload.notFound
      };
}

export async function getOtpSessionWithRust(token) {
  if (!token) return null;
  const payload = await requestRust({
    path: '/v1/auth/otp/session/get',
    body: { token },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || !(payload.session === null ||
      (payload.session && typeof payload.session === 'object' &&
       typeof payload.session.email === 'string' &&
       typeof payload.session.type === 'string' &&
       Number.isInteger(payload.session.attempts) &&
       Number.isInteger(payload.session.max_attempts) &&
       Number.isFinite(payload.session.expires_at)))) {
    throw new Error('Rust auth service returned an invalid OTP session response.');
  }
  if (!payload.session) return null;
  return {
    email: payload.session.email,
    type: payload.session.type,
    attempts: payload.session.attempts,
    max_attempts: payload.session.max_attempts,
    expires_at: new Date(payload.session.expires_at)
  };
}

export async function deleteOtpSessionWithRust(token) {
  if (!token) return;
  const payload = await requestRust({
    path: '/v1/auth/otp/session/delete',
    body: { token },
    headers: getRustServiceIdentityHeader()
  });
  requireOperationSuccess(payload, 'OTP deletion');
}

export async function createSecureGrantWithRust(email, type, expiryMinutes = 15) {
  const payload = await requestRust({
    path: '/v1/auth/grants',
    body: { email, type, expiry_minutes: expiryMinutes },
    headers: getRustServiceIdentityHeader()
  });
  requireSuccessPayload(payload, ['token'], 'grant creation');
  if (!/^grant_[a-f0-9]{64}$/.test(payload.token)) {
    throw new Error('Rust auth service returned an invalid grant token.');
  }
  return payload.token;
}

export async function consumeSecureGrantWithRust(token, type) {
  if (!token) return null;
  const payload = await requestRust({
    path: '/v1/auth/grants/consume',
    body: { token, type },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || !(payload.email === null || typeof payload.email === 'string')) {
    throw new Error('Rust auth service returned an invalid grant consumption response.');
  }
  return payload.email || null;
}

function getSsoClientIp(request) {
  let ip = String(request?.ip || request?.socket?.remoteAddress || '127.0.0.1')
    .split(',')[0]
    .trim();
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

export async function generateSsoHandshakeWithRust({
  userId,
  tiwiId,
  email,
  deviceData = {},
  appTrustToken = null,
  origin = 'tiwi_mobile_app',
  request = null
}) {
  const ip = getSsoClientIp(request);
  const fingerprint = {
    platform: deviceData.platform || 'mobile',
    osVersion: deviceData.osVersion || 'unknown',
    deviceModel: deviceData.deviceModel || 'unknown_device',
    appVersion: deviceData.appVersion || '1.0.0',
    networkType: deviceData.networkType || 'cellular/wifi'
  };
  const payload = await requestRust({
    path: '/v1/auth/sso/tickets',
    body: {
      user_id: userId,
      tiwi_id: tiwiId || null,
      email,
      device_data: {
        platform: fingerprint.platform,
        os_version: fingerprint.osVersion,
        device_model: fingerprint.deviceModel,
        app_version: fingerprint.appVersion,
        network_type: fingerprint.networkType
      },
      app_trust_token: appTrustToken,
      origin,
      ip,
      captured_at: new Date().toISOString()
    },
    headers: getRustServiceIdentityHeader()
  });
  const deviceFingerprint = payload?.deviceFingerprint;
  if (!payload || typeof payload.ssoToken !== 'string' ||
      !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(payload.ssoToken) ||
      typeof payload.nonce !== 'string' ||
      !/^sso_nonce_[a-f0-9]{48}$/.test(payload.nonce) ||
      !Number.isFinite(payload.expiresAt) ||
      typeof payload.isAppTrusted !== 'boolean' ||
      !deviceFingerprint || typeof deviceFingerprint !== 'object' ||
      ['hash', 'platform', 'osVersion', 'deviceModel', 'appVersion',
        'networkType', 'ip', 'capturedAt'].some(field =>
        typeof deviceFingerprint[field] !== 'string'
      )) {
    throw new Error('Rust auth service returned an invalid SSO ticket response.');
  }
  return { ...payload, deviceFingerprint };
}

export async function verifySsoHandshakeWithRust({ ssoToken, nonce }) {
  if (typeof ssoToken !== 'string' || typeof nonce !== 'string' || !ssoToken || !nonce) {
    return { valid: false, error: 'Missing SSO token or nonce' };
  }
  const payload = await requestRust({
    path: '/v1/auth/sso/tickets/consume',
    body: { sso_token: ssoToken, nonce },
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || typeof payload.valid !== 'boolean') {
    throw new Error('Rust auth service returned an invalid SSO verification response.');
  }
  if (!payload.valid) {
    if (typeof payload.error !== 'string' || !payload.error) {
      throw new Error('Rust auth service returned an invalid SSO verification error.');
    }
    return { valid: false, error: payload.error };
  }
  const user = payload.user;
  if (!user || typeof user.id !== 'string' || !user.id ||
      typeof user.email !== 'string' || !user.email ||
      !(user.tiwiId === null || typeof user.tiwiId === 'string') ||
      typeof payload.origin !== 'string' ||
      typeof payload.isAppTrusted !== 'boolean' ||
      !payload.deviceFingerprint || typeof payload.deviceFingerprint !== 'object') {
    throw new Error('Rust auth service returned an invalid verified SSO ticket.');
  }
  return {
    valid: true,
    user: { id: user.id, tiwiId: user.tiwiId, email: user.email },
    origin: payload.origin,
    isAppTrusted: payload.isAppTrusted,
    deviceFingerprint: payload.deviceFingerprint
  };
}

function normalizeRateLimitKey(key) {
  if (!key || typeof key !== 'string') return 'unknown';
  let normalized = key.split(',')[0].trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) normalized = normalized.substring(7);
  if (normalized === '::1') normalized = '127.0.0.1';
  return normalized;
}

function rateLimitKeyPayload(key) {
  const keyHash = hashSecuritySubject(normalizeRateLimitKey(key));
  if (!keyHash) throw new Error('A valid auth rate-limit key is required.');
  return { key_hash: keyHash };
}

export async function checkAuthRateLimitWithRust(key) {
  const payload = await requestRust({
    path: '/v1/auth/rate-limits/check',
    body: rateLimitKeyPayload(key),
    headers: getRustServiceIdentityHeader()
  });
  if (payload?.locked === true &&
      typeof payload.remainingSeconds === 'number' &&
      payload.remainingSeconds > 0) {
    return { isLocked: true, remainingSeconds: payload.remainingSeconds };
  }
  if (payload?.locked === false) return false;
  throw new Error('Rust auth service returned an invalid rate-limit check response.');
}

export async function recordAuthRateLimitFailureWithRust(key) {
  const payload = await requestRust({
    path: '/v1/auth/rate-limits/failure',
    body: rateLimitKeyPayload(key),
    headers: getRustServiceIdentityHeader()
  });
  if (!payload || !Number.isInteger(payload.count) || payload.count < 1 ||
      !Number.isFinite(payload.firstAttempt) ||
      !(payload.lockedUntil === null || Number.isFinite(payload.lockedUntil)) ||
      !Number.isInteger(payload.maxAttempts) || payload.maxAttempts < 1 ||
      !Number.isInteger(payload.remainingAttempts) || payload.remainingAttempts < 0) {
    throw new Error('Rust auth service returned an invalid rate-limit failure response.');
  }
  return {
    count: payload.count,
    firstAttempt: payload.firstAttempt,
    lockedUntil: payload.lockedUntil,
    maxAttempts: payload.maxAttempts,
    remainingAttempts: payload.remainingAttempts
  };
}

export function clearAuthRateLimitWithRust(key) {
  return requestRust({
    path: '/v1/auth/rate-limits/clear',
    body: rateLimitKeyPayload(key),
    headers: getRustServiceIdentityHeader()
  }).then(payload => requireOperationSuccess(payload, 'rate-limit reset'));
}
