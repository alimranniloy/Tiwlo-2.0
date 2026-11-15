import React from 'react';
import { Server, Cpu, MemoryStick, HardDrive, Cloud, ArrowRight } from 'lucide-react';

function formatBytesMb(mb) {
  const num = Number(mb);
  if (!Number.isFinite(num) || num < 0) return null;
  if (num >= 1024) return `${(num / 1024).toFixed(1)} GB`;
  return `${Math.round(num)} MB`;
}

export default function CloudOverview({ data, systemInfo, onViewDetails }) {
  const connected = data?.providerConnected === true;

  const ramUsed =
    data?.ramUsedFormatted ||
    systemInfo?.ramUsedFormatted ||
    formatBytesMb(data?.hostRamUsedMb ?? systemInfo?.hostRamUsedMb);
  const ramTotal =
    data?.ramTotalFormatted ||
    systemInfo?.ramTotalFormatted ||
    formatBytesMb(data?.hostRamTotalMb ?? systemInfo?.hostRamTotalMb);
  const ramPct = data?.ramUsagePercent ?? systemInfo?.ramUsagePercent ?? null;
  const ramDisplay =
    data?.hostRam ??
    systemInfo?.hostRam ??
    (ramUsed && ramTotal
      ? `${ramUsed} / ${ramTotal}${ramPct != null ? ` (${Number(ramPct).toFixed(0)}%)` : ''}`
      : ramPct != null
        ? `${Number(ramPct).toFixed(0)}% used`
        : '—');

  const cpuLoad = data?.cpuLoad ?? data?.hostCpuLoad ?? systemInfo?.cpuLoad ?? systemInfo?.hostCpuLoad ?? null;
  const cpuDisplay =
    typeof cpuLoad === 'number'
      ? cpuLoad.toFixed(2)
      : Array.isArray(cpuLoad)
        ? cpuLoad.map((n) => Number(n).toFixed(2)).join(' · ')
        : cpuLoad || '—';

  const mediaDiskDisplay =
    data?.mediaDiskUsage ??
    data?.totalStorage ??
    systemInfo?.mediaDiskUsage ??
    (data?.mediaDiskUsed && data?.mediaDiskTotal ? `${data.mediaDiskUsed} / ${data.mediaDiskTotal}` : '—');

  const dropletsDisplay = connected
    ? `${data?.activeServers ?? 0} / ${data?.totalServers ?? 0} active`
    : 'Not connected';

  const metrics = [
    { label: 'Host RAM', value: ramDisplay, icon: MemoryStick },
    { label: 'CPU Load', value: cpuDisplay, icon: Cpu },
    { label: 'Media Disk', value: mediaDiskDisplay, icon: HardDrive },
    {
      label: 'VPS Droplets',
      value: dropletsDisplay,
      icon: Cloud,
      statusBadge: connected ? 'Connected' : 'Local Host Only'
    }
  ];

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200/70 dark:border-neutral-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              Infrastructure &amp; Cloud
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              Host resources, media disk &amp; VPS droplets
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewDetails}
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-[#159f46] dark:hover:text-[#1ED760] transition-colors shrink-0"
        >
          <span>View Servers</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="p-3 rounded-lg bg-[#fafafa] dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {m.label}
                </span>
                <Icon className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
              </div>
              <div className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white truncate">
                {m.value}
              </div>
              {m.statusBadge && (
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    connected
                      ? 'bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]'
                      : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {m.statusBadge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>DB Connections</span>
        <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
          {systemInfo?.dbActiveConnections ?? data?.dbActiveConnections ?? '—'}
        </span>
      </div>
    </div>
  );
}
