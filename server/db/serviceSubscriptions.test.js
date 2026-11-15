import test from 'node:test';
import assert from 'node:assert/strict';
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
  getServiceSubscription,
  incrementServiceUsage,
  listAllServiceSubscriptions,
  listServiceOrders,
  resetMemoryServiceSubscriptions,
  subscribeServiceWithCredits
} from './serviceSubscriptions.js';
import {
  encryptBotToken,
  maskBotToken,
  buildOfficialBotInviteUrl
} from '../discord/discordDb.js';

function createMockBillingDB(initialCredits = 50) {
  const balances = new Map([['user_1', initialCredits]]);
  const charges = [];
  return {
    charges,
    balances,
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
      charges.push({ userId, amountUsd, planName, context, orderNumber });
      return {
        success: true,
        chargedAmount: amountUsd,
        cashCreditUsed: amountUsd,
        promoCreditUsed: 0,
        orderNumber,
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
