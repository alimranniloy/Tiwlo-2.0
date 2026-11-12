import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { requestSensitiveActionGrant } from '../security/reauth.js';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const EMPTY = { name: '@', type: 'TXT', content: '', ttl: 300, priority: 10 };

export default function AdminDnsView({ showToast }) {
  const [records, setRecords] = useState([]);
  const [zone, setZone] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('stockpro_session');
  const authHeaders = () => ({ ...(token() ? { Authorization: `Bearer ${token()}` } : {}) });
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/dns/records`, { credentials: 'include', headers: authHeaders() });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'DNS records could not be loaded.');
      setRecords(result.records || []);
      setZone(result.zone || '');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mutate = async (url, method, payload, successMessage) => {
    setSaving(true);
    setError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_BASE.replace(/\/api\/?$/, ''));
      const response = await fetch(`${API_BASE}${url}`, {
        method, credentials: 'include', headers,
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'DNS record could not be saved.');
      setEditing(null);
      setForm(EMPTY);
      showToast?.(successMessage);
      await load();
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (record) => {
    setEditing(record.id);
    setForm({ name: record.name, type: record.type, content: record.content, ttl: record.ttl, priority: record.priority ?? 10 });
  };

  const submit = (event) => {
    event.preventDefault();
    mutate(editing ? `/admin/dns/records/${encodeURIComponent(editing)}` : '/admin/dns/records', editing ? 'PUT' : 'POST', form,
      editing ? 'DNS record updated.' : 'DNS record added.');
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Globe className="h-5 w-5" /></span>
          <div><h2 className="text-xl font-bold text-neutral-900 dark:text-white">DNS records{zone ? ` · ${zone}` : ''}</h2><p className="text-sm text-neutral-500">Manage Tiwlo authoritative DNS, including website and mail records.</p></div>
          <button onClick={load} className="ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" type="button"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          These records are served by Tiwlo DNS. Public resolvers will use them only after the domain delegates to Tiwlo nameservers; Cloudflare remains authoritative while its nameservers are active.
        </p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <form onSubmit={submit} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-4 font-semibold">{editing ? 'Edit DNS record' : 'Add DNS record'}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="@, www, _dmarc, *" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2" /></label>
          <label className="text-sm">Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2">{['A','AAAA','CNAME','MX','NS','TXT'].map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="text-sm sm:col-span-2">Content / target<input required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="IP, hostname, or TXT value" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2" /></label>
          <label className="text-sm">TTL (seconds)<input required type="number" min="60" max="86400" value={form.ttl} onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })} className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2" /></label>
          {form.type === 'MX' && <label className="text-sm">Priority<input required type="number" min="0" max="65535" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2" /></label>}
        </div>
        <div className="mt-4 flex gap-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? 'Saving…' : editing ? 'Save changes' : 'Add record'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>}</div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b p-4 font-semibold">Current records {loading ? '· Loading…' : `· ${records.length}`}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-950"><tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Content</th><th className="p-3">TTL / Priority</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id} className="border-t border-neutral-100 dark:border-neutral-800"><td className="p-3 font-medium">{record.name === '@' ? zone : `${record.name}.${zone}`}</td><td className="p-3">{record.type}</td><td className="max-w-[420px] break-all p-3">{record.content}</td><td className="p-3">{record.ttl}{record.priority != null ? ` / ${record.priority}` : ''}</td><td className="p-3">{record.enabled ? record.isSystem ? 'System' : 'Active' : 'Disabled'}</td><td className="p-3"><div className="flex gap-2"><button type="button" title="Edit" onClick={() => beginEdit(record)} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Pencil className="h-4 w-4" /></button><button type="button" title="Delete" disabled={!record.enabled || saving} onClick={() => mutate(`/admin/dns/records/${encodeURIComponent(record.id)}`, 'DELETE', null, 'DNS record disabled.')} className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}{!loading && records.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-neutral-500">No records found.</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
  );
}
