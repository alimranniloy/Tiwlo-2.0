import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createAdminPlatformOpsRouter } from './adminPlatformOpsRoutes.js';

function startTestServer(router, adminUserResolver) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', (req, res, next) => {
    const adminUser = adminUserResolver ? adminUserResolver(req) : null;
    if (!adminUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.adminUser = adminUser;
    return next();
  }, router);

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}/api/admin`,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

function buildMockDeps(overrides = {}) {
  const nowIso = new Date().toISOString();
  const users = [
    { id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin', name: 'Super Admin', tiwiId: 'tiwlo_super' },
    { id: 'u_staff', email: 'support@tiwlo.com', role: 'admin', name: 'Support Agent', tiwiId: 'tiwlo_staff' },
    { id: 'u_merchant', email: 'merchant@example.com', role: 'owner', name: 'Merchant One', tiwiId: 'tiwlo_m1' },
    { id: 'u_merchant2', email: 'merchant2@example.com', role: 'owner', name: 'Merchant Two', tiwiId: 'tiwlo_m2' }
  ];
  const stores = [
    { tiwiId: 'store_super', ownerId: 'u_super', storeName: 'Tiwlo HQ Store', subdomain: 'hqstore', planId: 'enterprise', status: 'active', lifecycleStatus: 'active' },
    { tiwiId: 'store_paid', ownerId: 'u_merchant', storeName: 'Acme Retail', subdomain: 'acmeretail', planId: 'pro', status: 'active', lifecycleStatus: 'active' },
    { tiwiId: 'store_grace', ownerId: 'u_merchant2', storeName: 'Grace Shop', subdomain: 'graceshop', planId: 'growth', status: 'active', lifecycleStatus: 'grace_period' }
  ];
  const subscriptions = [
    { tiwiId: 'store_super', planId: 'enterprise', planName: 'Enterprise VIP', price: 129, status: 'active' },
    { tiwiId: 'store_paid', planId: 'pro', planName: 'Pro Business', price: 49, status: 'active' },
    { tiwiId: 'store_grace', planId: 'growth', planName: 'Growth Retailer', price: 19, status: 'active', lifecycleStatus: 'grace_period' }
  ];
  const masterState = { users, stores, subscriptions };
  const tenantStoreState = new Map([
    ['store_paid', { tiwiId: 'store_paid', ownerId: 'u_merchant', storeName: 'Acme Retail', subdomain: 'acmeretail', planId: 'pro', status: 'active' }],
    ['store_super', { tiwiId: 'store_super', ownerId: 'u_super', storeName: 'Tiwlo HQ Store', subdomain: 'hqstore', planId: 'enterprise', status: 'active' }]
  ]);

  let savedCurrencySettings = null;
  const recordedEvents = [];

  const topups = [
    { id: 'top_paid_1', user_id: 'u_merchant', provider: 'stripe', amount: 100, status: 'paid', currency: 'USD', paid_at: nowIso, created_at: nowIso },
    { id: 'top_ref_1', user_id: 'u_merchant', provider: 'bkash', amount: 25, refunded_amount: 25, status: 'refunded', currency: 'USD', created_at: nowIso }
  ];
  const billingOrders = [
    { id: 'ord_1', order_number: 'ORD-1001', user_id: 'u_merchant', tiwi_id: 'store_paid', order_type: 'store_upgrade', plan_id: 'pro', item_name: 'Pro Business', gross_amount_usd: 49, cash_credit_used_usd: 29, promo_credit_used_usd: 20, net_cash_revenue_usd: 29, provider: 'wallet', currency: 'USD', status: 'paid', created_at: nowIso }
  ];
  const promoClaims = [
    { id: 1, user_id: 'u_merchant', claim_type: 'welcome_bonus', promo_code: 'WELCOME20', amount_usd: 20, status: 'granted', created_at: nowIso }
  ];
  const redeemedVouchers = [
    { id: 'v_1', code: 'FREE50', amount: 50, is_redeemed: true, redeemed_by: 'u_merchant', redeemed_at: nowIso }
  ];
  const billingAccounts = [
    { user_id: 'u_merchant', credits: 71, promotional_credits: 0 }
  ];
  const securityEvents = [
    { id: 10, event_type: 'admin.login', severity: 'warning', user_id: 'u_super', subject: 'tiwloltd@gmail.com', ip: '1.2.3.4', details: { role: 'super_admin' }, created_at: nowIso },
    { id: 11, event_type: 'auth.failed', severity: 'warning', user_id: 'u_merchant', subject: 'merchant@example.com', ip: '5.6.7.8', details: { role: 'owner' }, created_at: nowIso }
  ];

  const queryPg = async (sql) => {
    const q = String(sql).trim();
    if (q.includes('FROM cloud_credit_topups')) return { rows: topups };
    if (q.includes('FROM platform_billing_orders')) return { rows: billingOrders };
    if (q.includes('FROM system_promo_claims')) return { rows: promoClaims };
    if (q.includes('FROM cloud_vouchers')) return { rows: redeemedVouchers };
    if (q.includes('FROM cloud_billing_accounts')) return { rows: billingAccounts };
    if (q.includes('FROM system_custom_domains')) return { rows: [] };
    if (q.includes('FROM system_free_subdomains')) return { rows: [] };
    if (q.includes('FROM system_security_events')) return { rows: securityEvents };
    if (q.includes('FROM support_tickets')) return { rows: [] };
    if (q.includes('FROM system_user_login_locations')) return { rows: [] };
    if (q.includes('FROM system_user_device_identities')) return { rows: [] };
    if (q.startsWith('SHOW server_version')) return { rows: [{ server_version: '16.2' }] };
    if (q.includes('pg_database_size')) return { rows: [{ size_bytes: 10485760 }] };
    if (q.includes('pg_stat_activity')) return { rows: [{ active_connections: 3 }] };
    if (q.includes('FROM system_settings WHERE setting_key')) {
      return { rows: savedCurrencySettings ? [{ settings: savedCurrencySettings, updated_at: nowIso }] : [] };
    }
    if (q.includes('INSERT INTO system_settings')) {
      return { rows: [] };
    }
    if (q.includes('INSERT INTO cloud_billing_accounts')) return { rows: [] };
    if (q.includes('UPDATE cloud_billing_accounts')) {
      return { rows: [{ credits: 10, promotional_credits: 25, promotional_expires_at: nowIso }] };
    }
    return { rows: [] };
  };

  return {
    users,
    masterState,
    recordedEvents,
    setSavedCurrency: (s) => { savedCurrencySettings = s; },
    deps: {
      queryPg,
      MasterDB: {
        getMasterData: async () => masterState,
        saveMasterData: async () => true,
        findUserByIdentifier: async (id) => users.find((u) => u.id === id || u.email === id) || null,
        deleteStoreForUser: async (ownerId, tiwiId) => {
          const before = masterState.stores.length;
          masterState.stores = masterState.stores.filter((s) => !(s.tiwiId === tiwiId && s.ownerId === ownerId));
          return masterState.stores.length < before;
        }
      },
      TenantDB: {
        getStoreDb: async (tiwiId) => tenantStoreState.get(tiwiId) || null,
        saveStoreDb: async (tiwiId, doc) => { tenantStoreState.set(tiwiId, doc); }
      },
      BillingDB: {
        chargeSubscriptionPlan: async () => ({ success: true })
      },
      getEcommercePackageById: async (planId) => ({
        planId,
        planName: planId.toUpperCase(),
        price: planId === 'enterprise' ? 129 : planId === 'pro' ? 49 : planId === 'growth' ? 19 : 0,
        productLimit: 100,
        warehouseLimit: 2,
        staffLimit: 3,
        monthlyOrderLimit: 1000,
        hasPos: planId !== 'free',
        hasCustomDomain: planId !== 'free'
      }),
      purgeStoreMediaAssets: async () => ({ deletedPaths: [] }),
      recordPlatformBillingOrder: async (row) => row,
      getMarketUsdRates: async () => {
        throw new Error('Market feed offline');
      },
      recordSecurityEvent: async (evt) => {
        recordedEvents.push(evt);
      },
      getFleetLiveStatus: () => ({ totalNodes: 2, onlineNodes: 2, offlineNodes: 0, unknownNodes: 0 }),
      listServerNodes: async () => ({ items: [{ id: 'srv_1', name: 'Node 1', status: 'online' }] }),
      computeRiskClusters: () => ({ summary: { flaggedUsers: 1, banEvasionClusters: 0 }, clusters: [] }),
      ...overrides
    }
  };
}

test('returns 401 without admin authentication', async () => {
  const mock = buildMockDeps();
  const router = createAdminPlatformOpsRouter({
    requireAdmin: (req, res, next) => (req.adminUser ? next() : res.status(401).json({ error: 'Unauthorized' })),
    deps: mock.deps
  });
  const srv = await startTestServer(router, () => null);
  try {
    const res = await fetch(`${srv.baseUrl}/overview`);
    assert.equal(res.status, 401);
  } finally {
    await srv.close();
  }
});

test('computes real Net Cash Profit excluding free credits/vouchers in /overview and /orders', async () => {
  const mock = buildMockDeps();
  const router = createAdminPlatformOpsRouter({ deps: mock.deps });
  const srv = await startTestServer(router, () => ({ id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin' }));
  try {
    const ovRes = await fetch(`${srv.baseUrl}/overview?range=7days`);
    assert.equal(ovRes.status, 200);
    const ovJson = await ovRes.json();
    assert.equal(ovJson.success, true);
    // Gross topup = 100, refund = 25 -> Net Cash Profit = 75 (free $20 promo + $50 voucher excluded!)
    assert.equal(ovJson.data.metrics.grossCashTopupsUsd, 100);
    assert.equal(ovJson.data.metrics.cashRefundsUsd, 25);
    assert.equal(ovJson.data.metrics.netCashProfitUsd, 75);
    assert.equal(ovJson.data.metrics.freeCreditsIssuedUsd, 70);
    assert.equal(ovJson.data.metrics.freeCreditsUsedUsd, 20);
    assert.equal(ovJson.data.storesOverview.totalStores, 3);
    assert.equal(ovJson.data.storesOverview.gracePeriodStores, 1);

    const ordRes = await fetch(`${srv.baseUrl}/orders`);
    assert.equal(ordRes.status, 200);
    const ordJson = await ordRes.json();
    assert.equal(ordJson.summary.netCashProfitUsd, 75);
    const promoRow = ordJson.orders.find((o) => o.type === 'promo' && o.orderNumber.startsWith('PROMO-'));
    assert.ok(promoRow);
    assert.equal(promoRow.netProfitUsd, 0);
    assert.equal(promoRow.paidCashUsd, 0);
  } finally {
    await srv.close();
  }
});

test('hides Super Admin activity from regular admins and blocks mutations on Super Admin stores/credits with 403', async () => {
  const mock = buildMockDeps();
  let currentRole = 'admin';
  const router = createAdminPlatformOpsRouter({ deps: mock.deps });
  const srv = await startTestServer(router, () =>
    currentRole === 'super_admin'
      ? { id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin' }
      : { id: 'u_staff', email: 'support@tiwlo.com', role: 'admin' }
  );

  try {
    // 1. Alerts must exclude super_admin security event for regular admin
    const alertAdminRes = await fetch(`${srv.baseUrl}/alerts`);
    const alertAdminJson = await alertAdminRes.json();
    assert.equal(alertAdminJson.alerts.some((a) => a.subject === 'tiwloltd@gmail.com'), false);
    assert.equal(alertAdminJson.alerts.some((a) => a.subject === 'merchant@example.com'), true);

    // 2. Overview recentActivities must exclude super_admin events for regular admin
    const ovAdminRes = await fetch(`${srv.baseUrl}/overview`);
    const ovAdminJson = await ovAdminRes.json();
    assert.equal(
      ovAdminJson.data.recentActivities.some((a) => a.target === 'tiwloltd@gmail.com'),
      false
    );

    // 3. Regular admin cannot patch/delete super_admin store or adjust super_admin credits -> 403
    const patchSuper = await fetch(`${srv.baseUrl}/stores/store_super`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName: 'Hijacked' })
    });
    assert.equal(patchSuper.status, 403);

    const delSuper = await fetch(`${srv.baseUrl}/stores/store_super`, { method: 'DELETE' });
    assert.equal(delSuper.status, 403);

    const credSuper = await fetch(`${srv.baseUrl}/users/u_super/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditType: 'cash', operation: 'add', amountUsd: 50 })
    });
    assert.equal(credSuper.status, 403);

    // 4. Super Admin can see own security events in /alerts
    currentRole = 'super_admin';
    const alertSuperRes = await fetch(`${srv.baseUrl}/alerts`);
    const alertSuperJson = await alertSuperRes.json();
    assert.equal(alertSuperJson.alerts.some((a) => a.subject === 'tiwloltd@gmail.com'), true);
  } finally {
    await srv.close();
  }
});

test('currency-rates returns bdtRate null without fabricating numbers when external feed fails and no manual override exists', async () => {
  const mock = buildMockDeps();
  const router = createAdminPlatformOpsRouter({ deps: mock.deps });
  const srv = await startTestServer(router, () => ({ id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin' }));
  try {
    const res = await fetch(`${srv.baseUrl}/currency-rates`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.rates.USD, 1);
    assert.equal(json.data.rates.BDT, undefined);
    assert.equal(json.data.bdtRate, null);
    assert.match(json.data.warning, /unavailable/i);
  } finally {
    await srv.close();
  }
});
