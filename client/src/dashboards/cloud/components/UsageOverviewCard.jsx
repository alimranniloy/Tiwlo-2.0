import React from 'react';

export default function UsageOverviewCard({ metrics }) {
  const rings = [
    {
      id: 'cpu',
      label: 'CPU',
      percent: metrics?.cpuPercent,
      usage: metrics?.cpuUsed || 'Unavailable',
      color: '#7b7b7b'
    },
    {
      id: 'memory',
      label: 'Memory',
      percent: metrics?.memoryPercent,
      usage: metrics?.memoryUsed || 'Unavailable',
      color: '#717171'
    },
    {
      id: 'storage',
      label: 'Storage',
      percent: metrics?.storagePercent,
      usage: metrics?.storageUsed || 'Unavailable',
      color: '#10B981'
    },
    {
      id: 'bandwidth',
      label: 'Bandwidth',
      percent: metrics?.bandwidthPercent,
      usage: metrics?.bandwidthUsed || 'Unavailable',
      color: '#939393'
    }
  ];
  const hasLiveMetrics = rings.some((ring) => Number.isFinite(ring.percent));

  // Circle SVG math
  const radius = 24;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
          Usage Overview
        </h3>

        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {hasLiveMetrics ? 'Live metrics' : 'No live metrics'}
        </span>
      </div>

      {/* 4 Circular Rings in a row or 2x2 grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 text-center">
        {rings.map((ring) => {
          const hasPercentage = Number.isFinite(ring.percent);
          const strokeDashoffset = hasPercentage
            ? circumference - (Math.min(100, Math.max(0, ring.percent)) / 100) * circumference
            : circumference;

          return (
            <div key={ring.id} className="flex flex-col items-center">
              {/* Circular Progress SVG */}
              <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 60 60">
                  {/* Background Track */}
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    strokeWidth="4.5"
                    fill="none"
                    className="stroke-neutral-100 dark:stroke-gray-800"
                  />
                  {/* Progress Fill */}
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    strokeWidth="4.5"
                    fill="none"
                    stroke={hasPercentage ? ring.color : 'transparent'}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Percentage Center Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-neutral-900 dark:text-white">
                    {hasPercentage ? `${ring.percent}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Title & Specs */}
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {ring.label}
              </p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-400 font-medium truncate max-w-[80px]">
                {ring.usage}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
