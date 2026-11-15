import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WELCOME_PROMO,
  evaluatePromoCodeRedemption,
  evaluateWelcomeBonusEligibility,
  normalizeWelcomePromoConfig
} from './promotions.js';
import { extractClientSignals, hashAbuseSignal } from '../security/freeTierAbuseGuard.js';

test('DEFAULT_WELCOME_PROMO sets $1 load -> $50 gift for 30 days on new accounts', () => {
  assert.equal(DEFAULT_WELCOME_PROMO.minDepositUsd, 1);
  assert.equal(DEFAULT_WELCOME_PROMO.bonusAmountUsd, 50);
  assert.equal(DEFAULT_WELCOME_PROMO.validityDays, 30);
  assert.equal(DEFAULT_WELCOME_PROMO.newAccountsOnly, true);
  assert.equal(DEFAULT_WELCOME_PROMO.onePerDevice, true);

  const clamped = normalizeWelcomePromoConfig({ minDepositUsd: 0.25, bonusAmountUsd: 75, validityDays: 45 });
  assert.equal(clamped.minDepositUsd, 1);
  assert.equal(clamped.bonusAmountUsd, 75);
  assert.equal(clamped.validityDays, 45);
});

test('welcome gift grants $50/30d on first $1 topup and blocks existing funded or multi-device accounts', () => {
  const cleanSignals = extractClientSignals({
    ip: '198.51.100.12',
    headers: { 'x-tiwlo-fingerprint': 'fp-clean-1', 'x-tiwlo-device-id': 'dev-clean-1', 'user-agent': 'Chrome/130' }
  });

  const eligible = evaluateWelcomeBonusEligibility({
    userId: 'user-new',
    config: DEFAULT_WELCOME_PROMO,
    accountState: {},
    depositAmountUsd: 1,
    signals: cleanSignals,
    priorWelcomeClaims: []
  });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.bonusAmountUsd, 50);
  assert.equal(eligible.validityDays, 30);

  const fundedAccount = evaluateWelcomeBonusEligibility({
    userId: 'user-funded',
    config: DEFAULT_WELCOME_PROMO,
    accountState: { hasPaidTopupsBefore: true },
    depositAmountUsd: 1,
    signals: cleanSignals,
    priorWelcomeClaims: []
  });
  assert.equal(fundedAccount.eligible, false);
  assert.equal(fundedAccount.code, 'NEW_ACCOUNTS_ONLY');

  const multiDeviceAbuse = evaluateWelcomeBonusEligibility({
    userId: 'user-alt',
    config: DEFAULT_WELCOME_PROMO,
    accountState: {},
    depositAmountUsd: 1,
    signals: cleanSignals,
    priorWelcomeClaims: [
      {
        user_id: 'user-new',
        device_fingerprint_hash: hashAbuseSignal('fingerprint', 'fp-clean-1'),
        device_token_hash: hashAbuseSignal('device_token', 'dev-other'),
        browser_cookie_hash: null,
        ip_hash: hashAbuseSignal('ip', '203.0.113.5'),
        subnet_hash: hashAbuseSignal('subnet', '203.0.113.0/24'),
        user_agent_hash: hashAbuseSignal('ua', 'Chrome/130'),
        status: 'granted'
      }
    ]
  });
  assert.equal(multiDeviceAbuse.eligible, false);
  assert.equal(multiDeviceAbuse.code, 'PROMO_DEVICE_ABUSE');
  assert.equal(multiDeviceAbuse.shouldBanAccount, true);
});

test('targeted promo codes enforce assigned users, min topup, and multi-device ban protection', () => {
  const targetedPromo = {
    id: 'promo-vip',
    code: 'VIP50',
    reward_type: 'promo_credit',
    amount_usd: 50,
    validity_days: 30,
    min_topup_usd: 1,
    target_type: 'specific_users',
    target_emails: ['vip@tiwlo.com'],
    target_user_ids: [],
    max_total_uses: 5,
    uses_count: 1,
    max_per_user: 1,
    one_per_device: true,
    new_accounts_only: false,
    is_active: true
  };

  const wrongUser = evaluatePromoCodeRedemption({
    promo: targetedPromo,
    user: { id: 'u2', email: 'other@tiwlo.com' },
    totalPaidTopupUsd: 5
  });
  assert.equal(wrongUser.eligible, false);
  assert.equal(wrongUser.statusCode, 403);
  assert.equal(wrongUser.code, 'PROMO_NOT_ASSIGNED');

  const vipNoDeposit = evaluatePromoCodeRedemption({
    promo: targetedPromo,
    user: { id: 'u1', email: 'vip@tiwlo.com' },
    totalPaidTopupUsd: 0
  });
  assert.equal(vipNoDeposit.eligible, false);
  assert.equal(vipNoDeposit.statusCode, 402);
  assert.equal(vipNoDeposit.code, 'PROMO_MIN_TOPUP_REQUIRED');

  const signals = extractClientSignals({
    ip: '198.51.100.99',
    headers: { 'x-tiwlo-fingerprint': 'fp-vip-1', 'x-tiwlo-device-id': 'dev-vip-1', 'user-agent': 'Chrome/130' }
  });

  const vipAllowed = evaluatePromoCodeRedemption({
    promo: targetedPromo,
    user: { id: 'u1', email: 'vip@tiwlo.com' },
    totalPaidTopupUsd: 1,
    signals,
    priorCodeClaims: []
  });
  assert.equal(vipAllowed.eligible, true);
  assert.equal(vipAllowed.amountUsd, 50);
  assert.equal(vipAllowed.validityDays, 30);

  const sharedDeviceAbuse = evaluatePromoCodeRedemption({
    promo: { ...targetedPromo, target_type: 'all' },
    user: { id: 'u-alt', email: 'alt@tiwlo.com' },
    totalPaidTopupUsd: 1,
    signals,
    priorCodeClaims: [
      {
        user_id: 'u1',
        device_fingerprint_hash: hashAbuseSignal('fingerprint', 'fp-vip-1'),
        status: 'granted'
      }
    ]
  });
  assert.equal(sharedDeviceAbuse.eligible, false);
  assert.equal(sharedDeviceAbuse.code, 'PROMO_DEVICE_ABUSE');
  assert.equal(sharedDeviceAbuse.shouldBanAccount, true);
});
