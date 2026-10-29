import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSocialProviderSecret,
  encryptSocialProviderSecret,
  getSocialCallbackUrl,
  getSocialStateCookieOptions
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

test('shares OAuth state cookies between the platform and authentication subdomains', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const startOptions = getSocialStateCookieOptions({
      headers: { host: PLATFORM_CONFIG.primaryDomain, 'x-forwarded-proto': 'https' }
    });
    const callbackOptions = getSocialStateCookieOptions({
      headers: { host: PLATFORM_CONFIG.authDomain, 'x-forwarded-proto': 'https' }
    });

    assert.equal(startOptions.domain, `.${PLATFORM_CONFIG.primaryDomain}`);
    assert.equal(callbackOptions.domain, startOptions.domain);
    assert.equal(callbackOptions.path, startOptions.path);
    assert.equal(callbackOptions.sameSite, 'lax');
    assert.equal(callbackOptions.secure, true);
    assert.equal(callbackOptions.httpOnly, true);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
