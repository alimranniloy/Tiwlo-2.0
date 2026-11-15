import React from 'react';
import { Database } from 'lucide-react';

export default function SystemInfoCard({ info }) {
  const dbSize = info?.dbSize ?? info?.databaseSize ?? info?.dbSizePretty ?? null;
  const dbConnections = info?.dbActiveConnections ?? info?.activeConnections ?? null;

  const specs = [
    { label: 'Node.js', value: info?.nodeVersion || '—' },
    { label: 'Database', value: info?.database || '—' },
    { label: 'DB Size', value: dbSize || '—' },
    {
      label: 'DB Connections',
      value: dbConnections != null ? String(dbConnections) : '—'
    },
    { label: 'Server Uptime', value: info?.serverUptime || '—' }
  ];

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#159f46] dark:text-[#1ED760]" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            System Information
          </h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            info?.operational
              ? 'bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {info?.operational ? 'Operational' : 'Checking'}
        </span>
      </div>

      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="flex items-center justify-between gap-3 text-xs py-2"
          >
            <span className="text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
              {spec.label}
            </span>
            <span className="font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 truncate text-right">
              {spec.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
