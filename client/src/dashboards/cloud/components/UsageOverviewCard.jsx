import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function UsageOverviewCard({ metrics }) {
  const [timeRange, setTimeRange] = useState('Last 7 days');

  const rings = [
    {
      id: 'cpu',
      label: 'CPU',
      percent: metrics?.cpuPercent ?? 32,
      usage: metrics?.cpuUsed || '2.6 / 8 vCPUs',
      color: '#3B82F6', // Blue
      trackColor: '#EFF6FF',
      darkTrackColor: '#1e293b'
    },
    {
      id: 'memory',
      label: 'Memory',
      percent: metrics?.memoryPercent ?? 48,
      usage: metrics?.memoryUsed || '3.8 / 8 GB',
      color: '#8B5CF6', // Purple
      trackColor: '#F5F3FF',
      darkTrackColor: '#1e293b'
    },
    {
      id: 'storage',
      label: 'Storage',
      percent: metrics?.storagePercent ?? 21,
      usage: metrics?.storageUsed || '16 / 80 GB',
      color: '#10B981', // Emerald
      trackColor: '#ECFDF5',
      darkTrackColor: '#1e293b'
    },
    {
      id: 'bandwidth',
      label: 'Bandwidth',
      percent: metrics?.bandwidthPercent ?? 18,
      usage: metrics?.bandwidthUsed || '0.4 / 2.4 TB',
      color: '#06B6D4', // Cyan
      trackColor: '#ECFEFF',
      darkTrackColor: '#1e293b'
    }
  ];

  // Circle SVG math
  const radius = 24;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Usage Overview
        </h3>

        <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-gray-800/80 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-gray-700/60 cursor-pointer">
          <span>{timeRange}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* 4 Circular Rings in a row or 2x2 grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 text-center">
        {rings.map((ring) => {
          const strokeDashoffset = circumference - (ring.percent / 100) * circumference;

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
                    className="stroke-slate-100 dark:stroke-gray-800"
                  />
                  {/* Progress Fill */}
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    strokeWidth="4.5"
                    fill="none"
                    stroke={ring.color}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Percentage Center Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {ring.percent}%
                  </span>
                </div>
              </div>

              {/* Title & Specs */}
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {ring.label}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium truncate max-w-[80px]">
                {ring.usage}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
