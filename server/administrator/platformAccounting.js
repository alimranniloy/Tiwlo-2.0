import { formatPeriodLabel } from './adminAnalytics.js';

const DEFAULT_PLAN_NAMES = Object.freeze({
  free: 'Free Starter',
  growth: 'Growth Retailer',
  pro: 'Pro Business',
  enterprise: 'Enterprise VIP'
});

const PLAN_ORDER = ['free', 'growth', 'pro', 'enterprise'];

function roundUsd(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function toTimestampMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function inWindow(tsMs, startMs, endMs) {
  if (startMs === null || endMs === null) return true;
  return tsMs !== null && tsMs >= startMs && tsMs < endMs;
}

function isNonCashGrantOrder(orderType) {
  const normalized = String(orderType || '').trim().toLowerCase();
  return normalized === 'promo_grant' || normalized === 'voucher_redeem';
}

function computeWindowMetrics({
  topups = [],
  billingOrders = [],
  promoClaims = [],
  redeemedVouchers = [],
  startMs = null,
  endMs = null
}) {
  let grossCashTopupsUsd = 0;
  let cashRefundsUsd = 0;
  let paidTopupCount = 0;
  const providerTotals = new Map();

  for (const topup of topups) {
    if (!topup) continue;
    const status = String(topup.status || '').trim().toLowerCase();
    const ts = toTimestampMs(topup.paid_at || topup.paidAt || topup.created_at || topup.createdAt);
    if (!inWindow(ts, startMs, endMs)) continue;

    if (status === 'paid') {
      const amount = Math.max(0, Number(topup.amount || 0));
      grossCashTopupsUsd += amount;
      paidTopupCount += 1;
      const provider = String(topup.provider || 'unknown').trim().toLowerCase() || 'unknown';
      const entry = providerTotals.get(provider) || { provider, amountUsd: 0, count: 0 };
      entry.amountUsd += amount;
      entry.count += 1;
      providerTotals.set(provider, entry);
    } else if (status === 'refunded') {
      const refund = Math.max(0, Number(topup.refunded_amount ?? topup.refundedAmount ?? topup.amount ?? 0));
      cashRefundsUsd += refund;
    }
  }

  let subscriptionCashRecognizedUsd = 0;
  let freeCreditsUsedUsd = 0;
  let planOrdersCount = 0;
  let totalBillingOrdersCount = 0;

  for (const order of billingOrders) {
    if (!order) continue;
    const ts = toTimestampMs(order.created_at || order.createdAt);
    if (!inWindow(ts, startMs, endMs)) continue;

    const status = String(order.status || 'paid').trim().toLowerCase();
    const orderType = String(order.order_type || order.orderType || '').trim().toLowerCase();

    if (status === 'refunded' || orderType === 'cash_refund') {
      const refund = Math.max(
        0,
        Number(order.refund_amount_usd ?? order.refundAmountUsd ?? order.net_cash_revenue_usd ?? order.gross_amount_usd ?? 0)
      );
      cashRefundsUsd += refund;
      continue;
    }

    if (status !== 'paid') continue;

    totalBillingOrdersCount += 1;
    if (!isNonCashGrantOrder(orderType)) {
      planOrdersCount += 1;
    }
    subscriptionCashRecognizedUsd += Math.max(
      0,
      Number(order.cash_credit_used_usd ?? order.cashCreditUsedUsd ?? 0)
    );
    freeCreditsUsedUsd += Math.max(
      0,
      Number(order.promo_credit_used_usd ?? order.promoCreditUsedUsd ?? 0)
    );
  }

  let promoGrantsUsd = 0;
  let promoGrantsCount = 0;
  for (const claim of promoClaims) {
    if (!claim) continue;
    const status = String(claim.status || 'granted').trim().toLowerCase();
    if (status === 'rejected') continue;
    const ts = toTimestampMs(claim.created_at || claim.createdAt);
    if (!inWindow(ts, startMs, endMs)) continue;
    promoGrantsUsd += Math.max(0, Number(claim.amount_usd ?? claim.amountUsd ?? 0));
    promoGrantsCount += 1;
  }

  let redeemedVouchersUsd = 0;
  let redeemedVouchersCount = 0;
  for (const voucher of redeemedVouchers) {
    if (!voucher) continue;
    const isRedeemed =
      voucher.is_redeemed === true ||
      voucher.isRedeemed === true ||
      String(voucher.is_redeemed ?? voucher.isRedeemed ?? '').toLowerCase() === 'true';
    if (!isRedeemed) continue;
    const ts = toTimestampMs(voucher.redeemed_at || voucher.redeemedAt || voucher.created_at || voucher.createdAt);
    if (!inWindow(ts, startMs, endMs)) continue;
    redeemedVouchersUsd += Math.max(0, Number(voucher.amount ?? voucher.amountUsd ?? 0));
    redeemedVouchersCount += 1;
  }

  const roundedGrossCashTopups = roundUsd(grossCashTopupsUsd);
  const roundedCashRefunds = roundUsd(cashRefundsUsd);
  const netCashProfitUsd = roundUsd(roundedGrossCashTopups - roundedCashRefunds);
  const freeCreditsIssuedUsd = roundUsd(promoGrantsUsd + redeemedVouchersUsd);

  return {
    grossCashTopupsUsd: roundedGrossCashTopups,
    cashRefundsUsd: roundedCashRefunds,
    netCashProfitUsd,
    subscriptionCashRecognizedUsd: roundUsd(subscriptionCashRecognizedUsd),
    freeCreditsIssuedUsd,
    freeCreditsUsedUsd: roundUsd(freeCreditsUsedUsd),
    nonCashCreditsGrantedUsd: roundUsd(redeemedVouchersUsd),
    promoGrantsUsd: roundUsd(promoGrantsUsd),
    redeemedVouchersUsd: roundUsd(redeemedVouchersUsd),
    paidTopupCount,
    planOrdersCount,
    totalBillingOrdersCount,
    totalSystemOrdersCount: paidTopupCount + planOrdersCount + promoGrantsCount + redeemedVouchersCount,
    revenueByProvider: [...providerTotals.values()]
      .map((entry) => ({
        provider: entry.provider,
        amountUsd: roundUsd(entry.amountUsd),
        count: entry.count
      }))
      .sort((a, b) => b.amountUsd - a.amountUsd)
  };
}

/**
 * Pure platform accounting calculator.
 * Strictly separates verified real cash deposits (cloud_credit_topups) from
 * promotional gifts and redeemed vouchers so free credits never inflate cash revenue or profit.
 */
export function computePlatformFinancialSummary({
  topups = [],
  billingOrders = [],
  promoClaims = [],
  redeemedVouchers = [],
  billingAccounts = [],
  periodStart = null,
  periodEnd = null,
  previousStart = null,
  previousEnd = null,
  bucketStarts = [],
  bucketUnit = 'day',
  now = new Date()
} = {}) {
  const safeTopups = Array.isArray(topups) ? topups : [];
  const safeOrders = Array.isArray(billingOrders) ? billingOrders : [];
  const safeClaims = Array.isArray(promoClaims) ? promoClaims : [];
  const safeVouchers = Array.isArray(redeemedVouchers) ? redeemedVouchers : [];
  const safeAccounts = Array.isArray(billingAccounts) ? billingAccounts : [];

  const startMs = toTimestampMs(periodStart);
  const endMs = toTimestampMs(periodEnd);
  const prevStartMs = toTimestampMs(previousStart);
  const prevEndMs = toTimestampMs(previousEnd);
  const nowMs = toTimestampMs(now) ?? Date.now();

  const period = computeWindowMetrics({
    topups: safeTopups,
    billingOrders: safeOrders,
    promoClaims: safeClaims,
    redeemedVouchers: safeVouchers,
    startMs,
    endMs
  });

  const previousPeriod = prevStartMs !== null && prevEndMs !== null
    ? computeWindowMetrics({
        topups: safeTopups,
        billingOrders: safeOrders,
        promoClaims: safeClaims,
        redeemedVouchers: safeVouchers,
        startMs: prevStartMs,
        endMs: prevEndMs
      })
    : null;

  const allTimeBase = computeWindowMetrics({
    topups: safeTopups,
    billingOrders: safeOrders,
    promoClaims: safeClaims,
    redeemedVouchers: safeVouchers,
    startMs: null,
    endMs: null
  });

  let walletCashCreditsUsd = 0;
  let walletPromoCreditsUsd = 0;
  for (const acct of safeAccounts) {
    if (!acct) continue;
    walletCashCreditsUsd += Math.max(0, Number(acct.credits || 0));
    const promoExpMs = toTimestampMs(acct.promotional_expires_at || acct.promotionalExpiresAt);
    if (promoExpMs === null || promoExpMs > nowMs) {
      walletPromoCreditsUsd += Math.max(0, Number(acct.promotional_credits ?? acct.promotionalCredits ?? 0));
    }
  }

  const unspentCashWalletLiabilityUsd = Math.max(
    0,
    roundUsd(allTimeBase.grossCashTopupsUsd - allTimeBase.subscriptionCashRecognizedUsd)
  );

  const allTime = {
    ...allTimeBase,
    unspentCashWalletLiabilityUsd,
    walletCashCreditsUsd: roundUsd(walletCashCreditsUsd),
    walletPromoCreditsUsd: roundUsd(walletPromoCreditsUsd)
  };

  const series = (Array.isArray(bucketStarts) ? bucketStarts : []).map((bucketStartRaw, index) => {
    const bStart = new Date(bucketStartRaw);
    const nextStartRaw = bucketStarts[index + 1] || periodEnd;
    const bEnd = nextStartRaw ? new Date(nextStartRaw) : new Date(bStart.getTime() + 24 * 60 * 60 * 1000);
    const bStartMs = bStart.getTime();
    const bEndMs = bEnd.getTime();

    const bucketMetrics = computeWindowMetrics({
      topups: safeTopups,
      billingOrders: safeOrders,
      promoClaims: safeClaims,
      redeemedVouchers: safeVouchers,
      startMs: bStartMs,
      endMs: bEndMs
    });

    return {
      label: formatPeriodLabel(bStart, bucketUnit, bEnd),
      cashTopupsUsd: bucketMetrics.grossCashTopupsUsd,
      cashUsedUsd: bucketMetrics.subscriptionCashRecognizedUsd,
      promoUsedUsd: bucketMetrics.freeCreditsUsedUsd,
      orders: bucketMetrics.totalSystemOrdersCount
    };
  });

  return {
    ...period,
    unspentCashWalletLiabilityUsd,
    period,
    previousPeriod,
    allTime,
    series
  };
}

/**
 * Pure store tier & domain breakdown calculator.
 */
export function computeStoreTierBreakdown(
  stores = [],
  customDomains = [],
  freeSubdomains = [],
  subscriptions = []
) {
  const safeStores = (Array.isArray(stores) ? stores : []).filter(
    (s) => s && String(s.status || 'active').trim().toLowerCase() !== 'deleted'
  );
  const safeCustomDomains = Array.isArray(customDomains) ? customDomains : [];
  const safeFreeSubdomains = (Array.isArray(freeSubdomains) ? freeSubdomains : []).filter(
    (d) => d && String(d.status || 'active').trim().toLowerCase() !== 'released'
  );
  const subByTiwi = new Map(
    (Array.isArray(subscriptions) ? subscriptions : [])
      .filter((s) => s?.tiwiId)
      .map((s) => [String(s.tiwiId), s])
  );

  let freeStores = 0;
  let paidStores = 0;
  let activeStores = 0;
  let gracePeriodStores = 0;
  let suspendedStores = 0;
  const planMap = new Map();

  for (const store of safeStores) {
    const tiwiId = String(store.tiwiId || store.storeId || '');
    const sub = subByTiwi.get(tiwiId) || store.subscription || null;
    const planId = String(sub?.planId || store.planId || 'free').trim().toLowerCase() || 'free';
    const planName = String(sub?.planName || store.planName || DEFAULT_PLAN_NAMES[planId] || planId).trim();

    const status = String(store.status || sub?.status || 'active').trim().toLowerCase();
    const lifecycleStatus = String(
      store.lifecycleStatus || sub?.lifecycleStatus || (status === 'suspended' ? 'suspended' : 'active')
    ).trim().toLowerCase();

    const isSuspended = status === 'suspended' || lifecycleStatus === 'suspended';
    const isGrace = !isSuspended && lifecycleStatus === 'grace_period';
    const isActive = !isSuspended && !isGrace;

    if (planId === 'free') {
      freeStores += 1;
    } else {
      paidStores += 1;
    }

    if (isSuspended) suspendedStores += 1;
    else if (isGrace) gracePeriodStores += 1;
    else activeStores += 1;

    const bucket = planMap.get(planId) || {
      planId,
      planName,
      count: 0,
      activeCount: 0,
      graceCount: 0,
      suspendedCount: 0
    };
    bucket.count += 1;
    if (isSuspended) bucket.suspendedCount += 1;
    else if (isGrace) bucket.graceCount += 1;
    else bucket.activeCount += 1;
    planMap.set(planId, bucket);
  }

  const byPlan = [...planMap.values()].sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.planId);
    const ib = PLAN_ORDER.indexOf(b.planId);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return b.count - a.count;
  });

  return {
    totalStores: safeStores.length,
    freeStores,
    paidStores,
    activeStores,
    gracePeriodStores,
    suspendedStores,
    customDomainsCount: safeCustomDomains.length,
    freeSubdomainsCount: safeFreeSubdomains.length,
    byPlan
  };
}
