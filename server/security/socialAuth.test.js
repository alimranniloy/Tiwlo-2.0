import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSocialProviderSecret,
  encryptSocialProviderSecret,
  getSocialCallbackUrl
} from './socialAuth.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

test('encrypts social OAuth client secrets with authenticated encryption', () => {
  const previousSecret = process.env.SECURITY_SECRET;
  process.env.SECURITY_SECRET = 'test-only-stable-social-oauth-encryption-key';
  try {
    const plaintext = 'social-provider-secret-value';
    const encrypted = encryptSocialProviderSecret(plaintext);
    assert.equal(encrypted.ciphertext.includes(Buffer.from(plaintext)), false);
    assert.equal(decryptSocialProviderSecret({
      secret_ciphertext: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_auth_tag: encrypted.authTag
    }), plaintext);
    assert.throws(() => decryptSocialProviderSecret({
      secret_ciphertext: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_auth_tag: Buffer.alloc(16)
    }));
  } finally {
    if (previousSecret === undefined) delete process.env.SECURITY_SECRET;
    else process.env.SECURITY_SECRET = previousSecret;
  }
});

test('uses API callback paths on the configured authentication hostname', () => {
  assert.equal(
    getSocialCallbackUrl('google'),
    `https://${PLATFORM_CONFIG.authDomain}/api/auth/google/callback`
  );
  assert.equal(
    getSocialCallbackUrl('github'),
    `https://${PLATFORM_CONFIG.authDomain}/api/auth/github/callback`
  );
  assert.throws(() => getSocialCallbackUrl('facebook'), /Unsupported social login provider/);
});
