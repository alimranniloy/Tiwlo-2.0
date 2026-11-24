import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { requestSensitiveActionGrant } from '../security/reauth.js';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || window.location.origin;
const EMPTY = { name: '@', type: 'TXT', content: '', ttl: 300, priority: 10 };

export default function AdminDnsView({ showToast }) {
  const [records, setRecords] = useState([]);
  const [zone, setZone] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/dns/records`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'DNS records could not be loaded.');
        if (!active) return;
        setRecords(result.records || []);
        setZone(result.zone || '');
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRecords();
    return () => {
      active = false;
    };
  }, [authHeaders, reloadTick]);

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  };

  const mutate = async (url, method, payload, successMessage) => {
    setSaving(true);
    setError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const response = await fetch(`${API_BASE}${url}`, {
        method,
        credentials: 'include',
        headers,
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'DNS record could not be saved.');
      setEditing(null);
      setForm(EMPTY);
      showToast?.(successMessage, 'success');
      handleRefresh();
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (record) => {
    setEditing(record.id);
    setForm({
      name: record.name,
      type: record.type,
      content: record.content,
      ttl: record.ttl,
      priority: record.priority ?? 10,
    });
  };

  const submit = (event) => {
    event.preventDefault();
    mutate(
      editing ? `/admin/dns/records/${encodeURIComponent(editing)}` : '/admin/dns/records',
      editing ? 'PUT' : 'POST',
      form,
      editing ? 'DNS record updated.' : 'DNS record added.'
    );
  };

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                DNS Records{zone ? ` · ${zone}` : ''}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Manage Tiwlo authoritative DNS, including website and mail records.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:ml-auto sm:self-auto"
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <p className="mt-4 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
          These records are served by Tiwlo DNS. Public resolvers will use them only after the domain delegates to Tiwlo nameservers; Cloudflare remains authoritative while its nameservers are active.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <h3 className="mb-4 text-sm font-semibold text-neutral-950 dark:text-white">
          {editing ? 'Edit DNS Record' : 'Add DNS Record'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="@, www, _dmarc, *"
              className="mt-1 h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </label>
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Type
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            >
              {['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 sm:col-span-2">
            Content / Target
            <input
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="IP, hostname, or TXT value"
              className="mt-1 h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </label>
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            TTL (seconds)
            <input
              required
              type="number"
              min="60"
              max="86400"
              value={form.ttl}
              onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
              className="mt-1 h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </label>
          {form.type === 'MX' && (
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Priority
              <input
                required
                type="number"
                min="0"
                max="65535"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add record'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
              className="inline-flex h-9 items-center rounded-xl border border-neutral-200/80 bg-white px-4 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200/80 px-4 py-3 text-sm font-semibold text-neutral-950 dark:border-neutral-800 dark:text-white">
          Current Records{' '}
          <span className="text-xs font-normal tabular-nums text-neutral-500">
            {loading ? '· Loading…' : `· ${records.length}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Content</th>
                <th className="px-3 py-3">TTL / Priority</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                  <td className="px-4 py-3 font-mono font-medium text-neutral-900 dark:text-white">
                    {record.name === '@' ? zone : `${record.name}.${zone}`}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                      {record.type}
                    </span>
                  </td>
                  <td className="max-w-[420px] break-all px-3 py-3 font-mono text-neutral-700 dark:text-neutral-300">
                    {record.content}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-neutral-600 dark:text-neutral-400">
                    {record.ttl}
                    {record.priority != null ? ` / ${record.priority}` : ''}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        record.isSystem
                          ? 'border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                          : record.enabled
                            ? 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                            : 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {record.isSystem ? 'System Locked' : record.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        title={record.isSystem ? 'System record is locked and auto-protected' : 'Edit'}
                        disabled={record.isSystem}
                        onClick={() => beginEdit(record)}
                        className="rounded-lg border border-neutral-200/80 p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={record.isSystem ? 'Critical system DNS records cannot be deleted' : 'Delete'}
                        disabled={record.isSystem || !record.enabled || saving}
                        onClick={() =>
                          mutate(
                            `/admin/dns/records/${encodeURIComponent(record.id)}`,
                            'DELETE',
                            null,
                            'DNS record disabled.'
                          )
                        }
                        className="rounded-lg border border-neutral-200/80 p-1.5 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
