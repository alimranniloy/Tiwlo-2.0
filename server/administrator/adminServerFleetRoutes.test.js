import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createAdminServerFleetRouter } from './adminServerFleetRoutes.js';
import {
  PRIMARY_NODE_ID,
  resetInMemoryServerFleetForTests
} from './serverFleetService.js';

async function createFleetTestClient(t, { allowAdmin = true, allowReauth = true } = {}) {
  let adminAuthorized = allowAdmin;
  let reauthAuthorized = allowReauth;

  const requireAdmin = (_req, res, next) => {
    if (!adminAuthorized) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }
    _req.adminUser = { id: 'admin_fleet_1', email: 'admin@tiwlo.net', role: 'admin' };
    return next();
  };

  const requireRecentReauth = (_req, res, next) => {
    if (!reauthAuthorized) {
      return res.status(428).json({ error: 'RECENT_VERIFICATION_REQUIRED' });
    }
    return next();
  };

  const app = express();
  app.use(express.json());
  app.use('/api/admin/fleet', createAdminServerFleetRouter({ requireAdmin, requireRecentReauth }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/fleet`;
  return {
    setAdminAuthorized: (val) => { adminAuthorized = val; },
    setReauthAuthorized: (val) => { reauthAuthorized = val; },
    call: (path, options = {}) => fetch(`${baseUrl}${path}`, options)
  };
}

test.beforeEach(() => {
  resetInMemoryServerFleetForTests();
});

test.afterEach(() => {
  resetInMemoryServerFleetForTests();
});

test('POST /api/admin/fleet/nodes succeeds when panelType is omitted and defaults to ubuntu_node', async (t) => {
  const client = await createFleetTestClient(t);

  const res = await client.call('/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Default Ubuntu Compute Node',
      hostname: 'ubuntu-default-01.tiwlo.net',
      ipAddress: '10.40.1.15',
      region: 'dhk1'
    })
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.node.panelType, 'ubuntu_node');
  assert.equal(body.node.serverRole, 'app_hosting');
  assert.equal(body.node.apiPort, 9443);
  assert.equal(body.node.connectivityMode, 'http_health');
  assert.equal(body.node.region, 'dhk1');
});

test('DELETE /api/admin/fleet/nodes/primary-ubuntu-node returns HTTP 403 while other nodes delete cleanly', async (t) => {
  const client = await createFleetTestClient(t);

  const primaryDelRes = await client.call(`/nodes/${PRIMARY_NODE_ID}`, {
    method: 'DELETE'
  });
  assert.equal(primaryDelRes.status, 403);
  const primaryDelJson = await primaryDelRes.json();
  assert.match(primaryDelJson.error, /primary/i);

  const createRes = await client.call('/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Disposable Node',
      hostname: 'disposable-01.tiwlo.net',
      ipAddress: '10.40.1.25'
    })
  });
  assert.equal(createRes.status, 201);
  const { node } = await createRes.json();

  const delRes = await client.call(`/nodes/${node.id}`, { method: 'DELETE' });
  assert.equal(delRes.status, 200);
  const delJson = await delRes.json();
  assert.equal(delJson.success, true);
  assert.equal(delJson.deleted, true);

  const missingRes = await client.call(`/nodes/${node.id}`, { method: 'DELETE' });
  assert.equal(missingRes.status, 404);
});

test('PATCH /api/admin/fleet/automation with { backupEnabled: true } persists and reflects in GET /api/admin/fleet/live-status', async (t) => {
  const client = await createFleetTestClient(t);

  const initialLiveRes = await client.call('/live-status');
  assert.equal(initialLiveRes.status, 200);
  const initialLive = await initialLiveRes.json();
  assert.equal(initialLive.automation.backupEnabled, false);

  const patchRes = await client.call('/automation', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupEnabled: true })
  });
  assert.equal(patchRes.status, 200);
  const patchJson = await patchRes.json();
  assert.equal(patchJson.success, true);
  assert.equal(patchJson.automation.backupEnabled, true);

  const autoRes = await client.call('/automation');
  assert.equal(autoRes.status, 200);
  const autoJson = await autoRes.json();
  assert.equal(autoJson.success, true);
  assert.equal(autoJson.automation.backupEnabled, true);

  const liveRes = await client.call('/live-status');
  assert.equal(liveRes.status, 200);
  const liveJson = await liveRes.json();
  assert.equal(liveJson.success, true);
  assert.equal(liveJson.automation.backupEnabled, true);
});
