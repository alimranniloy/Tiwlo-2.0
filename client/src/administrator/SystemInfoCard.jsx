import React from 'react';

export default function SystemInfoCard({ info }) {
  const specs = [
    { label: 'Node.js', value: info?.nodeVersion || '—' },
    { label: 'Database', value: info?.database || '—' },
    { label: 'Server Uptime', value: info?.serverUptime || '—' }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
        System Information
      </h3>

      <div className="space-y-3">
        {specs.map((spec, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0"
          >
            <span className="text-slate-400 dark:text-slate-500 font-medium">
              {spec.label}
            </span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {spec.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
