import { createHmac } from 'node:crypto';

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
    process.env.VITE_PRIMARY_DOMAIN ||
    ''
  );
  if (!secret) throw new Error('An abuse signal hash secret must be configured.');
  return createHmac('sha256', secret).update(String(value || 'unknown')).digest('hex');
}

export function createRustIdentityAssertion(
  user,
  { ip = 'unknown', deviceToken = '', nowSeconds = Math.floor(Date.now() / 1000) } = {}
) {
  const userId = String(user?.id || '').trim();
  if (!userId || /[\u0000-\u001f\u007f]/.test(userId) || userId.length > 128) {
    throw new TypeError('A valid authenticated user is required for a Rust identity assertion.');
  }
  const payload = {
    user_id: userId,
    email_verified: user.email_verified === true,
    ip_hash: hashSignal(ip),
    device_hash: deviceToken ? hashSignal(deviceToken) : null,
    email_hash: hashSignal(user.email || ''),
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
      nowSeconds: request.nowSeconds
    })
  };
}
