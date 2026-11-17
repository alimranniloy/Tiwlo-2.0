import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptBotToken, maskBotToken } from './discordDb.js';

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

test('discordDb fails closed in production when DISCORD_TOKEN_SECRET and SECURITY_SECRET are unset or too short', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      DISCORD_TOKEN_SECRET: undefined,
      SECURITY_SECRET: undefined
    },
    () => {
      assert.throws(
        () => encryptBotToken('MTIzNDU2Nzg5MDEyMzQ1Njc4.G9xAbC.superSecretToken9988'),
        /FATAL SECURITY ERROR/
      );
    }
  );

  withEnv(
    {
      NODE_ENV: 'production',
      DISCORD_TOKEN_SECRET: 'short-secret',
      SECURITY_SECRET: undefined
    },
    () => {
      assert.throws(
        () => encryptBotToken('MTIzNDU2Nzg5MDEyMzQ1Njc4.G9xAbC.superSecretToken9988'),
        /at least 32 characters/
      );
    }
  );
});

test('discordDb encrypts tokens in production when DISCORD_TOKEN_SECRET or SECURITY_SECRET is configured', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      DISCORD_TOKEN_SECRET: 'd'.repeat(32),
      SECURITY_SECRET: undefined
    },
    () => {
      const encrypted = encryptBotToken('MTIzNDU2Nzg5MDEyMzQ1Njc4.G9xAbC.superSecretToken9988');
      assert.equal(encrypted.hasToken, true);
      assert.equal(encrypted.last4, '9988');
      assert.ok(encrypted.ciphertext && !encrypted.ciphertext.includes('superSecretToken'));
      assert.equal(maskBotToken(encrypted.last4, encrypted.hasToken), '•••• •••• •••• 9988');
    }
  );
});
