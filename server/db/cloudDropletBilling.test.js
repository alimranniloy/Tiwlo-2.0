import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {
  DROPLET_BILLING_PERIOD_DAYS,
  DROPLET_GRACE_PERIOD_DAYS,
  DROPLET_SUSPEND_BEFORE_DELETE_DAYS,
  attemptAutoUnsuspendForUser,
  buildDropletInvoiceLineItems,
  buildDropletInvoiceNumber,
  ensureDropletBillingSchema,
  getInMemoryDropletBillingStateForTests,
  getInMemoryWalletBalanceForTests,
  initializeMonthlyDropletSubscription,
  predictUpcomingRenewalRisks,
  resetInMemoryDropletBillingForTests,
  runMonthlyDropletBillingSweep,
  seedInMemoryDropletForTests,
  sendDropletLifecycleEmail,
  sendDropletProvisionedEmail,
  setInMemoryUserForTests,
  setInMemoryWalletBalanceForTests
} from './cloudDropletBilling.js';

function createEmailRecorder() {
  const sent = [];
  const fn = async (payload) => {
    sent.push(payload);
    return { success: true, delivered: true, messageId: `mock_msg_${sent.length}` };
  };
  return { sent, fn };
}

function makeSampleDroplet(overrides = {}) {
  return {
    id: 'drp_test_001',
    userId: 'user_vps_1',
    name: 'prod-web-01',
    specs: '2 vCPU · 4 GB · 80 GB NVMe',
    vcpus: 2,
    memory: '4 GB',
    storage: '80 GB NVMe',
    ip: '203.0.113.42',
    ipv6: '2001:db8::42',
    region: 'Dhaka (DHK1)',
    regionCode: 'DHK1',
    status: 'active',
    image: 'Ubuntu 24.04 LTS',
    accessUsername: 'root',
    sshPort: 22001,
    tenantId: 'ubt_tenant_001',
    nodeId: 'primary-ubuntu-node',
    ...overrides
  };
}

test('ensureDropletBillingSchema executes idempotently on PostgreSQL (PGlite)', async (t) => {
  const db = new PGlite();
  t.after(async () => { await db.close(); });

  await db.exec(`
    CREATE TABLE cloud_droplets (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      status VARCHAR(64) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const first = await ensureDropletBillingSchema(db);
  assert.equal(first.ok, true);
  const second = await ensureDropletBillingSchema(db);
  assert.equal(second.ok, true);

  const dropletCols = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'cloud_droplets'
  `);
  const colNames = new Set(dropletCols.rows.map((r) => r.column_name));
  for (const required of [
    'monthly_price',
    'billing_cycle',
    'next_billing_at',
    'grace_until',
    'suspended_at',
    'purge_at',
    'last_invoice_id'
  ]) {
    assert.ok(colNames.has(required), `Expected column ${required} on cloud_droplets`);
  }

  const invoiceCols = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'cloud_droplet_invoices'
  `);
  const invColNames = new Set(invoiceCols.rows.map((r) => r.column_name));
  for (const required of [
    'id',
    'invoice_number',
    'user_id',
    'droplet_id',
    'droplet_name',
    'billing_period_start',
    'billing_period_end',
    'amount',
    'currency',
    'status',
    'line_items',
    'email_sent_at',
    'created_at'
  ]) {
    assert.ok(invColNames.has(required), `Expected column ${required} on cloud_droplet_invoices`);
  }
});

test('initializeMonthlyDropletSubscription creates itemized monthly invoice, deducts wallet, logs activity/notification, and sends branded provisioning email', async () => {
  resetInMemoryDropletBillingForTests();
  const t0 = new Date('2026-11-01T00:00:00.000Z');
  setInMemoryUserForTests({ id: 'user_vps_1', email: 'founder@example.com', name: 'Imran' });
  setInMemoryWalletBalanceForTests('user_vps_1', 50);

  const mailer = createEmailRecorder();
  const notifications = [];
  const droplet = makeSampleDroplet();

  const res = await initializeMonthlyDropletSubscription({
    userId: 'user_vps_1',
    droplet,
    monthlyPrice: 12,
    now: t0,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); }
  });

  assert.equal(res.success, true);
  assert.equal(res.charged, true);
  assert.equal(res.droplet.billingCycle, 'monthly');
  assert.equal(res.droplet.monthlyPrice, 12);
  assert.equal(res.droplet.graceUntil, null);

  const expectedNextBilling = new Date(t0.getTime() + DROPLET_BILLING_PERIOD_DAYS * 86400000).toISOString();
  assert.equal(res.droplet.nextBillingAt, expectedNextBilling);

  // Wallet deducted atomically
  assert.equal(getInMemoryWalletBalanceForTests('user_vps_1').total, 38);

  // Itemized invoice document fields
  assert.match(res.invoice.invoiceNumber, /^INV-VPS-\d{8}-[A-F0-9]{6}$/);
  assert.equal(res.invoice.status, 'paid');
  assert.equal(res.invoice.amount, 12);
  assert.equal(res.invoice.subtotal, 12);
  assert.equal(res.invoice.tax, 0);
  assert.equal(res.invoice.currency, 'USD');
  assert.equal(res.invoice.hostname, 'prod-web-01');
  assert.equal(res.invoice.region, 'Dhaka (DHK1)');
  assert.equal(res.invoice.ipv4, '203.0.113.42');
  assert.equal(res.invoice.ipv6, '2001:db8::42');
  assert.equal(res.invoice.billingPeriodStart, t0.toISOString());
  assert.equal(res.invoice.billingPeriodEnd, expectedNextBilling);
  assert.ok(Array.isArray(res.invoice.lineItems) && res.invoice.lineItems.length === 1);
  assert.equal(res.invoice.lineItems[0].specs, '2 vCPU · 4 GB · 80 GB NVMe');
  assert.ok(res.invoice.emailSentAt);

  // Email rendered with Tiwlo wrapper and full specs
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'founder@example.com');
  assert.equal(mailer.sent[0].type, 'cloud_vps_provisioned');
  assert.ok(mailer.sent[0].html.includes(res.invoice.invoiceNumber));
  assert.ok(mailer.sent[0].html.includes('prod-web-01'));
  assert.ok(mailer.sent[0].html.includes('203.0.113.42'));
  assert.ok(mailer.sent[0].html.includes('2001:db8::42'));
  assert.ok(mailer.sent[0].html.includes('Dhaka (DHK1)'));
  assert.ok(mailer.sent[0].html.includes('$12.00'));

  // Activity + social notification
  const state = getInMemoryDropletBillingStateForTests();
  assert.equal(state.activities.length, 1);
  assert.equal(state.notifications.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'cloud_vps_provisioned');
});

test('30-day renewal deducts wallet & issues paid invoice without suspension', async () => {
  resetInMemoryDropletBillingForTests();
  const t0 = new Date('2026-11-01T00:00:00.000Z');
  const t30 = new Date('2026-12-01T00:00:00.000Z');
  setInMemoryUserForTests({ id: 'user_vps_2', email: 'ops@example.com', name: 'Ops Team' });
  setInMemoryWalletBalanceForTests('user_vps_2', 40);

  const mailer = createEmailRecorder();
  const stopCalls = [];
  const holdIpCalls = [];

  await initializeMonthlyDropletSubscription({
    userId: 'user_vps_2',
    droplet: makeSampleDroplet({ id: 'drp_renew_1', userId: 'user_vps_2', name: 'api-node-1' }),
    monthlyPrice: 15,
    now: t0,
    sendEmailFn: mailer.fn
  });
  assert.equal(getInMemoryWalletBalanceForTests('user_vps_2').total, 25);

  const sweep = await runMonthlyDropletBillingSweep({
    now: t30,
    sendEmailFn: mailer.fn,
    stopDropletFn: async (d) => { stopCalls.push(d); },
    holdIpFn: async (d) => { holdIpCalls.push(d); }
  });

  assert.equal(sweep.skipped, false);
  assert.equal(sweep.renewed, 1);
  assert.equal(sweep.enteredGrace, 0);
  assert.equal(sweep.suspended, 0);
  assert.equal(stopCalls.length, 0);
  assert.equal(holdIpCalls.length, 0);
  assert.equal(getInMemoryWalletBalanceForTests('user_vps_2').total, 10);

  const state = getInMemoryDropletBillingStateForTests();
  assert.equal(state.droplets[0].status, 'active');
  assert.equal(state.droplets[0].graceUntil, null);
  assert.equal(
    state.droplets[0].nextBillingAt,
    new Date(t30.getTime() + DROPLET_BILLING_PERIOD_DAYS * 86400000).toISOString()
  );
  assert.equal(state.invoices.length, 2);
  assert.ok(state.invoices.every((inv) => inv.status === 'paid'));

  assert.equal(mailer.sent.length, 2);
  assert.equal(mailer.sent[1].type, 'cloud_vps_renewal_paid');
});

test('predictive low-balance renewal risk warning alerts user 3-5 days before due date and deduplicates', async () => {
  resetInMemoryDropletBillingForTests();
  const t0 = new Date('2026-11-01T00:00:00.000Z');
  const t26 = new Date('2026-11-27T00:00:00.000Z'); // 4 days before Dec 1
  const t27 = new Date('2026-11-28T00:00:00.000Z'); // 3 days before Dec 1

  setInMemoryUserForTests({ id: 'user_risk_1', email: 'risk@example.com', name: 'Risk User' });
  setInMemoryWalletBalanceForTests('user_risk_1', 18); // Enough for one ($10), short for both ($10 + $15 = $25)

  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_risk_a',
    userId: 'user_risk_1',
    name: 'web-a',
    monthlyPrice: 10,
    nextBillingAt: '2026-12-01T00:00:00.000Z',
    createdAt: t0.toISOString()
  }));
  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_risk_b',
    userId: 'user_risk_1',
    name: 'db-b',
    monthlyPrice: 15,
    nextBillingAt: '2026-12-01T12:00:00.000Z',
    createdAt: t0.toISOString()
  }));

  const mailer = createEmailRecorder();
  const notifications = [];

  const firstSweep = await runMonthlyDropletBillingSweep({
    now: t26,
    lookaheadDays: 5,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); }
  });

  assert.equal(firstSweep.warningsSent, 1);
  assert.equal(firstSweep.predictiveRisks.atRiskUsers, 1);
  assert.equal(firstSweep.predictiveRisks.risks[0].totalUpcomingAmount, 25);
  assert.equal(firstSweep.predictiveRisks.risks[0].availableBalance, 18);
  assert.equal(firstSweep.predictiveRisks.risks[0].shortfall, 7);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].type, 'cloud_vps_pre_renewal_warning');
  assert.ok(mailer.sent[0].html.includes('$25.00'));
  assert.ok(mailer.sent[0].html.includes('$18.00'));
  assert.ok(mailer.sent[0].html.includes('$7.00'));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'pre_renewal_warning');

  // Re-running inside same lookahead window deduplicates warning
  const secondRiskCheck = await predictUpcomingRenewalRisks({
    now: t27,
    lookaheadDays: 5,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); }
  });
  assert.equal(secondRiskCheck.warningsSent, 0);
  assert.equal(secondRiskCheck.risks[0].deduplicated, true);
  assert.equal(mailer.sent.length, 1);
  assert.equal(notifications.length, 1);
});

test('insufficient funds enters 3-day grace period (deduplicated) without stopping service, then suspends on grace expiry with 7-day purge countdown & IP hold', async () => {
  resetInMemoryDropletBillingForTests();
  const dueAt = new Date('2026-12-01T00:00:00.000Z');
  const day1InGrace = new Date('2026-12-02T00:00:00.000Z');
  const graceExpiredAt = new Date(dueAt.getTime() + DROPLET_GRACE_PERIOD_DAYS * 86400000);

  setInMemoryUserForTests({ id: 'user_grace_1', email: 'grace@example.com', name: 'Grace User' });
  setInMemoryWalletBalanceForTests('user_grace_1', 2); // Less than $20 monthly price

  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_grace_1',
    userId: 'user_grace_1',
    name: 'grace-vps',
    monthlyPrice: 20,
    nextBillingAt: dueAt.toISOString(),
    createdAt: '2026-11-01T00:00:00.000Z'
  }));

  const mailer = createEmailRecorder();
  const notifications = [];
  const stopCalls = [];
  const holdIpCalls = [];

  // Step 1: Due renewal fails -> enters 3-day grace period, service NOT stopped
  const sweep1 = await runMonthlyDropletBillingSweep({
    now: dueAt,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); },
    stopDropletFn: async (d) => { stopCalls.push(d); },
    holdIpFn: async (d) => { holdIpCalls.push(d); }
  });

  assert.equal(sweep1.enteredGrace, 1);
  assert.equal(sweep1.suspended, 0);
  assert.equal(stopCalls.length, 0);
  assert.equal(holdIpCalls.length, 0);

  let state = getInMemoryDropletBillingStateForTests();
  assert.equal(state.droplets[0].status, 'active');
  assert.equal(state.droplets[0].graceUntil, new Date(dueAt.getTime() + 3 * 86400000).toISOString());
  assert.equal(state.invoices.length, 1);
  assert.equal(state.invoices[0].status, 'past_due');
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].type, 'cloud_vps_grace_period');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'cloud_vps_grace_period');

  // Step 2: Sweep runs again mid-grace -> deduplicated (no duplicate past_due invoice or email)
  const sweep2 = await runMonthlyDropletBillingSweep({
    now: day1InGrace,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); },
    stopDropletFn: async (d) => { stopCalls.push(d); },
    holdIpFn: async (d) => { holdIpCalls.push(d); }
  });
  assert.equal(sweep2.enteredGrace, 0);
  assert.equal(sweep2.inGraceDeduplicated, 1);
  assert.equal(sweep2.suspended, 0);
  assert.equal(getInMemoryDropletBillingStateForTests().invoices.length, 1);
  assert.equal(mailer.sent.length, 1);
  assert.equal(notifications.length, 1);

  // Step 3: Grace expires -> retries once, still insufficient -> suspends, stops runtime, holds IP, sets 7-day purge
  const sweep3 = await runMonthlyDropletBillingSweep({
    now: graceExpiredAt,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); },
    stopDropletFn: async (d) => { stopCalls.push(d); },
    holdIpFn: async (d) => { holdIpCalls.push(d); }
  });

  assert.equal(sweep3.suspended, 1);
  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0].id, 'drp_grace_1');
  assert.equal(holdIpCalls.length, 1);
  assert.equal(holdIpCalls[0].id, 'drp_grace_1');

  state = getInMemoryDropletBillingStateForTests();
  const expectedPurgeAt = new Date(graceExpiredAt.getTime() + DROPLET_SUSPEND_BEFORE_DELETE_DAYS * 86400000).toISOString();
  assert.equal(state.droplets[0].status, 'suspended');
  assert.equal(state.droplets[0].suspendedAt, graceExpiredAt.toISOString());
  assert.equal(state.droplets[0].purgeAt, expectedPurgeAt);

  assert.equal(mailer.sent.length, 2);
  assert.equal(mailer.sent[1].type, 'cloud_vps_suspended');
  assert.ok(mailer.sent[1].html.includes(new Date(expectedPurgeAt).toUTCString()));
  assert.equal(notifications.length, 2);
  assert.equal(notifications[1].type, 'cloud_vps_suspended');
});

test('attemptAutoUnsuspendForUser bills past-due month upon top-up before purge date, restores runtime & IP, and emails invoice + unsuspend notice', async () => {
  resetInMemoryDropletBillingForTests();
  const suspendedAt = new Date('2026-12-04T00:00:00.000Z');
  const purgeAt = new Date('2026-12-11T00:00:00.000Z');
  const topupAt = new Date('2026-12-06T12:00:00.000Z');

  setInMemoryUserForTests({ id: 'user_topup_1', email: 'topup@example.com', name: 'Topup User' });
  setInMemoryWalletBalanceForTests('user_topup_1', 35); // Topped up $35 for $20 VPS

  const seeded = seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_susp_1',
    userId: 'user_topup_1',
    name: 'restore-vps',
    status: 'suspended',
    monthlyPrice: 20,
    nextBillingAt: '2026-12-01T00:00:00.000Z',
    graceUntil: suspendedAt.toISOString(),
    suspendedAt: suspendedAt.toISOString(),
    purgeAt: purgeAt.toISOString(),
    createdAt: '2026-11-01T00:00:00.000Z'
  }));
  assert.equal(seeded.status, 'suspended');

  const mailer = createEmailRecorder();
  const resumed = [];
  const restoredIps = [];
  const notifications = [];

  const result = await attemptAutoUnsuspendForUser({
    userId: 'user_topup_1',
    now: topupAt,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); },
    resumeDropletFn: async (d) => { resumed.push(d); },
    restoreIpFn: async (d) => { restoredIps.push(d); }
  });

  assert.equal(result.attempted, 1);
  assert.equal(result.reactivated, 1);
  assert.equal(result.failed, 0);
  assert.equal(getInMemoryWalletBalanceForTests('user_topup_1').total, 15);
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].id, 'drp_susp_1');
  assert.equal(restoredIps.length, 1);
  assert.equal(restoredIps[0].id, 'drp_susp_1');

  const state = getInMemoryDropletBillingStateForTests();
  assert.equal(state.droplets[0].status, 'active');
  assert.equal(state.droplets[0].graceUntil, null);
  assert.equal(state.droplets[0].suspendedAt, null);
  assert.equal(state.droplets[0].purgeAt, null);
  assert.equal(
    state.droplets[0].nextBillingAt,
    new Date(topupAt.getTime() + DROPLET_BILLING_PERIOD_DAYS * 86400000).toISOString()
  );
  assert.equal(result.results[0].invoice.status, 'paid');

  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].type, 'cloud_vps_unsuspended');
  assert.ok(mailer.sent[0].html.includes(result.results[0].invoice.invoiceNumber));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'cloud_vps_reactivated');
});

test('full purge after purge_at expires calls reclaimDropletFn, clears droplet data, releases IP, logs audit, and sends termination notice', async () => {
  resetInMemoryDropletBillingForTests();
  const suspendedAt = new Date('2026-12-04T00:00:00.000Z');
  const purgeAt = new Date('2026-12-11T00:00:00.000Z');
  const afterPurge = new Date('2026-12-11T00:05:00.000Z');

  setInMemoryUserForTests({ id: 'user_purge_1', email: 'purge@example.com', name: 'Purge User' });
  setInMemoryWalletBalanceForTests('user_purge_1', 0);

  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_purge_1',
    userId: 'user_purge_1',
    name: 'doomed-vps',
    status: 'suspended',
    monthlyPrice: 10,
    nextBillingAt: '2026-12-01T00:00:00.000Z',
    graceUntil: suspendedAt.toISOString(),
    suspendedAt: suspendedAt.toISOString(),
    purgeAt: purgeAt.toISOString(),
    createdAt: '2026-11-01T00:00:00.000Z'
  }));

  const mailer = createEmailRecorder();
  const notifications = [];
  const reclaimed = [];

  const sweep = await runMonthlyDropletBillingSweep({
    now: afterPurge,
    sendEmailFn: mailer.fn,
    notifyFn: async (n) => { notifications.push(n); },
    reclaimDropletFn: async (droplet, ctx) => {
      reclaimed.push({ droplet, ctx });
    }
  });

  assert.equal(sweep.purged, 1);
  assert.equal(reclaimed.length, 1);
  assert.equal(reclaimed[0].droplet.id, 'drp_purge_1');
  assert.equal(reclaimed[0].droplet.ipv4, '203.0.113.42');
  assert.equal(reclaimed[0].ctx.reason, 'billing_purge_expired');

  const state = getInMemoryDropletBillingStateForTests();
  assert.equal(state.droplets.length, 0);
  assert.equal(state.activities.length, 1);
  assert.match(state.activities[0].action, /Terminated suspended VPS/);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'cloud_vps_terminated');

  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].type, 'cloud_vps_terminated');
  assert.ok(mailer.sent[0].html.includes('doomed-vps'));
});

test('helper exports buildDropletInvoiceNumber, buildDropletInvoiceLineItems, sendDropletProvisionedEmail, and sendDropletLifecycleEmail work standalone', async () => {
  const invNum = buildDropletInvoiceNumber(new Date('2026-11-23T00:00:00.000Z'));
  assert.match(invNum, /^INV-VPS-20261123-[A-F0-9]{6}$/);

  const built = buildDropletInvoiceLineItems({
    droplet: makeSampleDroplet(),
    monthlyPrice: 24,
    periodStart: '2026-11-23T00:00:00.000Z',
    periodEnd: '2026-12-23T00:00:00.000Z',
    taxRate: 0.1
  });
  assert.equal(built.subtotal, 24);
  assert.equal(built.tax, 2.4);
  assert.equal(built.total, 26.4);
  assert.equal(built.lineItems.length, 1);

  const mailer = createEmailRecorder();
  const provRes = await sendDropletProvisionedEmail({
    to: 'dev@example.com',
    name: 'Dev',
    droplet: makeSampleDroplet(),
    invoice: { invoiceNumber: invNum, amount: 26.4, subtotal: 24, tax: 2.4, status: 'paid' },
    sendEmailFn: mailer.fn
  });
  assert.equal(provRes.success, true);

  const lifeRes = await sendDropletLifecycleEmail({
    event: 'terminated',
    to: 'dev@example.com',
    name: 'Dev',
    droplet: makeSampleDroplet(),
    purgeAt: '2026-12-30T00:00:00.000Z',
    sendEmailFn: mailer.fn
  });
  assert.equal(lifeRes.success, true);
  assert.equal(mailer.sent.length, 2);
});

test('custom billingDB integration and expired-purge safeguard in attemptAutoUnsuspendForUser', async () => {
  resetInMemoryDropletBillingForTests();
  const now = new Date('2026-12-12T00:00:00.000Z');
  setInMemoryUserForTests({ id: 'user_custom_1', email: 'custom@example.com', name: 'Custom' });

  const charges = [];
  const customBillingDB = {
    async getBillingAccount() {
      return { credits: 5, promotionalCredits: 0 };
    },
    async chargeSubscriptionPlan(userId, amountUsd, planName, context) {
      charges.push({ userId, amountUsd, planName, context });
      return { success: true, chargedAmount: amountUsd, cashCreditUsed: amountUsd, promoCreditUsed: 0 };
    }
  };

  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_expired_purge',
    userId: 'user_custom_1',
    name: 'expired-vps',
    status: 'suspended',
    monthlyPrice: 10,
    suspendedAt: '2026-12-01T00:00:00.000Z',
    purgeAt: '2026-12-08T00:00:00.000Z' // Already past purge_at
  }));

  seedInMemoryDropletForTests(makeSampleDroplet({
    id: 'drp_grace_clear',
    userId: 'user_custom_1',
    name: 'grace-clear-vps',
    status: 'active',
    monthlyPrice: 10,
    nextBillingAt: '2026-12-10T00:00:00.000Z',
    graceUntil: '2026-12-13T00:00:00.000Z'
  }));

  const mailer = createEmailRecorder();
  const res = await attemptAutoUnsuspendForUser({
    userId: 'user_custom_1',
    now,
    sendEmailFn: mailer.fn,
    billingDB: customBillingDB
  });

  // Only the in-grace droplet is billed/cleared; past-purge droplet is not reactivated
  assert.equal(res.attempted, 1);
  assert.equal(res.reactivated, 1);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].context.planId, 'drp_grace_clear');
  assert.equal(charges[0].context.metadata.dropletId, 'drp_grace_clear');

  const state = getInMemoryDropletBillingStateForTests();
  const cleared = state.droplets.find((d) => d.id === 'drp_grace_clear');
  const stillSuspended = state.droplets.find((d) => d.id === 'drp_expired_purge');
  assert.equal(cleared.graceUntil, null);
  assert.equal(stillSuspended.status, 'suspended');
});
