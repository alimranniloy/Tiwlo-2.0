import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthenticatedUserId, hasUnverifiedSsoIdentity } from './authGuards.js';

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
