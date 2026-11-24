import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  Database,
  Globe,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';

function formatGbValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${Number.isInteger(num) ? num.toLocaleString() : Number(num.toFixed(1)).toLocaleString()} GB`;
}

function formatCoresValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString()} ${num === 1 ? 'Core' : 'Cores'}`;
}

export function ClusterHardwareCapacityCard({
  liveStatus,
  nodesData,
  loading,
  error,
  onRefresh,
  onViewServers
}) {
  const nodes = Array.isArray(nodesData?.nodes) ? nodesData.nodes : [];
  const primaryNode =
    nodes.find((node) => node?.id === 'primary-ubuntu-node') ||
    nodes.find((node) => node?.isPrimary === true) ||
    null;

  const summary = liveStatus?.summary || nodesData?.summary || null;
  const automation = liveStatus?.automation || null;

  const primaryIpv4List =
    Array.isArray(primaryNode?.networkAddresses?.ipv4) &&
    primaryNode.networkAddresses.ipv4.length > 0
      ? primaryNode.networkAddresses.ipv4
      : primaryNode?.ipAddress
        ? [primaryNode.ipAddress]
        : [];

  const primaryIpv6List =
    Array.isArray(primaryNode?.networkAddresses?.ipv6) &&
    primaryNode.networkAddresses.ipv6.length > 0
      ? primaryNode.networkAddresses.ipv6
      : primaryNode?.ipv6Address
        ? [primaryNode.ipv6Address]
        : [];

  const primaryStatus = String(primaryNode?.status || '').toLowerCase();
  const primaryStatusTone =
    primaryStatus === 'online'
      ? 'bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]'
      : primaryStatus === 'degraded' || primaryStatus === 'maintenance'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : primaryStatus
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
          : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400';

  const hasAnyData = Boolean(liveStatus || nodesData);

  const automationBadges = automation
    ? [
        {
          key: 'failover',
          label: `Autonomous Failover: ${automation.autoFailoverEnabled ? 'Active' : 'Paused'}`,
          active: automation.autoFailoverEnabled === true
        },
        {
          key: 'healing',
          label: `Self-Healing: ${automation.selfHealingEnabled ? 'Active' : 'Paused'}`,
          active: automation.selfHealingEnabled === true
        },
        {
          key: 'backup',
          label: `Backup: ${automation.backupEnabled ? 'Active' : 'Paused'}`,
          active: automation.backupEnabled === true
        }
      ]
    : [];

  return (
    <section className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-neutral-200/70 dark:border-neutral-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760] flex items-center justify-center shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              Cluster Hardware Capacity
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              Primary host hardware &amp; combined multi-node cluster pool telemetry
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {automationBadges.length > 0 ? (
            automationBadges.map((badge) => (
              <span
                key={badge.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  badge.active
                    ? 'bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760]'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>{badge.label}</span>
              </span>
            ))
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
              {loading && !hasAnyData ? 'Checking Automation…' : 'Automation Status Unavailable'}
            </span>
          )}

          {typeof onRefresh === 'function' && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh cluster hardware metrics"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          {typeof onViewServers === 'function' && (
            <button
              type="button"
              onClick={onViewServers}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:text-[#159f46] dark:hover:text-[#1ED760] transition-colors pl-1"
            >
              <span>Manage Fleet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading && !hasAnyData ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <RefreshCw className="w-5 h-5 animate-spin text-[#1ED760]" />
          <span>Loading live cluster hardware capacity…</span>
        </div>
      ) : error && !hasAnyData ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cluster hardware telemetry unavailable</p>
              <p className="text-[11px] opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
          {typeof onRefresh === 'function' && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-neutral-800 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Partial cluster telemetry warning: {error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* 1. Primary Host Node Hardware (primary-ubuntu-node) */}
            <div className="xl:col-span-5 rounded-lg bg-[#fafafa] dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                      Primary Host Node
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 truncate">
                      {primaryNode?.id || 'primary-ubuntu-node'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                    {primaryNode?.hostname || primaryNode?.name || 'Local host telemetry'}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${primaryStatusTone}`}>
                  {primaryNode?.status || (nodesData ? 'Not Found' : 'Unavailable')}
                </span>
              </div>

              {!primaryNode ? (
                <div className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {nodesData
                    ? 'Primary host node (primary-ubuntu-node) was not returned by /api/admin/fleet/nodes.'
                    : 'Primary host node hardware is unavailable.'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>CPU Cores</span>
                        <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {formatCoresValue(primaryNode.cpuCores)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>RAM</span>
                        <MemoryStick className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {formatGbValue(primaryNode.ramGb)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>Free Storage</span>
                        <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {formatGbValue(primaryNode.storageFreeGb)}
                      </p>
                      {primaryNode.storageGb != null && (
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                          of {formatGbValue(primaryNode.storageGb)} total
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span>Detected OS</span>
                        <Server className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                      <p
                        className="mt-1 text-xs font-semibold text-neutral-900 dark:text-white truncate"
                        title={primaryNode.detectedOsName || primaryNode.detectedOsId || ''}
                      >
                        {primaryNode.detectedOsName || primaryNode.detectedOsId || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 px-3 py-2 space-y-1.5 text-[11px]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-neutral-500 dark:text-neutral-400 inline-flex items-center gap-1 shrink-0">
                        <Globe className="w-3 h-3" />
                        <span>IPv4</span>
                      </span>
                      <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 text-right break-all">
                        {primaryIpv4List.length > 0 ? primaryIpv4List.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                      <span className="text-neutral-500 dark:text-neutral-400 inline-flex items-center gap-1 shrink-0">
                        <Globe className="w-3 h-3" />
                        <span>IPv6</span>
                      </span>
                      <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 text-right break-all">
                        {primaryIpv6List.length > 0 ? primaryIpv6List.join(', ') : '—'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 2. Combined All-Server Cluster Pool Totals */}
            <div className="xl:col-span-7 rounded-lg bg-[#fafafa] dark:bg-neutral-900/70 border border-neutral-200/70 dark:border-neutral-800 p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">
                    Combined All-Server Cluster Pool Totals
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Aggregated live capacity across all registered fleet nodes
                  </p>
                </div>
                {summary?.avgLatencyMs != null && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 tabular-nums shrink-0">
                    Avg Latency: {summary.avgLatencyMs} ms
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Online / Total Servers
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {summary
                      ? `${Number(summary.online ?? 0).toLocaleString()} / ${Number(summary.total ?? 0).toLocaleString()}`
                      : '—'}
                  </p>
                  {summary && Number(summary.degraded || 0) > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                      {summary.degraded} degraded
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Total CPU Cores
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {summary ? formatCoresValue(summary.totalCpuCores) : '—'}
                  </p>
                  {summary?.onlineCpuCores != null && (
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {formatCoresValue(summary.onlineCpuCores)} online
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Total RAM (GB)
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {summary ? formatGbValue(summary.totalRamGb) : '—'}
                  </p>
                  {summary?.onlineRamGb != null && (
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {formatGbValue(summary.onlineRamGb)} online
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Total Storage (GB)
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {summary ? formatGbValue(summary.totalStorageGb) : '—'}
                  </p>
                </div>

                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Free Storage (GB)
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#159f46] dark:text-[#1ED760]">
                    {summary ? formatGbValue(summary.totalStorageFreeGb) : '—'}
                  </p>
                </div>

                <div className="rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 p-3">
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                    Used Storage (GB)
                  </span>
                  <p className="mt-1 text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {summary ? formatGbValue(summary.totalStorageUsedGb) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

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
