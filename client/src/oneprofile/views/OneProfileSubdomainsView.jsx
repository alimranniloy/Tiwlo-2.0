import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  LoaderCircle,
  Plus,
  RefreshCw,
  Server,
  Trash2
} from 'lucide-react';
import {
  DNS1_SUBDOMAIN,
  DNS2_SUBDOMAIN,
  FREE_SUBDOMAIN_DOMAIN,
  PLATFORM_DOMAIN
} from '../../config/platformConfig';

const EMPTY_RECORD = { type: 'A', name: '@', value: '', ttl: 300 };

export default function OneProfileSubdomainsView({
  currentUser,
  domains: initialDomains = [],
  onDomainClaimed,
  onNavigateTab
}) {
  const [domains, setDomains] = useState(initialDomains);
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomains[0]?.id || null);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // DNS Record state
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordFormState, setRecordFormState] = useState(EMPTY_RECORD);
  const [editingRecord, setEditingRecord] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (Array.isArray(initialDomains) && initialDomains.length > 0) {
      setDomains((prev) => {
        const merged = [...initialDomains];
        for (const item of prev) {
          if (!merged.some((d) => d.id === item.id)) merged.unshift(item);
        }
        return merged;
      });
      setSelectedDomainId((current) => current || initialDomains[0]?.id || null);
    }
  }, [initialDomains]);

  const loadDomains = async () => {
    try {
      const response = await fetch('/api/subdomains', { credentials: 'include' });
      const data = await response.json();
      if (response.ok && Array.isArray(data.domains)) {
        setDomains(data.domains);
        setSelectedDomainId((current) => current || data.domains[0]?.id || null);
      }
    } catch (_) {
      // Keep initial summary domains on transient error
    }
  };

  useEffect(() => {
    loadDomains();
  }, [currentUser?.id]);

  // Auto-claim from ?domain_claim=<name> query parameter when redirected from uids.app search
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pendingClaim = (params.get('domain_claim') || '').trim().toLowerCase();
    if (!pendingClaim) return;

    setNewSubdomain(pendingClaim);
    let cancelled = false;

    (async () => {
      setClaiming(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch('/api/subdomains/claim', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: pendingClaim })
        });
        const data = await response.json();
        window.history.replaceState(null, '', '/oneprofile/subdomains');
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error || 'Could not claim this subdomain.');
          return;
        }
        if (data.registration?.id) {
          setDomains((prev) => {
            const exists = prev.some((d) => d.id === data.registration.id);
            return exists ? prev : [data.registration, ...prev];
          });
          setSelectedDomainId(data.registration.id);
          onDomainClaimed?.(data.registration);
          setNewSubdomain('');
          setAvailability(null);
          setNotice(`${data.registration.domain} is now live and connected to your workspace.`);
        }
      } catch (claimErr) {
        if (!cancelled) {
          setError(claimErr.message || 'Could not claim this subdomain.');
        }
      } finally {
        if (!cancelled) setClaiming(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const name = newSubdomain.trim();
    if (!name) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      setError('');
      try {
        const response = await fetch(`/api/subdomains/check?name=${encodeURIComponent(name)}`, {
          credentials: 'include',
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not check subdomain availability.');
        setAvailability(data);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setAvailability(null);
          setError(requestError.message || 'Could not check subdomain availability.');
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [newSubdomain]);

  const selectedDomain = useMemo(
    () => domains.find((d) => d.id === selectedDomainId) || domains[0] || null,
    [domains, selectedDomainId]
  );

  const loadRecords = async (domainId) => {
    if (!domainId) {
      setRecords([]);
      return;
    }
    setLoadingRecords(true);
    try {
      const response = await fetch(`/api/subdomains/${encodeURIComponent(domainId)}/records`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load DNS records.');
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message || 'Could not load DNS records.');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    setEditingRecord(null);
    setRecordFormState(EMPTY_RECORD);
    setConfirmDeleteId(null);
    if (selectedDomain?.id) {
      loadRecords(selectedDomain.id);
    }
  }, [selectedDomain?.id]);

  const claimDomain = async (event) => {
    event.preventDefault();
    if (!availability?.available || availability.name !== newSubdomain.trim().toLowerCase() || claiming) return;
    setClaiming(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/subdomains/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: availability.name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not claim this subdomain.');
      if (!data.registration?.id || !data.registration?.domain) {
        throw new Error('The server did not return the claimed subdomain.');
      }
      setDomains((prev) => [data.registration, ...prev.filter((d) => d.id !== data.registration.id)]);
      setSelectedDomainId(data.registration.id);
      onDomainClaimed?.(data.registration);
      setNewSubdomain('');
      setAvailability(null);
      setNotice(`${data.registration.domain} claimed and provisioned with default DNS records.`);
    } catch (requestError) {
      setError(requestError.message || 'Could not claim this subdomain.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSubdomainChange = (event) => {
    setNewSubdomain(event.target.value.toLowerCase());
    setAvailability(null);
    setChecking(false);
    setError('');
  };

  const copyValue = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (copyError) {
      setError(`Could not copy: ${copyError.message}`);
    }
  };

  const submitDnsRecord = async (event) => {
    event.preventDefault();
    if (!selectedDomain?.id || savingRecord) return;
    setSavingRecord(true);
    setError('');
    setNotice('');
    const url = editingRecord
      ? `/api/subdomains/${encodeURIComponent(selectedDomain.id)}/records/${encodeURIComponent(editingRecord.id)}`
      : `/api/subdomains/${encodeURIComponent(selectedDomain.id)}/records`;
    try {
      const response = await fetch(url, {
        method: editingRecord ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: recordFormState.type,
          name: recordFormState.name,
          value: recordFormState.value,
          ttl: Number(recordFormState.ttl) || 300
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save DNS record.');
      setRecords((prev) =>
        editingRecord
          ? prev.map((r) => (r.id === editingRecord.id ? data.record : r))
          : [...prev, data.record]
      );
      setRecordFormState(EMPTY_RECORD);
      setEditingRecord(null);
      setNotice(editingRecord ? 'DNS record updated.' : 'DNS record added.');
    } catch (err) {
      setError(err.message || 'Could not save DNS record.');
    } finally {
      setSavingRecord(false);
    }
  };

  const deleteDnsRecord = async (recordItem) => {
    if (!selectedDomain?.id) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        `/api/subdomains/${encodeURIComponent(selectedDomain.id)}/records/${encodeURIComponent(recordItem.id)}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not delete DNS record.');
      setRecords((prev) => prev.filter((r) => r.id !== recordItem.id));
      if (editingRecord?.id === recordItem.id) {
        setEditingRecord(null);
        setRecordFormState(EMPTY_RECORD);
      }
      setConfirmDeleteId(null);
      setNotice(`${recordItem.type} record (${recordItem.name}) deleted.`);
    } catch (err) {
      setError(err.message || 'Could not delete DNS record.');
    }
  };

  const nameservers = useMemo(
    () =>
      selectedDomain?.nameservers?.length
        ? selectedDomain.nameservers
        : [`${DNS1_SUBDOMAIN}.${PLATFORM_DOMAIN}`, `${DNS2_SUBDOMAIN}.${PLATFORM_DOMAIN}`],
    [selectedDomain]
  );

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Subdomain & DNS Management</h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Claim your free .{FREE_SUBDOMAIN_DOMAIN} subdomain, manage DNS records, and launch your instant site.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadDomains();
            if (selectedDomain?.id) loadRecords(selectedDomain.id);
          }}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-800 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-xs font-bold text-emerald-900 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-semibold text-rose-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-xs font-bold text-rose-900 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={claimDomain} className="bg-white rounded-2xl border border-neutral-200/90 p-5 sm:p-6 shadow-2xs">
        <h3 className="text-sm font-extrabold text-neutral-900 mb-1.5 flex items-center gap-2">
          <Globe className="w-4 h-4 text-neutral-600" />
          <span>Register Free .{FREE_SUBDOMAIN_DOMAIN} Subdomain</span>
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Instant global activation with free SSL and Edge DNS records. Each verified account includes 1 free .{FREE_SUBDOMAIN_DOMAIN} subdomain.
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <div className="flex-1 w-full">
            <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus-within:border-neutral-400 focus-within:bg-white transition">
              <input
                type="text"
                autoComplete="off"
                maxLength={63}
                pattern="[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
                title="Use 1-63 letters, numbers, or hyphens; do not start or end with a hyphen."
                placeholder="your-project"
                value={newSubdomain}
                onChange={handleSubdomainChange}
                className="bg-transparent text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none w-full"
                aria-label="Subdomain name"
              />
              <span className="text-xs font-bold text-emerald-700 pl-2 shrink-0">.{FREE_SUBDOMAIN_DOMAIN}</span>
            </div>
            {checking && <p className="mt-2 text-xs text-neutral-500">Checking availability…</p>}
            {!checking && availability && (
              <p className={`mt-2 text-xs font-semibold ${availability.available ? 'text-emerald-700' : 'text-rose-700'}`}>
                {availability.available
                  ? `✓ ${availability.domain} is available to claim.`
                  : `✕ ${availability.domain} is ${availability.status}.`}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!availability?.available || availability.name !== newSubdomain.trim().toLowerCase() || claiming || checking}
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition"
          >
            {claiming && <LoaderCircle className="w-4 h-4 animate-spin" />}
            <span>{claiming ? 'Claiming…' : 'Claim Subdomain'}</span>
          </button>
        </div>
      </form>

      <section className="bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-neutral-900">Your Active Subdomains</h3>
          <span className="text-xs font-semibold text-neutral-500">{domains.length} connected</span>
        </div>

        <div className="divide-y divide-neutral-100">
          {domains.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-500">
              No .{FREE_SUBDOMAIN_DOMAIN} subdomain has been claimed yet. Search above to claim your free address.
            </div>
          ) : (
            domains.map((sub) => {
              const isSelected = selectedDomain?.id === sub.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedDomainId(sub.id)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition ${
                    isSelected ? 'bg-neutral-50/90' : 'hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-extrabold text-neutral-900 text-sm font-mono break-all">{sub.domain}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                        {sub.status || 'active'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold">
                        SSL Active
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-700">Nameservers</span>
                      <span>→</span>
                      <span className="font-mono text-neutral-600">
                        {(sub.nameservers?.length ? sub.nameservers : nameservers).join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('website')}
                        className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition"
                      >
                        Manage Site
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyValue(sub.domain, sub.id)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 flex items-center gap-1 transition"
                    >
                      {copiedKey === sub.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                      <span>{copiedKey === sub.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={`https://${sub.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1 transition"
                    >
                      <span>Visit Live</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {selectedDomain && (
        <section className="bg-white rounded-2xl border border-neutral-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-neutral-700" />
                <h3 className="text-sm font-extrabold text-neutral-900">
                  Edge DNS Records — <span className="font-mono">{selectedDomain.domain}</span>
                </h3>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Configure A, AAAA, CNAME, TXT, and NS records for your subdomain. Default @ records point to Tiwlo Edge Hosting.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nameservers.map((ns) => (
                <button
                  key={ns}
                  type="button"
                  onClick={() => copyValue(ns, ns)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-white text-[11px] font-mono text-neutral-700 transition"
                >
                  <span>{ns}</span>
                  {copiedKey === ns ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-400" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={submitDnsRecord}
            className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 sm:p-4 md:grid-cols-[110px_1fr_1.5fr_95px_auto]"
          >
            <select
              value={recordFormState.type}
              onChange={(e) => setRecordFormState({ ...recordFormState, type: e.target.value })}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-neutral-400"
              aria-label="Record type"
            >
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="TXT">TXT</option>
              <option value="NS">NS</option>
            </select>
            <input
              type="text"
              value={recordFormState.name}
              onChange={(e) => setRecordFormState({ ...recordFormState, name: e.target.value })}
              placeholder="Name (@ or www)"
              required
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-neutral-400"
            />
            <input
              type="text"
              value={recordFormState.value}
              onChange={(e) => setRecordFormState({ ...recordFormState, value: e.target.value })}
              placeholder={
                recordFormState.type === 'A'
                  ? 'IPv4 address (e.g. 94.130.180.93)'
                  : recordFormState.type === 'CNAME'
                  ? 'Target hostname (e.g. cname.vercel-dns.com)'
                  : 'Record value'
              }
              required
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-400"
            />
            <input
              type="number"
              min="60"
              max="86400"
              value={recordFormState.ttl}
              onChange={(e) => setRecordFormState({ ...recordFormState, ttl: e.target.value })}
              placeholder="TTL"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 focus:outline-none focus:border-neutral-400"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingRecord}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingRecord ? 'Save' : 'Add Record'}</span>
              </button>
              {editingRecord && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setRecordFormState(EMPTY_RECORD);
                  }}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead className="bg-neutral-50 text-[11px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Value / Target</th>
                  <th className="px-4 py-3">TTL</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loadingRecords ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      Loading DNS records…
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                      No custom DNS records found for {selectedDomain.domain}.
                    </td>
                  </tr>
                ) : (
                  records.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/70 transition">
                      <td className="px-4 py-3 font-extrabold text-neutral-900">{item.type}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-neutral-800">{item.name}</td>
                      <td className="px-4 py-3 font-mono text-neutral-600 max-w-xs break-all">{item.value}</td>
                      <td className="px-4 py-3 text-neutral-500">{item.ttl}s</td>
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteId === item.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => deleteDnsRecord(item)}
                              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-600 text-[11px] font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecord(item);
                                setRecordFormState({
                                  type: item.type,
                                  name: item.name,
                                  value: item.value,
                                  ttl: item.ttl
                                });
                              }}
                              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition"
                              aria-label={`Edit ${item.type} record`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:bg-rose-50 hover:text-rose-600 transition"
                              aria-label={`Delete ${item.type} record`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
