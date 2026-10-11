import test from 'node:test';
import assert from 'node:assert/strict';
import { isRustDnsEnabled } from './rustDomainClient.js';

test('DNS Rust cutover is disabled unless its own feature flag is enabled', () => {
  const previous = process.env.TIWLO_RUST_DNS_ENABLED;
  process.env.TIWLO_RUST_DNS_ENABLED = 'false';
  try {
    assert.equal(isRustDnsEnabled(), false);
    process.env.TIWLO_RUST_DNS_ENABLED = 'true';
    assert.equal(isRustDnsEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.TIWLO_RUST_DNS_ENABLED;
    else process.env.TIWLO_RUST_DNS_ENABLED = previous;
  }
});
