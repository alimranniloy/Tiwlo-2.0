import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import './postgres.js';
import {
  computeDocumentFingerprint,
  computeIdentityHash,
  decryptDocumentNumber,
  encryptDocumentNumber
} from './identityReviewStore.js';

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('identityReviewStore fails closed in production when PII key secrets are missing or too short', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      IDENTITY_PII_KEY: undefined,
      SECURITY_SECRET: undefined,
      SESSION_SECRET: undefined
    },
    () => {
      assert.throws(() => encryptDocumentNumber('PASS-123456'), /FATAL SECURITY ERROR/);
      assert.throws(() => computeDocumentFingerprint('PASS-123456'), /FATAL SECURITY ERROR/);
      assert.throws(
        () => computeIdentityHash({ fullName: 'Ada Lovelace', dateOfBirth: '1990-01-01', documentNumber: 'PASS-123456' }),
        /FATAL SECURITY ERROR/
      );
    }
  );

  withEnv(
    {
      NODE_ENV: 'production',
      IDENTITY_PII_KEY: 'too-short',
      SECURITY_SECRET: undefined,
      SESSION_SECRET: undefined
    },
    () => {
      assert.throws(() => encryptDocumentNumber('PASS-123456'), /at least 32 characters/);
    }
  );
});

test('identityReviewStore works in production when a strong key is configured', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      IDENTITY_PII_KEY: 'k'.repeat(32),
      SECURITY_SECRET: undefined,
      SESSION_SECRET: undefined
    },
    () => {
      const encrypted = encryptDocumentNumber('PASS-987654');
      assert.ok(encrypted && encrypted.ciphertext);
      assert.equal(decryptDocumentNumber(encrypted), 'PASS-987654');
      assert.match(computeDocumentFingerprint('PASS-987654'), /^[a-f0-9]{64}$/);
    }
  );
});

test('identityReviewStore uses a per-process ephemeral key in dev/test instead of a hardcoded literal', () => {
  withEnv(
    {
      NODE_ENV: 'test',
      IDENTITY_PII_KEY: undefined,
      SECURITY_SECRET: undefined,
      SESSION_SECRET: undefined
    },
    () => {
      const encrypted = encryptDocumentNumber('NID-554433');
      assert.equal(decryptDocumentNumber(encrypted), 'NID-554433');

      const fp1 = computeDocumentFingerprint('NID-554433');
      const fp2 = computeDocumentFingerprint('NID-554433');
      assert.equal(fp1, fp2);

      const legacyHardcodedKey = crypto.createHash('sha256').update('tiwlo-identity-dev-key').digest();
      const legacyFp = crypto.createHmac('sha256', legacyHardcodedKey).update('doc:NID554433').digest('hex');
      assert.notEqual(fp1, legacyFp);
    }
  );
});
