import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';
import cloudRoutes from './cloudRoutes.js';
import { createGraphQLMiddleware } from '../graphql/index.js';
import { requiresAddressVerificationForRequest } from '../security/authGuards.js';

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

test('cloud credit top-ups and vouchers never succeed without verified billing integration', async t => {
  const call = await createClient(t);
  const addCredits = t.mock.method(BillingDB, 'addCredits');
  const redeemVoucher = t.mock.method(BillingDB, 'redeemVoucher', async () => ({
    success: false,
    error: 'Voucher code is invalid or has already been redeemed.'
  }));
  const headers = { 'x-user-id': 'owner', 'content-type': 'application/json' };

  assert.equal((await call('/api/cloud/billing/credits/add', {
    method: 'POST',
    headers,
    body: JSON.stringify({ bundleAmount: 50, paymentMethod: 'Visa ending in 4242' })
  })).status, 503);
  assert.equal((await call('/api/cloud/billing/vouchers/redeem', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'WELCOME2026' })
  })).status, 400);
  assert.equal((await call('/api/cloud/billing/budgets', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Monthly cap', targetAmount: 50 })
  })).status, 503);
  assert.equal((await call('/api/cloud/billing/credits/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundleAmount: 50 })
  })).status, 401);
  assert.equal(addCredits.mock.callCount(), 0);
  assert.equal(redeemVoucher.mock.callCount(), 1);
});

test('credit checkout cancellation requires authentication and is scoped to the current account', async t => {
  const call = await createClient(t);
  const cancel = t.mock.method(BillingDB, 'cancelCreditTopup', async (userId, id) => {
    if (userId !== 'owner' || id !== 'topup-1') return null;
    return { id, status: 'cancelled', cancel_reason: 'user', expires_at: '2026-03-16T12:00:00.000Z', cancelledNow: true };
  });
  const notify = t.mock.method(BillingDB, 'sendCreditTopupCancellationEmail', async () => true);

  assert.equal((await call('/api/cloud/billing/credits/topup-1/cancel', { method: 'POST' })).status, 401);
  assert.equal((await call('/api/cloud/billing/credits/topup-1/cancel', {
    method: 'POST',
    headers: { 'x-user-id': 'other' }
  })).status, 404);
  const response = await call('/api/cloud/billing/credits/topup-1/cancel', {
    method: 'POST',
    headers: { 'x-user-id': 'owner' }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'cancelled');
  assert.equal(result.notificationSent, true);
  assert.deepEqual(notify.mock.calls[0].arguments, ['owner', 'topup-1']);
  assert.deepEqual(cancel.mock.calls.map(({ arguments: args }) => args), [
    ['other', 'topup-1'],
    ['owner', 'topup-1']
  ]);
});

test('provider cancellation and failure returns persist the corresponding terminal state', async t => {
  const call = await createClient(t);
  const lookup = t.mock.method(BillingDB, 'getCreditTopupForReturn', async id => ({
    id,
    status: 'pending',
    return_origin: 'https://uids.app'
  }));
  const setTerminal = t.mock.method(BillingDB, 'setCreditTopupTerminalStatus', async (id, status) => ({
    id,
    status,
    cancel_reason: status === 'cancelled' ? 'provider' : null
  }));

  const cancelled = await call('/api/cloud/billing/credits/return/stripe?orderId=topup-1&returnToken=secret&result=cancelled', { redirect: 'manual' });
  const failed = await call('/api/cloud/billing/credits/return/stripe?orderId=topup-2&returnToken=secret&result=failed', { redirect: 'manual' });
  assert.equal(cancelled.status, 303);
  assert.match(cancelled.headers.get('location'), /cloud_credit_payment=cancelled/);
  assert.equal(failed.status, 303);
  assert.match(failed.headers.get('location'), /cloud_credit_payment=failed/);
  assert.deepEqual(setTerminal.mock.calls.map(({ arguments: args }) => args), [
    ['topup-1', 'cancelled'],
    ['topup-2', 'failed']
  ]);
  assert.equal(lookup.mock.callCount(), 2);
});

test('late verified payment is still settled after a checkout was cancelled', async t => {
  const call = await createClient(t);
  const lookup = t.mock.method(BillingDB, 'getCreditTopupForReturn', async id => ({
    id,
    status: 'cancelled',
    return_origin: 'https://uids.app'
  }));
  const verify = t.mock.method(BillingDB, 'verifyAndCompleteCreditTopup', async () => ({
    success: true,
    status: 'paid'
  }));

  const response = await call('/api/cloud/billing/credits/return/stripe?orderId=topup-1&returnToken=secret', { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.match(response.headers.get('location'), /cloud_credit_payment=success/);
  assert.equal(lookup.mock.callCount(), 1);
  assert.equal(verify.mock.calls[0].arguments[0].status, 'cancelled');
});

test('droplets catalog exposes connected Ubuntu image and active region while marking unlinked ones unavailable', async t => {
  const call = await createClient(t);
  const res = await call('/api/cloud/droplets/catalog');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  const availableImages = data.images.filter((i) => i.available);
  const unavailableImages = data.images.filter((i) => !i.available);
  assert.equal(availableImages.length, 1);
  assert.equal(availableImages[0].id, 'ubuntu-24');
  assert.equal(availableImages[0].iconUrl, '/os-icons/ubuntu.svg');
  assert.equal(availableImages[0].runtimeImage, undefined);
  assert.ok(unavailableImages.some((i) => i.name === 'Debian 12' && i.iconUrl === '/os-icons/debian.svg'));

  const availableRegions = data.regions.filter((r) => r.available);
  const unavailableRegions = data.regions.filter((r) => !r.available);
  assert.equal(availableRegions.length, 1);
  assert.equal(availableRegions[0].id, 'dhk1');
  assert.equal(availableRegions[0].flagUrl, '/flags/bd.svg');
  assert.ok(unavailableRegions.some((r) => r.id === 'fra1' && r.flagUrl === '/flags/de.svg'));
});

test('GET /api/cloud/droplets/check-availability validates hostname and allows isolated usernames including root', async t => {
  const call = await createClient(t);

  const validRes = await call('/api/cloud/droplets/check-availability?hostname=web-node-01&username=root');
  assert.equal(validRes.status, 200);
  const validJson = await validRes.json();
  assert.equal(validJson.success, true);
  assert.deepEqual(validJson.hostname, {
    value: 'web-node-01',
    valid: true,
    available: true,
    reason: 'Available'
  });
  assert.deepEqual(validJson.username, {
    value: 'root',
    valid: true,
    available: true,
    reason: 'Isolated per droplet'
  });

  const invalidRes = await call('/api/cloud/droplets/check-availability?hostname=x&username=1bad');
  assert.equal(invalidRes.status, 200);
  const invalidJson = await invalidRes.json();
  assert.equal(invalidJson.hostname.valid, false);
  assert.equal(invalidJson.hostname.available, false);
  assert.equal(invalidJson.username.valid, false);
  assert.equal(invalidJson.username.available, false);

  const checkSpy = t.mock.method(CloudDB, 'checkDropletAvailability', async ({ userId, hostname, username }) => ({
    hostname: {
      value: hostname,
      valid: true,
      available: false,
      reason: 'Already used in your account'
    },
    username: {
      value: username,
      valid: true,
      available: true,
      reason: 'Isolated per droplet'
    },
    checkedUserId: userId
  }));
  const takenRes = await call('/api/cloud/droplets/check-availability?hostname=taken-node&username=root', {
    headers: { 'x-user-id': 'usr_cloud_1' }
  });
  assert.equal(takenRes.status, 200);
  const takenJson = await takenRes.json();
  assert.equal(checkSpy.mock.callCount(), 1);
  assert.deepEqual(checkSpy.mock.calls[0].arguments[0], {
    userId: 'usr_cloud_1',
    hostname: 'taken-node',
    username: 'root'
  });
  assert.equal(takenJson.hostname.available, false);
  assert.equal(takenJson.hostname.reason, 'Already used in your account');
});

test('POST /api/cloud/droplets rejects unavailable image/region or weak credentials and provisions valid requests', async t => {
  const call = await createClient(t);
  const headers = { 'x-user-id': 'usr_cloud_1', 'content-type': 'application/json' };

  const badImg = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'debian-12',
      regionId: 'dhk1',
      hostname: 'my-node-01',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(badImg.status, 400);

  const badRegion = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'fra1',
      hostname: 'my-node-01',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(badRegion.status, 400);

  const badHost = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'x',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(badHost.status, 400);

  const badUser = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'my-node-01',
      username: '1invalid',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(badUser.status, 400);

  const badPass = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'my-node-01',
      username: 'root',
      password: '123'
    })
  });
  assert.equal(badPass.status, 400);

  const createSpy = t.mock.method(CloudDB, 'createDroplet', async (userId, body) => ({
    droplet: {
      id: 'drp_1',
      userId,
      name: body.hostname,
      image: 'Ubuntu 24.04 LTS',
      accessUsername: body.username || 'root',
      sshPort: 22001,
      sshCommand: `ssh ${body.username || 'root'}@127.0.0.1 -p 22001`
    },
    tenant: { tenantId: 'ubt_1', nodeId: 'primary-ubuntu-node' }
  }));
  const ok = await call('/api/cloud/droplets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'my-node-01',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(ok.status, 201);
  assert.equal(createSpy.mock.callCount(), 1);
  const json = await ok.json();
  assert.equal(json.droplet.accessUsername, 'root');
  assert.equal(json.droplet.sshCommand, 'ssh root@127.0.0.1 -p 22001');
});

test('GET /api/cloud/droplets/catalog returns clusterPool, images, and regions', async t => {
  const call = await createClient(t);

  const defaultRes = await call('/api/cloud/droplets/catalog');
  assert.equal(defaultRes.status, 200);
  const defaultData = await defaultRes.json();
  assert.equal(defaultData.success, true);
  assert.ok('clusterPool' in defaultData);
  assert.ok(Array.isArray(defaultData.images) && defaultData.images.length > 0);
  assert.ok(Array.isArray(defaultData.regions) && defaultData.regions.length > 0);

  const mockPool = {
    totalNodes: 3,
    onlineNodes: 2,
    totalCpuCores: 24,
    totalRamGb: 96,
    totalStorageGb: 1500,
    totalStorageFreeGb: 920.5
  };
  const catalogSpy = t.mock.method(CloudDB, 'getDropletCatalog', async () => ({
    images: defaultData.images,
    regions: defaultData.regions,
    clusterPool: mockPool,
    connectedServer: defaultData.connectedServer
  }));

  const pooledRes = await call('/api/cloud/droplets/catalog');
  assert.equal(pooledRes.status, 200);
  const pooledData = await pooledRes.json();
  assert.equal(catalogSpy.mock.callCount(), 1);
  assert.equal(pooledData.success, true);
  assert.deepEqual(pooledData.clusterPool, mockPool);
  assert.equal(pooledData.images.length, defaultData.images.length);
  assert.equal(pooledData.regions.length, defaultData.regions.length);
});

test('POST /api/cloud/droplets and DELETE /api/cloud/droplets/:id enforce auth, conflict handling, and ownership', async t => {
  const call = await createClient(t);
  const jsonHeaders = { 'content-type': 'application/json' };
  const ownerHeaders = { 'x-user-id': 'usr_owner', ...jsonHeaders };

  const unauthCreate = await call('/api/cloud/droplets', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'app-node-01',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(unauthCreate.status, 401);

  const stored = new Map();
  t.mock.method(CloudDB, 'createDroplet', async (userId, body) => {
    if (body.hostname === 'duplicate-node') {
      const err = new Error('Hostname is already used in your account.');
      err.statusCode = 409;
      throw err;
    }
    const droplet = {
      id: 'drp_created_1',
      userId,
      name: body.hostname,
      image: 'Ubuntu 24.04 LTS',
      accessUsername: body.username || 'root',
      sshPort: 22005,
      sshCommand: `ssh ${body.username || 'root'}@127.0.0.1 -p 22005`
    };
    stored.set(droplet.id, droplet);
    return { droplet, tenant: { tenantId: 'ubt_created_1', nodeId: 'primary-ubuntu-node' } };
  });
  t.mock.method(CloudDB, 'getDropletById', async (id) => stored.get(id) || null);
  const deleteSpy = t.mock.method(CloudDB, 'deleteDroplet', async (userId, id) => {
    const existing = stored.get(id);
    if (!existing || existing.userId !== userId) return false;
    stored.delete(id);
    return true;
  });

  const conflictRes = await call('/api/cloud/droplets', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'duplicate-node',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(conflictRes.status, 409);

  const createRes = await call('/api/cloud/droplets', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({
      imageId: 'ubuntu-24',
      regionId: 'dhk1',
      hostname: 'app-node-01',
      username: 'root',
      password: 'StrongPassword1!'
    })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  assert.equal(created.droplet.id, 'drp_created_1');

  assert.equal((await call('/api/cloud/droplets/drp_created_1', { method: 'DELETE' })).status, 401);
  assert.equal((await call('/api/cloud/droplets/drp_missing', {
    method: 'DELETE',
    headers: { 'x-user-id': 'usr_owner' }
  })).status, 404);
  assert.equal((await call('/api/cloud/droplets/drp_created_1', {
    method: 'DELETE',
    headers: { 'x-user-id': 'usr_foreign' }
  })).status, 404);
  assert.equal(deleteSpy.mock.callCount(), 0);

  const delOk = await call('/api/cloud/droplets/drp_created_1', {
    method: 'DELETE',
    headers: { 'x-user-id': 'usr_owner' }
  });
  assert.equal(delOk.status, 200);
  const delJson = await delOk.json();
  assert.equal(delJson.success, true);
  assert.equal(deleteSpy.mock.callCount(), 1);
  assert.deepEqual(deleteSpy.mock.calls[0].arguments, ['usr_owner', 'drp_created_1']);
});

test('PATCH /api/cloud/droplets/:id/status rejects missing or invalid status and enforces ownership', async t => {
  const call = await createClient(t);
  t.mock.method(CloudDB, 'getDropletById', async (id) => (
    id === 'drp_1' ? { id: 'drp_1', userId: 'usr_owner' } : null
  ));

  const foreignRes = await call('/api/cloud/droplets/drp_1/status', {
    method: 'PATCH',
    headers: { 'x-user-id': 'usr_other', 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'stopped' })
  });
  assert.equal(foreignRes.status, 404);

  const missingStatusRes = await call('/api/cloud/droplets/drp_1/status', {
    method: 'PATCH',
    headers: { 'x-user-id': 'usr_owner', 'content-type': 'application/json' },
    body: JSON.stringify({ status: '' })
  });
  assert.equal(missingStatusRes.status, 400);

  const invalidStatusRes = await call('/api/cloud/droplets/drp_1/status', {
    method: 'PATCH',
    headers: { 'x-user-id': 'usr_owner', 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'restarting' })
  });
  assert.equal(invalidStatusRes.status, 400);

  await assert.rejects(
    () => CloudDB.updateDropletStatus('usr_owner', 'drp_1', 'restarting'),
    (err) => err.statusCode === 400
  );

  // Suspended droplet cannot self-reactivate via status PATCH (402 Payment Required)
  t.mock.method(CloudDB, 'updateDropletStatus', async () => {
    const err = new Error('Droplet is suspended due to unpaid billing.');
    err.statusCode = 402;
    throw err;
  });
  const selfUnsuspendRes = await call('/api/cloud/droplets/drp_1/status', {
    method: 'PATCH',
    headers: { 'x-user-id': 'usr_owner', 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  });
  assert.equal(selfUnsuspendRes.status, 402);
});

test('cloudDashboard GraphQL populates Droplet.created and CloudActivity.time without null bubbling', async t => {
  const createdAt = new Date('2026-11-24T09:40:19.397Z');
  const { MasterDB } = await import('../db/multiTenant.js');
  const pgMod = await import('../db/postgres.js');
  const pool = pgMod.getPgPool();

  // Exercise CloudDB.getDroplets / getCloudActivities mapping directly with Date rows
  t.mock.method(MasterDB, 'getUserStores', async () => []);
  t.mock.method(pool, 'query', async (sql) => {
    const q = String(sql || '');
    if (q.includes('FROM cloud_droplets')) {
      return {
        rows: [{
          id: 'drp_test_1',
          user_id: 'usr_owner',
          name: 'node-01',
          specs: '1 vCPU · 1 GB · 25 GB NVMe',
          vcpus: 1,
          memory: '1 GB',
          storage: '25 GB NVMe',
          ip: '2401:f40::1',
          region: 'Dhaka (DHK1)',
          region_code: 'DHK1',
          status: 'active',
          image: 'Ubuntu 24.04 LTS',
          created_at: createdAt
        }],
        rowCount: 1
      };
    }
    if (q.includes('FROM cloud_activities')) {
      return {
        rows: [{
          id: 'act_test_1',
          user_id: 'usr_owner',
          action: 'Provisioned Ubuntu 24.04 LTS (DHK1)',
          target: 'node-01',
          type: 'droplet',
          created_at: createdAt
        }],
        rowCount: 1
      };
    }
    return { rows: [], rowCount: 0 };
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.activeUser = { id: 'usr_owner', email: 'owner@example.com' };
    next();
  });
  app.use('/graphql', createGraphQLMiddleware());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const res = await fetch(`http://127.0.0.1:${server.address().port}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query GetCloudDashboard {
        cloudDashboard {
          metrics { totalDroplets totalVcpus totalStorage totalBandwidth }
          droplets { id name created createdAt status }
          activities { id action target type time createdAt }
          popularImages { id name os available }
        }
      }`
    })
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.errors, undefined);
  assert.equal(json.data.cloudDashboard.droplets.length, 1);
  assert.equal(json.data.cloudDashboard.droplets[0].created, createdAt.toISOString());
  assert.equal(json.data.cloudDashboard.activities.length, 1);
  assert.equal(json.data.cloudDashboard.activities[0].type, 'droplet');
  assert.equal(json.data.cloudDashboard.activities[0].time, createdAt.toISOString());
});

test('telemetry heartbeat endpoints remain reachable before address verification completes', () => {
  const unverifiedUser = { id: 'usr_1', addressVerified: false };
  assert.equal(
    requiresAddressVerificationForRequest({ path: '/api/telemetry/visitor/heartbeat', method: 'POST', activeUser: unverifiedUser }),
    false
  );
  assert.equal(
    requiresAddressVerificationForRequest({ path: '/api/cloud/droplets', method: 'GET', activeUser: unverifiedUser }),
    true
  );
});
