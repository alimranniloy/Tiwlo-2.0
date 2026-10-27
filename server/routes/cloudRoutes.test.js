import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';
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
