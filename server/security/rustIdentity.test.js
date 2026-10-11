import test from 'node:test';
import assert from 'node:assert/strict';
import { createRustIdentityAssertion } from './rustIdentity.js';

test('creates a short-lived Rust identity assertion from the authenticated user', () => {
  const previousSecret = process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'a'.repeat(32);
  try {
    const token = createRustIdentityAssertion(
      { id: 'user-123', email_verified: true },
      1000
    );
    const [payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    assert.deepEqual(decoded, {
      user_id: 'user-123',
      email_verified: true,
      expires_at: 1030
    });
    assert.equal(signature.length, 43);
  } finally {
    if (previousSecret === undefined) delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
    else process.env.TIWLO_INTERNAL_IDENTITY_SECRET = previousSecret;
  }
});

test('rejects missing or weak internal identity secrets', () => {
  const previousSecret = process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  try {
    assert.throws(
      () => createRustIdentityAssertion({ id: 'user-123' }, 1000),
      /TIWLO_INTERNAL_IDENTITY_SECRET/
    );
  } finally {
    if (previousSecret !== undefined) process.env.TIWLO_INTERNAL_IDENTITY_SECRET = previousSecret;
  }
});
