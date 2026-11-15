import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function getSeverityBadgeClass(severity) {
  const s = String(severity || 'info').toLowerCase();
  if (s === 'critical' || s === 'error') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  if (s === 'warning') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]';
}

function getEmailStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered' || s === 'sent' || s === 'accepted') {
    return 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]';
  }
  if (s === 'pending' || s === 'queued') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
}

export default function AdminLogsView({ onBackToDashboard, showToast }) {
  const [activeTab, setActiveTab] = useState('security'); // 'security' | 'email'
  const [events, setEvents] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [emailConfig, setEmailConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Security filters
  const [secSearch, setSecSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Email filters & SMTP test
  const [emailSearch, setEmailSearch] = useState('');
  const [emailTypeFilter, setEmailTypeFilter] = useState('all');
  const [emailStatusFilter, setEmailStatusFilter] = useState('all');
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [secRes, cfgRes, outboxRes] = await Promise.all([
          fetch(`${API_BASE}/admin/security-events?limit=200`, { credentials: 'include', headers }),
          fetch(`${API_BASE}/admin/email-config`, { credentials: 'include', headers }),
          fetch(`${API_BASE}/admin/email-outbox?limit=200`, { credentials: 'include', headers }),
        ]);

        const [secJson, cfgJson, outboxJson] = await Promise.all([
          secRes.json().catch(() => ({})),
          cfgRes.json().catch(() => ({})),
          outboxRes.json().catch(() => ({})),
        ]);

        if (!active) return;

        if (!secRes.ok && !cfgRes.ok && !outboxRes.ok) {
          throw new Error(secJson.error || 'Could not fetch audit logs or email outbox.');
        }

        setEvents(Array.isArray(secJson.events) ? secJson.events : []);
        setEmailConfig(cfgJson.config || null);
        setOutbox(Array.isArray(outboxJson.outbox) ? outboxJson.outbox : []);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load logs.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadLogs();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  };

  const handleSendSmtpTest = async (e) => {
    e.preventDefault();
    if (!testRecipient.trim()) return;
    try {
      setSendingTest(true);
      setTestResult(null);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/email-test`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to: testRecipient.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      setTestResult({ ok: res.ok && json.success, ...json });
      if (res.ok && json.success) {
        showToast?.(`SMTP test email sent to ${testRecipient.trim()}.`, 'success');
        handleRefresh();
      } else {
        showToast?.(json.error || 'SMTP test delivery failed.', 'error');
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message || 'Network error running SMTP test.' });
      showToast?.(err.message || 'SMTP test failed.', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const q = secSearch.trim().toLowerCase();
    return events.filter((ev) => {
      const sev = String(ev.severity || 'info').toLowerCase();
      if (severityFilter !== 'all' && sev !== severityFilter) return false;
      if (!q) return true;
      const detailsText = typeof ev.details === 'object' ? JSON.stringify(ev.details) : String(ev.details || '');
      return [
        ev.event_type,
        ev.eventType,
        ev.user_id,
        ev.userId,
        ev.email,
        ev.subject,
        ev.subject_hash,
        ev.remote_ip,
        ev.remoteIp,
        detailsText,
      ].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [events, secSearch, severityFilter]);

  const emailTypes = useMemo(() => {
    const set = new Set();
    for (const item of outbox) {
      if (item.type) set.add(item.type);
    }
    return ['all', ...Array.from(set)];
  }, [outbox]);

  const filteredOutbox = useMemo(() => {
    const q = emailSearch.trim().toLowerCase();
    return outbox.filter((item) => {
      if (emailTypeFilter !== 'all' && item.type !== emailTypeFilter) return false;
      const st = String(item.status || '').toLowerCase();
      if (emailStatusFilter === 'delivered' && !['delivered', 'sent', 'accepted'].includes(st)) return false;
      if (emailStatusFilter === 'failed' && ['delivered', 'sent', 'accepted'].includes(st)) return false;
      if (!q) return true;
      return [item.to, item.from, item.subject, item.type, item.status, item.error]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [outbox, emailSearch, emailTypeFilter, emailStatusFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Security Audit Logs &amp; Email Outbox
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Inspect immutable platform security events, transactional email delivery logs, and live SMTP relay diagnostics.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Subtab Bar */}
      <div className="inline-flex flex-wrap rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
            activeTab === 'security'
              ? 'bg-[#1ED760] font-semibold text-black'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Security &amp; Audit Events ({events.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
            activeTab === 'email'
              ? 'bg-[#1ED760] font-semibold text-black'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Email Delivery Outbox &amp; SMTP Test ({outbox.length})
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {activeTab === 'security' ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col justify-between gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'info', 'warning', 'error', 'critical'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition ${
                    severityFilter === sev
                      ? 'border-[#1ED760] bg-[#1ED760] font-semibold text-black'
                      : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={secSearch}
                onChange={(e) => setSecSearch(e.target.value)}
                placeholder="Search event type, user, IP, details..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-3 py-3">Event Type</th>
                  <th className="px-3 py-3">User / Subject</th>
                  <th className="px-3 py-3">IP &amp; Details</th>
                  <th className="px-4 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                      Loading security events...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-neutral-300 dark:text-neutral-700" />
                      No security events match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const eventType = ev.eventType || ev.event_type || 'event';
                    const severity = ev.severity || 'info';
                    const userId = ev.userId || ev.user_id;
                    const subject = ev.email || ev.subject || (ev.subject_hash ? `hash:${String(ev.subject_hash).slice(0, 12)}…` : null);
                    const ip = ev.remoteIp || ev.remote_ip || '—';
                    const timestamp = ev.createdAt || ev.created_at;
                    const detailsObj = ev.details && typeof ev.details === 'object' ? ev.details : {};
                    const detailEntries = Object.entries(detailsObj);

                    return (
                      <tr key={ev.id} className="align-top hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${getSeverityBadgeClass(
                              severity
                            )}`}
                          >
                            {severity}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono font-semibold text-neutral-900 dark:text-white">
                          {eventType}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {subject || 'System / Anonymous'}
                          </div>
                          {userId && (
                            <div className="font-mono text-[10px] text-neutral-500">User: {userId}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                            IP: {ip}
                          </div>
                          {detailEntries.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {detailEntries.slice(0, 4).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded border border-neutral-200/80 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                                >
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-neutral-500">
                          {timestamp ? new Date(timestamp).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SMTP Config & Quick Test */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-5">
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Active SMTP Transport
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Live mail configuration from server environment.
              </p>
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                  <dt className="text-neutral-500">Sender</dt>
                  <dd className="font-mono font-medium text-neutral-900 dark:text-white">
                    {emailConfig?.senderEmail || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                  <dt className="text-neutral-500">Provider</dt>
                  <dd className="font-mono text-neutral-800 dark:text-neutral-200">
                    {emailConfig?.smtp?.provider || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                  <dt className="text-neutral-500">Host : Port</dt>
                  <dd className="font-mono tabular-nums text-neutral-800 dark:text-neutral-200">
                    {emailConfig?.smtp?.host ? `${emailConfig.smtp.host}:${emailConfig.smtp.port}` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">TLS Mode</dt>
                  <dd className="font-mono text-neutral-800 dark:text-neutral-200">
                    {emailConfig?.smtp?.secure ? 'SMTPS (TLS)' : 'STARTTLS / Standard'}
                  </dd>
                </div>
              </dl>
            </div>

            <form
              onSubmit={handleSendSmtpTest}
              className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-7"
            >
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Send Live SMTP Deliverability Test
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Verifies live SMTP handshake and dispatches a real diagnostic email via `/api/admin/email-test`.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                  className="h-9 flex-1 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>

              {testResult && (
                <div
                  className={`mt-3 rounded-xl border p-3 text-xs ${
                    testResult.ok
                      ? 'border-[#1ED760]/40 bg-[#1ED760]/10 text-emerald-800 dark:text-[#1ED760]'
                      : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.ok ? 'SMTP Test Delivered' : 'SMTP Test Failed'}
                  </div>
                  {testResult.error && <p className="mt-1">{testResult.error}</p>}
                  {testResult.troubleshooting && <p className="mt-1 text-[11px] opacity-90">{testResult.troubleshooting}</p>}
                </div>
              )}
            </form>
          </div>

          {/* Outbox Table */}
          <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-col justify-between gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={emailStatusFilter}
                  onChange={(e) => setEmailStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>

                <select
                  value={emailTypeFilter}
                  onChange={(e) => setEmailTypeFilter(e.target.value)}
                  className="h-9 rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {emailTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All Email Types' : type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Search recipient, subject..."
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-3 py-3">Recipient</th>
                    <th className="px-3 py-3">Subject</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Error / Message ID</th>
                    <th className="px-4 py-3 text-right">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                        Loading email delivery outbox...
                      </td>
                    </tr>
                  ) : filteredOutbox.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                        No email deliveries found.
                      </td>
                    </tr>
                  ) : (
                    filteredOutbox.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${getEmailStatusBadgeClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium text-neutral-900 dark:text-white">
                          {item.to}
                        </td>
                        <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                          {item.subject}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-neutral-500">
                          {item.type}
                        </td>
                        <td className="px-3 py-3 max-w-[240px]">
                          {item.error ? (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400">{item.error}</span>
                          ) : item.messageId ? (
                            <span className="font-mono text-[10px] text-neutral-400 break-all">{item.messageId}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-neutral-500">
                          {item.createdAt || item.timestamp
                            ? new Date(item.createdAt || item.timestamp).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
