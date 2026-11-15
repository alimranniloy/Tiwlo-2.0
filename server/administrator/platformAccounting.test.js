import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlatformFinancialSummary,
  computeStoreTierBreakdown
} from './platformAccounting.js';

test('free promo credits and redeemed vouchers NEVER inflate grossCashTopupsUsd or netCashProfitUsd', () => {
  const summary = computePlatformFinancialSummary({
    topups: [
      { id: 't1', amount: 1.00, status: 'paid', provider: 'stripe', paid_at: '2026-11-10T10:00:00Z' },
      { id: 't2', amount: 25.00, status: 'paid', provider: 'bkash', paid_at: '2026-11-11T10:00:00Z' },
      { id: 't3', amount: 500.00, status: 'pending', provider: 'paypal', created_at: '2026-11-11T12:00:00Z' },
      { id: 't4', amount: 100.00, status: 'cancelled', provider: 'stripe', created_at: '2026-11-11T13:00:00Z' }
    ],
    promoClaims: [
      { id: 1, claim_type: 'welcome_bonus', amount_usd: 50.00, status: 'granted', created_at: '2026-11-10T10:01:00Z' },
      { id: 2, claim_type: 'promo_code', amount_usd: 20.00, status: 'granted', created_at: '2026-11-11T11:00:00Z' },
      { id: 3, claim_type: 'welcome_bonus', amount_usd: 50.00, status: 'rejected', created_at: '2026-11-11T11:30:00Z' }
    ],
    redeemedVouchers: [
      { id: 'v1', amount: 100.00, is_redeemed: true, redeemed_at: '2026-11-11T14:00:00Z' },
      { id: 'v2', amount: 250.00, is_redeemed: false }
    ],
    billingOrders: [
      {
        id: 'o1',
        order_type: 'subscription_upgrade',
        gross_amount_usd: 19.00,
        cash_credit_used_usd: 0.00,
        promo_credit_used_usd: 19.00,
        net_cash_revenue_usd: 0.00,
        status: 'paid',
        created_at: '2026-11-10T10:05:00Z'
      },
      {
        id: 'o2',
        order_type: 'subscription_upgrade',
        gross_amount_usd: 49.00,
        cash_credit_used_usd: 18.00,
        promo_credit_used_usd: 31.00,
        net_cash_revenue_usd: 18.00,
        status: 'paid',
        created_at: '2026-11-11T15:00:00Z'
      },
      {
        id: 'o3',
        order_type: 'promo_grant',
        gross_amount_usd: 50.00,
        cash_credit_used_usd: 0.00,
        promo_credit_used_usd: 0.00,
        net_cash_revenue_usd: 0.00,
        status: 'paid',
        created_at: '2026-11-10T10:01:00Z'
      },
      {
        id: 'o4',
        order_type: 'voucher_redeem',
        gross_amount_usd: 100.00,
        cash_credit_used_usd: 0.00,
        promo_credit_used_usd: 0.00,
        net_cash_revenue_usd: 0.00,
        status: 'paid',
        created_at: '2026-11-11T14:00:00Z'
      }
    ],
    billingAccounts: [
      { user_id: 'u1', credits: 108.00, promotional_credits: 20.00 }
    ],
    periodStart: new Date('2026-11-10T00:00:00Z'),
    periodEnd: new Date('2026-11-12T00:00:00Z'),
    bucketStarts: [new Date('2026-11-10T00:00:00Z'), new Date('2026-11-11T00:00:00Z')],
    bucketUnit: 'day'
  });

  // Real cash collected = $1 + $25 = $26 (pending/cancelled/promos/vouchers excluded!)
  assert.equal(summary.grossCashTopupsUsd, 26);
  assert.equal(summary.netCashProfitUsd, 26);

  // Free credits issued = $50 + $20 (granted promos) + $100 (redeemed voucher) = $170
  assert.equal(summary.freeCreditsIssuedUsd, 170);
  // Redeemed vouchers tracked separately as non-cash credits
  assert.equal(summary.nonCashCreditsGrantedUsd, 100);
  // Promo credits absorbed by plan purchases = $19 + $31 = $50
  assert.equal(summary.freeCreditsUsedUsd, 50);
  // Real cash wallet credit recognized on plans = $0 + $18 = $18
  assert.equal(summary.subscriptionCashRecognizedUsd, 18);
  // Unspent cash wallet liability = $26 paid topups - $18 cash used = $8
  assert.equal(summary.unspentCashWalletLiabilityUsd, 8);
  assert.equal(summary.allTime.walletCashCreditsUsd, 108);
  assert.equal(summary.allTime.walletPromoCreditsUsd, 20);

  // Daily series buckets match exact day splits
  assert.equal(summary.series.length, 2);
  assert.deepEqual(
    {
      cashTopupsUsd: summary.series[0].cashTopupsUsd,
      cashUsedUsd: summary.series[0].cashUsedUsd,
      promoUsedUsd: summary.series[0].promoUsedUsd
    },
    { cashTopupsUsd: 1, cashUsedUsd: 0, promoUsedUsd: 19 }
  );
  assert.deepEqual(
    {
      cashTopupsUsd: summary.series[1].cashTopupsUsd,
      cashUsedUsd: summary.series[1].cashUsedUsd,
      promoUsedUsd: summary.series[1].promoUsedUsd
    },
    { cashTopupsUsd: 25, cashUsedUsd: 18, promoUsedUsd: 31 }
  );
});

test('cash refunds reduce netCashProfitUsd without touching free credit metrics', () => {
  const summary = computePlatformFinancialSummary({
    topups: [
      { id: 't1', amount: 100, status: 'paid', provider: 'stripe', paid_at: '2026-11-10T10:00:00Z' },
      { id: 't2', amount: 20, status: 'refunded', provider: 'stripe', paid_at: '2026-11-10T11:00:00Z' }
    ],
    promoClaims: [
      { id: 1, amount_usd: 50, status: 'granted', created_at: '2026-11-10T10:00:00Z' }
    ]
  });

  assert.equal(summary.grossCashTopupsUsd, 100);
  assert.equal(summary.cashRefundsUsd, 20);
  assert.equal(summary.netCashProfitUsd, 80);
  assert.equal(summary.freeCreditsIssuedUsd, 50);
});

test('computeStoreTierBreakdown accurately separates free, paid, active, grace_period, and suspended stores', () => {
  const stores = [
    { tiwiId: 'TIW-1', planId: 'free', status: 'active', lifecycleStatus: 'active' },
    { tiwiId: 'TIW-2', planId: 'free', status: 'suspended', lifecycleStatus: 'suspended' },
    { tiwiId: 'TIW-3', planId: 'growth', status: 'active', lifecycleStatus: 'active' },
    { tiwiId: 'TIW-4', planId: 'growth', status: 'active', lifecycleStatus: 'grace_period' },
    { tiwiId: 'TIW-5', planId: 'pro', status: 'suspended', lifecycleStatus: 'suspended' },
    { tiwiId: 'TIW-6', planId: 'enterprise', status: 'active', lifecycleStatus: 'active' },
    { tiwiId: 'TIW-DEL', planId: 'free', status: 'deleted' }
  ];
  const customDomains = [
    { id: 'd1', domain: 'shop1.com', status: 'active' },
    { id: 'd2', domain: 'shop2.com', status: 'pending_verification' }
  ];
  const freeSubdomains = [
    { id: 'f1', subdomain: 'alpha', status: 'active' },
    { id: 'f2', subdomain: 'beta', status: 'suspended' },
    { id: 'f3', subdomain: 'old', status: 'released' }
  ];

  const breakdown = computeStoreTierBreakdown(stores, customDomains, freeSubdomains);
  assert.equal(breakdown.totalStores, 6);
  assert.equal(breakdown.freeStores, 2);
  assert.equal(breakdown.paidStores, 4);
  assert.equal(breakdown.activeStores, 3);
  assert.equal(breakdown.gracePeriodStores, 1);
  assert.equal(breakdown.suspendedStores, 2);
  assert.equal(breakdown.customDomainsCount, 2);
  assert.equal(breakdown.freeSubdomainsCount, 2);

  const byId = new Map(breakdown.byPlan.map((p) => [p.planId, p]));
  assert.deepEqual(byId.get('free'), {
    planId: 'free',
    planName: 'Free Starter',
    count: 2,
    activeCount: 1,
    graceCount: 0,
    suspendedCount: 1
  });
  assert.deepEqual(byId.get('growth'), {
    planId: 'growth',
    planName: 'Growth Retailer',
    count: 2,
    activeCount: 1,
    graceCount: 1,
    suspendedCount: 0
  });
  assert.deepEqual(byId.get('pro'), {
    planId: 'pro',
    planName: 'Pro Business',
    count: 1,
    activeCount: 0,
    graceCount: 0,
    suspendedCount: 1
  });
  assert.deepEqual(byId.get('enterprise'), {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    count: 1,
    activeCount: 1,
    graceCount: 0,
    suspendedCount: 0
  });
});
