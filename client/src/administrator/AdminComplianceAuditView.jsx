import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Cpu,
  CreditCard,
  Database,
  FileCheck2,
  LogOut,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { supportFetch as fetch } from '../utils/supportFetch';
import PaginationBar from '../components/PaginationBar';
import AnalyticsDonutChart from './AnalyticsDonutChart';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeMethodLabel(method) {
  const raw = String(method || '').trim().toLowerCase();
  if (raw.includes('bkash')) return 'bKash';
  if (raw.includes('nagad')) return 'Nagad';
  if (raw.includes('card') || raw.includes('stripe') || raw.includes('visa') || raw.includes('master')) return 'Card';
  return 'Other';
}

function normalizeOrderStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === 'cancelled' || raw === 'canceled' || raw === 'refunded' || raw === 'failed') return 'cancelled';
  if (raw === 'expired') return 'expired';
  if (raw === 'active' || raw === 'processing' || raw === 'pending') return 'active';
  if (raw === 'paid' || raw === 'completed' || raw === 'fulfilled' || raw === 'delivered') return 'completed';
  return raw || 'active';
}

function inferAuditSeverity(ev) {
  const explicit = String(ev?.severity || '').trim().toLowerCase();
  if (explicit === 'critical' || explicit === 'error') return 'critical';
  if (explicit === 'warning' || explicit === 'warn') return 'warning';
  if (explicit === 'info') return 'info';
  const action = String(ev?.action || ev?.eventType || '').toLowerCase();
  if (/(terminate|revoke|ban|delete|remove|reject|breach|fail)/.test(action)) return 'warning';
  return 'info';
}

function formatAuditDetails(ev) {
  if (ev?.reason) return String(ev.reason);
  if (ev?.summary) return String(ev.summary);
  const details = ev?.details;
  if (!details) return '—';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return '—';
    return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ');
  }
  return String(details);
}

export default function AdminComplianceAuditView({ onBackToDashboard, onNavigate, showToast }) {
  const [timeframe, setTimeframe] = useState('30d');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  // Orders pagination + status/gateway filters
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderGatewayFilter, setOrderGatewayFilter] = useState('all');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  // Payment ledger pagination
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

  // Staff permission audit trail + search/severity filter
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);

  // Security Action: Terminate Sessions
  const [termUserId, setTermUserId] = useState('');
  const [termReason, setTermReason] = useState('');
  const [terminating, setTerminating] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setSummaryError('');
    try {
      const params = new URLSearchParams({
        timeframe,
        status: orderStatusFilter,
        page: String(orderPage),
        limit: String(orderPageSize),
      });
      const res = await fetch(`${API_BASE}/admin/support/analytics/platform-ops-summary?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Failed to load platform compliance summary (HTTP ${res.status})`);
      }
      setSummary(json);
    } catch (err) {
      setSummaryError(err?.message || 'Unable to load platform compliance telemetry.');
    } finally {
      setLoading(false);
    }
  }, [timeframe, orderStatusFilter, orderPage, orderPageSize]);

  const loadAuditLogs = useCallback(async () => {
    setLoadingAudits(true);
    setAuditError('');
    try {
      const res = await fetch(`${API_BASE}/admin/support/staff-audit-logs?limit=250`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Failed to load staff audit logs (HTTP ${res.status})`);
      }
      setAuditLogs(Array.isArray(json.logs) ? json.logs : []);
    } catch (err) {
      setAuditError(err?.message || 'Unable to load immutable staff audit logs.');
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleTerminateSessions = async (e) => {
    e.preventDefault();
    if (!termUserId.trim() || terminating) return;
    setTerminating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/security/terminate-sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          userId: termUserId.trim(),
          reason: termReason.trim() || 'Admin security session revocation',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not terminate sessions');
      }
      showToast?.('Active sessions terminated and recorded in audit trail.', 'success');
      setTermUserId('');
      setTermReason('');
      await loadAuditLogs();
    } catch (err) {
      showToast?.(err.message || 'Session termination failed', 'error');
    } finally {
      setTerminating(false);
    }
  };

  // Payment breakdown donut segments & ledger rows
  const paymentRows = useMemo(() => {
    const raw = Array.isArray(summary?.paymentBreakdown) ? summary.paymentBreakdown : [];
    const grouped = new Map();
    for (const item of raw) {
      const label = normalizeMethodLabel(item.method || item.gateway);
      const existing = grouped.get(label) || {
        method: label,
        transactionsCount: 0,
        uniqueUsersCount: 0,
        totalAmount: 0,
      };
      existing.transactionsCount += Number(item.transactionsCount ?? item.count ?? 0);
      existing.uniqueUsersCount += Number(item.uniqueUsersCount ?? 0);
      existing.totalAmount += Number(item.totalAmount ?? item.total ?? 0);
      grouped.set(label, existing);
    }
    const order = ['bKash', 'Nagad', 'Card', 'Other'];
    return order
      .map((m) => grouped.get(m) || { method: m, transactionsCount: 0, uniqueUsersCount: 0, totalAmount: 0 })
      .filter((r) => r.transactionsCount > 0 || r.totalAmount > 0 || raw.length === 0);
  }, [summary]);

  const paymentDonutSegments = useMemo(() => {
    const colors = { bKash: '#EC4899', Nagad: '#0EA5E9', Card: '#1ED760', Other: '#8B5CF6' };
    return paymentRows.map((row) => ({
      key: row.method,
      label: row.method,
      value: row.totalAmount > 0 ? row.totalAmount : row.transactionsCount,
      sublabel: `${row.transactionsCount} tx · ${row.uniqueUsersCount} users`,
      color: colors[row.method] || '#64748B',
    }));
  }, [paymentRows]);

  const orderDonutSegments = useMemo(() => {
    const stats = summary?.orderStats || {};
    return [
      { key: 'active', label: 'Active', value: Number(stats.active || 0), color: '#1ED760' },
      { key: 'completed', label: 'Completed', value: Number(stats.completed || 0), color: '#0EA5E9' },
      { key: 'expired', label: 'Expired', value: Number(stats.expired || 0), color: '#8B5CF6' },
      { key: 'cancelled', label: 'Cancelled', value: Number(stats.cancelled || 0), color: '#EF4444' },
    ];
  }, [summary]);

  const csatSlaSegments = useMemo(() => {
    const csat = summary?.csatStats || summary?.csat || summary?.slaStats || {};
    const dist = csat.distribution || {};
    const satisfied = Number(
      csat.positiveCount ??
      ((dist[4] || 0) + (dist[5] || 0) || undefined) ??
      csat.slaMet ??
      summary?.integrity?.slaMet ??
      0
    );
    const neutral = Number(csat.neutralCount ?? dist[3] ?? csat.pending ?? 0);
    const breached = Number(
      csat.negativeCount ??
      ((dist[1] || 0) + (dist[2] || 0) || undefined) ??
      csat.slaBreached ??
      summary?.integrity?.slaBreached ??
      0
    );
    if (satisfied === 0 && neutral === 0 && breached === 0) {
      const totalAudits = Number(summary?.staffAuditCount ?? summary?.staffAudits?.length ?? 0);
      return totalAudits > 0
        ? [{ key: 'compliant', label: 'Compliant Audits', value: totalAudits, color: '#1ED760' }]
        : [];
    }
    return [
      { key: 'satisfied', label: 'Positive CSAT / SLA Met', value: satisfied, color: '#1ED760' },
      { key: 'neutral', label: 'Neutral / In Review', value: neutral, color: '#0EA5E9' },
      { key: 'breached', label: 'Low CSAT / Breached', value: breached, color: '#EF4444' },
    ];
  }, [summary]);

  const allOrders = useMemo(() => {
    const list = Array.isArray(summary?.orders) ? summary.orders : [];
    return list.filter((o) => {
      if (orderStatusFilter !== 'all') {
        const norm = o.normalized_status || normalizeOrderStatus(o.status);
        if (norm !== orderStatusFilter) return false;
      }
      if (orderGatewayFilter !== 'all') {
        if (normalizeMethodLabel(o.payment_method) !== orderGatewayFilter) return false;
      }
      return true;
    });
  }, [summary, orderStatusFilter, orderGatewayFilter]);

  const isServerPaginatedOrders =
    orderGatewayFilter === 'all' && summary?.pagination?.total != null;

  const totalOrdersCount = isServerPaginatedOrders
    ? Number(summary.pagination.total)
    : allOrders.length;

  const displayedOrders = useMemo(() => {
    if (isServerPaginatedOrders) {
      return allOrders;
    }
    const start = (orderPage - 1) * orderPageSize;
    return allOrders.slice(start, start + orderPageSize);
  }, [allOrders, isServerPaginatedOrders, orderPage, orderPageSize]);

  const pagedLedger = useMemo(() => {
    const start = (ledgerPage - 1) * ledgerPageSize;
    return paymentRows.slice(start, start + ledgerPageSize);
  }, [paymentRows, ledgerPage, ledgerPageSize]);

  const summaryStaffAudits = summary?.staffAudits;
  const combinedAudits = useMemo(() => {
    const fromSummary = Array.isArray(summaryStaffAudits) ? summaryStaffAudits : [];
    const base = auditLogs.length > 0 ? auditLogs : fromSummary;
    const query = auditSearch.trim().toLowerCase();
    return base.filter((ev) => {
      const sev = inferAuditSeverity(ev);
      if (auditSeverityFilter !== 'all' && sev !== auditSeverityFilter) return false;
      if (!query) return true;
      const actor = String(ev.actorName || ev.staffName || ev.staffEmail || ev.actorId || ev.staffId || '').toLowerCase();
      const target = String(ev.targetUserId || ev.targetId || ev.staffId || '').toLowerCase();
      const action = String(ev.action || ev.eventType || ev.permissionKey || '').toLowerCase();
      const ip = String(ev.ip || ev.remoteIp || '').toLowerCase();
      const detailsText = formatAuditDetails(ev).toLowerCase();
      return (
        actor.includes(query) ||
        target.includes(query) ||
        action.includes(query) ||
        ip.includes(query) ||
        detailsText.includes(query)
      );
    });
  }, [auditLogs, summaryStaffAudits, auditSearch, auditSeverityFilter]);

  const pagedAudits = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return combinedAudits.slice(start, start + auditPageSize);
  }, [combinedAudits, auditPage, auditPageSize]);

  const quota = summary?.quotaMetrics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                Operations Compliance &amp; Audit
              </h1>
              <span className="rounded-full border border-[#1ED760]/30 bg-[#1ED760]/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                Meta-Style Ops
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Platform quota telemetry, payment gateway breakdown, order expiry lifecycle, session revocation, and immutable staff permission audits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Selector 7d / 30d / 12m */}
            <div className="inline-flex rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-0.5">
              {[
                { id: '7d', label: '7d' },
                { id: '30d', label: '30d' },
                { id: '12m', label: '12m' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => {
                    setTimeframe(tf.id);
                    setOrderPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    timeframe === tf.id
                      ? 'bg-[#1ED760] text-neutral-950'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('live-visitors')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5 text-[#1ED760]" />
                Live Visitors
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                loadSummary();
                loadAuditLogs();
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {(summaryError || auditError) && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 shadow-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="space-y-1">
                <p className="font-semibold text-red-800 dark:text-red-200">
                  Compliance &amp; Audit Telemetry Error
                </p>
                {summaryError && <p>{summaryError}</p>}
                {auditError && <p>{auditError}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (summaryError) loadSummary();
                if (auditError) loadAuditLogs();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Quota Telemetry Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Total Platform Users</span>
            <Users className="h-4 w-4 text-[#1ED760]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {Number(quota.totalUsers || 0).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Provisioned Stores</span>
            <Store className="h-4 w-4 text-[#1ED760]" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {Number(quota.totalStores || 0).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Active DB Connections</span>
            <Database className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {Number(quota.pgActive || 0).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Node Heap Footprint</span>
            <Cpu className="h-4 w-4 text-violet-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {Number(quota.memoryHeapMb || 0).toFixed(0)} MB
          </p>
        </div>
      </div>

      {/* Circular SVG Donut Analytics (7d / 30d / 12m) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AnalyticsDonutChart
          title="Payment Method Breakdown"
          subtitle={`bKash / Nagad / Card / Other (${timeframe})`}
          segments={paymentDonutSegments}
          centerLabel="Total Volume"
          formatValue={(v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        />

        <AnalyticsDonutChart
          title="Order Lifecycle Breakdown"
          subtitle={`Active / Completed / Expired / Cancelled (${timeframe})`}
          segments={orderDonutSegments}
          centerLabel="Orders"
        />

        <AnalyticsDonutChart
          title="CSAT & SLA Compliance"
          subtitle={`Service quality & SLA status (${timeframe})`}
          segments={csatSlaSegments}
          centerLabel="Reviews"
        />
      </div>

      {/* Payment Gateway Ledger + Session Revocation Security Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#1ED760]" />
              <div>
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Payment Gateway Ledger ({timeframe})
                </h2>
                <p className="text-xs text-neutral-500">Verified transaction breakdown by payment rail</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">Gateway / Method</th>
                  <th className="px-3 py-2.5 text-right">Transactions</th>
                  <th className="px-3 py-2.5 text-right">Unique Users</th>
                  <th className="px-4 py-2.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                {pagedLedger.map((row) => (
                  <tr key={row.method} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50">
                    <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">
                      {row.method}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.transactionsCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.uniqueUsersCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-950 dark:text-white">
                      {row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={ledgerPage}
            pageSize={ledgerPageSize}
            total={paymentRows.length}
            onPageChange={setLedgerPage}
            onPageSizeChange={setLedgerPageSize}
            itemLabel="gateways"
          />
        </div>

        {/* Security Action: Terminate User/Staff Sessions */}
        <div className="lg:col-span-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Emergency Session Termination
              </h2>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Immediately revoke all active JWT/browser sessions for a compromised or restricted user ID. Every action is logged to the immutable audit trail.
            </p>
          </div>

          <form onSubmit={handleTerminateSessions} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Target User ID or Billing ID
              </label>
              <input
                type="text"
                required
                value={termUserId}
                onChange={(e) => setTermUserId(e.target.value)}
                placeholder="e.g. usr_12345 or TIW-9810"
                className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Security Audit Reason
              </label>
              <input
                type="text"
                required
                value={termReason}
                onChange={(e) => setTermReason(e.target.value)}
                placeholder="Suspicious multi-location login or credential reset"
                className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={terminating || !termUserId.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 dark:bg-white py-2.5 text-xs font-semibold text-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              {terminating ? 'Terminating Sessions...' : 'Terminate Active Sessions'}
            </button>
          </form>
        </div>
      </div>

      {/* Cancelled, Expired & Active Orders Table */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-[#1ED760]" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Orders Lifecycle &amp; Expiry Audit ({timeframe})
              </h2>
              <p className="text-xs text-neutral-500">
                Active, cancelled, and expired orders with billing IDs, payment method, and exact expiry dates.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'active', 'completed', 'cancelled', 'expired'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter(st);
                    setOrderPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition cursor-pointer ${
                    orderStatusFilter === st
                      ? 'bg-[#1ED760] text-neutral-950 font-semibold'
                      : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <select
              value={orderGatewayFilter}
              onChange={(e) => {
                setOrderGatewayFilter(e.target.value);
                setOrderPage(1);
              }}
              aria-label="Filter orders by payment gateway"
              className="h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 focus:border-[#1ED760] focus:outline-none"
            >
              <option value="all">All Gateways</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-3 py-2.5">Customer / Billing ID</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Expiry Date</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {loading && displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    Loading platform orders...
                  </td>
                </tr>
              ) : displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    No orders match this status in the selected timeframe.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((ord) => (
                  <tr key={ord.id || ord.order_number} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {ord.order_number || `#${ord.id}`}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {ord.customer_name || ord.customer_email || `User ${ord.user_id || ''}`}
                      </p>
                      <p className="font-mono text-[10px] text-neutral-500">
                        {ord.billing_id || ord.user_id || '—'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                      {normalizeMethodLabel(ord.payment_method)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          ['cancelled', 'expired'].includes(ord.normalized_status || normalizeOrderStatus(ord.status))
                            ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                            : 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                        }`}
                      >
                        {ord.status || 'active'}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {fmtDate(ord.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-950 dark:text-white">
                      {ord.currency || 'USD'} {Number(ord.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={orderPage}
          pageSize={orderPageSize}
          total={totalOrdersCount}
          onPageChange={setOrderPage}
          onPageSizeChange={(next) => {
            setOrderPageSize(next);
            setOrderPage(1);
          }}
          itemLabel="orders"
        />
      </div>

      {/* Immutable Staff Permission Audit Trail */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-neutral-200/80 dark:border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#1ED760]" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Immutable Staff Permission Audit Trail
              </h2>
              <p className="text-xs text-neutral-500">
                Chronological permission, appeal resolution, and session security events across staff accounts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                placeholder="Search actor, target, action, IP..."
                aria-label="Search audit logs"
                className="h-8 w-60 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 pl-8 pr-3 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
              />
            </div>

            <select
              value={auditSeverityFilter}
              onChange={(e) => {
                setAuditSeverityFilter(e.target.value);
                setAuditPage(1);
              }}
              aria-label="Filter audit logs by severity"
              className="h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 focus:border-[#1ED760] focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Actor / Staff</th>
                <th className="px-3 py-2.5">Severity</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">IP</th>
                <th className="px-4 py-2.5">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {loadingAudits && pagedAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    Loading audit logs...
                  </td>
                </tr>
              ) : pagedAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    {auditSearch || auditSeverityFilter !== 'all'
                      ? 'No audit events match the active search or severity filter.'
                      : 'No staff permission audit events logged yet.'}
                  </td>
                </tr>
              ) : (
                pagedAudits.map((ev, idx) => {
                  const severity = inferAuditSeverity(ev);
                  return (
                    <tr key={ev.id || idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500 tabular-nums">
                        {fmtDateTime(ev.createdAt || ev.created_at || ev.timestamp)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                        {ev.actorName || ev.staffName || ev.staffEmail || ev.actorId || 'System'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            severity === 'critical'
                              ? 'bg-red-500/12 text-red-700 dark:text-red-400'
                              : severity === 'warning'
                              ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                              : 'bg-[#1ED760]/12 text-emerald-700 dark:text-[#1ED760]'
                          }`}
                        >
                          {severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                        {ev.action || ev.eventType || 'AUDIT'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-500">
                        {ev.targetUserId || ev.targetId || ev.staffId || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                        {ev.ip || ev.remoteIp || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                        {formatAuditDetails(ev)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={auditPage}
          pageSize={auditPageSize}
          total={combinedAudits.length}
          onPageChange={setAuditPage}
          onPageSizeChange={setAuditPageSize}
          itemLabel="audit logs"
        />
      </div>
    </div>
  );
}
