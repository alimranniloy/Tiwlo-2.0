import React from 'react';

export default function RevenueBreakdownChart({ breakdown }) {
  const categories = breakdown?.categories || [
    { name: 'Products', percentage: 58.4, color: '#3b82f6', amount: '14,355.88' },
    { name: 'Cloud Services', percentage: 24.1, color: '#8b5cf6', amount: '5,924.26' },
    { name: 'Shipping', percentage: 9.8, color: '#10b981', amount: '2,409.04' },
    { name: 'Other', percentage: 7.7, color: '#f59e0b', amount: '1,892.82' }
  ];

  const totalDisplay = breakdown?.total
    ? `$${Math.round(breakdown.total).toLocaleString('en-US')}`
    : '$24,582';

  // SVG Donut calculation
  const radius = 64;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius; // ~402.12
  let accumulatedPercent = 0;

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
              const dashOffset = -(accumulatedPercent / 100) * circumference;
              accumulatedPercent += cat.percentage;

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
      </div>
    </div>
  );
}
