import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  Gift,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const FILTER_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'topup', label: 'Cash Top-ups' },
  { id: 'upgrade', label: 'Store Upgrades' },
  { id: 'creation', label: 'Store Creations' },
  { id: 'renewal', label: 'Renewals' },
  { id: 'addon', label: 'Add-ons' },
  { id: 'promo', label: 'Free/Promo & Vouchers' },
];

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeOrderType(order) {
  const raw = String(order?.type || order?.orderType || order?.category || '').toLowerCase();
  const orderNum = String(order?.orderNumber || order?.orderNo || order?.id || '').toLowerCase();
  if (raw.includes('topup') || raw.includes('deposit') || orderNum.startsWith('topup_')) return 'topup';
  if (raw.includes('upgrade')) return 'upgrade';
  if (raw.includes('creat') || raw.includes('new_store')) return 'creation';
  if (raw.includes('renew')) return 'renewal';
  if (raw.includes('addon') || raw.includes('add_on') || raw.includes('add-on')) return 'addon';
  if (
    raw.includes('promo') ||
    raw.includes('voucher') ||
    raw.includes('gift') ||
    raw.includes('free') ||
    (toNum(order?.freeCreditUsedUsd ?? order?.freeCreditUsed ?? order?.promoCreditUsed) > 0 &&
      toNum(order?.paidCashUsd ?? order?.paidCash ?? order?.cashPaidUsd) <= 0)
  ) {
    return 'promo';
  }
  return raw || 'order';
}

function getTypeLabel(normType, rawType) {
  switch (normType) {
    case 'topup':
      return 'Cash Top-up';
    case 'upgrade':
      return 'Store Upgrade';
    case 'creation':
      return 'Store Creation';
    case 'renewal':
      return 'Renewal';
    case 'addon':
      return 'Add-on';
    case 'promo':
      return 'Free / Promo';
    default:
      return rawType || 'Order';
  }
}

function getStatusPillClass(status) {
  const s = String(status || '').toLowerCase();
  if (['paid', 'completed', 'active', 'succeeded', 'settled', 'granted'].includes(s)) {
    return 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30';
  }
  if (['pending', 'processing', 'open', 'initiated'].includes(s)) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25';
  }
  if (['failed', 'cancelled', 'expired', 'refunded', 'rejected'].includes(s)) {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';
  }
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

function formatOriginalAmount(amount, currencyCode) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const code = String(currencyCode || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

export default function AdminSystemOrdersView({ onBackToDashboard }) {
  const currencyCtx = useAdminCurrency();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [reloadTick, setReloadTick] = useState(0);

  const formatMoney = useCallback((amountUsd, options) => {
    if (typeof currencyCtx?.formatMoney === 'function') {
      return currencyCtx.formatMoney(amountUsd, options);
    }
    const n = Number(amountUsd || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  }, [currencyCtx]);

  useEffect(() => {
    let active = true;
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const res = await fetch(`${API_BASE}/admin/orders`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Failed to fetch system orders (${res.status}).`);
        }
        if (!active) return;
        const list = Array.isArray(data.orders) ? data.orders : [];
        setOrders(list);
        setSummary(data.summary || data.reconciliation || null);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Could not load system orders.');
        setOrders([]);
        setSummary(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrders();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  };

  const normalizedOrders = useMemo(() => {
    return orders.map((o, idx) => {
      const normType = normalizeOrderType(o);
      const orderNumber = o.orderNumber || o.orderNo || o.reference || o.id || `ROW-${idx + 1}`;
      const createdAt = o.createdAt || o.paidAt || o.date || null;
      const merchantEmail = o.merchantEmail || o.userEmail || o.email || '';
      const merchantName = o.merchantName || o.userName || o.customer || '';
      const storeName = o.storeName || o.store || '';
      const planOrItem = o.planName || o.itemName || o.item || o.description || o.planId || '—';
      const paidCash = toNum(
        o.paidCashUsd ?? o.cashPaidUsd ?? o.paidCash ?? (normType === 'topup' ? o.amountUsd ?? o.amount ?? o.total : o.cashAmountUsd ?? o.total),
        0
      );
      const freeCreditUsed = toNum(
        o.freeCreditUsedUsd ?? o.promoCreditUsedUsd ?? o.freeCreditUsed ?? o.promoAmountUsd ?? 0,
        0
      );
      const netProfit = o.netProfitUsd != null || o.netProfit != null
        ? toNum(o.netProfitUsd ?? o.netProfit, 0)
        : paidCash;
      const provider = o.provider || o.gateway || o.paymentMethod || (freeCreditUsed > 0 && paidCash === 0 ? 'Promo Credit' : 'Wallet');
      const originalCurrency = o.originalCurrency || o.providerCurrency || o.currency || 'USD';
      const originalAmount = o.originalAmount ?? o.providerAmount ?? (originalCurrency === 'USD' ? (paidCash || o.amount || o.total) : null);
      const status = o.status || 'Unknown';

      return {
        raw: o,
        key: o.rowKey || `${orderNumber}:${idx}`,
        orderNumber,
        createdAt,
        merchantEmail,
        merchantName,
        storeName,
        normType,
        typeLabel: getTypeLabel(normType, o.typeLabel || o.type),
        planOrItem,
        paidCash,
        freeCreditUsed,
        netProfit,
        provider,
        originalCurrency,
        originalAmount,
        status,
      };
    });
  }, [orders]);

  const reconciliation = useMemo(() => {
    if (summary && typeof summary === 'object') {
      return {
        grossCashDeposits: toNum(
          summary.grossCashDepositsUsd ?? summary.grossCashDeposits ?? summary.grossDepositsUsd ?? summary.grossTopupsUsd,
          0
        ),
        paidPlanRecognized: toNum(
          summary.paidPlanRecognizedUsd ?? summary.paidPlanRecognized ?? summary.planRevenueUsd ?? summary.recognizedPlanUsd,
          0
        ),
        freeCreditsUsed: toNum(
          summary.freeCreditsUsedUsd ?? summary.freePromoCreditsUsedUsd ?? summary.freeCreditsUsed ?? summary.promoCreditsUsedUsd,
          0
        ),
        realNetCashProfit: toNum(
          summary.realNetCashProfitUsd ?? summary.realNetCashProfit ?? summary.netCashProfitUsd ?? summary.netProfitUsd,
          0
        ),
      };
    }

    let grossCashDeposits = 0;
    let paidPlanRecognized = 0;
    let freeCreditsUsed = 0;
    let realNetCashProfit = 0;

    for (const item of normalizedOrders) {
      const s = String(item.status || '').toLowerCase();
      const isCancelledOrFailed = ['failed', 'cancelled', 'expired', 'refunded', 'rejected'].includes(s);
      if (!isCancelledOrFailed) {
        if (item.normType === 'topup') {
          grossCashDeposits += item.paidCash;
        }
        if (['upgrade', 'creation', 'renewal', 'addon'].includes(item.normType)) {
          paidPlanRecognized += item.paidCash;
        }
        freeCreditsUsed += item.freeCreditUsed;
        realNetCashProfit += item.netProfit;
      }
    }

    return {
      grossCashDeposits,
      paidPlanRecognized,
      freeCreditsUsed,
      realNetCashProfit,
    };
  }, [summary, normalizedOrders]);

  const filterCounts = useMemo(() => {
    const counts = { all: normalizedOrders.length };
    for (const pill of FILTER_PILLS) {
      if (pill.id !== 'all') counts[pill.id] = 0;
    }
    for (const item of normalizedOrders) {
      if (counts[item.normType] !== undefined) {
        counts[item.normType] += 1;
      }
    }
    return counts;
  }, [normalizedOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return normalizedOrders.filter((item) => {
      if (activeFilter !== 'all' && item.normType !== activeFilter) {
        return false;
      }
      if (!q) return true;
      return [
        item.orderNumber,
        item.merchantEmail,
        item.merchantName,
        item.storeName,
        item.provider,
        item.planOrItem,
        item.status,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [normalizedOrders, activeFilter, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              System Orders &amp; Revenue Reconciliation
            </h1>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {normalizedOrders.length} Records
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Track real cash top-ups, plan upgrades, store creations, renewals, add-ons, and non-revenue promo credits.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Financial Reconciliation Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Gross Cash Deposits (Top-ups)
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <Wallet className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {formatMoney(reconciliation.grossCashDeposits)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Settled wallet top-ups</p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Paid Plan Recognized
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <Receipt className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {formatMoney(reconciliation.paidPlanRecognized)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Upgrades, creations, renewals &amp; add-ons</p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Free/Promo Credits Used (Not in Profit)
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Gift className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
            {formatMoney(reconciliation.freeCreditsUsed)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Excluded from net profit</p>
        </div>

        <div className="rounded-xl border border-[#1ED760]/40 bg-white p-4 dark:border-[#1ED760]/30 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Real Net Cash Profit
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-[#1ED760]">
            {formatMoney(reconciliation.realNetCashProfit)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Actual cash revenue after promo deductions</p>
        </div>
      </div>

      {/* Filters & Table Card */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Order # (ORD-... / topup_...), email, store name, provider..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-[#1ED760]"
              />
            </div>

            <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              Showing {filteredOrders.length} of {normalizedOrders.length} orders
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilter(pill.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    isActive
                      ? 'border-[#1ED760] bg-[#1ED760] text-black font-semibold'
                      : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`rounded px-1 text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-black/15 text-black'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {filterCounts[pill.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                <th className="px-4 py-3">Order #</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Tiwlo User / Service</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Plan / Item</th>
                <th className="px-3 py-3 text-right">Paid Cash</th>
                <th className="px-3 py-3 text-right">Free Credit Used</th>
                <th className="px-3 py-3 text-right">Net Profit</th>
                <th className="px-3 py-3">Gateway / Original Currency</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-neutral-500">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-neutral-400" />
                    Loading live system orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-neutral-500">
                    <BadgeDollarSign className="mx-auto mb-2 h-6 w-6 text-neutral-300 dark:text-neutral-700" />
                    No orders match the current filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const origFormatted = formatOriginalAmount(order.originalAmount, order.originalCurrency);
                  return (
                    <tr
                      key={order.key}
                      className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-neutral-900 dark:text-white">
                        {order.orderNumber}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {order.merchantName || order.merchantEmail || '—'}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {[order.merchantEmail, order.storeName].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          {order.typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                        {order.planOrItem}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-neutral-900 dark:text-white">
                        {formatMoney(order.paidCash)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {order.freeCreditUsed > 0 ? formatMoney(order.freeCreditUsed) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                        {formatMoney(order.netProfit)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium capitalize text-neutral-800 dark:text-neutral-200">
                          {order.provider}
                        </div>
                        <div className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                          {origFormatted || order.originalCurrency}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusPillClass(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
