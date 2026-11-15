import { applicationFetch } from '../api/graphqlTransport.js';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import { getDeviceTrackingHeaders } from '../utils/deviceFingerprint.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Clock,
  Cpu,
  Database,
  Eye,
  FileText,
  Globe,
  HardDrive,
  Laptop,
  Mail,
  MemoryStick,
  Package,
  RefreshCw,
  Shield,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  User,
  X
} from 'lucide-react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

const RANGE_OPTIONS = [
  { id: '15m', label: '15m', windowSeconds: 900, days: 1 },
  { id: 'today', label: 'Today', windowSeconds: 120, days: 1 },
  { id: '7d', label: '7d', windowSeconds: 120, days: 7 },
  { id: '30d', label: '30d', windowSeconds: 120, days: 30 }
];

async function adminFetch(url, options = {}) {
  try {
    return await applicationFetch(url, options);
  } catch (err) {
    if (String(err?.message || '').includes('No GraphQL operation is registered')) {
      const deviceHeaders = await getDeviceTrackingHeaders().catch(() => ({}));
      const mergedHeaders = {
        ...deviceHeaders,
        ...(options.headers instanceof Headers
          ? Object.fromEntries(options.headers.entries())
          : (options.headers || {}))
      };
      return globalThis.fetch(url, {
        ...options,
        headers: mergedHeaders
      });
    }
    throw err;
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatBytes(bytes) {
  const val = Number(bytes);
  if (!Number.isFinite(val) || val <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(val) / Math.log(1024)));
  return `${(val / Math.pow(1024, idx)).toFixed(idx >= 2 ? 2 : 0)} ${units[idx]}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
}

function DeviceIcon({ type }) {
  const t = String(type || '').toLowerCase();
  if (t === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-neutral-500" />;
  if (t === 'tablet') return <Tablet className="w-3.5 h-3.5 text-neutral-500" />;
  return <Laptop className="w-3.5 h-3.5 text-neutral-500" />;
}

export default function AdminLiveVisitorsView({ onBackToDashboard, showToast }) {
  const [selectedRange, setSelectedRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [analytics, setAnalytics] = useState({
    liveVisitorsCount: 0,
    liveVisitors: [],
    livePageBreakdown: [],
    popularPages: [],
    popularProducts: []
  });

  // Storage & Memory Health + GC policy
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthForbidden, setHealthForbidden] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [runningGc, setRunningGc] = useState(false);

  // User Activity Trail Modal/Drawer
  const [trailUser, setTrailUser] = useState(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailLoadingMore, setTrailLoadingMore] = useState(false);
  const [trailError, setTrailError] = useState('');
  const [trailItems, setTrailItems] = useState([]);
  const [trailNextCursor, setTrailNextCursor] = useState(null);
  const [trailHasMore, setTrailHasMore] = useState(false);
  const [trailSecurityEvents, setTrailSecurityEvents] = useState([]);
  const [trailEmailActivity, setTrailEmailActivity] = useState([]);
  const [trailTab, setTrailTab] = useState('actions');

  const activeRangeConfig = useMemo(
    () => RANGE_OPTIONS.find((r) => r.id === selectedRange) || RANGE_OPTIONS[2],
    [selectedRange]
  );

  const getAuthHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchLiveVisitors = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({
        windowSeconds: String(activeRangeConfig.windowSeconds),
        days: String(activeRangeConfig.days),
        limit: '25'
      });
      const res = await adminFetch(`${API_BASE}/admin/telemetry/live-visitors?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Telemetry request failed (${res.status}).`);
      }
      setAnalytics({
        liveVisitorsCount: Number(json.liveVisitorsCount || 0),
        liveVisitors: Array.isArray(json.liveVisitors) ? json.liveVisitors : [],
        livePageBreakdown: Array.isArray(json.livePageBreakdown) ? json.livePageBreakdown : [],
        popularPages: Array.isArray(json.popularPages) ? json.popularPages : [],
        popularProducts: Array.isArray(json.popularProducts) ? json.popularProducts : []
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load live visitor telemetry.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeRangeConfig.days, activeRangeConfig.windowSeconds, getAuthHeaders]);

  const fetchStorageHealth = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setHealthLoading(true);
      const res = await adminFetch(`${API_BASE}/admin/telemetry/storage-health`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.status === 403) {
        setHealthForbidden(true);
        setHealth(null);
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not load storage and memory health.');
      }
      setHealthForbidden(false);
      setHealth(json);
      if (json.policy) {
        setPolicyDraft((prev) => prev || json.policy);
      }
    } catch {
      // keep previous health snapshot on transient error
    } finally {
      if (!silent) setHealthLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await fetchLiveVisitors({ silent: true });
      if (active) setLoading(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [fetchLiveVisitors]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await fetchStorageHealth({ silent: true });
      if (active) setHealthLoading(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [fetchStorageHealth]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      fetchLiveVisitors({ silent: true });
      fetchStorageHealth({ silent: true });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchLiveVisitors, fetchStorageHealth]);

  const handleManualRefresh = () => {
    fetchLiveVisitors();
    fetchStorageHealth();
  };

  const openUserLogDrawer = async (visitor) => {
    if (!visitor?.userId) return;
    setTrailUser({
      id: visitor.userId,
      name: visitor.userName || visitor.userEmail || visitor.userId,
      email: visitor.userEmail || ''
    });
    setTrailTab('actions');
    setTrailItems([]);
    setTrailSecurityEvents([]);
    setTrailEmailActivity([]);
    setTrailNextCursor(null);
    setTrailHasMore(false);
    setTrailError('');
    setTrailLoading(true);

    try {
      const res = await adminFetch(
        `${API_BASE}/admin/telemetry/users/${encodeURIComponent(visitor.userId)}/live-trail?limit=30`,
        {
          credentials: 'include',
          headers: getAuthHeaders()
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Could not load user activity log (${res.status}).`);
      }
      setTrailItems(Array.isArray(json.items) ? json.items : []);
      setTrailNextCursor(json.nextCursorId || null);
      setTrailHasMore(Boolean(json.hasMore));
      setTrailSecurityEvents(Array.isArray(json.securityEvents) ? json.securityEvents : []);
      setTrailEmailActivity(Array.isArray(json.emailActivity) ? json.emailActivity : []);
    } catch (err) {
      setTrailError(err.message || 'Failed to load user activity trail.');
    } finally {
      setTrailLoading(false);
    }
  };

  const handleLoadOlderTrail = async () => {
    if (!trailUser?.id || !trailNextCursor || trailLoadingMore) return;
    try {
      setTrailLoadingMore(true);
      const params = new URLSearchParams({
        cursor: String(trailNextCursor),
        limit: '30'
      });
      const res = await adminFetch(
        `${API_BASE}/admin/telemetry/users/${encodeURIComponent(trailUser.id)}/live-trail?${params.toString()}`,
        {
          credentials: 'include',
          headers: getAuthHeaders()
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not load older logs.');
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setTrailItems((prev) => [...prev, ...nextItems]);
      setTrailNextCursor(json.nextCursorId || null);
      setTrailHasMore(Boolean(json.hasMore));
    } catch (err) {
      showToast?.(err.message || 'Could not load older logs.', 'error');
    } finally {
      setTrailLoadingMore(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!policyDraft) return;
    try {
      setSavingPolicy(true);
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_ORIGIN,
        {
          title: 'Authorize Retention Policy Update',
          description: 'Enter your Admin Security PIN to save automated log rotation and TTL retention limits.'
        }
      );

      const res = await adminFetch(`${API_BASE}/admin/telemetry/retention-policy`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(policyDraft)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update retention policy.');
      }
      setPolicyDraft(json.policy);
      showToast?.('Automated log retention policy saved.');
      fetchStorageHealth({ silent: true });
    } catch (err) {
      showToast?.(err.message || 'Could not save retention policy.', 'error');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleRunGcNow = async () => {
    try {
      setRunningGc(true);
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_ORIGIN,
        {
          title: 'Run Log Compaction & GC Now',
          description: 'Enter your Admin Security PIN to run immediate batched garbage collection and disk log rotation.'
        }
      );

      const res = await adminFetch(`${API_BASE}/admin/telemetry/run-gc`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Garbage collection failed.');
      }
      const deleted = Number(json.report?.totalDeleted || 0);
      const rotated = json.report?.diskRotated?.length || 0;
      showToast?.(`Compaction complete: pruned ${deleted} expired rows, rotated ${rotated} log file(s).`);
      fetchStorageHealth();
      fetchLiveVisitors({ silent: true });
    } catch (err) {
      showToast?.(err.message || 'Failed to run compaction & GC.', 'error');
    } finally {
      setRunningGc(false);
    }
  };

  const topPage = analytics.popularPages[0] || null;
  const topProduct = analytics.popularProducts[0] || null;

  return (
    <div className="space-y-5 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Live Visitors &amp; Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ED760]/30 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ED760] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1ED760]" />
              </span>
              Live Pulse
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Real-time active sessions, page &amp; product rollups, bounded user trails, and automated Meta-scale log rotation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Range Toggle */}
          <div className="inline-flex items-center rounded-xl border border-neutral-200/80 bg-neutral-50 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedRange(opt.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedRange === opt.id
                    ? 'bg-neutral-900 text-white dark:bg-[#1ED760] dark:text-neutral-950 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Auto-Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              autoRefresh
                ? 'border-[#1ED760]/40 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]'
                : 'border-neutral-200/80 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            <span>Auto 10s: {autoRefresh ? 'On' : 'Off'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Live Visitors Now</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {analytics.liveVisitorsCount}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            Active in last {selectedRange === '15m' ? '15 minutes' : '2 minutes'}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Active Pages</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {analytics.livePageBreakdown.length}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            Distinct routes currently viewed
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Top Popular Page</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 truncate text-base font-bold tracking-tight text-neutral-950 dark:text-white">
            {topPage ? topPage.path : '—'}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400 tabular-nums">
            {topPage ? `${topPage.viewsCount} views · ${topPage.sharePct}% share` : 'No page views recorded yet'}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Top Product</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 truncate text-base font-bold tracking-tight text-neutral-950 dark:text-white">
            {topProduct ? topProduct.productName : '—'}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400 tabular-nums">
            {topProduct ? `${topProduct.viewsCount} views · ${topProduct.uniqueVisitors} unique` : 'No product views recorded yet'}
          </p>
        </div>
      </div>

      {/* Live Visitors Right Now */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 px-4 py-3.5 dark:border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Live Visitors Right Now
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Showing real active sessions without synthetic placeholders.
            </p>
          </div>
          {analytics.livePageBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analytics.livePageBreakdown.slice(0, 4).map((b) => (
                <span
                  key={b.path}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 tabular-nums"
                >
                  <span className="max-w-[140px] truncate font-mono">{b.path}</span>
                  <span className="font-semibold text-[#149642] dark:text-[#1ED760]">{b.activeCount}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {loading && analytics.liveVisitors.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-400">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#1ED760] border-t-transparent" />
            Loading live sessions...
          </div>
        ) : analytics.liveVisitors.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Eye className="mx-auto mb-2 h-7 w-7 text-neutral-300 dark:text-neutral-700" />
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              No live visitors active right now
            </p>
            <p className="mt-1 text-[11px] text-neutral-400">
              Active sessions appear here automatically as users browse storefronts or dashboards.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 md:hidden">
              {analytics.liveVisitors.map((v) => (
                <div key={v.sessionId} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                          {v.isGuest ? 'Guest Visitor' : (v.userName || v.userEmail || v.userId)}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${
                            v.isGuest
                              ? 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                              : 'border-[#1ED760]/30 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]'
                          }`}
                        >
                          {v.isGuest ? 'Guest' : 'Registered'}
                        </span>
                      </div>
                      {!v.isGuest && v.userEmail && (
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">{v.userEmail}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-neutral-700 dark:text-neutral-200 shrink-0">
                      {formatDuration(v.activeSeconds)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-neutral-50 p-2.5 text-[11px] dark:bg-neutral-900 space-y-1">
                    <div className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                      {v.currentPath}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      {v.tiwiId && <span className="font-mono">Store: {v.tiwiId}</span>}
                      <span className="inline-flex items-center gap-1 capitalize">
                        <DeviceIcon type={v.deviceType} />
                        {v.deviceType} · {v.browserName}
                      </span>
                      {(v.country || v.ipAddress) && (
                        <span className="font-mono">
                          {[v.country, v.ipAddress].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {!v.isGuest && v.userId && (
                    <button
                      type="button"
                      onClick={() => openUserLogDrawer(v)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>View User Log</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                    <th className="py-2.5 px-4">Visitor / User</th>
                    <th className="py-2.5 px-3">Current Page &amp; Store</th>
                    <th className="py-2.5 px-3">Device &amp; Browser</th>
                    <th className="py-2.5 px-3">Country / IP</th>
                    <th className="py-2.5 px-3">Active Duration</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {analytics.liveVisitors.map((v) => (
                    <tr key={v.sessionId} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                              v.isGuest
                                ? 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                : 'border-[#1ED760]/30 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]'
                            }`}
                          >
                            {v.isGuest ? 'Guest' : 'User'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-neutral-900 dark:text-white truncate max-w-[180px]">
                              {v.isGuest ? v.visitorId.slice(0, 14) : (v.userName || v.userEmail || v.userId)}
                            </div>
                            {!v.isGuest && v.userEmail && (
                              <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">{v.userEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-neutral-900 dark:text-neutral-100 truncate max-w-[240px]">
                          {v.currentPath}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-500">
                          {v.tiwiId && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {v.tiwiId}
                            </span>
                          )}
                          {v.productName && <span className="truncate max-w-[160px]">{v.productName}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 capitalize text-neutral-700 dark:text-neutral-300">
                          <DeviceIcon type={v.deviceType} />
                          <span>{v.deviceType} · {v.browserName}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                        {[v.country, v.ipAddress].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {formatDuration(v.activeSeconds)}
                        </div>
                        <div className="text-[10px] text-neutral-400">{v.pageViewsCount} page views</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!v.isGuest && v.userId ? (
                          <button
                            type="button"
                            onClick={() => openUserLogDrawer(v)}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-[#1ED760] hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:text-white"
                          >
                            <FileText className="h-3 w-3" />
                            <span>View User Log</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-neutral-400">Guest</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Popular Pages & Popular Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Popular Pages */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Popular Pages</h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Ranked by views, unique visitors, and average dwell duration.
              </p>
            </div>
            <span className="text-[11px] font-medium text-neutral-400 tabular-nums">
              {analytics.popularPages.length} tracked
            </span>
          </div>

          {analytics.popularPages.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
              No page traffic recorded for this period yet.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.popularPages.map((pg, idx) => (
                <div key={pg.path} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-neutral-900 dark:text-white truncate">
                          {pg.path}
                        </div>
                        {pg.title && (
                          <div className="text-[10px] text-neutral-400 truncate">{pg.title}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {pg.viewsCount} views
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {pg.uniqueVisitors} uniq · {formatDuration(pg.avgDwellSeconds)} avg · {pg.sharePct}%
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#1ED760]"
                      style={{ width: `${Math.min(100, Math.max(2, pg.sharePct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular Products */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Popular Products</h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Storefront product impressions across Tiwlo merchants.
              </p>
            </div>
            <span className="text-[11px] font-medium text-neutral-400 tabular-nums">
              {analytics.popularProducts.length} tracked
            </span>
          </div>

          {analytics.popularProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
              No product views recorded for this period yet.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.popularProducts.map((prod, idx) => (
                <div key={`${prod.tiwiId}:${prod.productId}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-neutral-900 dark:text-white truncate">
                          {prod.productName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono truncate">
                          <span>ID: {prod.productId}</span>
                          {prod.tiwiId && <span>· Store: {prod.tiwiId}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {prod.viewsCount} views
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {prod.uniqueVisitors} unique · {prod.sharePct}%
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#1ED760]"
                      style={{ width: `${Math.min(100, Math.max(2, prod.sharePct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meta-Style Memory, Disk & Auto Log Rotation Card */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-950 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Meta-Scale Memory, Disk &amp; Automated Log Rotation
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Batched TTL garbage collection and bounded RAM LRU prevent Node memory or Postgres disk bloat.
              </p>
            </div>
          </div>

          {!healthForbidden && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={savingPolicy || !policyDraft}
                onClick={handleSavePolicy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 transition hover:border-[#1ED760] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#1ED760]" />
                <span>{savingPolicy ? 'Saving...' : 'Save TTL Policy'}</span>
              </button>
              <button
                type="button"
                disabled={runningGc}
                onClick={handleRunGcNow}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ED760] px-3.5 py-1.5 text-xs font-semibold text-neutral-950 shadow-xs transition hover:bg-[#19c055] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{runningGc ? 'Compacting...' : 'Run Compaction & GC Now'}</span>
              </button>
            </div>
          )}
        </div>

        {healthLoading ? (
          <div className="py-8 text-center text-xs text-neutral-400">Loading memory and storage telemetry...</div>
        ) : healthForbidden ? (
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            System settings or infrastructure permission is required to inspect or modify log retention policies.
          </div>
        ) : health ? (
          <>
            {/* Memory & GC Status Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <MemoryStick className="h-3.5 w-3.5 text-[#1ED760]" />
                  <span>Node.js Heap / RSS</span>
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {health.memory?.heapUsedMb ?? 0} MB / {health.memory?.rssMb ?? 0} MB RSS
                </div>
                <div className="text-[10px] text-neutral-400 tabular-nums">
                  Heap Total: {health.memory?.heapTotalMb ?? 0} MB
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <Cpu className="h-3.5 w-3.5 text-neutral-500" />
                  <span>System Memory</span>
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {health.systemMemory?.freeSystemMb ?? 0} MB Free
                </div>
                <div className="text-[10px] text-neutral-400 tabular-nums">
                  {health.systemMemory?.usedSystemPct ?? 0}% of {health.systemMemory?.totalSystemMb ?? 0} MB used
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <Clock className="h-3.5 w-3.5 text-neutral-500" />
                  <span>GC Checkpoint Schedule</span>
                </div>
                <div className="mt-1 text-xs font-semibold tabular-nums text-neutral-950 dark:text-white truncate">
                  Next: {formatDateTime(health.nextScheduledRunAt)}
                </div>
                <div className="text-[10px] text-neutral-400 tabular-nums truncate">
                  Last: {formatDateTime(health.lastRunAt)}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <Database className="h-3.5 w-3.5 text-[#1ED760]" />
                  <span>Total Pruned Rows</span>
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {Number(health.totalHistoricalPrunedRows || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 tabular-nums">
                  Disk Logs: {formatBytes(health.diskLogs?.totalBytes || 0)} ({health.diskLogs?.files?.length || 0} files)
                </div>
              </div>
            </div>

            {/* PG Table Sizes & Row Counts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-neutral-200/80 overflow-hidden dark:border-neutral-800">
                <div className="bg-neutral-50/80 px-3.5 py-2 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-300 border-b border-neutral-200/80 dark:border-neutral-800">
                  PostgreSQL Log &amp; Telemetry Tables
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">
                        <th className="py-2 px-3">Table</th>
                        <th className="py-2 px-3 text-right">Rows</th>
                        <th className="py-2 px-3 text-right">Disk Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 tabular-nums">
                      {(health.tables || []).map((tbl) => (
                        <tr key={tbl.table}>
                          <td className="py-2 px-3 font-mono text-[11px] text-neutral-800 dark:text-neutral-200">
                            {tbl.table}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-700 dark:text-neutral-300">
                            {tbl.exists ? Number(tbl.rowCount || 0).toLocaleString() : 'Not created'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-neutral-900 dark:text-white">
                            {tbl.exists ? formatBytes(tbl.sizeBytes) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Configurable TTL Retention Controls */}
              {policyDraft && (
                <div className="rounded-xl border border-neutral-200/80 p-3.5 space-y-3 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Automated TTL Retention Rules
                      </h3>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Safely caps row counts and file sizes in small non-blocking batches.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      <input
                        type="checkbox"
                        checked={Boolean(policyDraft.autoGcEnabled)}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, autoGcEnabled: e.target.checked })}
                        className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                      />
                      <span>Auto-GC Enabled</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Live Visitor Stale (mins)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={policyDraft.liveVisitorStaleMinutes}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, liveVisitorStaleMinutes: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        GC Interval (mins)
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={1440}
                        value={policyDraft.gcIntervalMinutes}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, gcIntervalMinutes: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Activity Trail TTL (days)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={policyDraft.userActivityTrailDays}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, userActivityTrailDays: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Activity Trail Max Rows
                      </span>
                      <input
                        type="number"
                        min={1000}
                        max={5000000}
                        value={policyDraft.userActivityTrailMaxRows}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, userActivityTrailMaxRows: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Security Events TTL (days)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={policyDraft.securityEventsDays}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, securityEventsDays: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Email Outbox TTL (days)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={policyDraft.emailOutboxDays}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, emailOutboxDays: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Daily Rollups Retention (days)
                      </span>
                      <input
                        type="number"
                        min={7}
                        max={730}
                        value={policyDraft.analyticsDailyRollupDays}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, analyticsDailyRollupDays: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Disk Log Max Size (MB)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={policyDraft.diskLogMaxMb}
                        onChange={(e) => setPolicyDraft({ ...policyDraft, diskLogMaxMb: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* User Chronological Activity Log Drawer */}
      {trailUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/50 backdrop-blur-xs">
          <div className="flex h-full w-full sm:max-w-xl flex-col border-l border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200/80 p-4 sm:p-5 dark:border-neutral-800">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white truncate">
                  User Activity Log · {trailUser.name}
                </h3>
                {trailUser.email && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                    {trailUser.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTrailUser(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Close user activity log"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-neutral-200/80 px-4 dark:border-neutral-800">
              {[
                { id: 'actions', label: `Page & Click Trail (${trailItems.length})` },
                { id: 'security', label: `Security (${trailSecurityEvents.length})` },
                { id: 'emails', label: `Emails (${trailEmailActivity.length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrailTab(t.id)}
                  className={`border-b-2 px-3 py-2 text-xs font-medium transition ${
                    trailTab === t.id
                      ? 'border-[#1ED760] text-neutral-950 dark:text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {trailLoading ? (
                <div className="py-14 text-center text-xs text-neutral-400">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#1ED760] border-t-transparent" />
                  Loading chronological user trail...
                </div>
              ) : trailError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {trailError}
                </div>
              ) : trailTab === 'actions' ? (
                trailItems.length === 0 ? (
                  <p className="py-10 text-center text-xs text-neutral-400">
                    No page visits or UI click events recorded for this user yet.
                  </p>
                ) : (
                  <>
                    {trailItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1ED760]/30 bg-[#1ED760]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                            {item.eventKind}
                          </span>
                          <span className="text-[10px] text-neutral-400 tabular-nums">
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1.5 font-mono text-xs font-medium text-neutral-900 dark:text-white break-all">
                          {item.pagePath || '—'}
                        </div>
                        {(item.targetLabel || item.ipAddress) && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                            {item.targetLabel && <span>Action: {item.targetLabel}</span>}
                            {item.ipAddress && <span className="font-mono">IP: {item.ipAddress}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    {trailHasMore && (
                      <button
                        type="button"
                        disabled={trailLoadingMore}
                        onClick={handleLoadOlderTrail}
                        className="w-full rounded-xl border border-neutral-200/80 bg-white py-2 text-xs font-semibold text-neutral-700 transition hover:border-[#1ED760] disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                      >
                        {trailLoadingMore ? 'Loading older logs...' : 'Load older logs'}
                      </button>
                    )}
                  </>
                )
              ) : trailTab === 'security' ? (
                trailSecurityEvents.length === 0 ? (
                  <p className="py-10 text-center text-xs text-neutral-400">No security events recorded.</p>
                ) : (
                  trailSecurityEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                          <Shield className="h-3.5 w-3.5 text-[#1ED760]" />
                          {ev.eventType}
                        </span>
                        <span className="text-[10px] text-neutral-400 tabular-nums">
                          {formatDateTime(ev.createdAt)}
                        </span>
                      </div>
                      {ev.ipAddress && (
                        <p className="mt-1 font-mono text-[11px] text-neutral-500">IP: {ev.ipAddress}</p>
                      )}
                    </div>
                  ))
                )
              ) : trailEmailActivity.length === 0 ? (
                <p className="py-10 text-center text-xs text-neutral-400">No email deliveries recorded.</p>
              ) : (
                trailEmailActivity.map((em) => (
                  <div
                    key={em.id}
                    className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                        <Mail className="h-3.5 w-3.5 text-[#1ED760]" />
                        {em.emailType} · {em.status}
                      </span>
                      <span className="text-[10px] text-neutral-400 tabular-nums">
                        {formatDateTime(em.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300 truncate">{em.subject}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
