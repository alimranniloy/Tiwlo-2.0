import test from 'node:test';
import assert from 'node:assert/strict';
import { isMediaRequestAuthorized } from './mediaStorage.js';

test('identity verification evidence is never exposed through public media aliases', () => {
  const metadata = {
    review_status: 'approved',
    purpose: 'identity_verification',
    owner_id: 'customer-one'
  };
  assert.equal(isMediaRequestAuthorized({}, metadata), false);
  assert.equal(isMediaRequestAuthorized({ activeUser: { id: 'customer-one', role: 'owner' } }, metadata), false);
  assert.equal(isMediaRequestAuthorized({ activeUser: { id: 'admin-one', role: 'admin' } }, metadata), false);
});
