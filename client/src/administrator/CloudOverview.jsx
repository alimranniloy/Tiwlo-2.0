import React from 'react';
import { Cloud, ArrowUpRight, ArrowRight, Server } from 'lucide-react';

export default function CloudOverview({ data, onViewDetails }) {
  const stats = [
    {
      label: 'Total Servers',
      value: data?.totalServers || '24',
      trend: '4.3%',
      positive: true
    },
    {
      label: 'Active Servers',
      value: data?.activeServers || '22',
      trend: '9.1%',
      positive: true
    },
    {
      label: 'Total Storage',
      value: data?.totalStorage || '1.8 TB',
      trend: '12.6%',
      positive: true
    },
    {
      label: 'Bandwidth Usage',
      value: data?.bandwidthUsage || '423 GB',
      trend: '18.4%',
      positive: true
    }
  ];

  const serverUsage = data?.serverUsage || [
    { os: 'Ubuntu 22.04', active: 8, total: 10, percent: 80, color: 'bg-blue-600' },
    { os: 'Windows Server', active: 4, total: 6, percent: 66.7, color: 'bg-blue-500' },
    { os: 'Debian 12', active: 3, total: 5, percent: 60, color: 'bg-blue-400' },
    { os: 'CentOS 7', active: 2, total: 5, percent: 40, color: 'bg-sky-400' }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Cloud className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Cloud Overview</h3>
        </div>

        <button
          onClick={onViewDetails}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          View Details <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Mini Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
          >
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block truncate">
              {s.label}
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {s.value}
            </div>
            <div className="flex items-center gap-1 text-[11px] mt-1">
              <span className="flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                {s.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Server Usage with Progress Bars */}
      <div className="mt-2">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">
          Server Usage
        </h4>

        <div className="space-y-3">
          {serverUsage.map((su, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {su.os}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{su.active}</span> / {su.total}
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${su.color || 'bg-blue-600'}`}
                  style={{ width: `${su.percent || (su.active / su.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
