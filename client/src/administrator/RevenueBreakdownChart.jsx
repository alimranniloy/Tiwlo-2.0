import React from 'react';
import { useAdminCurrency } from './AdminCurrencyContext';

const DEFAULT_PALETTE = ['#1ED760', '#0f172a', '#10b981', '#f59e0b', '#6366f1', '#64748b'];

export default function RevenueBreakdownChart({ breakdown }) {
  const { formatMoneyParts, formatMoney } = useAdminCurrency();

  const rawItems = Array.isArray(breakdown?.categories)
    ? breakdown.categories
    : Array.isArray(breakdown?.streams)
      ? breakdown.streams
      : Array.isArray(breakdown?.items)
        ? breakdown.items
        : [];

  const totalUsd =
    breakdown?.totalUsd ??
    breakdown?.total ??
    (rawItems.length
      ? rawItems.reduce((sum, item) => sum + (Number(item.amountUsd ?? item.amount ?? 0) || 0), 0)
      : null);

  const items = rawItems.map((item, idx) => {
    const amountUsd = Number(item.amountUsd ?? item.amount ?? 0) || 0;
    const pct =
      item.percentage != null
        ? Number(item.percentage)
        : totalUsd > 0
          ? (amountUsd / totalUsd) * 100
          : 0;
    return {
      name: item.name || item.label || `Stream ${idx + 1}`,
      amountUsd,
      percentage: Number.isFinite(pct) ? pct : 0,
      color: item.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
      isSubsidy: Boolean(item.isSubsidy || /free|promo|subsid/i.test(String(item.name || '')))
    };
  });

  const centerMoney = formatMoneyParts(totalUsd, { compact: true });

  const radius = 60;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between h-full">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Revenue &amp; Subsidy Mix
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Paid cash streams vs free credit subsidy
        </p>
      </div>

      <div className="flex flex-col items-center justify-center my-auto py-2">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="text-neutral-100 dark:text-neutral-900"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {items.map((cat, idx) => {
              const dashLength = Math.max(0, (cat.percentage / 100) * circumference);
              const accumulatedPercent = items
                .slice(0, idx)
                .reduce((total, category) => total + category.percentage, 0);
              const dashOffset = -(accumulatedPercent / 100) * circumference;

              return (
                <circle
                  key={cat.name + idx}
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke={cat.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${Math.max(0, circumference - dashLength)}`}
                  strokeDashoffset={dashOffset}
                  fill="transparent"
                  className="transition-all duration-500 hover:opacity-85"
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-4 text-center">
            <span className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white leading-tight">
              {centerMoney.primary}
            </span>
            {centerMoney.usdReference ? (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium tabular-nums">
                {centerMoney.usdReference}
              </span>
            ) : (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                Total Volume
              </span>
            )}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="w-full space-y-2 mt-4">
            {items.map((cat, idx) => (
              <div key={cat.name + idx} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium truncate">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                    {formatMoney(cat.amountUsd, { compact: true })}
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-white w-11 text-right">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-3">
            {breakdown ? 'No revenue breakdown recorded yet.' : 'Revenue breakdown is unavailable.'}
          </p>
        )}
      </div>
    </div>
  );
}
