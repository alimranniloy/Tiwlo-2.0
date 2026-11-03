import React from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Radio } from 'lucide-react';

const resources = [
  { key: 'cpu', label: 'CPU', icon: Cpu },
  { key: 'memory', label: 'Memory', icon: MemoryStick },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'bandwidth', label: 'Bandwidth', icon: Radio },
];

export default function CloudPerformanceCard({ metrics, loading = false }) {
  const hasMetrics = resources.some(({ key }) => Number.isFinite(metrics?.[`${key}Percent`]));

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-neutral-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-neutral-950 dark:text-white">Resource utilization</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Current usage reported by your cloud account</p>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {loading ? 'Updating' : 'Current'}
        </span>
      </div>

      {hasMetrics ? (
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {resources.map(({ key, label, icon: Icon }) => {
            const value = metrics?.[`${key}Percent`];
            const available = Number.isFinite(value);
            const percentage = available ? Math.min(100, Math.max(0, value)) : 0;

            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    <Icon className="size-4 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                    {available ? `${value}%` : '—'}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
                  role="progressbar"
                  aria-label={`${label} utilization`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={available ? percentage : undefined}
                >
                  <div
                    className="h-full rounded-full bg-[#1ed760] transition-[width]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center rounded-2xl bg-neutral-50 px-4 text-center text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {loading ? 'Loading current resource utilization…' : 'Current utilization data is not available.'}
        </div>
      )}
    </section>
  );
}
