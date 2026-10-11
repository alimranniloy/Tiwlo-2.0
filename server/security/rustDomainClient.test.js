import test from 'node:test';
import assert from 'node:assert/strict';
import { isRustDomainClaimEnabled } from './rustDomainClient.js';

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
