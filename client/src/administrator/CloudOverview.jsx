import React from 'react';
import { Cloud, ArrowRight } from 'lucide-react';

export default function CloudOverview({ data, onViewDetails }) {
  const connected = data?.providerConnected === true;
  const stats = [
    ['Total Servers', data?.totalServers],
    ['Active Servers', data?.activeServers],
    ['Total Storage', data?.totalStorage],
    ['Bandwidth Usage', data?.bandwidthUsage]
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
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

      {connected ? (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {stats.map(([label, value]) => (
            <div key={label} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block">{label}</span>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{value ?? '—'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <Cloud className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cloud provider not connected</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Server inventory and usage metrics are unavailable.
          </p>
        </div>
      )}
    </div>
  );
}
