import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, RefreshCw, ShieldAlert, Star } from 'lucide-react';
import { supportFetch as fetch } from '../../utils/supportFetch';
import PaginationBar from '../../components/PaginationBar';

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const PERFORMANCE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'top_performer', label: 'Top Performers' },
  { id: 'needs_attention', label: 'Needs Attention' },
  { id: 'slow_response', label: 'Slow Response' },
  { id: 'integrity_risk', label: 'Integrity Risk' },
];

export default function AdminStaffPerformancePanel({ apiBase = '/api', isSuperAdmin = false }) {
  const [category, setCategory] = useState('all');
  const [staffMetrics, setStaffMetrics] = useState([]);
  const [catalogCounts, setCatalogCounts] = useState({});
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [perfPage, setPerfPage] = useState(1);
  const [perfPageSize, setPerfPageSize] = useState(10);

  // Read-only Anti-Collusion Forensic Logs (Super Admin ONLY)
  const [forensicLogs, setForensicLogs] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);

  const loadMetrics = useCallback(async () => {
    setLoadingPerf(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/support/live-chats/staff-metrics?category=${encodeURIComponent(category)}`,
        {
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setStaffMetrics(Array.isArray(json.staffMetrics) ? json.staffMetrics : []);
        setCatalogCounts(json.catalogCounts || {});
      }
    } catch {
      // Ignore
    } finally {
      setLoadingPerf(false);
    }
  }, [apiBase, category]);

  const loadForensicLogs = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const res = await fetch(`${apiBase}/admin/support/live-chats/forensic-logs?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setForensicLogs(Array.isArray(json.logs) ? json.logs : []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingLogs(false);
    }
  }, [apiBase, isSuperAdmin, severityFilter]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadForensicLogs();
  }, [loadForensicLogs]);

  useEffect(() => {
    setPerfPage(1);
  }, [category, perfPageSize]);

  useEffect(() => {
    setLogsPage(1);
  }, [severityFilter, logsPageSize]);

  const pagedStaff = useMemo(() => {
    const start = (perfPage - 1) * perfPageSize;
    return staffMetrics.slice(start, start + perfPageSize);
  }, [staffMetrics, perfPage, perfPageSize]);

  const pagedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsPageSize;
    return forensicLogs.slice(start, start + logsPageSize);
  }, [forensicLogs, logsPage, logsPageSize]);

  return (
    <div className="space-y-6">
      {/* Staff Performance & Meta Catalogs */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#1ED760]" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Staff Performance &amp; Meta Catalogs
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                First Response Time, Avg/P95 Reply Speed, FCR, Escalations, Knowledge Contributions, and CSAT.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadMetrics}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingPerf ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/60 px-4 py-2.5">
          {PERFORMANCE_CATEGORIES.map((pill) => {
            const active = category === pill.id;
            const count = catalogCounts?.[pill.id];
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategory(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#1ED760] text-neutral-950 font-semibold'
                    : 'border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'
                }`}
              >
                <span>{pill.label}</span>
                {typeof count === 'number' && (
                  <span className="tabular-nums text-[10px] opacity-80">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Specialist</th>
                <th className="px-3 py-3 text-right">FRT</th>
                <th className="px-3 py-3 text-right">Avg / P95 Reply</th>
                <th className="px-3 py-3 text-right">FCR %</th>
                <th className="px-3 py-3 text-right">Escalation %</th>
                <th className="px-3 py-3 text-right">Knowledge</th>
                <th className="px-3 py-3 text-right">Avg CSAT</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {loadingPerf && pagedStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                    Loading staff metrics...
                  </td>
                </tr>
              ) : pagedStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
                    No staff records match this performance category.
                  </td>
                </tr>
              ) : (
                pagedStaff.map((row, idx) => (
                  <tr key={row.staffId || row.id || idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {row.name || row.staffName || 'Support Specialist'}
                      </p>
                      <p className="text-[11px] text-neutral-500">{row.role || row.department || 'Support'}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.frtSeconds != null ? `${Math.round(row.frtSeconds)}s` : row.frtMinutes != null ? `${Math.round(row.frtMinutes)}m` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {(row.avgReplySeconds != null ? `${Math.round(row.avgReplySeconds)}s` : '—')} / {(row.p95ReplySeconds != null ? `${Math.round(row.p95ReplySeconds)}s` : '—')}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-neutral-800 dark:text-neutral-200">
                      {row.fcrRate != null ? `${Math.round(row.fcrRate)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.escalationRate != null ? `${Math.round(row.escalationRate)}%` : '0%'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.knowledgeContributions ?? row.kbCount ?? 0}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1 font-medium text-neutral-900 dark:text-neutral-100">
                        <Star className="h-3.5 w-3.5 fill-[#1ED760] text-[#1ED760]" />
                        {row.avgCsat != null ? Number(row.avgCsat).toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="inline-flex rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-[#1ED760]">
                        {row.score != null ? Math.round(row.score) : '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={perfPage}
          pageSize={perfPageSize}
          total={staffMetrics.length}
          onPageChange={setPerfPage}
          onPageSizeChange={setPerfPageSize}
          itemLabel="specialists"
        />
      </div>

      {/* Super Admin Only: Read-Only Anti-Collusion Forensic Logs */}
      {isSuperAdmin && (
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Read-Only Anti-Collusion Forensic Logs
                  </h2>
                  <span className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
                    Super Admin Only · Immutable
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tamper-evident audit records for abnormal session access, rapid closes, and privilege checks.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                type="button"
                onClick={loadForensicLogs}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Actor / Staff</th>
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-4 py-2.5">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                {loadingLogs && pagedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      Loading forensic logs...
                    </td>
                  </tr>
                ) : pagedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      No forensic anomalies recorded.
                    </td>
                  </tr>
                ) : (
                  pagedLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500 tabular-nums">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            String(log.severity).toLowerCase() === 'high'
                              ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}
                        >
                          {log.severity || 'info'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                        {log.actorName || log.staffEmail || log.actorId || 'System'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                        {log.eventType || log.action || 'FORENSIC_AUDIT'}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                        {log.reason || log.summary || log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={logsPage}
            pageSize={logsPageSize}
            total={forensicLogs.length}
            onPageChange={setLogsPage}
            onPageSizeChange={setLogsPageSize}
            itemLabel="forensic logs"
          />
        </div>
      )}
    </div>
  );
}
