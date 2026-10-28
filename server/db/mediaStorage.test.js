import test from 'node:test';
import assert from 'node:assert/strict';
import { isMediaRequestAuthorized, resolveMediaStorageBackend } from './mediaStorage.js';

test('identity verification evidence always uses private server storage', () => {
  assert.equal(resolveMediaStorageBackend({ backend: 'google_drive' }, 'identity_verification'), 'local');
  assert.equal(resolveMediaStorageBackend({ backend: 'postgres' }, 'identity_verification'), 'local');
});

test('other media continues to use the configured storage backend', () => {
  assert.equal(resolveMediaStorageBackend({ backend: 'google_drive' }, 'profile_media'), 'google_drive');
  assert.equal(resolveMediaStorageBackend({ backend: 'local' }, 'profile_media'), 'local');
  assert.equal(resolveMediaStorageBackend(null, 'profile_media'), 'postgres');
});

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
