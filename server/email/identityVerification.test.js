import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderIdentityVerificationCompleteEmail,
  renderIdentityVerificationRequiredEmail
} from './index.js';

test('identity-required email explains the lock and links to the verification flow', () => {
  const html = renderIdentityVerificationRequiredEmail({
    to: 'customer@example.com',
    identityUrl: 'https://tiwlo.com/identity-required'
  });

  assert.match(html, /temporarily locked/i);
  assert.match(html, /Start identity verification/);
  assert.match(html, /https:\/\/tiwlo\.com\/identity-required/);
});

test('identity-complete email confirms the account was unlocked without overstating document checks', () => {
  const html = renderIdentityVerificationCompleteEmail({
    to: 'customer@example.com',
    accountUrl: 'https://tiwlo.com/dashboard'
  });

  assert.match(html, /account is unlocked/i);
  assert.match(html, /Account status: Active/);
  assert.match(html, /does not confirm that an identity document is genuine/i);
});
