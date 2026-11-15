import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Cpu,
  Globe2,
  HardDrive,
  MemoryStick,
  Network,
  RotateCw,
  Server,
} from 'lucide-react';
import { getCloudDashboardData } from '../../dashboards/cloud/graphql/cloudQueries';

function UsageBar({ label, percent = 0, usedLabel = '—', icon: Icon, hint = '' }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const tone =
    safePercent >= 85
      ? 'bg-rose-500'
      : safePercent >= 65
        ? 'bg-amber-500'
        : 'bg-[#1ED760]';

  return (
    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {safePercent}%
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tone}`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
        <span>{usedLabel || '—'}</span>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export default function WorkspacePerformanceView({
  currentUser,
  onBack,
  onNavigate,
  showToast,
}) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [data, setData] = useState({ metrics: null, droplets: [], activities: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadPerformance = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const payload = await getCloudDashboardData(userId);
      setData({
        metrics: payload?.metrics || null,
        droplets: Array.isArray(payload?.droplets) ? payload.droplets : [],
        activities: Array.isArray(payload?.activities) ? payload.activities : [],
      });
      if (manual) showToast?.('Live GraphQL performance metrics synced.');
    } catch (err) {
      setError(err.message || 'Unable to load Workspace performance metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPerformance(false);
  }, [userId]);

  const metrics = data.metrics || {};
  const droplets = data.droplets || [];
  const filteredDroplets = droplets.filter((d) => {
    if (statusFilter === 'all') return true;
    const s = String(d.status || '').toLowerCase();
    return statusFilter === 'active'
      ? s === 'active' || s === 'running'
      : s !== 'active' && s !== 'running';
  });

  const activeDropletsCount = droplets.filter((d) =>
    ['active', 'running'].includes(String(d.status || '').toLowerCase())
  ).length;
  const regionMap = droplets.reduce((acc, item) => {
    const key = item.region || item.regionCode || 'Unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Workspace</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
              System Performance Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-900 dark:text-[#1ED760]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760]" />
              Live GraphQL Telemetry
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Real-time compute, memory, disk, and bandwidth utilization across your account&apos;s active Workspace infrastructure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('workspace/security-alerts')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
            >
              Security Alerts
            </button>
          )}
          <button
            type="button"
            onClick={() => loadPerformance(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] px-4 py-2 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-60 cursor-pointer"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* KPI Resource Utilization Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UsageBar
          label="CPU Utilization"
          percent={metrics.cpuPercent ?? 0}
          usedLabel={metrics.cpuUsed || `${metrics.totalVcpus ?? 0} vCPUs allocated`}
          hint={metrics.vcpusGrowth || ''}
          icon={Cpu}
        />
        <UsageBar
          label="Memory Utilization"
          percent={metrics.memoryPercent ?? 0}
          usedLabel={metrics.memoryUsed || 'No active load'}
          hint={`${droplets.length} node(s)`}
          icon={MemoryStick}
        />
        <UsageBar
          label="Storage Allocation"
          percent={metrics.storagePercent ?? 0}
          usedLabel={metrics.storageUsed || metrics.totalStorage || '0 GB'}
          hint={metrics.storageGrowth || ''}
          icon={HardDrive}
        />
        <UsageBar
          label="Network Bandwidth"
          percent={metrics.bandwidthPercent ?? 0}
          usedLabel={metrics.bandwidthUsed || metrics.totalBandwidth || '0 TB'}
          hint={metrics.bandwidthGrowth || ''}
          icon={Network}
        />
      </div>

      {/* Infrastructure Summary & Regional Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
                <Server className="h-4 w-4 text-neutral-500" />
                Active Compute Nodes ({droplets.length})
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {activeDropletsCount} running · {Math.max(0, droplets.length - activeDropletsCount)} stopped or paused
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-0.5 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Running' },
                { id: 'other', label: 'Offline' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-neutral-950 text-neutral-950 dark:text-white shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading real GraphQL telemetry...</div>
          ) : filteredDroplets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-10 text-center">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">No compute nodes found in this state</p>
              <p className="mt-1 text-xs text-neutral-500">Deploy a Cloud Droplet or switch filter to inspect live performance.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                    <th className="py-2.5 pr-4 font-semibold">Node</th>
                    <th className="py-2.5 pr-4 font-semibold">Specs</th>
                    <th className="py-2.5 pr-4 font-semibold">IP / Region</th>
                    <th className="py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {filteredDroplets.map((node) => {
                    const running = ['active', 'running'].includes(String(node.status || '').toLowerCase());
                    return (
                      <tr key={node.id || node.tiwiId || node.name} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">{node.name}</div>
                          <div className="text-[11px] text-neutral-500">{node.image || 'Linux Container'}</div>
                        </td>
                        <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300 tabular-nums">
                          {node.specs || `${node.vcpus || 1} vCPU · ${node.memory || '1GB'} · ${node.storage || '25GB'}`}
                        </td>
                        <td className="py-3 pr-4 text-neutral-600 dark:text-neutral-400">
                          <div className="font-mono text-[11px]">{node.ip || '—'}</div>
                          <div className="text-[11px]">{node.region || node.regionCode || '—'}</div>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            running
                              ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-[#1ED760]' : 'bg-neutral-400'}`} />
                            {node.status || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Regional Distribution & Recent Cloud Events */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-neutral-500" />
              Region Distribution
            </h3>
            {Object.keys(regionMap).length === 0 ? (
              <p className="mt-3 text-xs text-neutral-500">No active regional deployments recorded.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {Object.entries(regionMap).map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{region}</span>
                    <span className="rounded-md border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-0.5 font-mono text-[11px] tabular-nums">
                      {count} node{count === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-neutral-500" />
              Recent System Events
            </h3>
            {data.activities.length === 0 ? (
              <p className="mt-3 text-xs text-neutral-500">No infrastructure events logged yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.activities.slice(0, 6).map((act, idx) => (
                  <li key={act.id || idx} className="rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-[#fafafa] dark:bg-neutral-900/40 px-3 py-2 text-xs">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {act.action || act.message || act.type || 'Telemetry event'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {act.target || act.resource || ''} {act.time || act.createdAt ? `· ${act.time || new Date(act.createdAt).toLocaleString()}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
