import React from 'react';
import {
  TrendingUp,
  Wallet,
  Gift,
  Store,
  Receipt,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

function readMetricNumber(metrics, ...keys) {
  if (!metrics) return null;
  for (const key of keys) {
    const raw = metrics[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'object' && raw !== null) {
      const candidate = raw.usd ?? raw.amountUsd ?? raw.count ?? raw.raw ?? raw.value;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && String(raw).trim() !== '') return parsed;
  }
  return null;
}

export default function MetricCards({ metrics, onNavigate }) {
  const { formatMoneyParts, formatMoney } = useAdminCurrency();

  const netCashProfitUsd = readMetricNumber(metrics, 'netCashProfitUsd', 'netProfitUsd');
  const grossCashTopupsUsd = readMetricNumber(metrics, 'grossCashTopupsUsd', 'grossTopupsUsd');
  const unspentWalletUsd = readMetricNumber(
    metrics,
    'unspentWalletLiabilityUsd',
    'unspentWalletUsd',
    'walletLiabilityUsd'
  );
  const freeIssuedUsd = readMetricNumber(metrics, 'freeCreditsIssuedUsd', 'promoCreditsIssuedUsd');
  const freeUsedUsd = readMetricNumber(metrics, 'freeCreditsUsedUsd', 'promoCreditsUsedUsd');

  const totalStores = readMetricNumber(metrics, 'totalStores');
  const freeStores = readMetricNumber(metrics, 'freeStores');
  const paidStores = readMetricNumber(metrics, 'paidStores');
  const graceOrSuspendedStores = readMetricNumber(
    metrics,
    'graceOrSuspendedStores',
    'graceAndSuspendedStores'
  );
  const graceStores = readMetricNumber(metrics, 'gracePeriodStores', 'graceStores');
  const suspendedStores = readMetricNumber(metrics, 'suspendedStores');
  const computedGraceSusp =
    graceOrSuspendedStores ??
    (graceStores != null || suspendedStores != null
      ? Number(graceStores || 0) + Number(suspendedStores || 0)
      : null);

  const totalSystemOrders = readMetricNumber(metrics, 'totalSystemOrders', 'systemOrdersCount');
  const upgradesCount = readMetricNumber(metrics, 'upgradeOrdersCount');
  const topupsCount = readMetricNumber(metrics, 'topupOrdersCount');
  const addonsCount = readMetricNumber(metrics, 'addonOrdersCount');

  const flaggedRiskUsers = readMetricNumber(metrics, 'flaggedRiskUsers', 'flaggedUsersCount');
  const banEvasionRiskCount = readMetricNumber(metrics, 'banEvasionRiskCount', 'clusterAlertsCount');
  const totalRiskAlerts =
    flaggedRiskUsers != null || banEvasionRiskCount != null
      ? Number(flaggedRiskUsers || 0) + Number(banEvasionRiskCount || 0)
      : null;

  const netProfitMoney = formatMoneyParts(netCashProfitUsd);
  const grossTopupsMoney = formatMoneyParts(grossCashTopupsUsd);
  const freeIssuedMoney = formatMoneyParts(freeIssuedUsd);

  const systemOrdersSub =
    upgradesCount != null || topupsCount != null || addonsCount != null
      ? `Upgrades: ${upgradesCount ?? 0} · Top-ups: ${topupsCount ?? 0} · Add-ons: ${addonsCount ?? 0}`
      : 'Upgrades, wallet top-ups & add-ons';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* 1. Net Cash Profit */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block">
              Net Cash Profit
            </span>
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]">
              Free Credits Excluded
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760] flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
            {netProfitMoney.primary}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {netProfitMoney.usdReference
              ? `${netProfitMoney.usdReference} USD · Realized cash revenue`
              : 'Realized cash revenue minus refunds & fees'}
          </p>
        </div>
      </div>

      {/* 2. Gross Cash Top-ups */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Gross Cash Top-ups
          </span>
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
            {grossTopupsMoney.primary}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {grossTopupsMoney.usdReference ? `${grossTopupsMoney.usdReference} · ` : ''}
            Unspent wallet liability:{' '}
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              {formatMoney(unspentWalletUsd)}
            </span>
          </p>
        </div>
      </div>

      {/* 3. Free & Promo Subsidized */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block">
              Free & Promo Subsidized
            </span>
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/12 text-amber-700 dark:text-amber-300">
              Excluded from profit
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
            {freeIssuedMoney.primary}
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {freeIssuedMoney.usdReference ? `${freeIssuedMoney.usdReference} issued · ` : 'Issued · '}
            Used:{' '}
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              {formatMoney(freeUsedUsd)}
            </span>
          </p>
        </div>
      </div>

      {/* 4. Stores: Free vs Paid */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Stores: Free vs Paid
          </span>
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
            {totalStores != null ? totalStores.toLocaleString('en-US') : '—'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
              Free: {freeStores != null ? freeStores.toLocaleString('en-US') : '—'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]">
              Paid: {paidStores != null ? paidStores.toLocaleString('en-US') : '—'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Grace/Susp: {computedGraceSusp != null ? computedGraceSusp.toLocaleString('en-US') : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. System Orders */}
      <button
        type="button"
        onClick={() => onNavigate?.('orders')}
        className="text-left bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 hover:border-[#1ED760]/60 transition-colors flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between gap-2 mb-3 w-full">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            System Orders
          </span>
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 group-hover:bg-[#1ED760]/15 group-hover:text-[#159f46] dark:group-hover:text-[#1ED760] flex items-center justify-center shrink-0 transition-colors">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="w-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
              {totalSystemOrders != null ? totalSystemOrders.toLocaleString('en-US') : '—'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-[#159f46] dark:group-hover:text-[#1ED760] transition-colors" />
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums truncate">
            {systemOrdersSub}
          </p>
        </div>
      </button>

      {/* 6. Risk & Cluster Alerts */}
      <button
        type="button"
        onClick={() => onNavigate?.('users')}
        className="text-left bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 hover:border-rose-500/50 transition-colors flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between gap-2 mb-3 w-full">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Risk & Cluster Alerts
          </span>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              totalRiskAlerts > 0
                ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="w-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white tracking-tight">
              {totalRiskAlerts != null ? totalRiskAlerts.toLocaleString('en-US') : '—'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-rose-500 transition-colors" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums bg-rose-500/10 text-rose-700 dark:text-rose-300">
              Flagged: {flaggedRiskUsers != null ? flaggedRiskUsers.toLocaleString('en-US') : '—'}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Cluster/Evasion: {banEvasionRiskCount != null ? banEvasionRiskCount.toLocaleString('en-US') : '—'}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
