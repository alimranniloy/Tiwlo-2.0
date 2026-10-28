import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { getPgPool } from '../db/postgres.js';
import { MasterDB } from '../db/multiTenant.js';
import { identityVerificationEmailNotifications } from '../db/emailService.js';
import adminRoutes from './adminRoutes.js';

test('admin identity lock requires confirmation request and affects only the selected account', async t => {
  const users = new Map([
    ['customer-one', {
      id: 'customer-one',
      email: 'one@example.com',
      name: 'Customer One',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: false
    }],
    ['customer-two', {
      id: 'customer-two',
      email: 'two@example.com',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: false
    }]
  ]);
  const lockedIds = [];
  const revokedIds = [];
  const notifiedEmails = [];

  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    lockedIds.push(id);
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  });
  t.mock.method(MasterDB, 'revokeUserSessions', async id => {
    revokedIds.push(id);
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(identityVerificationEmailNotifications, 'required', async ({ to }) => {
    notifiedEmails.push(to);
    return { success: true };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification/require`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-session', 'Content-Type': 'application/json' }
    }
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.deepEqual(lockedIds, ['customer-one']);
  assert.deepEqual(revokedIds, ['customer-one']);
  assert.deepEqual(notifiedEmails, ['one@example.com']);
  assert.equal(users.get('customer-one').identityVerificationRequired, true);
  assert.equal(users.get('customer-two').identityVerificationRequired, false);
});

test('admin can unverify one account and requires it to verify again', async t => {
  const users = new Map([
    ['customer-one', {
      id: 'customer-one',
      email: 'one@example.com',
      name: 'Customer One',
      role: 'owner',
      identityVerified: true,
      identityVerificationRequired: false
    }],
    ['customer-two', {
      id: 'customer-two',
      email: 'two@example.com',
      role: 'owner',
      identityVerified: true,
      identityVerificationRequired: false
    }]
  ]);
  const updatedIds = [];
  const revokedIds = [];
  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    updatedIds.push(id);
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  });
  t.mock.method(MasterDB, 'revokeUserSessions', async id => {
    revokedIds.push(id);
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(identityVerificationEmailNotifications, 'required', async () => ({ success: true }));

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification/unverify`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-session', 'Content-Type': 'application/json' }
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(updatedIds, ['customer-one']);
  assert.deepEqual(revokedIds, ['customer-one']);
  assert.equal(users.get('customer-one').identityVerified, false);
  assert.equal(users.get('customer-one').identityVerificationRequired, true);
  assert.equal(users.get('customer-two').identityVerified, true);
  assert.equal(users.get('customer-two').identityVerificationRequired, false);
});

test('verification evidence is listed only through the authenticated admin page', async t => {
  const user = {
    id: 'customer-one',
    tiwiId: 'TW-1001',
    email: 'one@example.com',
    role: 'owner',
    identityVerified: true,
    identityVerificationRequired: false
  };
  const queries = [];
  t.mock.method(MasterDB, 'getSession', async token => (
    token === 'admin-session'
      ? { user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' } }
      : null
  ));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => id === user.id ? user : null);
  t.mock.method(getPgPool(), 'query', async (sql, params) => {
    queries.push({ sql, params });
    return {
      rows: [{
        id: 'evidence-1',
        storage_path: '/uploads/verification/TW-1001/attempt.document.png',
        original_filename: 'passport-document.png',
        content_type: 'image/png',
        size_bytes: 4096,
        created_at: '2026-10-28T10:00:00.000Z'
      }]
    };
  });

  const app = express();
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification`;

  const anonymousResponse = await fetch(url);
  assert.equal(anonymousResponse.status, 401);

  const response = await fetch(url, {
    headers: { Authorization: 'Bearer admin-session' }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.user.tiwiId, 'TW-1001');
  assert.deepEqual(result.files.map(file => file.category), ['document']);
  assert.deepEqual(queries[0].params, [
    'customer-one',
    'identity_verification',
    '/uploads/verification/TW-1001/'
  ]);
});
