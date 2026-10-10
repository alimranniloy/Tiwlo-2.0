import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe2, Plus, RefreshCw, Server, ShieldCheck } from 'lucide-react';

export default function DomainsView({ currentUser, showToast }) {
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState({ type: 'A', name: '@', value: '', ttl: 300 });
  const [claimNotice, setClaimNotice] = useState(null);
  const [copiedNameserver, setCopiedNameserver] = useState('');

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
      else setClaimNotice({
        title: payload.code === 'FREE_DOMAIN_ALREADY_USED' ? 'Free domain already used' : 'Domain could not be registered',
        message: payload.error,
        maskedEmail: payload.maskedEmail
      });
    }).catch(error => {
      setClaimNotice({
        title: error.payload?.code === 'EMAIL_VERIFICATION_REQUIRED'
          ? 'Verify your email first'
          : error.payload?.code === 'FREE_DOMAIN_RATE_LIMITED'
            ? 'Too many attempts'
            : 'Domain could not be registered',
        message: error.payload?.error || error.message,
        maskedEmail: error.payload?.maskedEmail
      });
    });
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/subdomains/${encodeURIComponent(selected.id)}/records`, { credentials: 'include' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load DNS records.');
        setRecords(payload.records || []);
      })
      .catch(error => showToast?.(error.message, 'error'));
  }, [selected?.id]);

  const addRecord = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/subdomains/${encodeURIComponent(selected.id)}/records`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not create DNS record.');
      setRecords(current => [...current, payload.record]);
      setRecord({ type: 'A', name: '@', value: '', ttl: 300 });
      showToast?.('DNS record added.');
    } catch (error) {
      showToast?.(error.message, 'error');
    }
  };

  const copyNameserver = async (nameserver) => {
    try {
      await navigator.clipboard.writeText(nameserver);
      setCopiedNameserver(nameserver);
      window.setTimeout(() => setCopiedNameserver(''), 1600);
    } catch (error) {
      showToast?.('Could not copy nameserver.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071b35] via-[#0b3b63] to-[#0b57d0] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-blue-50">
              <ShieldCheck className="h-4 w-4" /> Managed DNS
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your domain control room</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Manage your uids.app address, authoritative nameservers, and DNS records from one focused workspace.</p>
          </div>
          <button type="button" onClick={loadDomains} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
      {claimNotice && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-base font-bold text-slate-900">{claimNotice.title}</p>
          <p className="mt-1 text-sm text-slate-600">{claimNotice.message}</p>
          {claimNotice.maskedEmail && (
            <p className="mt-3 text-xs text-slate-500">
              Linked account: <span className="font-semibold text-slate-700">{claimNotice.maskedEmail}</span>
            </p>
          )}
          <button type="button" onClick={() => setClaimNotice(null)} className="mt-4 text-xs font-bold text-[#0B57D0]">
            Dismiss
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <section className="rounded-3xl border border-[#E0E2EC] bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#5F6368]">Your domains</span>
            <button type="button" onClick={loadDomains} className="rounded-full p-2 text-[#5F6368] hover:bg-[#F0F4F9]" aria-label="Refresh domains"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {loading ? <p className="p-3 text-sm text-[#5F6368]">Loading…</p> : domains.length === 0 ? <p className="p-3 text-sm text-[#5F6368]">No registered domains yet.</p> : domains.map(domain => (
            <button key={domain.id} type="button" onClick={() => setSelected(domain)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm ${selected?.id === domain.id ? 'bg-[#C2E7FF] text-[#001D35]' : 'hover:bg-[#F0F4F9]'}`}>
              <Globe2 className="h-4 w-4" />
              <span className="truncate font-semibold">{domain.domain}</span>
            </button>
          ))}
        </section>
        <section className="rounded-3xl border border-[#E0E2EC] bg-white p-5 shadow-sm sm:p-7">
          {!selected ? <div className="py-16 text-center text-sm text-[#5F6368]">Register a uids.app domain to manage DNS here.</div> : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E0E2EC] pb-5">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0B57D0]">Selected domain</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">{selected.domain}</h2><p className="mt-1 text-sm text-emerald-700">Active · No expiry</p></div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" /> Tiwlo DNS active</span>
              </div>
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-start gap-3">
                  <Server className="mt-0.5 h-5 w-5 text-[#0B57D0]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900">Authoritative nameservers</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Use these nameservers for <span className="font-bold">{selected.domain}</span> only. DNS records added below are served for this domain.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(selected.nameservers || ['dns1.tiwlo.com', 'dns2.tiwlo.com']).map(nameserver => (
                        <button key={nameserver} type="button" onClick={() => copyNameserver(nameserver)} className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-left text-sm font-bold text-slate-800 hover:border-blue-300">
                          <span className="truncate">{nameserver}</span>
                          {copiedNameserver === nameserver ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Copy className="h-4 w-4 shrink-0 text-[#0B57D0]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div><h3 className="text-sm font-bold">DNS records for {selected.domain}</h3><p className="mt-1 text-xs text-[#5F6368]">Only this claimed domain can use and change these records.</p></div>
                </div>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E0E2EC]">
                  <table className="w-full text-left text-sm"><thead className="bg-[#F8F9FA] text-xs text-[#5F6368]"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">TTL</th></tr></thead><tbody>{records.map(item => <tr key={item.id} className="border-t border-[#E0E2EC]"><td className="px-4 py-3 font-bold">{item.type}</td><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3 break-all">{item.value}</td><td className="px-4 py-3">{item.ttl}</td></tr>)}</tbody></table>
                </div>
                <form onSubmit={addRecord} className="mt-5 grid gap-3 sm:grid-cols-[100px_1fr_1fr_90px_auto]">
                  <select value={record.type} onChange={event => setRecord({ ...record, type: event.target.value })} className="rounded-xl border border-[#DADCE0] px-3 py-2 text-sm"><option>A</option><option>CNAME</option><option>TXT</option></select>
                  <input value={record.name} onChange={event => setRecord({ ...record, name: event.target.value })} placeholder="Name" className="rounded-xl border border-[#DADCE0] px-3 py-2 text-sm" />
                  <input required value={record.value} onChange={event => setRecord({ ...record, value: event.target.value })} placeholder="Value" className="rounded-xl border border-[#DADCE0] px-3 py-2 text-sm" />
                  <input type="number" min="60" max="86400" value={record.ttl} onChange={event => setRecord({ ...record, ttl: event.target.value })} className="rounded-xl border border-[#DADCE0] px-3 py-2 text-sm" />
                  <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0B57D0] px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add</button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
