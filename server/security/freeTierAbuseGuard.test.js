import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFreeStoreEligibility,
  extractClientSignals,
  extractNetworkSubnet,
  hashAbuseSignal,
  normalizeClientIp
} from './freeTierAbuseGuard.js';

test('normalizeClientIp and extractNetworkSubnet normalize IPv4-mapped addresses and Wi-Fi subnets', () => {
  assert.equal(normalizeClientIp('::ffff:192.168.1.42'), '192.168.1.42');
  assert.equal(normalizeClientIp('::1'), '127.0.0.1');
  assert.equal(extractNetworkSubnet('::ffff:192.168.1.42'), '192.168.1.0/24');
  assert.equal(extractNetworkSubnet('not-an-ip'), null);
});

test('1 free store per account: allows first free store and blocks second free store while allowing paid plan', () => {
  const signals = extractClientSignals({
    ip: '203.0.113.10',
    headers: { 'x-tiwlo-fingerprint': 'fp-user-1', 'x-tiwlo-device-id': 'dev-1', 'user-agent': 'Mozilla/5.0' }
  });

  const firstFree = evaluateFreeStoreEligibility({
    ownerId: 'user-1',
    existingStores: [],
    selectedPackage: { planId: 'free', price: 0 },
    signals,
    priorClaims: []
  });
  assert.equal(firstFree.allowed, true);

  const deletedFree = evaluateFreeStoreEligibility({
    ownerId: 'user-1',
    existingStores: [{ id: 's1', planId: 'free', status: 'deleted' }],
    selectedPackage: { planId: 'free', price: 0 },
    signals,
    priorClaims: []
  });
  assert.equal(deletedFree.allowed, true);

  const secondFree = evaluateFreeStoreEligibility({
    ownerId: 'user-1',
    existingStores: [{ id: 's1', planId: 'free', status: 'active' }],
    selectedPackage: { planId: 'free', price: 0 },
    signals,
    priorClaims: []
  });
  assert.equal(secondFree.allowed, false);
  assert.equal(secondFree.statusCode, 403);
  assert.equal(secondFree.code, 'FREE_STORE_LIMIT_REACHED');
  assert.equal(secondFree.shouldBanAccount, false);

  const paidStore = evaluateFreeStoreEligibility({
    ownerId: 'user-1',
    existingStores: [{ id: 's1', planId: 'free', status: 'active' }],
    selectedPackage: { planId: 'growth', price: 19 },
    signals,
    priorClaims: []
  });
  assert.equal(paidStore.allowed, true);
});

test('multi-account device fingerprint abuse blocks free store and activates account/device ban', () => {
  const sharedFp = 'fp-shared-laptop-abc';
  const signalsUser2 = extractClientSignals({
    ip: '198.51.100.25',
    headers: { 'x-tiwlo-fingerprint': sharedFp, 'x-tiwlo-device-id': 'dev-user-2', 'user-agent': 'Chrome/130' }
  });

  const priorClaims = [
    {
      user_id: 'user-1',
      store_id: 'store-1',
      plan_id: 'free',
      device_fingerprint_hash: hashAbuseSignal('fingerprint', sharedFp),
      device_token_hash: hashAbuseSignal('device_token', 'dev-user-1'),
      browser_cookie_hash: null,
      ip_hash: hashAbuseSignal('ip', '203.0.113.10'),
      subnet_hash: hashAbuseSignal('subnet', '203.0.113.0/24'),
      user_agent_hash: hashAbuseSignal('ua', 'Chrome/130'),
      status: 'active'
    }
  ];

  const decision = evaluateFreeStoreEligibility({
    ownerId: 'user-2',
    existingStores: [],
    selectedPackage: { planId: 'free', price: 0 },
    signals: signalsUser2,
    priorClaims
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.statusCode, 403);
  assert.equal(decision.code, 'FREE_TIER_DEVICE_ABUSE');
  assert.equal(decision.shouldBanAccount, true);
  assert.ok(decision.blockSignalTypes.includes('fingerprint'));
  assert.ok(decision.blockSignalTypes.includes('user'));
});

test('same Wi-Fi/IP tracking blocks repeat free-tier attempts and bans multi-account clusters', () => {
  const signalsUser2 = extractClientSignals({
    ip: '192.168.50.14',
    headers: { 'x-tiwlo-fingerprint': 'fp-2', 'x-tiwlo-device-id': 'dev-2', 'user-agent': 'Mobile Safari' }
  });

  const singleIpClaim = [
    {
      user_id: 'user-1',
      store_id: 'store-1',
      plan_id: 'free',
      device_fingerprint_hash: hashAbuseSignal('fingerprint', 'fp-1'),
      device_token_hash: hashAbuseSignal('device_token', 'dev-1'),
      browser_cookie_hash: null,
      ip_hash: hashAbuseSignal('ip', '192.168.50.14'),
      subnet_hash: hashAbuseSignal('subnet', '192.168.50.0/24'),
      user_agent_hash: hashAbuseSignal('ua', 'Desktop Firefox'),
      status: 'active'
    }
  ];

  const sameIpDifferentDevice = evaluateFreeStoreEligibility({
    ownerId: 'user-2',
    existingStores: [],
    selectedPackage: { planId: 'free', price: 0 },
    signals: signalsUser2,
    priorClaims: singleIpClaim
  });
  assert.equal(sameIpDifferentDevice.allowed, false);
  assert.equal(sameIpDifferentDevice.code, 'FREE_TIER_IP_LIMIT_REACHED');
  assert.equal(sameIpDifferentDevice.recordStrike, true);

  const sameWifiMatchingUa = evaluateFreeStoreEligibility({
    ownerId: 'user-3',
    existingStores: [],
    selectedPackage: { planId: 'free', price: 0 },
    signals: extractClientSignals({
      ip: '192.168.50.88',
      headers: { 'x-tiwlo-fingerprint': 'fp-3', 'x-tiwlo-device-id': 'dev-3', 'user-agent': 'Desktop Firefox' }
    }),
    priorClaims: singleIpClaim
  });
  assert.equal(sameWifiMatchingUa.allowed, false);
  assert.equal(sameWifiMatchingUa.code, 'FREE_TIER_MULTI_ACCOUNT_BAN');
  assert.equal(sameWifiMatchingUa.shouldBanAccount, true);
});

test('active blocked identity immediately denies store creation and flags ban', () => {
  const decision = evaluateFreeStoreEligibility({
    ownerId: 'user-blocked',
    existingStores: [],
    selectedPackage: { planId: 'growth', price: 19 },
    signals: {},
    blockedSignals: [{ id: 1, signal_type: 'fingerprint', reason: 'Device banned for abuse' }]
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.statusCode, 403);
  assert.equal(decision.code, 'DEVICE_OR_NETWORK_BLOCKED');
  assert.equal(decision.shouldBanAccount, true);
});
