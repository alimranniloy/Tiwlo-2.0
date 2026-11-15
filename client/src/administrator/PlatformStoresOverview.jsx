import React from 'react';
import { Store, ArrowRight, Globe, Clock, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const DEFAULT_PLAN_LABELS = {
  free: 'Free Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise'
};

export default function PlatformStoresOverview({ data, onViewDetails }) {
  const { formatMoney } = useAdminCurrency();

  const freeStores = data?.freeStores ?? data?.freeCount ?? null;
  const paidStores = data?.paidStores ?? data?.paidCount ?? null;
  const graceStores = data?.gracePeriodStores ?? data?.graceStores ?? data?.graceCount ?? null;
  const suspendedStores = data?.suspendedStores ?? data?.suspendedCount ?? null;
  const customDomains = data?.customDomains ?? data?.customDomainCount ?? null;
  const freeSubdomains = data?.freeSubdomains ?? data?.subdomainCount ?? null;

  const planRows = Array.isArray(data?.planBreakdown)
    ? data.planBreakdown
    : Array.isArray(data?.plans)
      ? data.plans
      : [];

  const totalFromBreakdown = planRows.reduce((sum, row) => sum + (Number(row.count ?? row.stores ?? 0) || 0), 0);
  const totalStores =
    data?.totalStores ??
    (freeStores != null && paidStores != null
      ? Number(freeStores) + Number(paidStores) + Number(graceStores || 0) + Number(suspendedStores || 0)
      : totalFromBreakdown || null);

  const summaryTiles = [
    {
      label: 'Free Stores',
      value: freeStores,
      icon: Sparkles,
      badgeClass: 'text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-900'
    },
    {
      label: 'Paid Stores',
      value: paidStores,
      icon: CheckCircle2,
      badgeClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
    },
    {
      label: 'Grace Period (3d)',
      value: graceStores,
      icon: Clock,
      badgeClass: 'text-amber-700 dark:text-amber-300 bg-amber-500/10'
    },
    {
      label: 'Suspended (180d)',
      value: suspendedStores,
      icon: AlertTriangle,
      badgeClass: 'text-rose-700 dark:text-rose-300 bg-rose-500/10'
    },
    {
      label: 'Custom Domains',
      value: customDomains,
      icon: Globe,
      badgeClass: 'text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900'
    },
    {
      label: 'Free Subdomains',
      value: freeSubdomains,
      icon: Store,
      badgeClass: 'text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900'
    }
  ];

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200/70 dark:border-neutral-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760] flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              Platform Stores Overview
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {totalStores != null
                ? `${Number(totalStores).toLocaleString('en-US')} total tenant storefronts`
                : 'Tenant storefront distribution & domain mix'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewDetails}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1ED760] hover:bg-[#19c354] text-black transition-colors shrink-0"
        >
          <span>Manage Stores</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 6 Store Status & Domain Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
        {summaryTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="p-3 rounded-lg bg-[#fafafa] dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                  {tile.label}
                </span>
                <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${tile.badgeClass}`}>
                  <Icon className="w-3 h-3" />
                </span>
              </div>
              <div className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                {tile.value != null ? Number(tile.value).toLocaleString('en-US') : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-plan Breakdown Table */}
      <div className="mt-4 pt-4 border-t border-neutral-200/70 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            Plan Distribution
          </h4>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Live tiers</span>
        </div>

        {planRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/70 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 px-2 text-right">Stores</th>
                  <th className="py-2 px-2 text-right">Share</th>
                  <th className="py-2 pl-2 text-right">Monthly Run-Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                {planRows.map((row) => {
                  const key = String(row.planId || row.id || row.name || '').toLowerCase();
                  const label = row.name || row.planName || DEFAULT_PLAN_LABELS[key] || row.planId || 'Plan';
                  const count = Number(row.count ?? row.stores ?? 0);
                  const share =
                    row.percentage != null
                      ? Number(row.percentage)
                      : totalStores > 0
                        ? (count / totalStores) * 100
                        : 0;
                  const mrrUsd = row.mrrUsd ?? row.revenueUsd ?? null;

                  return (
                    <tr key={label} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                      <td className="py-2 pr-3 font-medium text-neutral-800 dark:text-neutral-200">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              key === 'free'
                                ? 'bg-neutral-400'
                                : key === 'growth'
                                  ? 'bg-[#1ED760]'
                                  : key === 'pro'
                                    ? 'bg-emerald-600'
                                    : 'bg-neutral-900 dark:bg-white'
                            }`}
                          />
                          <span className="truncate">{label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {count.toLocaleString('en-US')}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
                        {share.toFixed(1)}%
                      </td>
                      <td className="py-2 pl-2 text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                        {mrrUsd != null ? formatMoney(mrrUsd) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
            {data ? 'No plan breakdown available yet.' : 'Loading store plan breakdown…'}
          </div>
        )}
      </div>
    </div>
  );
}
