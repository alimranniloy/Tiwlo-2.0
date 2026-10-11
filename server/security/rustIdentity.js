import { createHash, createHmac } from 'node:crypto';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const ASSERTION_TTL_SECONDS = 30;

function getIdentitySecret() {
  const secret = String(process.env.TIWLO_INTERNAL_IDENTITY_SECRET || '');
  if (!secret || secret.length < 32) {
    throw new Error('TIWLO_INTERNAL_IDENTITY_SECRET must be at least 32 characters.');
  }
  return secret;
}

function hashSignal(value) {
  const secret = String(
    process.env.ABUSE_HASH_SECRET ||
    process.env.SECURITY_SECRET ||
    PLATFORM_CONFIG.primaryDomain
  );
  return createHmac('sha256', secret).update(String(value || 'unknown')).digest('hex');
}

function hashLabeledSignal(label, value) {
  const secret = String(
    process.env.ABUSE_HASH_SECRET ||
    process.env.SECURITY_SECRET ||
    PLATFORM_CONFIG.primaryDomain
  );
  return createHmac('sha256', secret)
    .update(`${label}:${String(value || 'unknown').trim()}`)
    .digest('hex');
}

export function createRustIdentityAssertion(
  user,
  {
    ip = 'unknown',
    deviceToken = '',
    headers = {},
    nowSeconds = Math.floor(Date.now() / 1000)
  } = {}
) {
  const userId = String(user?.id || '').trim();
  if (!userId || /[\u0000-\u001f\u007f]/.test(userId) || userId.length > 128) {
    throw new TypeError('A valid authenticated user is required for a Rust identity assertion.');
  }
  const userAgent = String(headers['user-agent'] || 'unknown-client').trim();
  const clientHints = [
    headers['sec-ch-ua'],
    headers['sec-ch-ua-mobile'],
    headers['sec-ch-ua-platform']
  ].map(value => String(value || '').trim()).join('|');
  const payload = {
    user_id: userId,
    email_verified: user.email_verified === true || user.emailVerified === true,
    ip_hash: hashSignal(ip),
    device_hash: deviceToken ? hashSignal(deviceToken) : null,
    email_hash: hashSignal(user.email || ''),
    identity_hash: hashLabeledSignal(
      'identity',
      deviceToken || `${userAgent}|${clientHints}|${ip}`
    ),
    session_fingerprint: createHash('sha256').update(userAgent).digest('hex'),
    session_user_agent_hash: hashLabeledSignal('user-agent', userAgent),
    session_client_hints_hash: clientHints
      ? hashLabeledSignal('client-hints', clientHints)
      : null,
    session_platform_class: String(headers['sec-ch-ua-platform'] || 'unknown')
      .replace(/["']/g, '').slice(0, 32) || 'unknown',
    expires_at: nowSeconds + ASSERTION_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getIdentitySecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function getRustIdentityHeader(user, request = {}) {
  return {
    'x-tiwlo-identity': createRustIdentityAssertion(user, {
      ip: request.ip || request.socket?.remoteAddress,
      deviceToken: request.cookies?.uids_device || '',
      headers: request.headers || {},
      nowSeconds: request.nowSeconds
    })
  };
}

export function getRustServiceIdentityHeader() {
  return getRustIdentityHeader({
    id: 'tiwlo-internal-auth-service',
    email: 'auth-service@tiwlo.internal',
    email_verified: true
  });
}
