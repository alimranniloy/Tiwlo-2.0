import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Edit3, Globe2, MoreVertical, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';

const EMPTY_RECORD = { type: 'A', name: '@', value: '', ttl: 300 };

export default function DomainsView({ currentUser, showToast }) {
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(EMPTY_RECORD);
  const [editing, setEditing] = useState(null);
  const [claimNotice, setClaimNotice] = useState(null);
  const [copied, setCopied] = useState('');

  const loadDomains = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subdomains', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load domains.');
      setDomains(payload.domains || []);
      setSelected(current => current || payload.domains?.[0] || null);
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (domain = selected) => {
    if (!domain) return;
    try {
      const response = await fetch(`/api/subdomains/${encodeURIComponent(domain.id)}/records`, { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load DNS records.');
      setRecords(payload.records || []);
    } catch (error) {
      showToast?.(error.message, 'error');
    }
  };

  useEffect(() => { loadDomains(); }, [currentUser?.id]);

  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get('domain_claim');
    if (!pending || !currentUser?.id) return;
    fetch('/api/subdomains/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pending })
    }).then(async response => {
      const payload = await response.json();
      if (!response.ok && response.status !== 409) {
        const error = new Error(payload.error || 'Could not claim domain.');
        error.payload = payload;
        throw error;
      }
      window.history.replaceState(null, '', '/domains');
      await loadDomains();
      if (response.ok) showToast?.(`${payload.registration.domain} registered successfully.`);
      else setClaimNotice({ title: 'Free domain already used', message: payload.error, maskedEmail: payload.maskedEmail });
    }).catch(error => setClaimNotice({
      title: error.payload?.code === 'EMAIL_VERIFICATION_REQUIRED' ? 'Verify your email first' : 'Domain could not be registered',
      message: error.payload?.error || error.message,
      maskedEmail: error.payload?.maskedEmail
    }));
  }, [currentUser?.id]);

  useEffect(() => {
    setEditing(null);
    setRecord(EMPTY_RECORD);
    loadRecords(selected);
  }, [selected?.id]);

  const nameservers = useMemo(() => selected?.nameservers || ['dns1.tiwlo.com', 'dns2.tiwlo.com'], [selected]);
  const nsRecords = records.filter(item => item.type === 'NS');
  const otherRecords = records.filter(item => item.type !== 'NS');

  const submitRecord = async event => {
    event.preventDefault();
    if (!selected) return;
    const url = editing
      ? `/api/subdomains/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(editing.id)}`
      : `/api/subdomains/${encodeURIComponent(selected.id)}/records`;
    try {
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save DNS record.');
      setRecords(current => editing ? current.map(item => item.id === editing.id ? payload.record : item) : [...current, payload.record]);
      setRecord(EMPTY_RECORD);
      setEditing(null);
      showToast?.(editing ? 'DNS record updated.' : 'DNS record added.');
    } catch (error) {
      showToast?.(error.message, 'error');
    }
  };

  const deleteRecord = async item => {
    if (!window.confirm(`Delete ${item.type} record ${item.name}?`)) return;
    try {
      const response = await fetch(`/api/subdomains/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(item.id)}`, { method: 'DELETE', credentials: 'include' });
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not delete DNS record.');
      setRecords(current => current.filter(recordItem => recordItem.id !== item.id));
      if (editing?.id === item.id) { setEditing(null); setRecord(EMPTY_RECORD); }
      showToast?.('DNS record deleted.');
    } catch (error) {
      showToast?.(error.message, 'error');
    }
  };

  const copy = async value => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1400);
    } catch (error) {
      showToast?.('Could not copy value.', 'error');
    }
  };

  const startEdit = item => {
    setEditing(item);
    setRecord({ type: item.type, name: item.name, value: item.value, ttl: item.ttl });
  };

  const recordForm = (
    <form onSubmit={submitRecord} className="grid gap-3 rounded-xl border border-[#dadce0] bg-[#f8fafd] p-4 md:grid-cols-[120px_1fr_1.5fr_100px_auto]">
      <select value={record.type} onChange={event => setRecord({ ...record, type: event.target.value })} className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm">
        <option>A</option><option>CNAME</option><option>TXT</option><option>NS</option>
      </select>
      <input value={record.name} onChange={event => setRecord({ ...record, name: event.target.value })} placeholder="Name, e.g. @" className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm" required />
      <input value={record.value} onChange={event => setRecord({ ...record, value: event.target.value })} placeholder={record.type === 'NS' ? 'ns1.example.com' : 'Value'} className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm" required />
      <input type="number" min="60" max="86400" value={record.ttl} onChange={event => setRecord({ ...record, ttl: event.target.value })} className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button type="submit" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1a73e8] px-3 py-2 text-sm font-bold text-white hover:bg-[#1769d1]"><Plus className="h-4 w-4" /> {editing ? 'Save' : 'Add'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setRecord(EMPTY_RECORD); }} className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm">Cancel</button>}
      </div>
    </form>
  );

  const recordsTable = items => (
    <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-[#f8fafd] text-xs font-bold text-[#5f6368]"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">TTL</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id} className="border-t border-[#e8eaed] hover:bg-[#f8fafd]">
          <td className="px-4 py-3 font-bold text-[#1a73e8]">{item.type}</td><td className="px-4 py-3 font-medium">{item.name}</td><td className="max-w-xs break-all px-4 py-3 text-[#3c4043]">{item.value}</td><td className="px-4 py-3 text-[#5f6368]">{item.ttl}</td>
          <td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => startEdit(item)} className="rounded-lg p-2 text-[#5f6368] hover:bg-[#e8f0fe] hover:text-[#1a73e8]" aria-label={`Edit ${item.type} record`}><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => deleteRecord(item)} className="rounded-lg p-2 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]" aria-label={`Delete ${item.type} record`}><Trash2 className="h-4 w-4" /></button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-[#202124]">
      <div className="flex items-center justify-between border-b border-[#dadce0] pb-4">
        <div><p className="text-xs font-bold uppercase tracking-wide text-[#1a73e8]">Cloud DNS</p><h1 className="mt-1 text-2xl font-normal">Domains</h1><p className="mt-1 text-sm text-[#5f6368]">Manage your uids.app domain and DNS records.</p></div>
        <button type="button" onClick={loadDomains} className="rounded-full p-3 text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Refresh domains"><RefreshCw className="h-5 w-5" /></button>
      </div>
      {claimNotice && <div className="rounded-xl border border-[#fbbc04] bg-[#fef7e0] p-4 text-sm"><strong>{claimNotice.title}</strong><p className="mt-1">{claimNotice.message}</p><button type="button" onClick={() => setClaimNotice(null)} className="mt-2 font-bold text-[#1a73e8]">Dismiss</button></div>}
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-[#dadce0] bg-white p-2">
          <div className="flex items-center justify-between px-3 py-3 text-xs font-bold uppercase tracking-wide text-[#5f6368]"><span>My domains</span><MoreVertical className="h-4 w-4" /></div>
          {loading ? <p className="p-3 text-sm text-[#5f6368]">Loading…</p> : domains.length === 0 ? <p className="p-3 text-sm text-[#5f6368]">No registered domains.</p> : domains.map(domain => <button key={domain.id} type="button" onClick={() => setSelected(domain)} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${selected?.id === domain.id ? 'bg-[#e8f0fe] font-bold text-[#174ea6]' : 'hover:bg-[#f1f3f4]'}`}><Globe2 className="h-4 w-4" /><span className="truncate">{domain.domain}</span></button>)}
        </aside>
        <main className="space-y-5">
          {!selected ? <div className="rounded-xl border border-[#dadce0] bg-white p-12 text-center text-sm text-[#5f6368]">Register a uids.app domain to manage DNS here.</div> : <>
            <section className="rounded-xl border border-[#dadce0] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#5f6368]">Domain</p><h2 className="mt-1 text-2xl font-normal">{selected.domain}</h2><p className="mt-1 text-sm text-[#188038]"><Check className="mr-1 inline h-4 w-4" />Active</p></div><span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-bold text-[#174ea6]">Managed by Tiwlo DNS</span></div>
              <div className="mt-5 border-t border-[#e8eaed] pt-5"><div className="flex items-center gap-2"><Server className="h-5 w-5 text-[#1a73e8]" /><h3 className="font-bold">Nameservers</h3></div><p className="mt-1 text-sm text-[#5f6368]">You can use multiple nameservers. Add custom NS records below when this domain is delegated to them.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{nameservers.map(value => <button key={value} type="button" onClick={() => copy(value)} className="flex items-center justify-between rounded-lg border border-[#dadce0] px-3 py-2 text-left text-sm hover:bg-[#f8fafd]"><span>{value}</span>{copied === value ? <Check className="h-4 w-4 text-[#188038]" /> : <Copy className="h-4 w-4 text-[#1a73e8]" />}</button>)}</div></div>
            </section>
            <section className="rounded-xl border border-[#dadce0] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="text-lg font-normal">Nameserver records</h3><p className="mt-1 text-sm text-[#5f6368]">Add, edit, or delete multiple NS records for this domain.</p></div><Server className="h-5 w-5 text-[#1a73e8]" /></div><div className="mt-4">{nsRecords.length ? recordsTable(nsRecords) : <p className="rounded-lg bg-[#f8fafd] p-4 text-sm text-[#5f6368]">No custom NS records configured.</p>}</div><div className="mt-4">{recordForm}</div></section>
            <section className="rounded-xl border border-[#dadce0] bg-white p-5"><h3 className="text-lg font-normal">Other DNS records</h3><p className="mt-1 text-sm text-[#5f6368]">A, CNAME, and TXT records served only for {selected.domain}.</p><div className="mt-4">{otherRecords.length ? recordsTable(otherRecords) : <p className="rounded-lg bg-[#f8fafd] p-4 text-sm text-[#5f6368]">No records configured.</p>}</div></section>
          </>}
        </main>
      </div>
    </div>
  );
}
