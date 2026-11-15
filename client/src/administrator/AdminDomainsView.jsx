import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function getVerificationBadge(row) {
  const status = String(row?.status || '').toLowerCase();
  const verified = Boolean(row?.dnsVerified || row?.verified || row?.verifiedAt || status === 'verified' || status === 'active');
  if (verified) {
    return {
      label: 'Verified',
      cls: 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]',
      Icon: CheckCircle2,
    };
  }
  if (status.includes('fail') || status.includes('error')) {
    return {
      label: 'Failed',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      Icon: ShieldAlert,
    };
  }
  return {
    label: status ? status.replace(/_/g, ' ') : 'Pending DNS',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    Icon: Clock,
  };
}

function getSslBadge(row) {
  const ssl = String(row?.sslStatus || row?.ssl_status || 'not_requested').toLowerCase();
  if (['active', 'issued', 'valid', 'provisioned'].includes(ssl)) {
    return {
      label: 'SSL Active',
      cls: 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]',
    };
  }
  if (['pending', 'provisioning', 'issuing'].includes(ssl)) {
    return {
      label: 'Issuing SSL',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }
  if (['failed', 'error'].includes(ssl)) {
    return {
      label: 'SSL Error',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    };
  }
  return {
    label: ssl.replace(/_/g, ' '),
    cls: 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  };
}

function getSubdomainStatusClass(status) {
  const s = String(status || 'active').toLowerCase();
  if (s === 'active') {
    return 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]';
  }
  if (s === 'suspended') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  return 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

export default function AdminDomainsView({ onBackToDashboard }) {
  const [activeTab, setActiveTab] = useState('custom'); // 'custom' | 'subdomains'
  const [customDomains, setCustomDomains] = useState([]);
  const [freeSubdomains, setFreeSubdomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const loadDomains = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const res = await fetch(`${API_BASE}/admin/domains`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Failed to load domains (${res.status}).`);
        }
        if (!active) return;
        setCustomDomains(Array.isArray(data.customDomains) ? data.customDomains : Array.isArray(data.domains) ? data.domains : []);
        setFreeSubdomains(Array.isArray(data.freeSubdomains) ? data.freeSubdomains : Array.isArray(data.subdomains) ? data.subdomains : []);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Could not load domain records.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDomains();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  };

  const filteredCustom = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customDomains;
    return customDomains.filter((d) =>
      [d.domain, d.ownerName, d.ownerEmail, d.userEmail, d.storeName, d.tiwiId, d.status, d.sslStatus]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [customDomains, search]);

  const filteredSubdomains = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return freeSubdomains;
    return freeSubdomains.filter((s) =>
      [s.host, s.domain, s.subdomain, s.ownerName, s.ownerEmail, s.userEmail, s.storeName, s.tiwiId, s.status]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [freeSubdomains, search]);

  const verifiedCount = useMemo(
    () => customDomains.filter((d) => getVerificationBadge(d).label === 'Verified').length,
    [customDomains]
  );
  const sslActiveCount = useMemo(
    () => customDomains.filter((d) => getSslBadge(d).label === 'SSL Active').length,
    [customDomains]
  );

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
            Store Domains &amp; Subdomains
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Inspect tenant custom domain DNS verification, SSL issuance, and free platform subdomains.
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

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-xs font-medium text-neutral-500">Custom Domains</span>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {customDomains.length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-xs font-medium text-neutral-500">DNS Verified</span>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
            {verifiedCount}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-xs font-medium text-neutral-500">SSL Certificates Active</span>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {sslActiveCount}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-xs font-medium text-neutral-500">Free Subdomains</span>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {freeSubdomains.length}
          </p>
        </div>
      </div>

      {/* Tabs & Search Card */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col justify-between gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-neutral-200/80 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'custom'
                  ? 'bg-[#1ED760] font-semibold text-black'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Custom Domains ({customDomains.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subdomains')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === 'subdomains'
                  ? 'bg-[#1ED760] font-semibold text-black'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Free Subdomains ({freeSubdomains.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain, owner, store..."
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        )}

        {activeTab === 'custom' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                  <th className="px-4 py-3">Custom Domain</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Store / Tiwi ID</th>
                  <th className="px-3 py-3 text-center">DNS Verification</th>
                  <th className="px-3 py-3 text-center">SSL Status</th>
                  <th className="px-4 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                      Loading custom domains...
                    </td>
                  </tr>
                ) : filteredCustom.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                      No custom domains found.
                    </td>
                  </tr>
                ) : (
                  filteredCustom.map((row) => {
                    const dnsBadge = getVerificationBadge(row);
                    const sslBadge = getSslBadge(row);
                    const DnsIcon = dnsBadge.Icon;
                    return (
                      <tr key={row.id || row.domain} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                        <td className="px-4 py-3">
                          <a
                            href={`https://${row.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono font-semibold text-neutral-950 hover:underline dark:text-white"
                          >
                            {row.domain}
                            <ExternalLink className="h-3 w-3 text-neutral-400" />
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {row.ownerName || row.userName || '—'}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {row.ownerEmail || row.userEmail || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {row.storeName || '—'}
                          </div>
                          <div className="font-mono text-[11px] text-neutral-500">
                            {row.tiwiId || row.tiwi_id || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${dnsBadge.cls}`}
                          >
                            <DnsIcon className="h-3 w-3" />
                            {dnsBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${sslBadge.cls}`}
                          >
                            <Lock className="h-3 w-3" />
                            {sslBadge.label}
                          </span>
                          {(row.sslError || row.ssl_error) && (
                            <p className="mt-1 max-w-[180px] truncate text-[10px] text-rose-500" title={row.sslError || row.ssl_error}>
                              {row.sslError || row.ssl_error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-500">
                          {row.createdAt || row.created_at
                            ? new Date(row.createdAt || row.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                  <th className="px-4 py-3">Subdomain Host</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Store</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Claimed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                      Loading free subdomains...
                    </td>
                  </tr>
                ) : filteredSubdomains.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                      No free subdomains found.
                    </td>
                  </tr>
                ) : (
                  filteredSubdomains.map((row) => {
                    const host = row.host || (row.subdomain && row.domain ? `${row.subdomain}.${row.domain}` : row.subdomain || row.domain);
                    return (
                      <tr key={row.id || host} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                        <td className="px-4 py-3">
                          <a
                            href={`https://${host}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono font-semibold text-neutral-950 hover:underline dark:text-white"
                          >
                            {host}
                            <ExternalLink className="h-3 w-3 text-neutral-400" />
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {row.ownerName || row.userName || '—'}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {row.ownerEmail || row.userEmail || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {row.storeName || '—'}
                          </div>
                          {row.tiwiId && (
                            <div className="font-mono text-[11px] text-neutral-500">{row.tiwiId}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getSubdomainStatusClass(
                              row.status
                            )}`}
                          >
                            {row.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-500">
                          {row.createdAt || row.created_at
                            ? new Date(row.createdAt || row.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
