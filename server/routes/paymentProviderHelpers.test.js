import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  normalizePaymentProviderConfiguration,
  toPublicPaymentProvider,
  validatePaymentProviderConfiguration
} from './paymentProviderHelpers.js';

test('validates and normalizes an isolated provider profile', () => {
  const result = normalizePaymentProviderConfiguration('sslcommerz', {
    enabled: true,
    mode: 'sandbox',
    feePercent: 2,
    feeFixed: 5,
    feeMode: 'customer',
    credentials: { storeId: 'merchant-id', storePassword: 'secret-value' }
  });
  assert.equal(result.config.enabled, true);
  assert.equal(result.credentials.storeId, 'merchant-id');
  assert.equal(result.credentials.storePassword, 'secret-value');
  assert.throws(() => normalizePaymentProviderConfiguration('sslcommerz', {
    enabled: true,
    credentials: { storeId: 'merchant-id' }
  }), /required SSLCOMMERZ merchant credentials/);
  assert.throws(() => validatePaymentProviderConfiguration('stripe', {
    feePercent: 101
  }), /between 0 and 100/);
  assert.throws(() => validatePaymentProviderConfiguration('nagad', {
    credentials: { apiSecret: 'not-an-allowed-field' }
  }), /Invalid payment credential field/);
});

test('encrypts credentials per store and provider and never exposes secrets publicly', () => {
  const oldSecret = process.env.SECURITY_SECRET;
  process.env.SECURITY_SECRET = 'test-only-stable-payment-encryption-key';
  try {
    const credentials = { secretKey: 'sk_test_private_value', webhookSecret: 'whsec_private_value' };
    const encrypted = encryptPaymentCredentials('TIW-STORE-1', 'stripe', credentials);
    assert.equal(encrypted.ciphertext.includes(Buffer.from('sk_test_private_value')), false);
    const record = {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag
    };
    assert.deepEqual(decryptPaymentCredentials('TIW-STORE-1', 'stripe', record), credentials);
    assert.throws(() => decryptPaymentCredentials('TIW-STORE-2', 'stripe', record));
    const publicConfig = toPublicPaymentProvider('stripe', {
      enabled: true,
      mode: 'live',
      feePercent: 2,
      feeFixed: 1
    }, encrypted);
    assert.equal(publicConfig.enabled, true);
    assert.equal(publicConfig.checkoutReady, true);
    assert.equal(JSON.stringify(publicConfig).includes('sk_test_private_value'), false);
    const deferredNagad = toPublicPaymentProvider('nagad', { enabled: true }, null);
    assert.equal(deferredNagad.checkoutReady, false);
    assert.equal(deferredNagad.enabled, false);
  } finally {
    if (oldSecret === undefined) delete process.env.SECURITY_SECRET;
    else process.env.SECURITY_SECRET = oldSecret;
  }
});
