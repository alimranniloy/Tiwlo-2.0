import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DNS1_SUBDOMAIN,
  DNS2_SUBDOMAIN,
  PLATFORM_DOMAIN,
  STORE_DOMAIN,
} from '../config/platformConfig';

function normalizeDomainList(payload) {
  if (Array.isArray(payload?.domains)) return payload.domains;
  if (Array.isArray(payload?.customDomains)) return payload.customDomains;
  return [];
}

function unwrapDnsConfigPayload(payload) {
  if (!payload || typeof payload !== 'object') return { dns: null, plan: null };
  const dns = payload.dnsConfig && typeof payload.dnsConfig === 'object' ? payload.dnsConfig : payload;
  const plan = payload.plan && typeof payload.plan === 'object' ? payload.plan : null;
  return { dns, plan };
}

function normalizeNameservers(dnsConfig) {
  const { dns } = unwrapDnsConfigPayload(dnsConfig);
  if (Array.isArray(dns?.nameservers) && dns.nameservers.length > 0) {
    return dns.nameservers;
  }
  const ns1 = dns?.dns1 || dns?.ns1;
  const ns2 = dns?.dns2 || dns?.ns2;
  const fromFields = [ns1, ns2].filter(Boolean);
  if (fromFields.length > 0) return fromFields;
  return [
    `${DNS1_SUBDOMAIN}.${PLATFORM_DOMAIN}`,
    `${DNS2_SUBDOMAIN}.${PLATFORM_DOMAIN}`,
  ];
}

function normalizeAddressRecords(dnsConfig) {
  const { dns } = unwrapDnsConfigPayload(dnsConfig);
  const records = [];
  const seen = new Set();
  const pushRecord = (type, name, value) => {
    const cleanType = String(type || '').trim().toUpperCase();
    const cleanValue = String(value || '').trim();
    const cleanName = String(name || '@').trim() || '@';
    if (!cleanType || !cleanValue || cleanType === 'NS') return;
    const key = `${cleanType}:${cleanName}:${cleanValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({ type: cleanType, name: cleanName, value: cleanValue });
  };

  if (Array.isArray(dns?.records)) {
    for (const rec of dns.records) {
      pushRecord(rec?.type, rec?.name || '@', rec?.value ?? rec?.content);
    }
  }
  if (Array.isArray(dns?.serverAddresses)) {
    for (const addr of dns.serverAddresses) {
      pushRecord(addr?.type, addr?.name || '@', addr?.value ?? addr?.content);
    }
  }
  pushRecord('A', '@', dns?.aRecord || dns?.ipv4 || dns?.serverIpv4);
  pushRecord('AAAA', '@', dns?.aaaaRecord || dns?.ipv6 || dns?.serverIpv6);
  pushRecord('CNAME', 'www', dns?.cnameTarget || dns?.cname);
  return records;
}

async function fetchDomainSettingsBundle(tiwiId) {
  const dnsQuery = tiwiId ? `?tiwiId=${encodeURIComponent(tiwiId)}` : '';
  const [dnsRes, domainsRes, subRes] = await Promise.allSettled([
    fetch(`/api/domains/config/dns${dnsQuery}`, { credentials: 'include' }),
    fetch('/api/domains', { credentials: 'include' }),
    fetch('/api/subscription', { credentials: 'include' }),
  ]);

  let nextDnsConfig = null;
  let nextPlanInfo = null;
  let nextDnsPayload = null;
  if (dnsRes.status === 'fulfilled' && dnsRes.value.ok) {
    nextDnsPayload = await dnsRes.value.json().catch(() => null);
    const unwrapped = unwrapDnsConfigPayload(nextDnsPayload);
    nextDnsConfig = unwrapped.dns;
    nextPlanInfo = unwrapped.plan;
  }

  let nextDomains = null;
  if (domainsRes.status === 'fulfilled' && domainsRes.value.ok) {
    const domainsPayload = await domainsRes.value.json().catch(() => ({}));
    nextDomains = normalizeDomainList(domainsPayload);
  } else if (nextDnsPayload) {
    nextDomains = normalizeDomainList(nextDnsPayload);
  }

  let nextSubscription = null;
  if (subRes.status === 'fulfilled' && subRes.value.ok) {
    nextSubscription = await subRes.value.json().catch(() => null);
  }

  return { nextDnsConfig, nextPlanInfo, nextDomains, nextSubscription };
}

export default function StoreDomainSettingsView({
  currentStore = null,
  subscription = null,
  onNavigateToPricing,
  showToast,
}) {
  const tiwiId = currentStore?.tiwiId || null;
  const [dnsConfig, setDnsConfig] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [domains, setDomains] = useState([]);
  const [fetchedSubscription, setFetchedSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyDomainId, setBusyDomainId] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [upgradePromptVisible, setUpgradePromptVisible] = useState(false);
  const [reauthNotice, setReauthNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const liveSubscription = fetchedSubscription || subscription;

  const loadDomainSettings = async () => {
    setRefreshing(true);
    setActionError('');
    try {
      const { nextDnsConfig, nextPlanInfo, nextDomains, nextSubscription } = await fetchDomainSettingsBundle(tiwiId);
      if (nextDnsConfig) setDnsConfig(nextDnsConfig);
      if (nextPlanInfo) setPlanInfo(nextPlanInfo);
      if (nextDomains) setDomains(nextDomains);
      if (nextSubscription) setFetchedSubscription(nextSubscription);
    } catch (error) {
      setActionError(error.message || 'Could not load domain configuration.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchDomainSettingsBundle(tiwiId)
      .then(({ nextDnsConfig, nextPlanInfo, nextDomains, nextSubscription }) => {
        if (cancelled) return;
        if (nextDnsConfig) setDnsConfig(nextDnsConfig);
        if (nextPlanInfo) setPlanInfo(nextPlanInfo);
        if (nextDomains) setDomains(nextDomains);
        if (nextSubscription) setFetchedSubscription(nextSubscription);
      })
      .catch((error) => {
        if (!cancelled) setActionError(error.message || 'Could not load domain configuration.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tiwiId]);

  const planId = String(
    planInfo?.planId || dnsConfig?.planId || liveSubscription?.planId || currentStore?.planId || 'free'
  ).toLowerCase();
  const hasCustomDomain = Boolean(
    planInfo?.hasCustomDomain ??
      dnsConfig?.hasCustomDomain ??
      liveSubscription?.hasCustomDomain ??
      ['growth', 'pro', 'enterprise'].includes(planId)
  );

  const currentSubdomain = useMemo(() => {
    const raw =
      planInfo?.subdomain ||
      dnsConfig?.currentSubdomain ||
      dnsConfig?.storeSubdomain ||
      dnsConfig?.subdomain ||
      liveSubscription?.subdomain ||
      currentStore?.subdomain ||
      '';
    if (!raw) return '';
    const cleaned = String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (cleaned.includes('.')) return cleaned;
    return `${cleaned}.${STORE_DOMAIN}`;
  }, [planInfo, dnsConfig, liveSubscription, currentStore]);

  const nameservers = useMemo(() => normalizeNameservers(dnsConfig), [dnsConfig]);
  const dnsRecords = useMemo(() => normalizeAddressRecords(dnsConfig), [dnsConfig]);

  const activeCustomDomain = useMemo(
    () => domains.find((d) => d.status === 'active' && d.sslStatus === 'active') || null,
    [domains]
  );

  const copyValue = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast?.('Copied to clipboard.');
      window.setTimeout(() => setCopiedKey(''), 1600);
    } catch {
      showToast?.('Could not copy value.', 'error');
    }
  };

  const handleDomainApiError = async (response, fallbackMessage) => {
    const payload = await response.json().catch(() => ({}));
    if (
      response.status === 403 &&
      (payload?.code === 'REAUTH_REQUIRED' || payload?.error === 'REAUTH_REQUIRED')
    ) {
      const msg =
        payload?.message ||
        'Recent email verification is required before modifying custom domains. Please re-authenticate and try again.';
      setReauthNotice(msg);
      throw new Error(msg);
    }
    if (
      response.status === 428 &&
      (payload?.code === 'RECENT_VERIFICATION_REQUIRED' ||
        payload?.error === 'RECENT_VERIFICATION_REQUIRED')
    ) {
      const msg = payload?.message || 'Verify your email before making this domain change.';
      setReauthNotice(msg);
      throw new Error(msg);
    }
    throw new Error(payload?.error || payload?.message || fallbackMessage);
  };

  const handleAddDomain = async (event) => {
    event.preventDefault();
    setActionError('');
    setReauthNotice('');

    if (!hasCustomDomain) {
      setUpgradePromptVisible(true);
      return;
    }

    const cleanDomain = newDomain.trim().toLowerCase();
    if (!cleanDomain) {
      setActionError('Enter a domain name such as shop.example.com.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain }),
      });
      if (!response.ok) {
        await handleDomainApiError(response, 'Could not add custom domain.');
      }
      const payload = await response.json().catch(() => ({}));
      if (payload?.domain) {
        setDomains((prev) => [payload.domain, ...prev.filter((d) => d.id !== payload.domain.id)]);
      } else {
        await loadDomainSettings(true);
      }
      setNewDomain('');
      showToast?.('Domain added. Add the TXT record below and verify DNS.');
    } catch (error) {
      setActionError(error.message || 'Could not add custom domain.');
      showToast?.(error.message || 'Could not add custom domain.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDomain = async (domainId) => {
    setBusyDomainId(`verify:${domainId}`);
    setActionError('');
    setReauthNotice('');
    try {
      const response = await fetch(`/api/domains/${encodeURIComponent(domainId)}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        await handleDomainApiError(response, 'DNS ownership could not be verified yet.');
      }
      const payload = await response.json().catch(() => ({}));
      if (payload?.domain) {
        setDomains((prev) => prev.map((d) => (d.id === domainId ? payload.domain : d)));
      }
      showToast?.(
        payload?.readyForSsl
          ? 'DNS verified! Ready to provision SSL.'
          : 'Ownership verified! Point A/AAAA or nameservers to provision SSL.'
      );
    } catch (error) {
      setActionError(error.message || 'Could not verify DNS.');
      showToast?.(error.message || 'Could not verify DNS.', 'error');
    } finally {
      setBusyDomainId('');
    }
  };

  const handleProvisionSsl = async (domainId) => {
    setBusyDomainId(`ssl:${domainId}`);
    setActionError('');
    setReauthNotice('');
    try {
      const response = await fetch(`/api/domains/${encodeURIComponent(domainId)}/provision`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        await handleDomainApiError(response, 'SSL provisioning failed.');
      }
      const payload = await response.json().catch(() => ({}));
      if (payload?.domain) {
        setDomains((prev) => prev.map((d) => (d.id === domainId ? payload.domain : d)));
      }
      showToast?.('SSL provisioned and custom domain is now active!');
    } catch (error) {
      setActionError(error.message || 'SSL provisioning failed.');
      showToast?.(error.message || 'SSL provisioning failed.', 'error');
    } finally {
      setBusyDomainId('');
    }
  };

  const handleDeleteDomain = async (domainId) => {
    setBusyDomainId(`delete:${domainId}`);
    setActionError('');
    setReauthNotice('');
    try {
      const response = await fetch(`/api/domains/${encodeURIComponent(domainId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        await handleDomainApiError(response, 'Could not remove domain.');
      }
      setDomains((prev) => prev.filter((d) => d.id !== domainId));
      showToast?.('Domain removed.');
    } catch (error) {
      setActionError(error.message || 'Could not remove domain.');
      showToast?.(error.message || 'Could not remove domain.', 'error');
    } finally {
      setBusyDomainId('');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Domain Settings
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Manage your storefront address, live platform DNS records, and custom domains.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDomainSettings(true)}
          disabled={refreshing || loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Current Store Domain / Free Subdomain */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Current Store Domain
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <Globe className="h-4 w-4 text-neutral-700 dark:text-neutral-300" aria-hidden="true" />
              <span className="font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                {loading ? 'Loading...' : activeCustomDomain?.domain || currentSubdomain || 'Not assigned yet'}
              </span>
              <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                {activeCustomDomain ? 'Custom Domain' : 'Free Subdomain'}
              </span>
            </div>
            {activeCustomDomain && currentSubdomain && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Default subdomain: <span className="font-mono">{currentSubdomain}</span>
              </p>
            )}
          </div>

          {(activeCustomDomain?.domain || currentSubdomain) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyValue('current-domain', activeCustomDomain?.domain || currentSubdomain)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                {copiedKey === 'current-domain' ? (
                  <Check className="h-3.5 w-3.5 text-[#1ED760]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Copy
              </button>
              <a
                href={`https://${activeCustomDomain?.domain || currentSubdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Visit
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Live Platform DNS Configuration */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
            Live Platform DNS Configuration
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Nameservers and IP records stay automatically synchronized whenever platform infrastructure migrates.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {nameservers.map((ns, idx) => (
              <div
                key={ns}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800"
              >
                <div className="min-w-0">
                  <span className="font-medium text-neutral-500 dark:text-neutral-400">
                    NS{idx + 1} ·{' '}
                  </span>
                  <span className="font-mono font-medium text-neutral-950 dark:text-white break-all">
                    {ns}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyValue(`ns-${idx}`, ns)}
                  className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white"
                  aria-label={`Copy ${ns}`}
                >
                  {copiedKey === `ns-${idx}` ? (
                    <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>

          {dnsRecords.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Host</th>
                    <th className="px-3 py-2 font-medium">Target / Value</th>
                    <th className="px-3 py-2 text-right font-medium">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {dnsRecords.map((rec, idx) => (
                    <tr key={`${rec.type}-${rec.name}-${idx}`}>
                      <td className="px-3 py-2 font-semibold text-neutral-950 dark:text-white">
                        {rec.type}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-600 dark:text-neutral-300">
                        {rec.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-900 dark:text-neutral-100 break-all">
                        {rec.value}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => copyValue(`rec-${idx}`, rec.value)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white"
                          aria-label={`Copy ${rec.type} record value`}
                        >
                          {copiedKey === `rec-${idx}` ? (
                            <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Add your domain */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Add your domain
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Connect a custom domain to your storefront with automatic SSL provisioning.
            </p>
          </div>
          {!hasCustomDomain && (
            <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Paid Plan Feature
            </span>
          )}
        </div>

        <form onSubmit={handleAddDomain} className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            value={newDomain}
            onFocus={() => {
              if (!hasCustomDomain) setUpgradePromptVisible(true);
            }}
            onChange={(event) => {
              setNewDomain(event.target.value);
              if (!hasCustomDomain) setUpgradePromptVisible(true);
            }}
            placeholder="shop.yourdomain.com"
            aria-label="Custom domain"
            className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:focus:border-neutral-400"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-4 text-sm font-semibold text-black transition-colors hover:bg-[#18B953] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Adding...' : 'Add your domain'}
          </button>
        </form>

        {!hasCustomDomain && (
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50/70 px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900/40">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                {upgradePromptVisible
                  ? 'Upgrade required to connect a custom domain'
                  : 'You are currently on the Free plan'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Upgrade to Growth, Pro, or Enterprise to add a custom domain and enable automatic SSL certificates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToPricing?.()}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition-colors hover:bg-[#18B953]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Upgrade Plan
            </button>
          </div>
        )}

        {reauthNotice && (
          <div
            role="alert"
            className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-200"
          >
            {reauthNotice}
          </div>
        )}

        {actionError && !reauthNotice && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            {actionError}
          </div>
        )}

        {hasCustomDomain && domains.length > 0 && (
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {domains.map((domain) => {
              const verification = domain?.dns?.verification;
              const isVerified = domain.status === 'verified' || domain.status === 'active';
              const isActive = domain.status === 'active' && domain.sslStatus === 'active';
              const canDelete = ['not_requested', 'pending', 'failed'].includes(
                String(domain.sslStatus || 'not_requested')
              );
              const isVerifying = busyDomainId === `verify:${domain.id}`;
              const isProvisioning = busyDomainId === `ssl:${domain.id}`;
              const isDeleting = busyDomainId === `delete:${domain.id}`;

              return (
                <div key={domain.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-neutral-950 dark:text-white break-all">
                          {domain.domain}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          {domain.status}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          SSL: {domain.sslStatus || 'not_requested'}
                        </span>
                      </div>
                      {domain.sslError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {domain.sslError}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isVerified && (
                        <button
                          type="button"
                          disabled={Boolean(busyDomainId)}
                          onClick={() => handleVerifyDomain(domain.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
                        >
                          {isVerifying ? 'Verifying...' : 'Verify DNS'}
                        </button>
                      )}
                      {isVerified && !isActive && (
                        <button
                          type="button"
                          disabled={Boolean(busyDomainId)}
                          onClick={() => handleProvisionSsl(domain.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-black transition-colors hover:bg-[#18B953] disabled:opacity-60"
                        >
                          {isProvisioning ? 'Provisioning...' : 'Provision SSL'}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          disabled={Boolean(busyDomainId)}
                          onClick={() => handleDeleteDomain(domain.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-red-600 disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-900"
                          aria-label={`Remove ${domain.domain}`}
                        >
                          <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {!isVerified && verification && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 text-xs space-y-1.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        Add this TXT record at your DNS provider to verify ownership:
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-neutral-900 dark:text-neutral-100 break-all">
                          {verification.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue(`txt-name-${domain.id}`, verification.name)}
                          className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                        >
                          {copiedKey === `txt-name-${domain.id}` ? (
                            <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy Host
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-neutral-900 dark:text-neutral-100 break-all">
                          {verification.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyValue(`txt-val-${domain.id}`, verification.value)}
                          className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                        >
                          {copiedKey === `txt-val-${domain.id}` ? (
                            <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy Value
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
