import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerificationRouteAllowed } from './access.js';

test('verification routes require an Identity-started history entry', () => {
  assert.equal(isVerificationRouteAllowed('/verification', '', null), false);
  assert.equal(isVerificationRouteAllowed('/verification/capture-selfie', '', null), false);
  assert.equal(
    isVerificationRouteAllowed('/verification/processing', '', { step: 4 }),
    false
  );
});

test('Identity-started flow can navigate its step routes', () => {
  const state = { identityVerificationStarted: true };
  assert.equal(isVerificationRouteAllowed('/verification', '', state), true);
  assert.equal(isVerificationRouteAllowed('/verification/upload-document', '', state), true);
  assert.equal(isVerificationRouteAllowed('/verification/success', '', state), true);
});

test('continue route requires a well-formed one-time QR token in the URL fragment', () => {
  const token = 'A'.repeat(43);
  assert.equal(isVerificationRouteAllowed('/verification/continue', `#token=${token}`, null), true);
  assert.equal(isVerificationRouteAllowed('/verification/continue', '', {
    identityVerificationStarted: true
  }), false);
  assert.equal(isVerificationRouteAllowed('/verification/continue', '#token=short', null), false);
  assert.equal(isVerificationRouteAllowed('/verification/continue', '', null), false);
});
