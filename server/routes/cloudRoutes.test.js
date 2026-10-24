import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { CloudDB } from '../db/cloud.js';
import cloudRoutes from './cloudRoutes.js';

async function createClient(t) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-user-id']) req.activeUser = { id: req.headers['x-user-id'] };
    next();
  });
  app.use('/api/cloud', cloudRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return async (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('droplet status and delete routes require authentication and owner identity', async t => {
  const call = await createClient(t);
  t.mock.method(CloudDB, 'getDropletById', async () => ({ userId: 'owner' }));
  const update = t.mock.method(CloudDB, 'updateDropletStatus', async () => ({ id: 'droplet-1' }));
  const remove = t.mock.method(CloudDB, 'deleteDroplet', async () => true);

  assert.equal((await call('/api/cloud/droplets/droplet-1/status', { method: 'PATCH' })).status, 401);
  assert.equal((await call('/api/cloud/droplets/droplet-1', { method: 'DELETE' })).status, 401);

  const foreignHeaders = { 'x-user-id': 'other' };
  assert.equal((await call('/api/cloud/droplets/droplet-1/status', { method: 'PATCH', headers: foreignHeaders })).status, 404);
  assert.equal((await call('/api/cloud/droplets/droplet-1', { method: 'DELETE', headers: foreignHeaders })).status, 404);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);

  const headers = { 'x-user-id': 'owner', 'content-type': 'application/json' };
  assert.equal((await call('/api/cloud/droplets/droplet-1/status', {
    method: 'PATCH', headers, body: JSON.stringify({ status: 'active' })
  })).status, 200);
  assert.equal((await call('/api/cloud/droplets/droplet-1', { method: 'DELETE', headers })).status, 200);
  assert.deepEqual(update.mock.calls[0].arguments, ['owner', 'droplet-1', 'active']);
  assert.deepEqual(remove.mock.calls[0].arguments, ['owner', 'droplet-1']);
});

test('droplet rename is owner-scoped and validates the display name', async t => {
  const call = await createClient(t);
  const rename = t.mock.method(CloudDB, 'renameDroplet', async (userId, id, name) => ({
    id,
    userId,
    name
  }));

  assert.equal((await call('/api/cloud/droplets/droplet-1/name', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed VM' })
  })).status, 401);

  const headers = { 'x-user-id': 'owner', 'content-type': 'application/json' };
  assert.equal((await call('/api/cloud/droplets/droplet-1/name', {
    method: 'PATCH', headers, body: JSON.stringify({ name: 'Renamed VM' })
  })).status, 200);
  assert.deepEqual(rename.mock.calls[0].arguments, ['owner', 'droplet-1', 'Renamed VM']);
  assert.equal((await call('/api/cloud/droplets/droplet-1/name', {
    method: 'PATCH', headers, body: JSON.stringify({ name: '   ' })
  })).status, 400);
  assert.equal(rename.mock.callCount(), 1);
});
