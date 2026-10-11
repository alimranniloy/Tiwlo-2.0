import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDomainWithRust, isRustDomainClaimEnabled } from './rustDomainClient.js';

test('Rust domain claims stay disabled by default', () => {
  const previous = process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED;
  delete process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED;
  try {
    assert.equal(isRustDomainClaimEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED;
    else process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED = previous;
  }
});

test('Rust domain claim feature flag accepts only true', () => {
  const previous = process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED;
  process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED = 'yes';
  try {
    assert.equal(isRustDomainClaimEnabled(), false);
    process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED = 'true';
    assert.equal(isRustDomainClaimEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED;
    else process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED = previous;
  }
});

test('Rust claim client preserves the user-facing error contract', async t => {
  const previous = {
    enabled: process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED,
    backend: process.env.TIWLO_RUST_BACKEND_URL,
    identity: process.env.TIWLO_INTERNAL_IDENTITY_SECRET,
    abuse: process.env.ABUSE_HASH_SECRET
  };
  process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED = 'true';
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'i'.repeat(32);
  process.env.ABUSE_HASH_SECRET = 'a'.repeat(32);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      const envKey = {
        enabled: 'TIWLO_RUST_DOMAIN_CLAIM_ENABLED',
        backend: 'TIWLO_RUST_BACKEND_URL',
        identity: 'TIWLO_INTERNAL_IDENTITY_SECRET',
        abuse: 'ABUSE_HASH_SECRET'
      }[key];
      if (value === undefined) delete process.env[envKey];
      else process.env[envKey] = value;
    }
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({
      error: 'Verify your email before claiming a free domain.',
      code: 'EMAIL_VERIFICATION_REQUIRED'
    }),
    { status: 403 }
  ));

  await assert.rejects(
    claimDomainWithRust({
      user: { id: 'user-1', email: 'user@example.com' },
      name: 'example',
      request: { ip: '127.0.0.1' }
    }),
    error => {
      assert.equal(error.statusCode, 403);
      assert.deepEqual(error.details, {
        error: 'Verify your email before claiming a free domain.',
        code: 'EMAIL_VERIFICATION_REQUIRED'
      });
      return true;
    }
  );
});
