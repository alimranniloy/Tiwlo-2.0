import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthenticatedUserId,
  hasUnverifiedSsoIdentity,
  requireAuthenticatedUser,
  requiresAddressVerificationForRequest
} from './authGuards.js';

test('registration does not accept caller-supplied SSO identity claims', () => {
  assert.equal(hasUnverifiedSsoIdentity({ isSso: true }), true);
  assert.equal(hasUnverifiedSsoIdentity({ isSso: 'true' }), true);
  assert.equal(hasUnverifiedSsoIdentity({ isSso: false }), false);
  assert.equal(hasUnverifiedSsoIdentity({}), false);
});

test('TPanel identity comes only from the resolved authenticated session', () => {
  assert.equal(
    getAuthenticatedUserId({
      activeUser: { id: 'session-user' },
      query: { userId: 'attacker-user' },
      headers: { 'x-user-id': 'attacker-user' },
      body: { userId: 'attacker-user' }
    }),
    'session-user'
  );
  assert.equal(
    getAuthenticatedUserId({
      query: { userId: 'attacker-user' },
      headers: { 'x-user-id': 'attacker-user' },
      body: { userId: 'attacker-user' }
    }),
    null
  );
});

test('identity-required accounts are blocked except in the verification flow', () => {
  const req = {
    activeUser: {
      id: 'locked-user',
      identityVerificationRequired: true,
      identityVerified: false
    }
  };
  let status = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(value) { status = value; return this; },
    json(value) { payload = value; return this; }
  };

  requireAuthenticatedUser(req, res, () => { nextCalled = true; });
  assert.equal(status, 403);
  assert.equal(payload.code, 'IDENTITY_VERIFICATION_REQUIRED');
  assert.equal(nextCalled, false);

  status = 200;
  requireAuthenticatedUser(req, res, () => { nextCalled = true; }, { allowIdentityVerification: true });
  assert.equal(status, 200);
  assert.equal(nextCalled, true);
});

test('address-unverified accounts (credentials, social, staff/admin) are blocked from protected REST endpoints', () => {
  const newWebUser = { id: 'usr_1', role: 'owner', authMethod: 'credentials', addressVerified: false };
  const newStaffUser = { id: 'stf_1', role: 'admin', authMethod: 'credentials', addressVerified: false };
  const verifiedAdmin = { id: 'adm_1', role: 'admin', authMethod: 'credentials', addressVerified: true };

  assert.equal(requiresAddressVerificationForRequest({ path: '/api/stores', method: 'GET', activeUser: newWebUser }), true);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/admin/overview', method: 'GET', activeUser: newStaffUser }), true);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/admin/security-pin/setup', method: 'POST', activeUser: newStaffUser }), true);

  assert.equal(requiresAddressVerificationForRequest({ path: '/api/address-verification', method: 'POST', activeUser: newWebUser }), false);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/auth/sync-session', method: 'GET', activeUser: newStaffUser }), false);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/verification/handoff', method: 'POST', activeUser: newWebUser }), false);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/graphql', method: 'POST', activeUser: newWebUser }), false);
  assert.equal(requiresAddressVerificationForRequest({ path: '/api/admin/overview', method: 'GET', activeUser: verifiedAdmin }), false);
});
