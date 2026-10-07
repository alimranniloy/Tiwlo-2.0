import React from 'react';

export default function RevenueBreakdownChart({ breakdown }) {
  const categories = breakdown?.categories || [];

  const totalDisplay = breakdown?.total == null
    ? (breakdown?.currency === 'Mixed currencies' ? 'Mixed' : '—')
    : `${breakdown.currency || ''} ${Number(breakdown.total).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  // SVG Donut calculation
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius; // ~402.12

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Revenue Breakdown</h3>
      </div>

      <div className="flex flex-col items-center justify-center my-auto py-2">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="text-slate-100 dark:text-slate-800"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Slices */}
            {categories.map((cat, idx) => {
              const dashLength = (cat.percentage / 100) * circumference;
              const accumulatedPercent = categories
                .slice(0, idx)
                .reduce((total, category) => total + category.percentage, 0);
              const dashOffset = -(accumulatedPercent / 100) * circumference;

              return (
                <circle
                  key={idx}
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke={cat.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  fill="transparent"
                  strokeLinecap="round"
                  className="transition-all duration-500 hover:opacity-85 cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">
              {totalDisplay}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
              Total Revenue
            </span>
          </div>
        </div>

        {/* Legend List */}
        {categories.length ? (
          <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 mt-4 px-2">
            {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-slate-600 dark:text-slate-400 font-medium truncate">
                  {cat.name}
                </span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {cat.percentage}%
              </span>
            </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-3">
            {breakdown?.currency === 'Mixed currencies'
              ? 'Category totals are not combined across different currencies.'
              : breakdown ? 'No paid sales in this period.' : 'Revenue data is unavailable.'}
          </p>
        )}
      </div>
    </div>
  );
}
