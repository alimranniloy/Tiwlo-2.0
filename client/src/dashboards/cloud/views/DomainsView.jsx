import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Globe2,
  HelpCircle,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Unlock,
  X
} from 'lucide-react';
import {
  DNS1_SUBDOMAIN,
  DNS2_SUBDOMAIN,
  FREE_SUBDOMAIN_DOMAIN,
  PLATFORM_DOMAIN,
  SERVER_IPV4,
  SERVER_IPV6
} from '../../../config/platformConfig.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger
} from '../../../components/ui/shadcnPrimitives';

const EMPTY_RECORD = { type: 'A', name: '@', value: '', ttl: 300 };
const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

const RECORD_PLACEHOLDERS = {
  A: '203.0.113.10',
  AAAA: '2001:db8::1',
  CNAME: 'target.example.com',
  MX: 'mail.example.com',
  TXT: 'v=spf1 ~all',
  NS: 'ns1.example.com'
};

function isIpv4Value(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(value || '').trim());
}

function isIpv6Value(value) {
  const raw = String(value || '').trim();
  return raw.includes(':') && /^[0-9a-fA-F:]+$/.test(raw);
}

function getDropletIps(droplet) {
  if (!droplet) return { ipv4: '', ipv6: '' };
  const rawIp = String(droplet.ip || '').trim();
  const rawIpv4 = String(droplet.ipv4 || '').trim();
  const rawIpv6 = String(droplet.ipv6 || '').trim();
  const ipv4 = isIpv4Value(rawIpv4) ? rawIpv4 : (isIpv4Value(rawIp) ? rawIp : '');
  const ipv6 = isIpv6Value(rawIpv6) ? rawIpv6 : (isIpv6Value(rawIp) ? rawIp : '');
  return { ipv4, ipv6 };
}

function formatShortDate(iso) {
  if (!iso) return 'Platform Managed';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Platform Managed';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HelpTooltip({ label, title, description }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200/80 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute left-0 top-7 z-30 w-72 rounded-xl border border-neutral-200/90 bg-white p-3.5 text-left shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-950 dark:text-white">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
      )}
    </span>
  );
}

export default function DomainsView({ currentUser, showToast }) {
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recordsByDomainId, setRecordsByDomainId] = useState({});
  const [droplets, setDroplets] = useState([]);
  const [platformDns, setPlatformDns] = useState({
    nameservers: [`${DNS1_SUBDOMAIN}.${PLATFORM_DOMAIN}`, `${DNS2_SUBDOMAIN}.${PLATFORM_DOMAIN}`],
    ipv4: SERVER_IPV4 || '',
    ipv6: SERVER_IPV6 || ''
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Portfolio search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // View mode: 'portfolio' | 'add' (hydrated from deep-link query params)
  const [viewMode, setViewMode] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('view');
      return v === 'add' ? 'add' : 'portfolio';
    } catch {
      return 'portfolio';
    }
  });
  const [managerTab, setManagerTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      return t === 'vps' || t === 'health' || t === 'dns' ? t : 'dns';
    } catch {
      return 'dns';
    }
  });

  // DNS Record form
  const [record, setRecord] = useState(EMPTY_RECORD);
  const [editing, setEditing] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Add Domain flow state
  const [addDomainMode, setAddDomainMode] = useState('custom');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [claimingDomain, setClaimingDomain] = useState(false);
  const [newlyCreatedDomain, setNewlyCreatedDomain] = useState(null);
  const [verifyingDomainId, setVerifyingDomainId] = useState(null);

  // Connect VPS / Droplet state
  const [selectedDropletId, setSelectedDropletId] = useState('');
  const [targetProxyPort, setTargetProxyPort] = useState('80');
  const [connectingDroplet, setConnectingDroplet] = useState(false);

  // Notices, clipboard, propagation health, lock preferences
  const [claimNotice, setClaimNotice] = useState(null);
  const [copied, setCopied] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [healthReport, setHealthReport] = useState(null);
  const [transferLocks, setTransferLocks] = useState({});
  const [autoRenewPrefs, setAutoRenewPrefs] = useState({});

  const fetchAllDomainData = useCallback(async () => {
    const [domainsRes, customDomainsRes, dropletsRes, configRes] = await Promise.allSettled([
      fetch('/api/subdomains', { credentials: 'include' }),
      fetch('/api/cloud/domains', { credentials: 'include' }),
      fetch('/api/cloud/droplets', { credentials: 'include' }),
      fetch('/api/domains/config/dns', { credentials: 'include' })
    ]);

    let freeDomains = [];
    if (domainsRes.status === 'fulfilled' && domainsRes.value.ok) {
      const domainsPayload = await domainsRes.value.json().catch(() => ({}));
      freeDomains = (Array.isArray(domainsPayload.domains) ? domainsPayload.domains : []).map((d) => ({
        ...d,
        domainKind: 'subdomain'
      }));
    }

    let customDomains = [];
    const customRecordsMap = {};
    if (customDomainsRes.status === 'fulfilled' && customDomainsRes.value.ok) {
      const customPayload = await customDomainsRes.value.json().catch(() => ({}));
      const rawCustom = Array.isArray(customPayload.domains) ? customPayload.domains : [];
      customDomains = rawCustom
        .filter((cd) => !freeDomains.some((fd) => String(fd.domain || '').toLowerCase() === String(cd.hostname || '').toLowerCase()))
        .map((cd) => {
          customRecordsMap[cd.id] = Array.isArray(cd.records) ? cd.records : [];
          return {
            ...cd,
            domain: cd.hostname || cd.domain,
            name: cd.hostname || cd.domain,
            domainKind: 'custom'
          };
        });
      // Annotate free subdomains that also have active VPS proxy bindings
      freeDomains = freeDomains.map((fd) => {
        const match = rawCustom.find((cd) => String(cd.hostname || '').toLowerCase() === String(fd.domain || '').toLowerCase());
        return match
          ? {
            ...fd,
            cloudBindingId: match.id,
            dropletId: match.dropletId,
            dropletName: match.dropletName,
            targetPort: match.targetPort,
            proxyEnabled: match.proxyEnabled
          }
          : fd;
      });
    }

    if (domainsRes.status !== 'fulfilled' && customDomainsRes.status !== 'fulfilled') {
      throw new Error('Could not load domains.');
    }

    const nextDomains = [...customDomains, ...freeDomains];

    let nextDroplets = [];
    if (dropletsRes.status === 'fulfilled' && dropletsRes.value.ok) {
      const dropletsPayload = await dropletsRes.value.json().catch(() => []);
      if (Array.isArray(dropletsPayload)) {
        nextDroplets = dropletsPayload;
      } else if (Array.isArray(dropletsPayload?.droplets)) {
        nextDroplets = dropletsPayload.droplets;
      }
    }

    let nextPlatformDns = null;
    if (configRes.status === 'fulfilled' && configRes.value.ok) {
      const cfgPayload = await configRes.value.json().catch(() => ({}));
      const dnsCfg = cfgPayload?.dnsConfig || cfgPayload;
      if (dnsCfg && typeof dnsCfg === 'object') {
        nextPlatformDns = {
          nameservers: Array.isArray(dnsCfg.nameservers) && dnsCfg.nameservers.length
            ? dnsCfg.nameservers
            : [`${DNS1_SUBDOMAIN}.${PLATFORM_DOMAIN}`, `${DNS2_SUBDOMAIN}.${PLATFORM_DOMAIN}`],
          ipv4: dnsCfg.ipv4 || SERVER_IPV4 || '',
          ipv6: dnsCfg.ipv6 || SERVER_IPV6 || ''
        };
      }
    }

    // Load DNS records for free subdomains (custom domain records are already included)
    const recordEntries = await Promise.all(
      freeDomains.map(async (dom) => {
        try {
          const recRes = await fetch(`/api/subdomains/${encodeURIComponent(dom.id)}/records`, { credentials: 'include' });
          if (!recRes.ok) return [dom.id, null];
          const recPayload = await recRes.json().catch(() => ({}));
          return [dom.id, Array.isArray(recPayload.records) ? recPayload.records : []];
        } catch {
          return [dom.id, null];
        }
      })
    );

    const nextRecordsMap = { ...customRecordsMap };
    for (const [domId, recList] of recordEntries) {
      if (recList) nextRecordsMap[domId] = recList;
    }

    return { nextDomains, nextDroplets, nextPlatformDns, nextRecordsMap };
  }, []);

  const refreshDomains = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSyncing(true);
    try {
      const { nextDomains, nextDroplets, nextPlatformDns, nextRecordsMap } = await fetchAllDomainData();
      setDomains(nextDomains);
      setDroplets(nextDroplets);
      if (nextPlatformDns) setPlatformDns(nextPlatformDns);
      setRecordsByDomainId((prev) => ({ ...prev, ...nextRecordsMap }));
      setSelected((current) => {
        if (!current) return nextDomains[0] || null;
        return nextDomains.find((item) => item.id === current.id) || nextDomains[0] || null;
      });
      setLastSyncedAt(new Date().toISOString());
      if (!silent) {
        showToast?.('DNS zones and VPS addresses synced.');
      }
    } catch (error) {
      showToast?.(error.message || 'Could not load domains.', 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [fetchAllDomainData, showToast]);

  // Initial load without synchronous setState in effect
  useEffect(() => {
    let active = true;
    fetchAllDomainData()
      .then(({ nextDomains, nextDroplets, nextPlatformDns, nextRecordsMap }) => {
        if (!active) return;
        setDomains(nextDomains);
        setDroplets(nextDroplets);
        if (nextPlatformDns) setPlatformDns(nextPlatformDns);
        setRecordsByDomainId(nextRecordsMap);
        setSelected((current) => {
          if (current) return nextDomains.find((d) => d.id === current.id) || nextDomains[0] || null;
          try {
            const requested = new URLSearchParams(window.location.search).get('domain');
            if (requested) {
              const matched = nextDomains.find(
                (d) => String(d.domain || '').toLowerCase() === requested.toLowerCase() || String(d.id) === requested
              );
              if (matched) return matched;
            }
          } catch {}
          return nextDomains[0] || null;
        });
        setSelectedDropletId((current) => current || nextDroplets[0]?.id || '');
        setLastSyncedAt(new Date().toISOString());
      })
      .catch((error) => {
        if (active) showToast?.(error.message || 'Could not load domains.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, fetchAllDomainData, showToast]);

  // Sync active domain, tab, and view mode to URL query params without clobbering ?domain_claim
  useEffect(() => {
    try {
      const pathname = window.location.pathname || '';
      if (!pathname.startsWith('/domains') && !pathname.startsWith('/cloud/domains')) return;
      const params = new URLSearchParams(window.location.search);
      if (params.has('domain_claim')) return;
      if (selected?.domain) {
        params.set('domain', selected.domain);
      } else {
        params.delete('domain');
      }
      if (managerTab && managerTab !== 'dns') {
        params.set('tab', managerTab);
      } else {
        params.delete('tab');
      }
      if (viewMode === 'add') {
        params.set('view', 'add');
      } else {
        params.delete('view');
      }
      const nextSearch = params.toString();
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      if (`${pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
      }
    } catch {}
  }, [selected?.domain, managerTab, viewMode]);

  // Existing ?domain_claim=... auto-claim workflow preserved 100%
  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get('domain_claim');
    if (!pending || !currentUser?.id) return;
    let active = true;

    fetch('/api/subdomains/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pending })
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok && response.status !== 409) {
          const error = new Error(payload.error || 'Could not claim domain.');
          error.payload = payload;
          throw error;
        }
        window.history.replaceState(null, '', '/domains');
        if (!active) return;
        await refreshDomains({ silent: true });
        if (response.ok) {
          showToast?.(`${payload.registration.domain} registered successfully.`);
        } else {
          setClaimNotice({
            title: 'Free domain already used',
            message: payload.error,
            maskedEmail: payload.maskedEmail
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        setClaimNotice({
          title: error.payload?.code === 'EMAIL_VERIFICATION_REQUIRED' ? 'Verify your email first' : 'Domain could not be registered',
          message: error.payload?.error || error.message,
          maskedEmail: error.payload?.maskedEmail
        });
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, refreshDomains, showToast]);

  // Debounced availability check ONLY in Free Subdomain mode
  useEffect(() => {
    if (viewMode !== 'add' || addDomainMode !== 'subdomain') return undefined;
    const cleaned = newDomainInput.trim().toLowerCase();
    if (!cleaned) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCheckingAvailability(true);
      fetch(`/api/subdomains/check?name=${encodeURIComponent(cleaned)}`, {
        credentials: 'include',
        signal: controller.signal
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Could not check availability.');
          setAvailability(data);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setAvailability({ available: false, status: 'invalid', message: err.message });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCheckingAvailability(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [addDomainMode, newDomainInput, viewMode]);

  const loadRecords = useCallback(async (domainObj) => {
    if (!domainObj?.id) return [];
    if (domainObj.domainKind === 'custom') {
      return recordsByDomainId[domainObj.id] || domainObj.records || [];
    }
    setLoadingRecords(true);
    try {
      const response = await fetch(`/api/subdomains/${encodeURIComponent(domainObj.id)}/records`, { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load DNS records.');
      const nextList = Array.isArray(payload.records) ? payload.records : [];
      setRecordsByDomainId((prev) => ({ ...prev, [domainObj.id]: nextList }));
      return nextList;
    } catch (error) {
      showToast?.(error.message || 'Could not load DNS records.', 'error');
      return [];
    } finally {
      setLoadingRecords(false);
    }
  }, [recordsByDomainId, showToast]);

  const selectDomain = (domainObj) => {
    setSelected(domainObj);
    setEditing(null);
    setRecord(EMPTY_RECORD);
    setConfirmDeleteId(null);
    setHealthReport(null);
    setViewMode('portfolio');
    if (domainObj?.id && !recordsByDomainId[domainObj.id]) {
      loadRecords(domainObj);
    }
  };

  const records = useMemo(
    () => (selected?.id ? recordsByDomainId[selected.id] || [] : []),
    [recordsByDomainId, selected]
  );

  const nameservers = useMemo(
    () => (selected?.nameservers?.length ? selected.nameservers : platformDns.nameservers),
    [platformDns.nameservers, selected]
  );

  const nsRecords = useMemo(() => records.filter((item) => item.type === 'NS'), [records]);
  const zoneRecords = useMemo(() => records.filter((item) => item.type !== 'NS'), [records]);
  const subdomainRecords = useMemo(
    () => zoneRecords.filter((item) => item.name && item.name !== '@'),
    [zoneRecords]
  );

  const getDomainSummary = useCallback((domainObj) => {
    const domRecords = recordsByDomainId[domainObj.id] || [];
    const aRecords = domRecords.filter((r) => r.type === 'A');
    const aaaaRecords = domRecords.filter((r) => r.type === 'AAAA');
    const isCustom = domainObj.domainKind === 'custom';
    const hasA = aRecords.length > 0 || (isCustom && Boolean(platformDns.ipv4));
    const hasAAAA = aaaaRecords.length > 0 || (isCustom && Boolean(domainObj.serverIpv6 || platformDns.ipv6));
    const isVerified = ['active', 'verified'].includes(String(domainObj.status || '').toLowerCase());

    let linkedDroplet = domainObj.dropletId
      ? droplets.find((d) => String(d.id) === String(domainObj.dropletId)) || null
      : null;
    if (!linkedDroplet) {
      for (const d of droplets) {
        const { ipv4, ipv6 } = getDropletIps(d);
        const matchesV4 = ipv4 && aRecords.some((r) => r.value === ipv4);
        const matchesV6 = ipv6 && aaaaRecords.some((r) => r.value === ipv6);
        if (matchesV4 || matchesV6) {
          linkedDroplet = d;
          break;
        }
      }
    }

    const nsList = domainObj.nameservers?.length ? domainObj.nameservers : platformDns.nameservers;
    return {
      domRecords,
      hasA,
      hasAAAA,
      isVerified,
      needsDns: !hasA && !hasAAAA,
      linkedDroplet,
      nsList,
      primaryIpv4: aRecords[0]?.value || (isCustom ? platformDns.ipv4 : ''),
      primaryIpv6: aaaaRecords[0]?.value || (isCustom ? (domainObj.serverIpv6 || platformDns.ipv6) : '')
    };
  }, [droplets, platformDns.ipv4, platformDns.ipv6, platformDns.nameservers, recordsByDomainId]);

  const filterCounts = useMemo(() => {
    let activeCount = 0;
    let needsDnsCount = 0;
    let ipv6Count = 0;
    for (const d of domains) {
      const s = getDomainSummary(d);
      if (s.isVerified) activeCount += 1;
      if (!s.isVerified || s.needsDns) needsDnsCount += 1;
      if (s.hasAAAA) ipv6Count += 1;
    }
    return {
      all: domains.length,
      verified: activeCount,
      pending: needsDnsCount,
      ipv6: ipv6Count
    };
  }, [domains, getDomainSummary]);

  const filteredDomains = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return domains.filter((d) => {
      const summary = getDomainSummary(d);
      if (statusFilter === 'verified' && !summary.isVerified) return false;
      if (statusFilter === 'pending' && summary.isVerified && !summary.needsDns) return false;
      if (statusFilter === 'ipv6' && !summary.hasAAAA) return false;
      if (!q) return true;
      return [
        d.domain,
        d.name,
        d.status,
        summary.linkedDroplet?.name,
        summary.primaryIpv4,
        summary.primaryIpv6,
        ...summary.nsList
      ].some((val) => String(val || '').toLowerCase().includes(q));
    });
  }, [domains, getDomainSummary, searchQuery, statusFilter]);

  const submitRecord = async (event) => {
    event.preventDefault();
    if (!selected?.id || savingRecord) return;
    setSavingRecord(true);
    const isCustom = selected.domainKind === 'custom';
    const url = isCustom
      ? `/api/cloud/domains/${encodeURIComponent(selected.id)}/records`
      : editing
        ? `/api/subdomains/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(editing.id)}`
        : `/api/subdomains/${encodeURIComponent(selected.id)}/records`;
    try {
      const response = await fetch(url, {
        method: !isCustom && editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save DNS record.');
      setRecordsByDomainId((prev) => {
        const current = prev[selected.id] || [];
        const updated = editing
          ? current.map((item) => (item.id === editing.id ? payload.record : item))
          : [...current.filter((item) => item.id !== payload.record?.id), payload.record];
        return { ...prev, [selected.id]: updated };
      });
      setRecord(EMPTY_RECORD);
      setEditing(null);
      showToast?.(editing ? 'DNS record updated.' : 'DNS record added.');
    } catch (error) {
      showToast?.(error.message || 'Could not save DNS record.', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  const deleteRecord = async (item) => {
    if (!selected?.id) return;
    const isCustom = selected.domainKind === 'custom';
    try {
      const response = await fetch(
        isCustom
          ? `/api/cloud/domains/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(item.id)}`
          : `/api/subdomains/${encodeURIComponent(selected.id)}/records/${encodeURIComponent(item.id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not delete DNS record.');
      setRecordsByDomainId((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] || []).filter((recordItem) => recordItem.id !== item.id)
      }));
      if (editing?.id === item.id) {
        setEditing(null);
        setRecord(EMPTY_RECORD);
      }
      setConfirmDeleteId(null);
      showToast?.('DNS record deleted.');
    } catch (error) {
      showToast?.(error.message || 'Could not delete DNS record.', 'error');
    }
  };

  const upsertApexRecord = async (domainId, currentRecords, type, value) => {
    const existingApex = currentRecords.find((r) => r.type === type && r.name === '@');
    const url = existingApex
      ? `/api/subdomains/${encodeURIComponent(domainId)}/records/${encodeURIComponent(existingApex.id)}`
      : `/api/subdomains/${encodeURIComponent(domainId)}/records`;
    const response = await fetch(url, {
      method: existingApex ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name: '@', value, ttl: 300 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Could not sync ${type} record.`);
    }
    return payload.record;
  };

  const handleVerifyCustomDomain = async (domainObj) => {
    const target = domainObj || selected;
    if (!target?.id || target.domainKind !== 'custom') return;
    setVerifyingDomainId(target.id);
    try {
      const response = await fetch(`/api/cloud/domains/${encodeURIComponent(target.id)}/verify`, {
        method: 'POST',
        credentials: 'include'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Verification failed.');
      if (payload.verified) {
        const updated = { ...payload.domain, domainKind: 'custom', name: payload.domain.hostname };
        setDomains((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
        if (selected?.id === updated.id) setSelected((prev) => ({ ...prev, ...updated }));
        if (newlyCreatedDomain?.id === updated.id) setNewlyCreatedDomain((prev) => ({ ...prev, ...updated }));
        showToast?.(`${updated.domain} verified and live with automatic SSL.`, 'success');
      } else {
        showToast?.('Nameservers or edge AAAA record not detected yet. Wait a minute for propagation and retry.', 'warning');
      }
    } catch (error) {
      showToast?.(error.message || 'Verification failed.', 'error');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const connectDomainToDroplet = async (targetDomain, dropletId) => {
    const target = targetDomain || selected;
    const droplet = droplets.find((d) => String(d.id) === String(dropletId));
    if (!target?.id || !droplet) {
      showToast?.('Select a valid VPS / Droplet first.', 'error');
      return;
    }

    const parsedPort = Math.min(65535, Math.max(1, Number.parseInt(String(targetProxyPort || '80'), 10) || 80));
    setConnectingDroplet(true);
    try {
      if (target.domainKind === 'custom') {
        const res = await fetch(`/api/cloud/domains/${encodeURIComponent(target.id)}/droplet`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dropletId: droplet.id, targetPort: parsedPort, proxyEnabled: true })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Could not link VPS droplet.');
        const updated = { ...target, dropletId: droplet.id, dropletName: droplet.name, targetPort: parsedPort, proxyEnabled: true };
        setDomains((prev) => prev.map((d) => (d.id === target.id ? updated : d)));
        if (selected?.id === target.id) setSelected(updated);
        if (newlyCreatedDomain?.id === target.id) setNewlyCreatedDomain(updated);
        showToast?.(`Connected ${target.domain} -> ${droplet.name} (port ${parsedPort}).`);
        return;
      }

      // Free .uids.app subdomain: point apex AAAA/A to platform edge & bind HTTP proxy to selected droplet container!
      const edgeIpv4 = platformDns.ipv4 || '';
      const edgeIpv6 = platformDns.ipv6 || getDropletIps(droplet).ipv6 || '';
      const currentRecords = recordsByDomainId[target.id] || (await loadRecords(target));
      let nextRecords = [...currentRecords];
      if (edgeIpv4) {
        const savedA = await upsertApexRecord(target.id, nextRecords, 'A', edgeIpv4);
        nextRecords = nextRecords.some((r) => r.id === savedA.id)
          ? nextRecords.map((r) => (r.id === savedA.id ? savedA : r))
          : [...nextRecords, savedA];
      }
      if (edgeIpv6) {
        const savedAAAA = await upsertApexRecord(target.id, nextRecords, 'AAAA', edgeIpv6);
        nextRecords = nextRecords.some((r) => r.id === savedAAAA.id)
          ? nextRecords.map((r) => (r.id === savedAAAA.id ? savedAAAA : r))
          : [...nextRecords, savedAAAA];
      }

      const bindRes = await fetch('/api/cloud/domains', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: target.domain,
          dropletId: droplet.id,
          targetPort: parsedPort,
          proxyEnabled: true
        })
      });
      const bindPayload = await bindRes.json().catch(() => ({}));
      if (!bindRes.ok) throw new Error(bindPayload.error || 'Could not activate VPS web proxy.');

      setRecordsByDomainId((prev) => ({ ...prev, [target.id]: nextRecords }));
      const updated = { ...target, dropletId: droplet.id, dropletName: droplet.name, targetPort: parsedPort, proxyEnabled: true };
      setDomains((prev) => prev.map((d) => (d.id === target.id ? updated : d)));
      if (selected?.id === target.id) setSelected(updated);
      if (newlyCreatedDomain?.id === target.id) setNewlyCreatedDomain(updated);
      showToast?.(`Connected ${target.domain} -> ${droplet.name} (port ${parsedPort}) with automatic SSL.`);
    } catch (error) {
      showToast?.(error.message || 'Could not sync VPS domain routing.', 'error');
    } finally {
      setConnectingDroplet(false);
    }
  };

  const handleClaimNewDomain = async (event) => {
    event.preventDefault();
    const cleaned = newDomainInput.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/, 1)[0];
    if (!cleaned || claimingDomain) return;

    setClaimingDomain(true);
    try {
      if (addDomainMode === 'custom') {
        const parsedPort = Math.min(65535, Math.max(1, Number.parseInt(String(targetProxyPort || '80'), 10) || 80));
        const response = await fetch('/api/cloud/domains', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostname: cleaned,
            dropletId: selectedDropletId || null,
            targetPort: parsedPort,
            proxyEnabled: true
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not add custom domain.');
        const created = {
          ...payload.domain,
          domain: payload.domain.hostname,
          name: payload.domain.hostname,
          domainKind: 'custom'
        };
        setDomains((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
        setSelected(created);
        setNewlyCreatedDomain(created);
        setRecordsByDomainId((prev) => ({ ...prev, [created.id]: created.records || [] }));
        setNewDomainInput('');
        setAvailability(null);
        showToast?.(
          created.status === 'active'
            ? `${created.domain} added and active with SSL!`
            : `${created.domain} added. Point nameservers to ${platformDns.nameservers.join(' & ')} below.`
        );
        return;
      }

      const response = await fetch('/api/subdomains/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: availability?.name || cleaned })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Could not add domain.');
      }
      const created = payload.registration ? { ...payload.registration, domainKind: 'subdomain' } : null;
      if (created?.id) {
        setDomains((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
        setSelected(created);
        setNewlyCreatedDomain(created);
        setNewDomainInput('');
        setAvailability(null);
        await loadRecords(created);
        showToast?.(`${created.domain} added. Connect a VPS in Step 3 below.`);
      }
    } catch (error) {
      showToast?.(error.message || 'Could not add domain.', 'error');
    } finally {
      setClaimingDomain(false);
    }
  };

  const runPropagationCheck = async () => {
    if (!selected?.id) return;
    const latest = await loadRecords(selected);
    const hasA = latest.some((r) => r.type === 'A');
    const hasAAAA = latest.some((r) => r.type === 'AAAA');
    const hasNs = nameservers.length >= 2 || latest.some((r) => r.type === 'NS');
    setHealthReport({
      checkedAt: new Date().toISOString(),
      hasA,
      hasAAAA,
      hasNs,
      recordCount: latest.length
    });
    showToast?.(`Propagation & zone check completed for ${selected.domain}.`);
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1400);
    } catch {
      showToast?.('Could not copy value.', 'error');
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    setRecord({ type: item.type, name: item.name, value: item.value, ttl: item.ttl });
    setConfirmDeleteId(null);
  };

  const selectedSummary = useMemo(
    () => (selected ? getDomainSummary(selected) : null),
    [getDomainSummary, selected]
  );

  const isLocked = selected ? transferLocks[selected.id] ?? true : true;
  const isAutoRenew = selected ? autoRenewPrefs[selected.id] ?? true : true;

  const renderRecordsTable = (items) => {
    if (!items.length) {
      return (
        <div className="rounded-xl border border-dashed border-neutral-200/80 bg-neutral-50/70 p-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
          No DNS records configured in this section yet.
        </div>
      );
    }

    return (
      <>
        {/* Desktop Table */}
        <div className="hidden overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800 md:block">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-neutral-50/90 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Value / Target</th>
                <th className="px-4 py-3">TTL</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                  <td className="px-4 py-3">
                    <Badge variant={item.type === 'AAAA' ? 'info' : item.type === 'A' ? 'brand' : 'secondary'}>
                      {item.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.name}
                  </td>
                  <td className="max-w-xs break-all px-4 py-3 font-mono text-neutral-700 dark:text-neutral-300">
                    <div className="flex items-center gap-2">
                      <span className="break-all">{item.value}</span>
                      <button
                        type="button"
                        onClick={() => copy(item.value)}
                        aria-label={`Copy ${item.type} value`}
                        className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {copied === item.value ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{item.ttl}s</td>
                  <td className="px-4 py-3 text-right">
                    {confirmDeleteId === item.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Button type="button" variant="destructive" size="sm" onClick={() => deleteRecord(item)}>
                          Confirm
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(item)}
                          aria-label={`Edit ${item.type} record`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Delete ${item.type} record`}
                          className="hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Stack */}
        <div className="space-y-2.5 md:hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={item.type === 'AAAA' ? 'info' : item.type === 'A' ? 'brand' : 'secondary'}>
                    {item.type}
                  </Badge>
                  <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-white">{item.name}</span>
                </div>
                <span className="text-[11px] text-neutral-500">TTL {item.ttl}s</span>
              </div>
              <p className="mt-2 break-all rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {item.value}
              </p>
              <div className="mt-2.5 flex items-center justify-end gap-1.5">
                {confirmDeleteId === item.id ? (
                  <>
                    <Button type="button" variant="destructive" size="sm" onClick={() => deleteRecord(item)}>
                      Confirm
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(item.value)}>
                      {copied === item.value ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderAddDomainFlow = () => {
    const activeTargetDomain = newlyCreatedDomain || selected;
    const setupNameservers = activeTargetDomain?.nameservers?.length
      ? activeTargetDomain.nameservers
      : platformDns.nameservers;
    const selectedVps = droplets.find((d) => String(d.id) === String(selectedDropletId));
    const selectedVpsIps = getDropletIps(selectedVps);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setViewMode('portfolio');
                setNewlyCreatedDomain(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Domains
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                Add Domain & Connect VPS
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Register your .{FREE_SUBDOMAIN_DOMAIN} zone, configure Tiwlo nameservers, and point DNS to your VPS.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="md" disabled title="Domain purchasing is coming soon">
            <ShoppingBag className="h-4 w-4" />
            Buy Domain
            <Badge variant="secondary" className="ml-1">Coming Soon</Badge>
          </Button>
        </div>

        <Alert variant="info">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Automatic Edge HTTPS + VPS Port Forwarding (Zero Router Config)</p>
            <p className="mt-0.5 text-[11px] opacity-90">
              Domains using Tiwlo Nameservers (<code className="font-mono">dns1.tiwlo.com</code> / <code className="font-mono">dns2.tiwlo.com</code>) or Cloudflare <code className="font-mono">AAAA</code> automatically get SSL via Tiwlo Edge and route traffic directly to your chosen VPS HTTP port.
            </p>
          </div>
        </Alert>

        {/* Step 1: Enter & Save Domain (Custom Domain OR Free .uids.app Subdomain) */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="brand">Step 1</Badge>
                <CardTitle>Add Custom Domain or .{FREE_SUBDOMAIN_DOMAIN}</CardTitle>
              </div>
              {newlyCreatedDomain && (
                <Badge variant={newlyCreatedDomain.status === 'active' ? 'success' : 'warning'}>
                  Saved: {newlyCreatedDomain.domain} ({newlyCreatedDomain.status === 'active' ? 'Active' : 'Pending DNS'})
                </Badge>
              )}
            </div>
            <CardDescription>
              Add your own domain (e.g. mybrand.com) using Tiwlo nameservers, or claim a free .{FREE_SUBDOMAIN_DOMAIN} address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => {
                  setAddDomainMode('custom');
                  setNewDomainInput('');
                  setAvailability(null);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  addDomainMode === 'custom'
                    ? 'bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Custom Domain (Your Domain)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddDomainMode('subdomain');
                  setNewDomainInput('');
                  setAvailability(null);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  addDomainMode === 'subdomain'
                    ? 'bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Free .{FREE_SUBDOMAIN_DOMAIN}
              </button>
            </div>

            <form onSubmit={handleClaimNewDomain} className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <div className="flex items-center rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2 focus-within:border-neutral-400 focus-within:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:focus-within:bg-neutral-950">
                  <input
                    type="text"
                    value={newDomainInput}
                    onChange={(e) => {
                      setNewDomainInput(e.target.value.toLowerCase());
                      setAvailability(null);
                    }}
                    placeholder={addDomainMode === 'custom' ? 'example.com or app.example.com' : 'my-app'}
                    maxLength={253}
                    aria-label="Domain name"
                    className="w-full bg-transparent text-sm font-medium text-neutral-950 placeholder:text-neutral-400 focus:outline-none dark:text-white"
                    required
                  />
                  {addDomainMode === 'subdomain' && (
                    <span className="shrink-0 pl-2 font-mono text-xs font-semibold text-emerald-700 dark:text-[#1ED760]">
                      .{FREE_SUBDOMAIN_DOMAIN}
                    </span>
                  )}
                </div>
                {addDomainMode === 'subdomain' && checkingAvailability && (
                  <p className="mt-1.5 text-xs text-neutral-500">Checking availability…</p>
                )}
                {addDomainMode === 'subdomain' && !checkingAvailability && availability && (
                  <p className={`mt-1.5 text-xs font-medium ${availability.available ? 'text-emerald-700 dark:text-[#1ED760]' : 'text-rose-600 dark:text-rose-400'}`}>
                    {availability.available
                      ? `${availability.domain} is available.`
                      : availability.message || `${availability.domain || newDomainInput} is ${availability.status}.`}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={
                  claimingDomain ||
                  !newDomainInput.trim() ||
                  (addDomainMode === 'subdomain' && availability && !availability.available)
                }
              >
                <Plus className="h-4 w-4" />
                {claimingDomain ? 'Saving Domain…' : 'Save Domain'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Step 2: Nameserver Setup Guide */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Step 2</Badge>
              <CardTitle>Nameserver Setup Guide</CardTitle>
              <HelpTooltip
                label="Nameserver sync help"
                title="How Tiwlo Nameservers Stay Synced"
                description="Pointing or delegating your domain to Tiwlo authoritative nameservers ensures every A, AAAA, CNAME, MX, and TXT update propagates cleanly across our edge resolvers."
              />
            </div>
            <CardDescription>
              Use these exact Tiwlo nameservers at your registrar (or keep them active for your .{FREE_SUBDOMAIN_DOMAIN} zone).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              <li className="flex gap-2">
                <span className="font-bold text-neutral-900 dark:text-white">1.</span>
                <span>Open your domain registrar&apos;s <strong>DNS / Nameservers</strong> panel and switch to <strong>Custom Nameservers</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-neutral-900 dark:text-white">2.</span>
                <span>Enter the two Tiwlo authoritative nameservers below and save changes.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-neutral-900 dark:text-white">3.</span>
                <span>Connect your domain to a VPS droplet in Step 3 so Tiwlo writes your IPv4 (A) and IPv6 (AAAA) records automatically.</span>
              </li>
            </ol>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {setupNameservers.map((ns, index) => (
                <div
                  key={ns}
                  className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Nameserver {index + 1}
                    </p>
                    <p className="font-mono text-xs font-semibold text-neutral-950 dark:text-white">{ns}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(ns)}>
                    {copied === ns ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === ns ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              ))}
            </div>
            {(platformDns.ipv6 || platformDns.ipv4) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
                <div>
                  <span className="font-medium text-neutral-700 dark:text-neutral-200">
                    Or via Cloudflare (IPv4 + IPv6 CDN):
                  </span>{' '}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Add AAAA record <code className="font-mono text-neutral-900 dark:text-neutral-100">@ -&gt; {platformDns.ipv6 || platformDns.ipv4}</code> with Cloudflare Proxy ON.
                  </span>
                </div>
                {activeTargetDomain?.domainKind === 'custom' && activeTargetDomain.status !== 'active' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={verifyingDomainId === activeTargetDomain.id}
                    onClick={() => handleVerifyCustomDomain(activeTargetDomain)}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${verifyingDomainId === activeTargetDomain.id ? 'animate-spin' : ''}`} />
                    {verifyingDomainId === activeTargetDomain.id ? 'Checking…' : 'Verify DNS & Activate'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Connect Domain to VPS / Droplet */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Step 3</Badge>
              <CardTitle>Connect Domain to VPS / Droplet</CardTitle>
              <HelpTooltip
                label="IPv6 AAAA auto-sync help"
                title="Dual-Stack A & AAAA Auto-Sync"
                description="Selecting a VPS automatically creates or updates both your @ A (IPv4) and @ AAAA (IPv6) DNS records using that droplet's live assigned addresses."
              />
            </div>
            <CardDescription>
              {activeTargetDomain
                ? `Target domain: ${activeTargetDomain.domain}`
                : 'Save or select a domain above, then pick a VPS to auto-sync A and AAAA DNS records.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {droplets.length === 0 ? (
              <Alert variant="warning">
                <Server className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No active VPS / Droplets found on this account</p>
                  <p className="mt-0.5 text-[11px]">
                    You can create a droplet first or manually add custom A / AAAA records inside the DNS Zone Manager.
                  </p>
                </div>
              </Alert>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="add-domain-vps-select" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Choose VPS / Droplet
                  </label>
                  <select
                    id="add-domain-vps-select"
                    value={selectedDropletId}
                    onChange={(e) => setSelectedDropletId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  >
                    {droplets.map((d) => {
                      const ips = getDropletIps(d);
                      const ipSummary = [ips.ipv4 && `IPv4: ${ips.ipv4}`, ips.ipv6 && `IPv6: ${ips.ipv6}`]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.regionCode || d.region || 'VPS'}) {ipSummary ? `— ${ipSummary}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="w-full space-y-1.5 sm:w-28">
                  <label htmlFor="add-domain-vps-port" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    VPS Port
                  </label>
                  <input
                    id="add-domain-vps-port"
                    type="number"
                    min="1"
                    max="65535"
                    value={targetProxyPort}
                    onChange={(e) => setTargetProxyPort(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={!activeTargetDomain || !selectedDropletId || connectingDroplet}
                  onClick={() => connectDomainToDroplet(activeTargetDomain, selectedDropletId)}
                >
                  <Link2 className="h-4 w-4" />
                  {connectingDroplet ? 'Connecting…' : 'Connect to VPS'}
                </Button>
              </div>
            )}

            {selectedVps && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3.5 py-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
                <span className="font-semibold text-neutral-700 dark:text-neutral-200">{selectedVps.name}:</span>
                <Badge variant={selectedVpsIps.ipv4 ? 'brand' : 'secondary'}>
                  IPv4 A: {selectedVpsIps.ipv4 || 'Not assigned'}
                </Badge>
                <Badge variant={selectedVpsIps.ipv6 ? 'info' : 'secondary'}>
                  IPv6 AAAA: {selectedVpsIps.ipv6 || 'Not assigned'}
                </Badge>
                <Badge variant="outline">User-Managed SSL (Inside Your VPS)</Badge>
              </div>
            )}

            {activeTargetDomain && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    selectDomain(activeTargetDomain);
                    setManagerTab('dns');
                  }}
                >
                  Open DNS Zone Manager for {activeTargetDomain.domain}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 text-neutral-950 dark:text-neutral-50">
      {/* Clean Flat shadcn/ui Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Cloud DNS</Badge>
              {lastSyncedAt && (
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
              Domain Portfolio &amp; DNS Manager
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Manage custom domains, free .{FREE_SUBDOMAIN_DOMAIN} domains, Tiwlo nameservers, and live VPS routing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={syncing || loading}
              onClick={() => refreshDomains({ silent: false })}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync DNS'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled
              title="Domain purchasing is coming soon"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Buy Domain
              <Badge variant="secondary" className="ml-0.5 text-[10px]">Soon</Badge>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setViewMode((mode) => (mode === 'add' ? 'portfolio' : 'add'))}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Domain
            </Button>
          </div>
        </CardContent>
      </Card>

      {claimNotice && (
        <Alert variant="warning" className="justify-between">
          <div className="space-y-1">
            <p className="font-semibold">{claimNotice.title}</p>
            <p>{claimNotice.message}</p>
            {claimNotice.maskedEmail && (
              <p className="text-[11px] opacity-80">Account email: {claimNotice.maskedEmail}</p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setClaimNotice(null)}>
            Dismiss
          </Button>
        </Alert>
      )}

      {viewMode === 'add' ? (
        renderAddDomainFlow()
      ) : (
        <>
          {/* Portfolio Overview Strip */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search domains, nameservers, VPS IP…"
                    aria-label="Search domains"
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50/70 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="all">All ({filterCounts.all})</TabsTrigger>
                    <TabsTrigger value="verified">Verified / Active ({filterCounts.verified})</TabsTrigger>
                    <TabsTrigger value="pending">Needs DNS / Pending ({filterCounts.pending})</TabsTrigger>
                    <TabsTrigger value="ipv6">IPv6 AAAA Enabled ({filterCounts.ipv6})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {loading ? (
                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40">
                  Loading domain portfolio…
                </div>
              ) : filteredDomains.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200/80 bg-neutral-50/60 p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
                  <Globe2 className="mx-auto h-6 w-6 text-neutral-400" />
                  <p className="mt-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {domains.length === 0 ? 'No custom or free domains added yet' : 'No domains match this filter'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {domains.length === 0
                      ? 'Click Add Domain above to register a domain and point it to your VPS.'
                      : 'Clear your search query or switch filter tabs to view other domains.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Portfolio Table */}
                  <div className="hidden overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800 md:block">
                    <table className="w-full min-w-[780px] text-left text-xs">
                      <thead className="bg-neutral-50/90 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-900/80 dark:text-neutral-400">
                        <tr>
                          <th className="px-4 py-3">Domain</th>
                          <th className="px-4 py-3">Nameservers</th>
                          <th className="px-4 py-3">Linked Droplet / Target</th>
                          <th className="px-4 py-3">IPv4 A &amp; IPv6 AAAA</th>
                          <th className="px-4 py-3">SSL &amp; Lock</th>
                          <th className="px-4 py-3 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/70 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                        {filteredDomains.map((domainObj) => {
                          const summary = getDomainSummary(domainObj);
                          const isSelected = selected?.id === domainObj.id;
                          const locked = transferLocks[domainObj.id] ?? true;

                          return (
                            <tr
                              key={domainObj.id}
                              onClick={() => selectDomain(domainObj)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#1ED760]/8 dark:bg-[#1ED760]/10'
                                  : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Globe2 className="h-4 w-4 shrink-0 text-neutral-500" />
                                  <div>
                                    <p className="font-mono font-semibold text-neutral-950 dark:text-white">
                                      {domainObj.domain}
                                    </p>
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <Badge variant={summary.isVerified ? 'success' : 'warning'}>
                                        {summary.isVerified ? 'Active' : domainObj.status || 'Pending'}
                                      </Badge>
                                      <span className="text-[11px] text-neutral-500">
                                        Auto-Renew · {formatShortDate(domainObj.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {summary.nsList.slice(0, 2).map((ns) => (
                                    <Badge key={ns} variant="outline" className="font-mono text-[10px]">
                                      {ns}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {summary.linkedDroplet ? (
                                  <div>
                                    <p className="font-semibold text-neutral-900 dark:text-white">
                                      {summary.linkedDroplet.name}
                                    </p>
                                    <p className="font-mono text-[11px] text-neutral-500">
                                      {summary.primaryIpv4 || summary.primaryIpv6}
                                    </p>
                                  </div>
                                ) : summary.primaryIpv4 || summary.primaryIpv6 ? (
                                  <div>
                                    <p className="font-medium text-neutral-700 dark:text-neutral-300">Custom Target</p>
                                    <p className="font-mono text-[11px] text-neutral-500">
                                      {summary.primaryIpv4 || summary.primaryIpv6}
                                    </p>
                                  </div>
                                ) : (
                                  <Badge variant="warning">Needs DNS Target</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant={summary.hasA ? 'brand' : 'secondary'}>
                                    A: {summary.hasA ? 'Synced' : 'None'}
                                  </Badge>
                                  <Badge variant={summary.hasAAAA ? 'info' : 'secondary'}>
                                    AAAA: {summary.hasAAAA ? 'IPv6' : 'Off'}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline">User-Managed SSL (VPS)</Badge>
                                  <Badge variant={locked ? 'secondary' : 'warning'}>
                                    {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                    {locked ? 'Locked' : 'Unlocked'}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  variant={isSelected ? 'primary' : 'outline'}
                                  size="sm"
                                  onClick={() => selectDomain(domainObj)}
                                >
                                  {isSelected ? 'Selected' : 'Manage'}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Portfolio Card Stack */}
                  <div className="space-y-2.5 md:hidden">
                    {filteredDomains.map((domainObj) => {
                      const summary = getDomainSummary(domainObj);
                      const isSelected = selected?.id === domainObj.id;
                      const locked = transferLocks[domainObj.id] ?? true;

                      return (
                        <div
                          key={domainObj.id}
                          onClick={() => selectDomain(domainObj)}
                          className={`rounded-xl border p-3.5 transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#1ED760]/60 bg-[#1ED760]/8 dark:bg-[#1ED760]/10'
                              : 'border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm font-bold text-neutral-950 dark:text-white">
                                {domainObj.domain}
                              </p>
                              <p className="mt-0.5 text-[11px] text-neutral-500">
                                {summary.linkedDroplet
                                  ? `VPS: ${summary.linkedDroplet.name}`
                                  : summary.primaryIpv4 || summary.primaryIpv6 || 'No VPS target yet'}
                              </p>
                            </div>
                            <Badge variant={summary.isVerified ? 'success' : 'warning'}>
                              {summary.isVerified ? 'Active' : domainObj.status || 'Pending'}
                            </Badge>
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <Badge variant={summary.hasA ? 'brand' : 'secondary'}>
                              A: {summary.hasA ? 'Synced' : 'None'}
                            </Badge>
                            <Badge variant={summary.hasAAAA ? 'info' : 'secondary'}>
                              AAAA: {summary.hasAAAA ? 'IPv6' : 'Off'}
                            </Badge>
                            <Badge variant="outline">User-Managed SSL (VPS)</Badge>
                            <Badge variant={locked ? 'secondary' : 'warning'}>
                              {locked ? 'Locked' : 'Unlocked'}
                            </Badge>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
                            <span className="truncate font-mono text-[10px] text-neutral-500">
                              NS: {summary.nsList.join(', ')}
                            </span>
                            <Button
                              type="button"
                              variant={isSelected ? 'primary' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectDomain(domainObj);
                              }}
                            >
                              {isSelected ? 'Managing' : 'Manage'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* GoDaddy-Style Domain Details Manager */}
          {selected && selectedSummary && (
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-lg font-bold text-neutral-950 dark:text-white sm:text-xl">
                        {selected.domain}
                      </h2>
                      <Badge variant={selectedSummary.isVerified ? 'success' : 'warning'}>
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedSummary.isVerified ? 'Active Zone' : selected.status || 'Pending'}
                      </Badge>
                      <Badge variant={selectedSummary.hasA ? 'brand' : 'secondary'}>
                        IPv4 A: {selectedSummary.hasA ? 'Active' : 'Missing'}
                      </Badge>
                      <Badge variant={selectedSummary.hasAAAA ? 'info' : 'secondary'}>
                        IPv6 AAAA: {selectedSummary.hasAAAA ? 'Enabled' : 'Not Set'}
                      </Badge>
                      <div className="inline-flex items-center gap-1">
                        <Badge variant="outline">
                          User-Managed SSL (Inside Your VPS — Platform SSL Disabled)
                        </Badge>
                        <HelpTooltip
                          label="VPS SSL explanation"
                          title="User-Managed SSL (Inside Your VPS)"
                          description="Platform SSL is intentionally disabled for VPS domains. Tiwlo routes DNS directly to your VPS IPv4/IPv6 and never intercepts TLS — run Certbot, Nginx, or Caddy SSL inside your VPS."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300">Nameservers:</span>
                      <span className="font-mono">{nameservers.join(' · ')}</span>
                      <HelpTooltip
                        label="Nameservers sync explanation"
                        title="Authoritative Tiwlo Nameservers"
                        description="Tiwlo's dual authoritative nameservers keep your zone records synced cleanly across global resolvers whenever you update A, AAAA, CNAME, MX, or TXT entries."
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {domains.length > 1 && (
                      <select
                        aria-label="Switch active domain"
                        value={selected.id}
                        onChange={(e) => {
                          const found = domains.find((d) => d.id === e.target.value);
                          if (found) selectDomain(found);
                        }}
                        className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-semibold text-neutral-800 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      >
                        {domains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.domain}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      disabled={loadingRecords}
                      onClick={runPropagationCheck}
                    >
                      <Activity className="h-3.5 w-3.5" />
                      {loadingRecords ? 'Checking…' : 'Check Propagation'}
                    </Button>
                    {selected.domainKind === 'custom' && selected.status !== 'active' && (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        disabled={verifyingDomainId === selected.id}
                        onClick={() => handleVerifyCustomDomain(selected)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${verifyingDomainId === selected.id ? 'animate-spin' : ''}`} />
                        {verifyingDomainId === selected.id ? 'Verifying…' : 'Verify DNS'}
                      </Button>
                    )}
                    {selected.domainKind === 'custom' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        onClick={async () => {
                          const res = await fetch(`/api/cloud/domains/${encodeURIComponent(selected.id)}`, {
                            method: 'DELETE',
                            credentials: 'include'
                          });
                          if (res.ok) {
                            setDomains((prev) => {
                              const next = prev.filter((d) => d.id !== selected.id);
                              setSelected(next[0] || null);
                              return next;
                            });
                            showToast?.(`Removed ${selected.domain}.`);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Dedicated Manager Tabs */}
                <Tabs value={managerTab} onValueChange={setManagerTab}>
                  <TabsList className="w-full justify-start sm:w-auto">
                    <TabsTrigger value="dns">DNS Zone Records ({zoneRecords.length})</TabsTrigger>
                    <TabsTrigger value="nameservers">Domain &amp; Nameservers</TabsTrigger>
                    <TabsTrigger value="ssl">Subdomains, Forwarding &amp; VPS SSL</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>

              <CardContent className="space-y-5">
                {healthReport && (
                  <Alert variant={healthReport.hasA || healthReport.hasAAAA ? 'success' : 'warning'}>
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">
                        DNS Health Check ({new Date(healthReport.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                      </p>
                      <p className="mt-0.5 text-[11px]">
                        IPv4 A: {healthReport.hasA ? 'Configured' : 'Missing'} · IPv6 AAAA: {healthReport.hasAAAA ? 'Configured' : 'Not configured'} · Nameservers: {healthReport.hasNs ? 'Ready' : 'Check NS'} · Total Records: {healthReport.recordCount}
                      </p>
                    </div>
                  </Alert>
                )}

                {/* SECTION B: DNS ZONE RECORDS */}
                {managerTab === 'dns' && (
                  <div className="space-y-5">
                    {/* AAAA IPv6 Auto-Sync & VPS Quick-Connect Bar */}
                    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                            AAAA IPv6 Auto-Sync &amp; VPS Binding
                          </span>
                          <Badge variant={selectedSummary.hasAAAA ? 'info' : 'secondary'}>
                            {selectedSummary.hasAAAA ? 'AAAA IPv6 Synced' : 'IPv4 Only / No AAAA'}
                          </Badge>
                          <HelpTooltip
                            label="AAAA IPv6 Auto-Sync help"
                            title="AAAA IPv6 Auto-Sync"
                            description="When you connect a domain to a Tiwlo VPS droplet, both your A (IPv4) and AAAA (IPv6) apex records are automatically created and kept synced with your VPS network interfaces."
                          />
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {selectedSummary.linkedDroplet
                            ? `Currently linked to VPS "${selectedSummary.linkedDroplet.name}".`
                            : 'Select a VPS below to automatically write or update @ A and @ AAAA records.'}
                        </p>
                      </div>

                      {droplets.length > 0 && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            aria-label="Connect VPS droplet"
                            value={selectedDropletId}
                            onChange={(e) => setSelectedDropletId(e.target.value)}
                            className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                          >
                            {droplets.map((d) => {
                              const ips = getDropletIps(d);
                              return (
                                <option key={d.id} value={d.id}>
                                  {d.name} {ips.ipv4 ? `(${ips.ipv4})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            disabled={!selectedDropletId || connectingDroplet}
                            onClick={() => connectDomainToDroplet(selected, selectedDropletId)}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            {connectingDroplet ? 'Syncing…' : 'Sync VPS A / AAAA'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Inline Quick Add / Edit DNS Record Form */}
                    <form
                      onSubmit={submitRecord}
                      className="grid gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 md:grid-cols-[110px_1fr_1.6fr_96px_auto]"
                    >
                      <select
                        aria-label="Record type"
                        value={record.type}
                        onChange={(e) => setRecord({ ...record, type: e.target.value })}
                        className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-semibold text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      >
                        {RECORD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        value={record.name}
                        onChange={(e) => setRecord({ ...record, name: e.target.value })}
                        placeholder="Host, e.g. @ or www"
                        aria-label="Record host name"
                        className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        required
                      />
                      <input
                        value={record.value}
                        onChange={(e) => setRecord({ ...record, value: e.target.value })}
                        placeholder={RECORD_PLACEHOLDERS[record.type] || 'Value'}
                        aria-label="Record value"
                        className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        required
                      />
                      <input
                        type="number"
                        min="60"
                        max="86400"
                        value={record.ttl}
                        onChange={(e) => setRecord({ ...record, ttl: e.target.value })}
                        aria-label="Record TTL in seconds"
                        className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <Button type="submit" variant="primary" size="md" disabled={savingRecord} className="flex-1">
                          <Plus className="h-3.5 w-3.5" />
                          {editing ? 'Save' : 'Add'}
                        </Button>
                        {editing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => {
                              setEditing(null);
                              setRecord(EMPTY_RECORD);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </form>

                    {renderRecordsTable(zoneRecords)}
                  </div>
                )}

                {/* SECTION A: DOMAIN & NAMESERVERS */}
                {managerTab === 'nameservers' && (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Primary Nameservers */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                            <CardTitle>Primary Nameservers</CardTitle>
                            <HelpTooltip
                              label="Primary nameservers help"
                              title="How Tiwlo Nameservers Work"
                              description="Use these Tiwlo authoritative nameservers so zone edits (A, AAAA, CNAME, MX, TXT) take effect cleanly without external DNS drift."
                            />
                          </div>
                          <CardDescription>
                            Copy these authoritative nameservers or delegate subdomains with custom NS records below.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                          {nameservers.map((nsValue, idx) => (
                            <div
                              key={nsValue}
                              className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
                            >
                              <div>
                                <p className="text-[10px] font-semibold uppercase text-neutral-500">NS {idx + 1}</p>
                                <p className="font-mono text-xs font-semibold text-neutral-900 dark:text-white">{nsValue}</p>
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={() => copy(nsValue)}>
                                {copied === nsValue ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied === nsValue ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Auto-Renew & Transfer Lock Controls */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                            <CardTitle>Renewal &amp; Transfer Lock</CardTitle>
                          </div>
                          <CardDescription>
                            Zone lifecycle protection for {selected.domain}.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                            <div>
                              <p className="text-xs font-semibold text-neutral-900 dark:text-white">Auto-Renew</p>
                              <p className="text-[11px] text-neutral-500">Platform zone stays active automatically.</p>
                            </div>
                            <Button
                              type="button"
                              variant={isAutoRenew ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const next = !isAutoRenew;
                                setAutoRenewPrefs((prev) => ({ ...prev, [selected.id]: next }));
                                showToast?.(`Auto-Renew ${next ? 'enabled' : 'paused'} for ${selected.domain}.`);
                              }}
                            >
                              {isAutoRenew ? 'On' : 'Off'}
                            </Button>
                          </div>

                          <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                            <div>
                              <p className="text-xs font-semibold text-neutral-900 dark:text-white">Transfer Lock</p>
                              <p className="text-[11px] text-neutral-500">Prevents unauthorized zone delegation transfers.</p>
                            </div>
                            <Button
                              type="button"
                              variant={isLocked ? 'dark' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const next = !isLocked;
                                setTransferLocks((prev) => ({ ...prev, [selected.id]: next }));
                                showToast?.(`Transfer Lock ${next ? 'enabled' : 'disabled'} for ${selected.domain}.`);
                              }}
                            >
                              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                              {isLocked ? 'Locked' : 'Unlocked'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Custom NS Records</h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Optional sub-zone delegation records for {selected.domain}.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(null);
                            setRecord({ type: 'NS', name: '@', value: '', ttl: 3600 });
                            setManagerTab('dns');
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add NS Record
                        </Button>
                      </div>
                      {renderRecordsTable(nsRecords)}
                    </div>
                  </div>
                )}

                {/* SECTION C: SUBDOMAINS, FORWARDING & VPS SSL */}
                {managerTab === 'ssl' && (
                  <div className="space-y-5">
                    <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
                      <CardTitle>Edge SSL &amp; VPS Routing</CardTitle>
                      <HelpTooltip
                        label="Edge SSL details"
                        title="How Tiwlo Edge SSL & VPS Routing Work"
                        description="Tiwlo terminates HTTPS (Port 443) at the edge via Caddy and forwards HTTP & WebSocket traffic cleanly into your connected VPS container port (default 80), or you can use Cloudflare Proxy for IPv4+IPv6 global CDN."
                      />
                    </div>
                    <CardDescription>
                      Automatic HTTPS SSL &amp; container port forwarding for {selected.domain}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Alert variant={selectedSummary.linkedDroplet ? 'success' : 'info'}>
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          {selectedSummary.linkedDroplet
                            ? `Connected to ${selectedSummary.linkedDroplet.name} (Port ${selected.targetPort || 80})`
                            : 'Ready to connect to a VPS Droplet'}
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          Set registrar nameservers to <code className="font-mono">{nameservers.join(' / ')}</code> (or Cloudflare <code className="font-mono">AAAA -&gt; {platformDns.ipv6 || 'server IPv6'}</code>) and connect any VPS droplet to serve HTTP/WebSocket apps with automatic TLS.
                        </p>
                      </div>
                    </Alert>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-neutral-800">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                              Apex Routing (@)
                            </p>
                            <p className="mt-1 font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                              {selectedSummary.primaryIpv4 || selectedSummary.primaryIpv6 || 'No apex A/AAAA record set'}
                            </p>
                            <p className="mt-1 text-[11px] text-neutral-500">
                              {selectedSummary.linkedDroplet
                                ? `Routed directly to VPS: ${selectedSummary.linkedDroplet.name}`
                                : 'Direct DNS passthrough to target IP'}
                            </p>
                          </div>

                          <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-neutral-800">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                              Subdomain &amp; CNAME Forwarding
                            </p>
                            <p className="mt-1 text-xs font-semibold text-neutral-900 dark:text-white">
                              {subdomainRecords.length} host record{subdomainRecords.length === 1 ? '' : 's'} active
                            </p>
                            <p className="mt-1 text-[11px] text-neutral-500">
                              Add CNAME or A records (e.g. www, api, *) in the DNS Zone tab to route subdomains.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                            Subdomain Host Records
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Non-apex records (e.g. www, api, *) configured under {selected.domain}.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(null);
                            setRecord({ type: 'CNAME', name: 'www', value: selected.domain, ttl: 300 });
                            setManagerTab('dns');
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Subdomain Record
                        </Button>
                      </div>
                      {renderRecordsTable(subdomainRecords)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
