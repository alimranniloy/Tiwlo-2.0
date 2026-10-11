import test from 'node:test';
import assert from 'node:assert/strict';
import { createRustIdentityAssertion } from './rustIdentity.js';

test('creates a short-lived Rust identity assertion from the authenticated user', () => {
  const previousSecret = process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  const previousAbuseSecret = process.env.ABUSE_HASH_SECRET;
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'a'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'b'.repeat(32);
  try {
    const token = createRustIdentityAssertion(
      { id: 'user-123', email: 'user@example.com', email_verified: true },
      { ip: '127.0.0.1', deviceToken: 'device-1', nowSeconds: 1000 }
    );
    const [payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    assert.equal(decoded.user_id, 'user-123');
    assert.equal(decoded.email_verified, true);
    assert.equal(decoded.expires_at, 1030);
    assert.match(decoded.ip_hash, /^[a-f0-9]{64}$/);
    assert.match(decoded.device_hash, /^[a-f0-9]{64}$/);
    assert.match(decoded.email_hash, /^[a-f0-9]{64}$/);
    assert.equal(signature.length, 43);
  } finally {
    if (previousSecret === undefined) delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
    else process.env.TIWLO_INTERNAL_IDENTITY_SECRET = previousSecret;
    if (previousAbuseSecret === undefined) delete process.env.ABUSE_HASH_SECRET;
    else process.env.ABUSE_HASH_SECRET = previousAbuseSecret;
  }
});

test('rejects missing or weak internal identity secrets', () => {
  const previousSecret = process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  const previousAbuseSecret = process.env.ABUSE_HASH_SECRET;
  delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  process.env.ABUSE_HASH_SECRET = 'b'.repeat(32);
  try {
    assert.throws(
      () => createRustIdentityAssertion({ id: 'user-123' }, { nowSeconds: 1000 }),
      /TIWLO_INTERNAL_IDENTITY_SECRET/
    );
  } finally {
    if (previousSecret !== undefined) process.env.TIWLO_INTERNAL_IDENTITY_SECRET = previousSecret;
    else delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
    if (previousAbuseSecret === undefined) delete process.env.ABUSE_HASH_SECRET;
    else process.env.ABUSE_HASH_SECRET = previousAbuseSecret;
  }
});
