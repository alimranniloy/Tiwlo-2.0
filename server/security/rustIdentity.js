import { createHmac } from 'node:crypto';

const ASSERTION_TTL_SECONDS = 30;

function getIdentitySecret() {
  const secret = String(process.env.TIWLO_INTERNAL_IDENTITY_SECRET || '');
  if (!secret || secret.length < 32) {
    throw new Error('TIWLO_INTERNAL_IDENTITY_SECRET must be at least 32 characters.');
  }
  return secret;
}

export function createRustIdentityAssertion(user, nowSeconds = Math.floor(Date.now() / 1000)) {
  const userId = String(user?.id || '').trim();
  if (!userId || /[\u0000-\u001f\u007f]/.test(userId) || userId.length > 128) {
    throw new TypeError('A valid authenticated user is required for a Rust identity assertion.');
  }
  const payload = {
    user_id: userId,
    email_verified: user.email_verified === true,
    expires_at: nowSeconds + ASSERTION_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getIdentitySecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function getRustIdentityHeader(user, nowSeconds) {
  return {
    'x-tiwlo-identity': createRustIdentityAssertion(user, nowSeconds)
  };
}
