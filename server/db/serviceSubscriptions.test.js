import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import {
  DEFAULT_DISCORD_PACKAGES,
  DEFAULT_WHATSAPP_PACKAGES,
  getDiscordPackages,
  getWhatsappPackages,
  getEcommerceCatalog,
  normalizeDiscordPackageList,
  normalizeWhatsappPackageList
} from './packages.js';
import {
  checkServiceLimit,
  evaluateServiceTierInsight,
  getServiceSubscription,
  incrementServiceUsage,
  listAllServiceSubscriptions,
  listServiceNotifications,
  listServiceOrders,
  markServiceNotificationsRead,
  processDueServiceRenewals,
  resetMemoryServiceSubscriptions,
  setServiceAutoRenew,
  subscribeServiceWithCredits
} from './serviceSubscriptions.js';
import {
  encryptBotToken,
  maskBotToken,
  buildOfficialBotInviteUrl,
  DiscordDB
} from '../discord/discordDb.js';
import discordRoutes from '../discord/discordRoutes.js';
import whatsappRoutes from '../whatsapp/whatsappRoutes.js';
import { WhatsAppManager } from '../whatsapp/whatsappManager.js';
import { getPgPool } from './postgres.js';
import { BillingDB, resetMemoryBillingInvoices } from './billing.js';
import { MasterDB } from './multiTenant.js';
import { CloudDB } from './cloud.js';
import { createGraphQLMiddleware } from '../graphql/index.js';

function createMockBillingDB(initialCredits = 50) {
  const balances = new Map([['user_1', initialCredits]]);
  const charges = [];
  const invoices = [];
  return {
    charges,
    invoices,
    balances,
    async recordSubscriptionInvoice(userId, payload = {}) {
      const orderNumber = payload.orderNumber || `ORD-MOCK-${invoices.length + 1}`;
      const invoice = {
        id: orderNumber,
        orderNumber,
        amount: Number(payload.amountUsd || 0),
        currency: 'USD',
        status: Number(payload.amountUsd || 0) <= 0 ? 'Free Trial' : 'Paid',
        description: payload.planName || 'Subscription',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        orderType: payload.orderType || null,
        planId: payload.planId || null,
        planName: payload.planName || null,
        isFreeTrial: Number(payload.amountUsd || 0) <= 0
      };
      invoices.push(invoice);
      return invoice;
    },
    async chargeSubscriptionPlan(userId, amountUsd, planName, context = {}) {
      const current = balances.get(userId) ?? 0;
      if (current < amountUsd) {
        return {
          success: false,
          statusCode: 402,
          error: `Insufficient credits. Need $${amountUsd.toFixed(2)}, have $${current.toFixed(2)}.`,
          requiredAmount: amountUsd,
          availableCredits: current,
          shortfall: Number((amountUsd - current).toFixed(2))
        };
      }
      const remaining = Number((current - amountUsd).toFixed(2));
      balances.set(userId, remaining);
      const orderNumber = `ORD-${charges.length + 1001}`;
      const invoice = await this.recordSubscriptionInvoice(userId, {
        amountUsd,
        cashCreditUsedUsd: amountUsd,
        promoCreditUsedUsd: 0,
        planName,
        orderType: context?.orderType || 'subscription_charge',
        planId: context?.planId || null,
        orderNumber
      });
      charges.push({ userId, amountUsd, planName, context, orderNumber });
      return {
        success: true,
        chargedAmount: amountUsd,
        cashCreditUsed: amountUsd,
        promoCreditUsed: 0,
        orderNumber,
        invoice,
        remainingCredits: remaining
      };
    }
  };
}

test('No free packages allowed for Discord or WhatsApp', () => {
  assert.ok(DEFAULT_DISCORD_PACKAGES.every(pkg => pkg.price >= 1));
  assert.ok(DEFAULT_WHATSAPP_PACKAGES.every(pkg => pkg.price >= 1));

  const normalizedDiscord = normalizeDiscordPackageList([
    { planId: 'free_hack', planName: 'Free Hack', price: 0, maxBots: 1, maxServersPerBot: 1, monthlyCommandsLimit: 100 }
  ]);
  assert.equal(normalizedDiscord.length, 1);
  assert.ok(normalizedDiscord[0].price >= 1, 'Discord package price cannot be 0');

  const normalizedWa = normalizeWhatsappPackageList([
    { planId: 'free_wa', planName: 'Free WA', price: -5, maxSessions: 1, monthlyMessagesLimit: 100 }
  ]);
  assert.equal(normalizedWa.length, 1);
  assert.ok(normalizedWa[0].price >= 1, 'WhatsApp package price cannot be <= 0');
});

test('getEcommerceCatalog & getters return all 4 package arrays with enabled filtering', async () => {
  const initial = await getEcommerceCatalog();
  assert.ok(Array.isArray(initial.packages) && initial.packages.length > 0);
  assert.ok(Array.isArray(initial.addons) && initial.addons.length > 0);
  assert.ok(Array.isArray(initial.discordPackages) && initial.discordPackages.length === 3);
  assert.ok(Array.isArray(initial.whatsappPackages) && initial.whatsappPackages.length === 3);

  const discord = await getDiscordPackages();
  const wa = await getWhatsappPackages();
  assert.equal(discord.length, 3);
  assert.equal(wa.length, 3);

  // Disabled package filtered when includeDisabled is omitted
  const withDisabled = normalizeDiscordPackageList([
    ...DEFAULT_DISCORD_PACKAGES,
    { planId: 'discord_hidden', planName: 'Hidden', price: 99, enabled: false }
  ]);
  assert.equal(withDisabled.length, 4);
  assert.equal(withDisabled.filter(p => p.enabled !== false).length, 3);
});

test('Unsubscribed user is rejected with 402 SUBSCRIPTION_REQUIRED and available packages', async () => {
  resetMemoryServiceSubscriptions();
  const discordCheck = await checkServiceLimit('unsubscribed_user', 'discord', { serversCount: 0 });
  assert.equal(discordCheck.allowed, false);
  assert.equal(discordCheck.statusCode, 402);
  assert.equal(discordCheck.code, 'SUBSCRIPTION_REQUIRED');
  assert.ok(Array.isArray(discordCheck.packages) && discordCheck.packages.length >= 3);

  const waCheck = await checkServiceLimit('unsubscribed_user', 'whatsapp', { sessionsCount: 0 });
  assert.equal(waCheck.allowed, false);
  assert.equal(waCheck.statusCode, 402);
  assert.equal(waCheck.code, 'SUBSCRIPTION_REQUIRED');
  assert.ok(Array.isArray(waCheck.packages) && waCheck.packages.length >= 3);
});

test('Subscription purchase deducts Tiwlo Credits via BillingDB and rejects insufficient balance', async () => {
  resetMemoryServiceSubscriptions();
  const poorBilling = createMockBillingDB(5);
  const failed = await subscribeServiceWithCredits({
    userId: 'user_1',
    userRole: 'user',
    serviceType: 'discord',
    planId: 'discord_starter',
    billingDB: poorBilling
  });
  assert.equal(failed.success, false);
  assert.equal(failed.statusCode, 402);
  assert.equal(failed.code, 'INSUFFICIENT_CREDITS');
  assert.equal(poorBilling.balances.get('user_1'), 5);

  const richBilling = createMockBillingDB(100);
  const activated = await subscribeServiceWithCredits({
    userId: 'user_1',
    userRole: 'user',
    serviceType: 'discord',
    planId: 'discord_starter',
    billingDB: richBilling
  });
  assert.equal(activated.success, true);
  assert.equal(activated.subscription.planId, 'discord_starter');
  assert.equal(activated.subscription.status, 'active');
  assert.equal(richBilling.balances.get('user_1'), 91); // 100 - 9
  assert.equal(richBilling.charges.length, 1);

  const sub = await getServiceSubscription('user_1', 'discord');
  assert.equal(sub.planId, 'discord_starter');
  assert.equal(sub.price, 9);

  const allSubs = await listAllServiceSubscriptions({ serviceType: 'discord' });
  assert.equal(allSubs.total, 1);

  const orders = await listServiceOrders({ serviceType: 'discord' });
  assert.equal(orders.total, 1);
  assert.equal(orders.items[0].planId, 'discord_starter');
});

test('Discord subscription limits strictly enforce maxServersPerBot and monthlyCommandsLimit', async () => {
  resetMemoryServiceSubscriptions();
  const billing = createMockBillingDB(100);
  await subscribeServiceWithCredits({
    userId: 'user_1',
    userRole: 'user',
    serviceType: 'discord',
    planId: 'discord_starter',
    billingDB: billing
  });

  const sub = await getServiceSubscription('user_1', 'discord');
  const maxServers = sub.limits.maxServersPerBot;
  const maxCommands = sub.limits.monthlyCommandsLimit;

  // Under limit passes
  const allowFirst = await checkServiceLimit('user_1', 'discord', { serversCount: 0 });
  assert.equal(allowFirst.allowed, true);

  // At limit fails with 403 LIMIT_EXCEEDED
  const denyOver = await checkServiceLimit('user_1', 'discord', { serversCount: maxServers });
  assert.equal(denyOver.allowed, false);
  assert.equal(denyOver.statusCode, 403);
  assert.equal(denyOver.code, 'LIMIT_EXCEEDED');
  assert.equal(denyOver.metric, 'maxServersPerBot');

  // Exhaust monthly commands limit
  await incrementServiceUsage('user_1', 'discord', 'monthlyCommands', maxCommands);
  const denyCommands = await checkServiceLimit('user_1', 'discord', { checkCommands: true });
  assert.equal(denyCommands.allowed, false);
  assert.equal(denyCommands.statusCode, 403);
  assert.equal(denyCommands.code, 'LIMIT_EXCEEDED');
  assert.equal(denyCommands.metric, 'monthlyCommandsLimit');
});

test('WhatsApp subscription limits strictly enforce maxSessions, monthlyMessagesLimit, dailyBroadcastLimit, autoReplyFlowsLimit', async () => {
  resetMemoryServiceSubscriptions();
  const billing = createMockBillingDB(100);
  await subscribeServiceWithCredits({
    userId: 'user_1',
    userRole: 'user',
    serviceType: 'whatsapp',
    planId: 'wa_starter',
    billingDB: billing
  });

  const sub = await getServiceSubscription('user_1', 'whatsapp');
  assert.equal(billing.balances.get('user_1'), 88); // 100 - 12

  // Sessions limit
  const allowSess = await checkServiceLimit('user_1', 'whatsapp', { sessionsCount: 0 });
  assert.equal(allowSess.allowed, true);
  const denySess = await checkServiceLimit('user_1', 'whatsapp', { sessionsCount: sub.limits.maxSessions });
  assert.equal(denySess.allowed, false);
  assert.equal(denySess.metric, 'maxSessions');

  // Auto-reply flows limit
  const denyFlows = await checkServiceLimit('user_1', 'whatsapp', { autoReplyFlowsCount: sub.limits.autoReplyFlowsLimit });
  assert.equal(denyFlows.allowed, false);
  assert.equal(denyFlows.metric, 'autoReplyFlowsLimit');

  // Daily broadcasts limit
  await incrementServiceUsage('user_1', 'whatsapp', 'dailyBroadcasts', sub.limits.dailyBroadcastLimit);
  const denyBroadcast = await checkServiceLimit('user_1', 'whatsapp', { checkBroadcast: true });
  assert.equal(denyBroadcast.allowed, false);
  assert.equal(denyBroadcast.metric, 'dailyBroadcastLimit');

  // Monthly messages limit
  await incrementServiceUsage('user_1', 'whatsapp', 'monthlyMessages', sub.limits.monthlyMessagesLimit);
  const denyMsg = await checkServiceLimit('user_1', 'whatsapp', { checkMessages: true });
  assert.equal(denyMsg.allowed, false);
  assert.equal(denyMsg.metric, 'monthlyMessagesLimit');
});

test('Official Discord Bot token encryption & masking never leaks plaintext secret', () => {
  const secretToken = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.G9xAbC.superSecretToken9988';
  const encrypted = encryptBotToken(secretToken);
  assert.ok(typeof encrypted.ciphertext === 'string' && encrypted.ciphertext.length > 20);
  assert.ok(!encrypted.ciphertext.includes(secretToken));
  assert.equal(encrypted.last4, '9988');
  assert.equal(encrypted.hasToken, true);

  const masked = maskBotToken(encrypted.last4, encrypted.hasToken);
  assert.ok(masked.endsWith('9988'));
  assert.ok(!masked.includes('superSecret'));

  const invite = buildOfficialBotInviteUrl({ clientId: '123456789012345678', permissionsInt: '8' });
  assert.equal(
    invite,
    'https://discord.com/oauth2/authorize?client_id=123456789012345678&permissions=8&scope=bot%20applications.commands'
  );
});

test('Auto-renewal toggle, scheduled renewals, and payment failure notifications', async () => {
  resetMemoryServiceSubscriptions();

  const missingToggle = await setServiceAutoRenew({ userId: 'user_1', serviceType: 'discord', autoRenew: false });
  assert.equal(missingToggle.success, false);
  assert.equal(missingToggle.statusCode, 404);

  // Manual purchase failure records payment_failed notification and safely catches email errors
  const poorBilling = createMockBillingDB(3);
  const sentEmails = [];
  const failedPurchase = await subscribeServiceWithCredits({
    userId: 'user_1',
    serviceType: 'discord',
    planId: 'discord_starter',
    billingDB: poorBilling,
    userEmail: 'owner@example.com',
    userName: 'Owner',
    sendFailureEmailFn: async (payload) => {
      sentEmails.push(payload);
      throw new Error('SMTP offline');
    }
  });
  assert.equal(failedPurchase.success, false);
  assert.equal(failedPurchase.code, 'INSUFFICIENT_CREDITS');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'owner@example.com');
  assert.equal(sentEmails[0].serviceType, 'discord');

  const failNotes = await listServiceNotifications('user_1', { serviceType: 'discord', unreadOnly: true });
  assert.equal(failNotes.length, 1);
  assert.equal(failNotes[0].kind, 'payment_failed');

  const markSingle = await markServiceNotificationsRead('user_1', {
    serviceType: 'discord',
    notificationId: failNotes[0].id
  });
  assert.equal(markSingle.updatedCount, 1);
  assert.equal((await listServiceNotifications('user_1', { serviceType: 'discord', unreadOnly: true })).length, 0);

  // Purchase with autoRenew=false, then enable autoRenew=true
  const billing = createMockBillingDB(25);
  const subResult = await subscribeServiceWithCredits({
    userId: 'user_1',
    serviceType: 'discord',
    planId: 'discord_starter',
    autoRenew: false,
    billingDB: billing
  });
  assert.equal(subResult.success, true);
  assert.equal(subResult.subscription.autoRenew, false);
  assert.ok(subResult.orderNumber);
  assert.ok(subResult.invoice);

  const invalidToggle = await setServiceAutoRenew({ userId: 'user_1', serviceType: 'discord', autoRenew: 'yes' });
  assert.equal(invalidToggle.statusCode, 400);

  // Future sweep skips when autoRenew=false
  const futureDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  const skippedSweep = await processDueServiceRenewals({ now: futureDate, billingDB: billing });
  assert.equal(skippedSweep.processed, 0);
  assert.equal(billing.balances.get('user_1'), 16);

  // Enable autoRenew and increment usage -> sweep renews, resets usage, records renewal_succeeded
  const enabledToggle = await setServiceAutoRenew({ userId: 'user_1', serviceType: 'discord', autoRenew: true });
  assert.equal(enabledToggle.success, true);
  assert.equal(enabledToggle.subscription.autoRenew, true);

  await incrementServiceUsage('user_1', 'discord', 'monthlyCommands', 500);
  const renewedSweep = await processDueServiceRenewals({ now: futureDate, billingDB: billing });
  assert.equal(renewedSweep.processed, 1);
  assert.equal(renewedSweep.renewed, 1);
  assert.equal(renewedSweep.failed, 0);
  assert.equal(billing.balances.get('user_1'), 7); // 16 - 9

  const renewedSub = await getServiceSubscription('user_1', 'discord');
  assert.equal(renewedSub.status, 'active');
  assert.equal(renewedSub.renewalFailureCount, 0);
  assert.equal(renewedSub.usage.monthlyCommands, 0);

  const renewalNotes = await listServiceNotifications('user_1', { serviceType: 'discord', unreadOnly: true });
  assert.equal(renewalNotes[0].kind, 'renewal_succeeded');

  // Next renewal 30d later fails (7 < 9) -> status becomes past_due, increments failureCount, records payment_failed
  const secondFuture = new Date(futureDate.getTime() + 31 * 24 * 60 * 60 * 1000);
  const failedSweep = await processDueServiceRenewals({
    now: secondFuture,
    billingDB: billing,
    sendFailureEmailFn: async (payload) => sentEmails.push(payload)
  });
  assert.equal(failedSweep.processed, 1);
  assert.equal(failedSweep.failed, 1);

  const pastDueSub = await getServiceSubscription('user_1', 'discord');
  assert.equal(pastDueSub.status, 'past_due');
  assert.equal(pastDueSub.isActive, false);
  assert.equal(pastDueSub.renewalFailureCount, 1);
  assert.ok(pastDueSub.lastRenewalError);
  assert.ok(pastDueSub.lastRenewalAttemptAt);

  const afterFailNotes = await listServiceNotifications('user_1', { serviceType: 'discord', unreadOnly: true });
  assert.equal(afterFailNotes[0].kind, 'payment_failed');
});

test('evaluateServiceTierInsight computes utilization, tierActionRequired, and recommendedPlan', async () => {
  resetMemoryServiceSubscriptions();
  const inactiveInsight = await evaluateServiceTierInsight({
    serviceType: 'discord',
    subscription: null,
    usage: { serversCount: 0, botsCount: 0, monthlyCommands: 0 }
  });
  assert.equal(inactiveInsight.tierActionRequired, 'inactive');
  assert.equal(inactiveInsight.currentTier, null);
  assert.equal(inactiveInsight.recommendedPlan.planId, 'discord_starter');
  assert.equal(inactiveInsight.tiers[0].recommended, true);

  const billing = createMockBillingDB(100);
  await subscribeServiceWithCredits({
    userId: 'user_1',
    serviceType: 'discord',
    planId: 'discord_starter',
    billingDB: billing
  });
  const sub = await getServiceSubscription('user_1', 'discord');

  const healthyInsight = await evaluateServiceTierInsight({
    serviceType: 'discord',
    subscription: sub,
    usage: { serversCount: 0, botsCount: 0, monthlyCommands: 500 }
  });
  assert.equal(healthyInsight.tierActionRequired, 'healthy');
  assert.equal(healthyInsight.recommendedPlan, null);
  assert.equal(healthyInsight.currentTier.metrics.monthlyCommands.status, 'ok');

  // >= 75% monthly commands -> upgrade_recommended -> discord_pro
  const warningInsight = await evaluateServiceTierInsight({
    serviceType: 'discord',
    subscription: sub,
    usage: { serversCount: 0, botsCount: 0, monthlyCommands: 2000 }
  });
  assert.equal(warningInsight.tierActionRequired, 'upgrade_recommended');
  assert.equal(warningInsight.currentTier.metrics.monthlyCommands.percent, 80);
  assert.equal(warningInsight.currentTier.metrics.monthlyCommands.status, 'warning');
  assert.equal(warningInsight.recommendedPlan.planId, 'discord_pro');
  const proTier = warningInsight.tiers.find(t => t.planId === 'discord_pro');
  assert.equal(proTier.recommended, true);
  assert.equal(proTier.priceDelta, 15);
  assert.equal(proTier.limitsDelta.monthlyCommandsLimit, 12500);

  // WhatsApp at limit -> limit_reached -> wa_business
  await subscribeServiceWithCredits({
    userId: 'user_1',
    serviceType: 'whatsapp',
    planId: 'wa_starter',
    billingDB: billing
  });
  const waSub = await getServiceSubscription('user_1', 'whatsapp');
  const waLimitInsight = await evaluateServiceTierInsight({
    serviceType: 'whatsapp',
    subscription: waSub,
    usage: { sessionsCount: 1, autoReplyFlowsCount: 1, monthlyMessages: 100, dailyBroadcasts: 0 }
  });
  assert.equal(waLimitInsight.tierActionRequired, 'limit_reached');
  assert.equal(waLimitInsight.currentTier.metrics.sessions.status, 'exceeded');
  assert.equal(waLimitInsight.recommendedPlan.planId, 'wa_business');
});

async function createRouteTestClient(t, mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      req.activeUser = {
        id: String(userId),
        role: String(req.headers['x-user-role'] || 'owner'),
        email: `${userId}@example.com`,
        name: String(userId)
      };
    }
    next();
  });
  app.use(mountPath, router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('Discord and WhatsApp routes strictly block unsubscribed dashboard access with 402 while allowing subscription, workspace, and admin routes', async (t) => {
  resetMemoryServiceSubscriptions();
  t.mock.method(DiscordDB, 'getServers', async () => []);
  t.mock.method(DiscordDB, 'getOfficialBots', async () => []);
  t.mock.method(DiscordDB, 'getOverview', async () => ({
    botsRegisteredCount: 0,
    officialBots: [],
    connectedServersCount: 0,
    totalMembersCount: 0,
    servers: [],
    bots: [],
    recentActivities: []
  }));
  t.mock.method(DiscordDB, 'getWorkspace', async () => ({
    services: [],
    operations: [],
    totalServices: 0,
    connectedServersCount: 0,
    allServicesHealthy: true
  }));
  t.mock.method(MasterDB, 'getUserStores', async () => []);
  t.mock.method(CloudDB, 'getDroplets', async () => []);
  t.mock.method(WhatsAppManager, 'listSessions', async () => []);

  const mockBilling = createMockBillingDB(100);
  t.mock.method(BillingDB, 'chargeSubscriptionPlan', (...args) => mockBilling.chargeSubscriptionPlan(...args));
  t.mock.method(BillingDB, 'recordSubscriptionInvoice', (...args) => mockBilling.recordSubscriptionInvoice(...args));

  const callDiscord = await createRouteTestClient(t, '/api/discord', discordRoutes);
  const callWa = await createRouteTestClient(t, '/api/whatsapp', whatsappRoutes);

  const userHeaders = { 'x-user-id': 'user_1', 'x-user-role': 'owner' };
  const adminHeaders = { 'x-user-id': 'admin_1', 'x-user-role': 'admin' };

  // Public packages allowed
  assert.equal((await callDiscord('/api/discord/packages')).status, 200);
  assert.equal((await callWa('/api/whatsapp/packages')).status, 200);

  // Unsubscribed users (including admins on user dashboard endpoints) get 402 SUBSCRIPTION_REQUIRED
  for (const path of ['/api/discord/overview', '/api/discord/bots', '/api/discord/bots/1', '/api/discord/servers', '/api/discord/automations', '/api/discord/tickets', '/api/discord/activities']) {
    const res = await callDiscord(path, { headers: userHeaders });
    assert.equal(res.status, 402, `Expected 402 for ${path}`);
    const body = await res.json();
    assert.equal(body.code, 'SUBSCRIPTION_REQUIRED');
    assert.ok(Array.isArray(body.packages) && body.packages.length >= 3);

    const adminRes = await callDiscord(path, { headers: adminHeaders });
    assert.equal(adminRes.status, 402, `Expected 402 for unsubscribed admin on ${path}`);
  }

  for (const path of ['/api/whatsapp/sessions', '/api/whatsapp/sessions/sess_1', '/api/whatsapp/logs', '/api/whatsapp/broadcast']) {
    const res = await callWa(path, { headers: userHeaders });
    assert.equal(res.status, 402, `Expected 402 for ${path}`);
    const body = await res.json();
    assert.equal(body.code, 'SUBSCRIPTION_REQUIRED');
    assert.ok(Array.isArray(body.packages) && body.packages.length >= 3);
  }

  // Allowed without subscription: /subscription*, /workspace*, /admin/*
  const subGet = await callDiscord('/api/discord/subscription', { headers: userHeaders });
  assert.equal(subGet.status, 200);
  const subBody = await subGet.json();
  assert.equal(subBody.tierInsight.tierActionRequired, 'inactive');
  assert.ok(Array.isArray(subBody.notifications));

  assert.equal((await callDiscord('/api/discord/workspace', { headers: userHeaders })).status, 200);
  assert.equal((await callDiscord('/api/discord/admin/packages', { headers: adminHeaders })).status, 200);
  assert.equal((await callDiscord('/api/discord/admin/packages', { headers: userHeaders })).status, 403);
  assert.equal((await callWa('/api/whatsapp/admin/packages', { headers: adminHeaders })).status, 200);

  // Purchase Discord subscription -> returns orderNumber & invoice, unlocks dashboard endpoints
  const purchaseDiscord = await callDiscord('/api/discord/subscription/purchase', {
    method: 'POST',
    headers: { ...userHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ planId: 'discord_starter', autoRenew: false })
  });
  assert.equal(purchaseDiscord.status, 200);
  const purchaseBody = await purchaseDiscord.json();
  assert.equal(purchaseBody.subscription.isActive, true);
  assert.equal(purchaseBody.subscription.autoRenew, false);
  assert.ok(purchaseBody.orderNumber);
  assert.ok(purchaseBody.invoice);

  const toggleRes = await callDiscord('/api/discord/subscription/auto-renew', {
    method: 'PATCH',
    headers: { ...userHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ autoRenew: true })
  });
  assert.equal(toggleRes.status, 200);
  assert.equal((await toggleRes.json()).subscription.autoRenew, true);

  assert.equal((await callDiscord('/api/discord/overview', { headers: userHeaders })).status, 200);
  assert.equal((await callDiscord('/api/discord/servers', { headers: userHeaders })).status, 200);

  // Purchase WhatsApp subscription and verify notifications + sessions gate opens
  const purchaseWa = await callWa('/api/whatsapp/subscription/purchase', {
    method: 'POST',
    headers: { ...userHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ planId: 'wa_starter' })
  });
  assert.equal(purchaseWa.status, 200);
  assert.ok((await purchaseWa.json()).invoice);
  assert.equal((await callWa('/api/whatsapp/sessions', { headers: userHeaders })).status, 200);
  assert.equal((await callWa('/api/whatsapp/subscription/notifications', { headers: userHeaders })).status, 200);
  assert.equal((await callWa('/api/whatsapp/subscription/notifications/read', {
    method: 'POST',
    headers: { ...userHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({})
  })).status, 200);
});

test('Unified Billing Invoices record $0 Free Trial and Paid tiers across E-commerce, Discord, WhatsApp, and GraphQL', async (t) => {
  resetMemoryBillingInvoices();
  const db = new PGlite();
  const pool = getPgPool();
  const runQuery = async (sql, params) => (
    params?.length
      ? db.query(sql, params)
      : (await db.exec(sql)).at(-1)
  );
  t.mock.method(pool, 'query', runQuery);
  t.mock.method(pool, 'connect', async () => ({
    query: runQuery,
    release() {}
  }));
  t.after(async () => {
    await db.close();
  });

  await db.exec(`
    CREATE TABLE system_users (
      id VARCHAR(64) PRIMARY KEY,
      tiwi_id VARCHAR(64),
      name VARCHAR(255),
      store_name VARCHAR(255),
      email VARCHAR(255),
      role VARCHAR(64) DEFAULT 'owner',
      account_type VARCHAR(32) DEFAULT 'personal',
      business_name VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      phone VARCHAR(64),
      postal_code VARCHAR(32),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cloud_billing_accounts (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE,
      credits NUMERIC(12, 2) NOT NULL DEFAULT 0,
      promotional_credits NUMERIC(12, 2) NOT NULL DEFAULT 0,
      promotional_expires_at TIMESTAMPTZ,
      welcome_promo_claimed_at TIMESTAMPTZ,
      first_paid_topup_at TIMESTAMPTZ,
      monthly_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
      currency VARCHAR(32) DEFAULT 'USD',
      account_type VARCHAR(32) DEFAULT 'personal',
      business_name VARCHAR(255) DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cloud_credit_topups (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      provider VARCHAR(32),
      amount NUMERIC(12, 2),
      currency VARCHAR(8) DEFAULT 'USD',
      status VARCHAR(24),
      cancel_reason VARCHAR(32),
      cancelled_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMPTZ
    );
    CREATE TABLE cloud_droplets (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      name VARCHAR(255),
      specs VARCHAR(255),
      vcpus INT,
      memory VARCHAR(64),
      storage VARCHAR(64),
      ip VARCHAR(64),
      region VARCHAR(128),
      region_code VARCHAR(32),
      status VARCHAR(64),
      image VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE platform_billing_orders (
      id VARCHAR(64) PRIMARY KEY,
      order_number VARCHAR(64) UNIQUE NOT NULL,
      user_id VARCHAR(64),
      tiwi_id VARCHAR(64),
      order_type VARCHAR(32) NOT NULL,
      plan_id VARCHAR(64),
      item_name TEXT,
      gross_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
      cash_credit_used_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
      promo_credit_used_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
      net_cash_revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
      provider VARCHAR(32),
      currency VARCHAR(8) NOT NULL DEFAULT 'USD',
      status VARCHAR(32) NOT NULL DEFAULT 'paid',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_state_documents (
      namespace TEXT NOT NULL,
      document_key TEXT NOT NULL,
      data JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (namespace, document_key)
    );
  `);

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('usr_bill_1', 'TIW-90001', 'Zara', 'Zara Store', 'zara@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (id, user_id, credits) VALUES ('cba_1', 'usr_bill_1', 100.00)`
  );
  await db.query(
    `INSERT INTO cloud_credit_topups (id, user_id, provider, amount, currency, status, created_at, paid_at)
     VALUES ('ctu_1', 'usr_bill_1', 'stripe', 100.00, 'USD', 'paid', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', '{"stores":[],"subscriptions":[]}'::jsonb)`
  );

  // 1. Free Starter / Free Trial e-commerce store records a $0 Free Trial invoice
  const freeStore = await MasterDB.createStoreForUser({
    userId: 'usr_bill_1',
    storeName: 'Zara Free Trial',
    subdomain: 'zarafree',
    planId: 'free'
  });
  assert.ok(freeStore.orderNumber);
  assert.equal(freeStore.invoice.amount, 0);
  assert.equal(freeStore.invoice.status, 'Free Trial');
  assert.equal(freeStore.invoice.isFreeTrial, true);

  // 2. Paid e-commerce store records a Paid invoice
  const paidStore = await MasterDB.createStoreForUser({
    userId: 'usr_bill_1',
    storeName: 'Zara Pro Shop',
    subdomain: 'zarapro',
    planId: 'growth'
  });
  assert.ok(paidStore.orderNumber);
  assert.equal(paidStore.invoice.amount, 19);
  assert.equal(paidStore.invoice.status, 'Paid');
  assert.equal(paidStore.invoice.isFreeTrial, false);

  // 3. Discord & WhatsApp charges record invoices in platform_billing_orders
  const discordCharge = await BillingDB.chargeSubscriptionPlan('usr_bill_1', 9, 'Discord Starter', {
    orderType: 'discord_subscription',
    planId: 'discord_starter',
    metadata: { serviceType: 'discord', planId: 'discord_starter', planName: 'Discord Starter' }
  });
  assert.equal(discordCharge.success, true);
  assert.ok(discordCharge.invoice);

  const waCharge = await BillingDB.chargeSubscriptionPlan('usr_bill_1', 12, 'WhatsApp Starter', {
    orderType: 'whatsapp_subscription',
    planId: 'wa_starter',
    metadata: { serviceType: 'whatsapp', planId: 'wa_starter', planName: 'WhatsApp Starter' }
  });
  assert.equal(waCharge.success, true);
  assert.ok(waCharge.invoice);

  // 4. getBillingAccount merges topups + all platform_billing_orders invoices
  const account = await BillingDB.getBillingAccount('usr_bill_1');
  assert.equal(account.credits, 60); // 100 - 19 - 9 - 12
  assert.equal(account.invoices.length, 5);
  assert.ok(account.invoices.some((i) => i.orderType === 'credit_topup' && i.amount === 100));
  assert.ok(account.invoices.some((i) => i.orderType === 'ecommerce_free_trial' && i.amount === 0 && i.isFreeTrial === true && i.status === 'Free Trial'));
  assert.ok(account.invoices.some((i) => i.orderType === 'ecommerce_subscription' && i.amount === 19 && i.status === 'Paid'));
  assert.ok(account.invoices.some((i) => i.orderType === 'discord_subscription' && i.amount === 9));
  assert.ok(account.invoices.some((i) => i.orderType === 'whatsapp_subscription' && i.amount === 12));

  // 5. GraphQL cloudBillingAccount exposes all unified invoice fields
  const gqlApp = express();
  gqlApp.use(express.json());
  gqlApp.use((req, _res, next) => {
    req.activeUser = { id: 'usr_bill_1', tiwiId: 'TIW-90001', role: 'owner' };
    next();
  });
  gqlApp.post('/graphql', createGraphQLMiddleware());
  const gqlServer = gqlApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => gqlServer.once('listening', resolve));
  t.after(() => new Promise((resolve) => gqlServer.close(resolve)));

  const gqlRes = await fetch(`http://127.0.0.1:${gqlServer.address().port}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `{
        cloudBillingAccount {
          credits
          invoices {
            id
            orderNumber
            amount
            status
            description
            orderType
            planId
            planName
            isFreeTrial
            cashCreditUsed
            promoCreditUsed
          }
        }
      }`
    })
  });
  assert.equal(gqlRes.status, 200);
  const gqlBody = await gqlRes.json();
  assert.equal(gqlBody.errors, undefined);
  assert.equal(gqlBody.data.cloudBillingAccount.credits, 60);
  assert.equal(gqlBody.data.cloudBillingAccount.invoices.length, 5);
  const freeTrialGql = gqlBody.data.cloudBillingAccount.invoices.find((i) => i.orderType === 'ecommerce_free_trial');
  assert.equal(freeTrialGql.isFreeTrial, true);
  assert.equal(freeTrialGql.status, 'Free Trial');
  assert.equal(freeTrialGql.amount, 0);
});
