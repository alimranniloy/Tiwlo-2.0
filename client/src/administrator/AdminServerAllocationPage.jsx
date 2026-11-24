import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui/shadcnPrimitives';
import {
  Activity,
  ArrowLeft,
  Check,
  Cpu,
  Gauge,
  HelpCircle,
  MemoryStick,
  Package,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  SlidersHorizontal,
} from 'lucide-react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';
const API_ORIGIN =
  API_BASE.replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const PACKAGE_CATEGORIES = [
  'Standard',
  'CPU Optimized',
  'Memory Optimized',
  'Storage NVMe',
];

const TIER_PALETTE = ['#1ED760', '#0ea5e9', '#f59e0b', '#6366f1', '#64748b'];

function HelpPopover({ title, text, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!pinned) return undefined;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [pinned]);

  const posClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/60 ${
          open
            ? 'bg-[#1ED760]/20 text-emerald-700 dark:text-[#1ED760]'
            : 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200'
        }`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-50 mt-1.5 w-64 rounded-xl border border-neutral-200/90 bg-white p-3 text-left shadow-lg dark:border-neutral-800 dark:bg-neutral-950 ${posClass}`}
        >
          <p className="text-[11px] font-semibold text-neutral-900 dark:text-white">{title}</p>
          <p className="mt-1 text-[11px] font-normal leading-relaxed text-neutral-600 dark:text-neutral-300 normal-case tracking-normal">
            {text}
          </p>
        </div>
      )}
    </span>
  );
}

function normalizeAllocationPackage(raw = {}, idx = 0) {
  const displayedVcpus = Number(raw.displayedVcpus ?? raw.vcpus ?? 1) || 1;
  const displayedRamGb = Number(raw.displayedRamGb ?? raw.ramGb ?? 1) || 1;
  const displayedStorageGb = Number(raw.displayedStorageGb ?? raw.storageGb ?? 25) || 25;
  const backendCpuQuotaPct = Number(raw.backendCpuQuotaPct ?? displayedVcpus * 100) || 100;
  const backendRamMb = Number(raw.backendRamMb ?? displayedRamGb * 1024) || 1024;
  const backendStorageGb = Number(raw.backendStorageGb ?? displayedStorageGb) || displayedStorageGb;
  const burstRamMb = Number(raw.burstRamMb ?? 0) || 0;

  return {
    ...raw,
    id: String(raw.id || raw.slug || `pkg-${idx + 1}`),
    name: String(raw.name || raw.title || `Package ${idx + 1}`),
    category: raw.category || 'Standard',
    enabled: raw.enabled !== false,
    monthlyPriceUsd: Number(raw.monthlyPriceUsd ?? raw.monthlyPrice ?? raw.price ?? 0) || 0,
    displayedVcpus,
    displayedRamGb,
    displayedStorageGb,
    backendCpuQuotaPct,
    backendRamMb,
    backendStorageGb,
    burstRamMb,
    sortOrder: Number(raw.sortOrder ?? idx + 1) || idx + 1,
  };
}

function toDraftFields(pkg) {
  return {
    displayedVcpus: String(pkg.displayedVcpus),
    displayedRamGb: String(pkg.displayedRamGb),
    displayedStorageGb: String(pkg.displayedStorageGb),
    backendCpuQuotaPct: String(pkg.backendCpuQuotaPct),
    backendRamMb: String(pkg.backendRamMb),
    backendStorageGb: String(pkg.backendStorageGb),
    burstRamMb: String(pkg.burstRamMb),
  };
}

const numInputCls =
  'w-20 rounded-lg border border-neutral-200/90 bg-white px-2 py-1.5 text-xs tabular-nums text-neutral-900 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

export default function AdminServerAllocationPage({ onBackToDashboard, onNavigate, showToast }) {
  const [packages, setPackages] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [analyticsMeta, setAnalyticsMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [savingId, setSavingId] = useState('');
  const [savingAll, setSavingAll] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);
  const [donutMode, setDonutMode] = useState('efficiency'); // 'efficiency' | 'tiers'

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchWithOptionalReauth = useCallback(
    async (url, options = {}) => {
      const headers = { ...getHeaders(), ...(options.headers || {}) };
      let res = await fetch(url, { credentials: 'include', ...options, headers });
      let json = await res.json().catch(() => ({}));
      const needsReauth =
        (res.status === 403 || res.status === 428) &&
        (json.reauthRequired ||
          json.error === 'RECENT_VERIFICATION_REQUIRED' ||
          json.code === 'RECENT_VERIFICATION_REQUIRED' ||
          /reauth|verification|grant/i.test(json.error || json.message || ''));

      if (needsReauth) {
        headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
        res = await fetch(url, { credentials: 'include', ...options, headers });
        json = await res.json().catch(() => ({}));
      }
      return { res, json };
    },
    [getHeaders]
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const reqOpts = {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };

      let res = await fetch(`${API_BASE}/admin/server-packages/allocation-analytics`, reqOpts);
      let json = await res.json().catch(() => ({}));

      if (res.status === 404) {
        res = await fetch(`${API_BASE}/admin/server-packages`, reqOpts);
        json = await res.json().catch(() => ({}));
      }

      if (!res.ok || json.success === false) {
        throw new Error(
          json.error || json.message || `Failed to load allocation analytics (${res.status}).`
        );
      }

      const payload = json.data && !Array.isArray(json.data) ? json.data : json;
      let rawPkgs = Array.isArray(payload.packages)
        ? payload.packages
        : Array.isArray(payload.allocations)
          ? payload.allocations
          : Array.isArray(payload.serverPackages)
            ? payload.serverPackages
            : [];

      // If analytics endpoint returned summary without full packages list, fetch catalog too
      if (rawPkgs.length === 0) {
        const catRes = await fetch(`${API_BASE}/admin/server-packages`, reqOpts);
        const catJson = await catRes.json().catch(() => ({}));
        if (catRes.ok && catJson.success !== false) {
          const catPayload =
            catJson.data && !Array.isArray(catJson.data) ? catJson.data : catJson;
          rawPkgs = Array.isArray(catPayload.packages)
            ? catPayload.packages
            : Array.isArray(catPayload.serverPackages)
              ? catPayload.serverPackages
              : [];
        }
      }

      const normalized = rawPkgs
        .map(normalizeAllocationPackage)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.monthlyPriceUsd - b.monthlyPriceUsd);

      setPackages(normalized);
      setAnalyticsMeta(payload.summary || payload.analytics || payload);
      const nextDrafts = {};
      normalized.forEach((p) => {
        nextDrafts[p.id] = toDraftFields(p);
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setErrorMsg(err?.message || 'Could not load resource allocation analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Merge live draft edits with persisted packages so charts react instantaneously
  const livePackages = useMemo(() => {
    return packages.map((pkg) => {
      const d = drafts[pkg.id];
      if (!d) return pkg;
      const displayedVcpus = Math.max(1, Number(d.displayedVcpus) || pkg.displayedVcpus);
      const displayedRamGb = Math.max(0.25, Number(d.displayedRamGb) || pkg.displayedRamGb);
      const displayedStorageGb = Math.max(
        5,
        Number(d.displayedStorageGb) || pkg.displayedStorageGb
      );
      const backendCpuQuotaPct = Math.max(
        10,
        Number(d.backendCpuQuotaPct) || pkg.backendCpuQuotaPct
      );
      const backendRamMb = Math.max(128, Number(d.backendRamMb) || pkg.backendRamMb);
      const backendStorageGb = Math.max(
        5,
        Number(d.backendStorageGb) || pkg.backendStorageGb
      );
      const burstRamMb = Math.max(0, Number(d.burstRamMb ?? pkg.burstRamMb) || 0);

      const dirty =
        Number(d.displayedVcpus) !== pkg.displayedVcpus ||
        Number(d.displayedRamGb) !== pkg.displayedRamGb ||
        Number(d.displayedStorageGb) !== pkg.displayedStorageGb ||
        Number(d.backendCpuQuotaPct) !== pkg.backendCpuQuotaPct ||
        Number(d.backendRamMb) !== pkg.backendRamMb ||
        Number(d.backendStorageGb) !== pkg.backendStorageGb ||
        Number(d.burstRamMb) !== pkg.burstRamMb;

      return {
        ...pkg,
        displayedVcpus,
        displayedRamGb,
        displayedStorageGb,
        backendCpuQuotaPct,
        backendRamMb,
        backendStorageGb,
        burstRamMb,
        backendRamGb: backendRamMb / 1024,
        burstRamGb: burstRamMb / 1024,
        dirty,
      };
    });
  }, [packages, drafts]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return livePackages.filter((pkg) => {
      if (categoryFilter !== 'ALL' && pkg.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        pkg.name.toLowerCase().includes(q) ||
        pkg.id.toLowerCase().includes(q) ||
        pkg.category.toLowerCase().includes(q)
      );
    });
  }, [livePackages, search, categoryFilter]);

  const dirtyPackages = useMemo(
    () => livePackages.filter((p) => p.dirty),
    [livePackages]
  );

  // Aggregate Cluster Analytics
  const metrics = useMemo(() => {
    const list = livePackages;
    const active = list.filter((p) => p.enabled);
    const totalDisplayedRamGb = list.reduce((s, p) => s + p.displayedRamGb, 0);
    const totalBackendRamGb = list.reduce((s, p) => s + p.backendRamMb / 1024, 0);
    const totalBurstRamMb = list.reduce((s, p) => s + p.burstRamMb, 0);
    const avgCpuQuotaPct = list.length
      ? Math.round(list.reduce((s, p) => s + p.backendCpuQuotaPct, 0) / list.length)
      : 0;
    const overcommitRatio =
      totalBackendRamGb > 0 ? totalDisplayedRamGb / totalBackendRamGb : 1;
    const efficiencyPct =
      totalDisplayedRamGb > 0
        ? Math.min(200, Math.round((totalBackendRamGb / totalDisplayedRamGb) * 100))
        : 100;

    // Donut 1: Overcommit / Efficiency Allocation Breakdown
    const hardRamGb = totalBackendRamGb;
    const overcommitDeltaGb = Math.max(0, totalDisplayedRamGb - totalBackendRamGb);
    const burstPoolGb = totalBurstRamMb / 1024;
    const totalPool = Math.max(0.01, hardRamGb + overcommitDeltaGb + burstPoolGb);

    const efficiencySegments = [
      {
        name: 'Hard Backend RAM',
        valueLabel: `${hardRamGb.toFixed(1)} GB`,
        percentage: (hardRamGb / totalPool) * 100,
        color: '#1ED760',
      },
      {
        name: 'Virtual Overcommit Delta',
        valueLabel: `${overcommitDeltaGb.toFixed(1)} GB`,
        percentage: (overcommitDeltaGb / totalPool) * 100,
        color: '#0f172a',
      },
      {
        name: 'Burst / Swap Headroom',
        valueLabel: `${burstPoolGb.toFixed(1)} GB`,
        percentage: (burstPoolGb / totalPool) * 100,
        color: '#f59e0b',
      },
    ];

    // Donut 2: Active Tier Mix
    const tierTotal = Math.max(1, active.length);
    const tierCounts = PACKAGE_CATEGORIES.map((cat, idx) => {
      const count = active.filter((p) => p.category === cat).length;
      return {
        name: cat,
        valueLabel: `${count} tier${count === 1 ? '' : 's'}`,
        count,
        percentage: active.length ? (count / tierTotal) * 100 : 0,
        color: TIER_PALETTE[idx % TIER_PALETTE.length],
      };
    }).filter((t) => t.count > 0);

    return {
      totalPackages: list.length,
      activeCount: active.length,
      totalDisplayedRamGb,
      totalBackendRamGb,
      totalBurstRamMb,
      avgCpuQuotaPct,
      overcommitRatio,
      efficiencyPct,
      efficiencySegments,
      tierSegments: tierCounts,
    };
  }, [livePackages]);

  const handleFieldChange = (pkgId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [pkgId]: {
        ...(prev[pkgId] || {}),
        [field]: value,
      },
    }));
  };

  const handleResetRow = (pkgId) => {
    const orig = packages.find((p) => p.id === pkgId);
    if (!orig) return;
    setDrafts((prev) => ({
      ...prev,
      [pkgId]: toDraftFields(orig),
    }));
  };

  const saveSinglePackage = async (pkg) => {
    const payload = {
      ...pkg,
      displayedVcpus: Math.max(1, Number(pkg.displayedVcpus) || 1),
      displayedRamGb: Math.max(0.25, Number(pkg.displayedRamGb) || 1),
      displayedStorageGb: Math.max(5, Number(pkg.displayedStorageGb) || 25),
      backendCpuQuotaPct: Math.max(10, Number(pkg.backendCpuQuotaPct) || 100),
      backendRamMb: Math.max(128, Number(pkg.backendRamMb) || 1024),
      backendStorageGb: Math.max(5, Number(pkg.backendStorageGb) || 25),
      burstRamMb: Math.max(0, Number(pkg.burstRamMb) || 0),
    };
    const { res, json } = await fetchWithOptionalReauth(
      `${API_BASE}/admin/server-packages/packages/${encodeURIComponent(pkg.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok || json.success === false) {
      throw new Error(json.error || json.message || `Failed to save ${pkg.name}.`);
    }
    return payload;
  };

  const handleSaveRow = async (pkg) => {
    if (savingId || savingAll) return;
    try {
      setSavingId(pkg.id);
      await saveSinglePackage(pkg);
      showToast?.(`Updated resource quotas for ${pkg.name}.`, 'success');
      await loadAnalytics();
    } catch (err) {
      showToast?.(err?.message || 'Could not save quota allocation.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleSaveAllDirty = async () => {
    if (dirtyPackages.length === 0 || savingAll) return;
    try {
      setSavingAll(true);
      for (const pkg of dirtyPackages) {
        // Sequential so a single PIN verification grant covers subsequent calls cleanly
        await saveSinglePackage(pkg);
      }
      showToast?.(`Saved quotas for ${dirtyPackages.length} packages.`, 'success');
      await loadAnalytics();
    } catch (err) {
      showToast?.(err?.message || 'Failed while saving modified packages.', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Grouped Bar Chart Geometry
  const chartPackages = filteredPackages.slice(0, 10);
  const maxBarRamGb = useMemo(() => {
    if (chartPackages.length === 0) return 8;
    const peak = Math.max(
      4,
      ...chartPackages.flatMap((p) => [
        p.displayedRamGb,
        p.backendRamGb + p.burstRamGb,
      ])
    );
    return Math.ceil(peak * 1.15);
  }, [chartPackages]);

  const svgW = 640;
  const svgH = 248;
  const padL = 44;
  const padR = 16;
  const padT = 20;
  const padB = 46;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const activeDonutSegments =
    donutMode === 'efficiency' ? metrics.efficiencySegments : metrics.tierSegments;
  const donutRadius = 60;
  const donutStroke = 22;
  const donutCircumference = 2 * Math.PI * donutRadius;

  const hoveredPkg =
    hoveredBarIdx !== null && chartPackages[hoveredBarIdx]
      ? chartPackages[hoveredBarIdx]
      : null;

  return (
    <div className="space-y-5">
      {/* Header & Page Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {onBackToDashboard && (
              <Button variant="outline" size="sm" onClick={onBackToDashboard}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Overview
              </Button>
            )}
            <Tabs
              value="server-allocation"
              onValueChange={(val) => {
                if (val && val !== 'server-allocation') onNavigate?.(val);
              }}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="server-packages">
                  <Package className="h-3.5 w-3.5" />
                  Server Packages &amp; OS Pricing
                </TabsTrigger>
                <TabsTrigger value="server-allocation">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Resource Allocation &amp; Quotas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Resource Allocation &amp; Hidden Backend Quotas
            </h1>
            <HelpPopover
              title="Displayed vs Hidden Backend Quotas"
              text="Compare what customers see in Create Droplet (Displayed vCPU/RAM/NVMe) against the actual container cgroup limits (CPU%, RAM MB, Disk GB, Burst RAM) enforced silently on cluster nodes."
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Tune per-package container cgroup limits, inspect RAM overcommit ratios, and monitor tier efficiency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {dirtyPackages.length > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={savingAll}
              onClick={handleSaveAllDirty}
            >
              <Save className="h-3.5 w-3.5" />
              {savingAll
                ? 'Saving...'
                : `Save All Modified (${dirtyPackages.length})`}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="justify-between">
          <div className="space-y-0.5">
            <p className="font-semibold">Unable to load resource allocation analytics</p>
            <p className="opacity-90">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            Retry
          </Button>
        </Alert>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Displayed vs Backend RAM</span>
                <HelpPopover
                  title="Displayed vs Backend RAM"
                  text="Sum of customer-visible RAM (GB) across packages versus hard cgroup RAM (GB) allocated on host nodes."
                />
              </div>
              <MemoryStick className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {metrics.totalDisplayedRamGb.toFixed(1)} GB
              <span className="ml-1.5 text-xs font-semibold text-neutral-400">
                / {metrics.totalBackendRamGb.toFixed(1)} GB real
              </span>
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-[#1ED760]">
              {metrics.overcommitRatio.toFixed(2)}x allocation ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Avg Backend CPU Quota</span>
                <HelpPopover
                  title="Backend CPU Quota %"
                  text="Average Linux cgroup CPU quota percentage across tiers. 100% equals 1 full logical host CPU core."
                />
              </div>
              <Cpu className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {metrics.avgCpuQuotaPct}%
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {(metrics.avgCpuQuotaPct / 100).toFixed(2)} avg host cores per tier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Burst RAM Headroom</span>
                <HelpPopover
                  title="Burst RAM (MB)"
                  text="Temporary swap/burst RAM allowance above hard backendRamMb before container OOM enforcement kicks in."
                />
              </div>
              <Activity className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {metrics.totalBurstRamMb.toLocaleString()} MB
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {(metrics.totalBurstRamMb / 1024).toFixed(2)} GB total burst buffer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Cluster Efficiency</span>
                <HelpPopover
                  title="Cluster Efficiency"
                  text="Ratio of actual backend RAM provisioned relative to displayed RAM (100% = 1:1 dedicated, <100% = memory overcommit savings)."
                  align="right"
                />
              </div>
              <Gauge className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {metrics.efficiencyPct}%
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {metrics.activeCount}/{metrics.totalPackages} active tiers monitored
              {analyticsMeta?.activeDroplets != null
                ? ` · ${analyticsMeta.activeDroplets} droplets`
                : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive SVG Charts Grid (matching RevenueBreakdownChart aesthetic) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Grouped Bar Chart: Displayed RAM GB vs Actual Backend RAM GB */}
        <Card className="lg:col-span-8 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle>Displayed RAM vs Actual Backend RAM (GB)</CardTitle>
                  <HelpPopover
                    title="Grouped RAM Allocation Chart"
                    text="Compares advertised RAM (emerald) against hidden container cgroup RAM (dark slate) and burst headroom (amber) across packages. Edits below preview live here."
                  />
                </div>
                <CardDescription className="mt-1">
                  Hover any tier bar group to inspect exact MB cgroup caps and overcommit ratios.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-600 dark:text-neutral-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#1ED760]" />
                  Displayed RAM
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-slate-900 dark:bg-sky-400" />
                  Backend RAM
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                  Burst Headroom
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-1">
            {chartPackages.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-xs text-neutral-400">
                {loading ? 'Loading chart...' : 'No packages available to chart.'}
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="h-60 w-full min-w-[460px]"
                    role="img"
                    aria-label="Displayed RAM versus Actual Backend RAM grouped bar chart"
                  >
                    {/* Y-axis gridlines & labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                      const val = maxBarRamGb * tick;
                      const y = padT + plotH - tick * plotH;
                      return (
                        <g key={tick}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={svgW - padR}
                            y2={y}
                            stroke="currentColor"
                            className="text-neutral-200/80 dark:text-neutral-800"
                            strokeDasharray={tick === 0 ? undefined : '3 3'}
                          />
                          <text
                            x={padL - 8}
                            y={y + 3.5}
                            textAnchor="end"
                            className="fill-neutral-400 dark:fill-neutral-500 text-[10px] tabular-nums"
                          >
                            {val % 1 === 0 ? `${val}G` : `${val.toFixed(1)}G`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Grouped Bars */}
                    {chartPackages.map((pkg, idx) => {
                      const groupW = plotW / chartPackages.length;
                      const cx = padL + groupW * idx + groupW / 2;
                      const barW = Math.min(20, Math.max(10, groupW * 0.26));
                      const gap = 4;

                      const dispH = Math.max(
                        2,
                        (pkg.displayedRamGb / maxBarRamGb) * plotH
                      );
                      const backH = Math.max(
                        2,
                        (pkg.backendRamGb / maxBarRamGb) * plotH
                      );
                      const burstH = Math.max(
                        0,
                        (pkg.burstRamGb / maxBarRamGb) * plotH
                      );

                      const dispY = padT + plotH - dispH;
                      const backY = padT + plotH - backH;
                      const burstY = Math.max(padT, backY - burstH);
                      const isHovered = hoveredBarIdx === idx;

                      const shortName =
                        pkg.name.length > 12 ? `${pkg.name.slice(0, 11)}…` : pkg.name;

                      return (
                        <g
                          key={pkg.id}
                          onMouseEnter={() => setHoveredBarIdx(idx)}
                          onMouseLeave={() => setHoveredBarIdx(null)}
                          className="cursor-pointer"
                        >
                          {isHovered && (
                            <rect
                              x={padL + groupW * idx + 4}
                              y={padT}
                              width={Math.max(0, groupW - 8)}
                              height={plotH}
                              rx={6}
                              className="fill-neutral-100/80 dark:fill-neutral-900/70"
                            />
                          )}

                          {/* Displayed RAM Bar */}
                          <rect
                            x={cx - barW - gap / 2}
                            y={dispY}
                            width={barW}
                            height={dispH}
                            rx={4}
                            fill="#1ED760"
                            className="transition-all duration-200"
                            opacity={hoveredBarIdx === null || isHovered ? 1 : 0.65}
                          />

                          {/* Backend RAM Bar */}
                          <rect
                            x={cx + gap / 2}
                            y={backY}
                            width={barW}
                            height={backH}
                            rx={4}
                            className="fill-slate-900 dark:fill-sky-400 transition-all duration-200"
                            opacity={hoveredBarIdx === null || isHovered ? 1 : 0.65}
                          />

                          {/* Burst RAM Stacked Cap */}
                          {burstH > 1 && (
                            <rect
                              x={cx + gap / 2}
                              y={burstY}
                              width={barW}
                              height={Math.max(2, backY - burstY)}
                              rx={3}
                              fill="#f59e0b"
                              opacity={hoveredBarIdx === null || isHovered ? 0.9 : 0.55}
                            />
                          )}

                          {/* X-axis label */}
                          <text
                            x={cx}
                            y={padT + plotH + 16}
                            textAnchor="middle"
                            className={`text-[10px] ${
                              isHovered
                                ? 'fill-neutral-950 dark:fill-white font-semibold'
                                : 'fill-neutral-500 dark:fill-neutral-400'
                            }`}
                          >
                            {shortName}
                          </text>
                          <text
                            x={cx}
                            y={padT + plotH + 29}
                            textAnchor="middle"
                            className="fill-neutral-400 dark:fill-neutral-500 text-[9px] tabular-nums"
                          >
                            {pkg.backendCpuQuotaPct}% CPU
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Interactive Readout Strip */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/80 bg-[#fafafa] px-3.5 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
                  {hoveredPkg ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-950 dark:text-white">
                          {hoveredPkg.name}
                        </span>
                        {hoveredPkg.dirty && <Badge variant="warning">Previewing Unsaved</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 tabular-nums text-[11px] text-neutral-600 dark:text-neutral-300">
                        <span>
                          Displayed: <strong>{hoveredPkg.displayedRamGb} GB</strong>
                        </span>
                        <span>
                          Backend: <strong>{hoveredPkg.backendRamMb} MB</strong> (
                          {hoveredPkg.backendRamGb.toFixed(2)} GB)
                        </span>
                        <span>
                          Burst: <strong>+{hoveredPkg.burstRamMb} MB</strong>
                        </span>
                        <span>
                          Ratio:{' '}
                          <strong>
                            {(hoveredPkg.displayedRamGb / Math.max(0.01, hoveredPkg.backendRamGb)).toFixed(2)}x
                          </strong>
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Showing {chartPackages.length} tier{chartPackages.length === 1 ? '' : 's'} — hover a bar group for cgroup RAM &amp; burst breakdown.
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Donut / Ratio Gauge Chart (matching RevenueBreakdownChart.jsx aesthetic) */}
        <Card className="lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle>
                    {donutMode === 'efficiency'
                      ? 'Overcommit & Efficiency Ratio'
                      : 'Active Tier Mix'}
                  </CardTitle>
                  <HelpPopover
                    title="Overcommit & Tier Donut"
                    text="Switch between Memory Efficiency Ratio (Hard Backend RAM vs Overcommit Delta vs Burst Pool) and Active Tier Mix across categories."
                    align="right"
                  />
                </div>
                <CardDescription className="mt-1">
                  {donutMode === 'efficiency'
                    ? 'Hard cgroup memory vs virtual overcommit'
                    : 'Active packages across hardware categories'}
                </CardDescription>
              </div>
              <div className="inline-flex rounded-lg border border-neutral-200/80 bg-neutral-100/80 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setDonutMode('efficiency')}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                    donutMode === 'efficiency'
                      ? 'bg-[#1ED760] text-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Ratio
                </button>
                <button
                  type="button"
                  onClick={() => setDonutMode('tiers')}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                    donutMode === 'tiers'
                      ? 'bg-[#1ED760] text-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Tiers
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col items-center justify-center my-auto py-3">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={donutRadius}
                  className="text-neutral-100 dark:text-neutral-900"
                  stroke="currentColor"
                  strokeWidth={donutStroke}
                  fill="transparent"
                />
                {activeDonutSegments.map((seg, idx) => {
                  const dashLength = Math.max(0, (seg.percentage / 100) * donutCircumference);
                  const accumulated = activeDonutSegments
                    .slice(0, idx)
                    .reduce((sum, item) => sum + item.percentage, 0);
                  const dashOffset = -(accumulated / 100) * donutCircumference;

                  return (
                    <circle
                      key={seg.name + idx}
                      cx="80"
                      cy="80"
                      r={donutRadius}
                      stroke={seg.color}
                      strokeWidth={donutStroke}
                      strokeDasharray={`${dashLength} ${Math.max(0, donutCircumference - dashLength)}`}
                      strokeDashoffset={dashOffset}
                      fill="transparent"
                      className="transition-all duration-500 hover:opacity-85"
                    />
                  );
                })}
              </svg>

              <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center px-4 text-center">
                <span className="text-lg font-bold leading-tight tabular-nums text-neutral-900 dark:text-white">
                  {donutMode === 'efficiency'
                    ? `${metrics.overcommitRatio.toFixed(2)}x`
                    : `${metrics.activeCount}`}
                </span>
                <span className="mt-0.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                  {donutMode === 'efficiency'
                    ? `${metrics.efficiencyPct}% Real RAM`
                    : 'Active Tiers'}
                </span>
              </div>
            </div>

            <div className="mt-4 w-full space-y-2">
              {activeDonutSegments.length > 0 ? (
                activeDonutSegments.map((seg, idx) => (
                  <div
                    key={seg.name + idx}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate font-medium text-neutral-600 dark:text-neutral-300">
                        {seg.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {seg.valueLabel}
                      </span>
                      <span className="w-10 text-right font-semibold text-neutral-900 dark:text-white">
                        {seg.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-neutral-400">
                  No active tier metrics available.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Package Quota Control Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Displayed Specs vs Backend Container Quotas</CardTitle>
                <HelpPopover
                  title="Per-Package Quota Editor"
                  text="Adjust advertised specs (left) and silent cgroup enforcement caps (right) per package. Changes preview in the charts above immediately and persist on Save."
                />
              </div>
              <CardDescription className="mt-1">
                Left columns control what users see on pricing cards; right columns enforce hidden cgroup limits on Linux hosts.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search packages..."
                  className="w-full rounded-lg border border-neutral-200/90 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by package category"
                className="rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1.5 text-xs text-neutral-700 focus:border-[#1ED760] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value="ALL">All Categories</option>
                {PACKAGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-t border-neutral-200/80 bg-neutral-50/70 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
                  <th className="px-4 py-2" colSpan={1}>
                    Package
                  </th>
                  <th
                    className="border-x border-neutral-200/70 bg-emerald-500/5 px-3 py-2 text-emerald-800 dark:border-neutral-800 dark:text-[#1ED760]"
                    colSpan={3}
                  >
                    Displayed to User (Customer Panel)
                  </th>
                  <th
                    className="border-r border-neutral-200/70 bg-sky-500/5 px-3 py-2 text-sky-800 dark:border-neutral-800 dark:text-sky-300"
                    colSpan={4}
                  >
                    Actual Backend Quota (Hidden cgroups)
                  </th>
                  <th className="px-3 py-2" colSpan={2}>
                    Efficiency &amp; Save
                  </th>
                </tr>
                <tr className="border-y border-neutral-200/80 bg-[#fafafa] text-[11px] font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300">
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Tier Name</span>
                      <HelpPopover
                        title="Tier Name"
                        text="Package display name, category, and whether it is currently active in the storefront."
                      />
                    </div>
                  </th>
                  <th className="border-l border-neutral-200/70 px-3 py-2.5 dark:border-neutral-800">
                    <div className="inline-flex items-center gap-1">
                      <span>vCPUs</span>
                      <HelpPopover
                        title="Displayed vCPUs"
                        text="Virtual CPU count shown to customers on the plan card (displayedVcpus)."
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="inline-flex items-center gap-1">
                      <span>RAM (GB)</span>
                      <HelpPopover
                        title="Displayed RAM (GB)"
                        text="Memory capacity advertised to customers in GB (displayedRamGb)."
                      />
                    </div>
                  </th>
                  <th className="border-r border-neutral-200/70 px-3 py-2.5 dark:border-neutral-800">
                    <div className="inline-flex items-center gap-1">
                      <span>Disk (GB)</span>
                      <HelpPopover
                        title="Displayed Storage (GB)"
                        text="NVMe disk space advertised to customers in GB (displayedStorageGb)."
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="inline-flex items-center gap-1">
                      <span>CPU Quota %</span>
                      <HelpPopover
                        title="Backend CPU Quota %"
                        text="Actual Linux cgroup CPU cap in percent (backendCpuQuotaPct). 100% = 1 host core, 50% = half core."
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="inline-flex items-center gap-1">
                      <span>RAM (MB)</span>
                      <HelpPopover
                        title="Backend RAM (MB)"
                        text="Hard container memory ceiling in megabytes (backendRamMb). Setting 768 MB for a 1 GB plan yields a 1.33x overcommit ratio."
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="inline-flex items-center gap-1">
                      <span>Disk (GB)</span>
                      <HelpPopover
                        title="Backend Storage (GB)"
                        text="Actual host storage quota enforced on the container/VM volume (backendStorageGb)."
                      />
                    </div>
                  </th>
                  <th className="border-r border-neutral-200/70 px-3 py-2.5 dark:border-neutral-800">
                    <div className="inline-flex items-center gap-1">
                      <span>Burst (MB)</span>
                      <HelpPopover
                        title="Burst RAM (MB)"
                        text="Short-term burst/swap memory buffer in MB above backendRamMb before OOM killer triggers (burstRamMb)."
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5">
                    <div className="inline-flex items-center gap-1">
                      <span>Ratio</span>
                      <HelpPopover
                        title="RAM Overcommit Ratio"
                        text="Displayed RAM ÷ Backend RAM. 1.00x = 1:1 dedicated; >1.00x = overcommitted; <1.00x = over-provisioned."
                        align="right"
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <span>Actions</span>
                      <HelpPopover
                        title="Save Quota Changes"
                        text="Persist updated displayed and backend quota fields to /api/admin/server-packages/packages/:id (PIN reauth protected)."
                        align="right"
                      />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                      Loading package allocation matrix...
                    </td>
                  </tr>
                ) : filteredPackages.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                      No packages match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredPackages.map((pkg) => {
                    const draft = drafts[pkg.id] || toDraftFields(pkg);
                    const ratio =
                      pkg.backendRamGb > 0 ? pkg.displayedRamGb / pkg.backendRamGb : 1;
                    const ratioVariant =
                      ratio > 1.35 ? 'warning' : ratio >= 0.98 ? 'brand' : 'info';
                    const isSavingRow = savingId === pkg.id;

                    return (
                      <tr
                        key={pkg.id}
                        className={`transition-colors ${
                          pkg.dirty
                            ? 'bg-amber-500/5 dark:bg-amber-500/5'
                            : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40'
                        }`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-950 dark:text-white">
                              {pkg.name}
                            </span>
                            {pkg.dirty && <Badge variant="warning">Unsaved</Badge>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <span>{pkg.category}</span>
                            {!pkg.enabled && (
                              <>
                                <span>•</span>
                                <span className="text-rose-500">Disabled</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Displayed to User */}
                        <td className="border-l border-neutral-200/60 px-3 py-2.5 dark:border-neutral-800/80">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={draft.displayedVcpus}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'displayedVcpus', e.target.value)
                            }
                            aria-label={`${pkg.name} displayed vCPUs`}
                            className={numInputCls}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={draft.displayedRamGb}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'displayedRamGb', e.target.value)
                            }
                            aria-label={`${pkg.name} displayed RAM GB`}
                            className={numInputCls}
                          />
                        </td>
                        <td className="border-r border-neutral-200/60 px-3 py-2.5 dark:border-neutral-800/80">
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={draft.displayedStorageGb}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'displayedStorageGb', e.target.value)
                            }
                            aria-label={`${pkg.name} displayed Storage GB`}
                            className={numInputCls}
                          />
                        </td>

                        {/* Actual Backend Quotas */}
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="10"
                            step="10"
                            value={draft.backendCpuQuotaPct}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'backendCpuQuotaPct', e.target.value)
                            }
                            aria-label={`${pkg.name} backend CPU quota percent`}
                            className={numInputCls}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="128"
                            step="64"
                            value={draft.backendRamMb}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'backendRamMb', e.target.value)
                            }
                            aria-label={`${pkg.name} backend RAM MB`}
                            className={numInputCls}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={draft.backendStorageGb}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'backendStorageGb', e.target.value)
                            }
                            aria-label={`${pkg.name} backend Storage GB`}
                            className={numInputCls}
                          />
                        </td>
                        <td className="border-r border-neutral-200/60 px-3 py-2.5 dark:border-neutral-800/80">
                          <input
                            type="number"
                            min="0"
                            step="64"
                            value={draft.burstRamMb}
                            onChange={(e) =>
                              handleFieldChange(pkg.id, 'burstRamMb', e.target.value)
                            }
                            aria-label={`${pkg.name} burst RAM MB`}
                            className={numInputCls}
                          />
                        </td>

                        {/* Ratio */}
                        <td className="px-3 py-2.5 align-middle tabular-nums">
                          <Badge variant={ratioVariant}>{ratio.toFixed(2)}x</Badge>
                        </td>

                        {/* Save / Reset */}
                        <td className="px-4 py-2.5 text-right align-middle">
                          <div className="inline-flex items-center gap-1">
                            {pkg.dirty && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reset row"
                                aria-label={`Reset ${pkg.name}`}
                                onClick={() => handleResetRow(pkg.id)}
                                disabled={isSavingRow || savingAll}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant={pkg.dirty ? 'default' : 'outline'}
                              size="sm"
                              disabled={!pkg.dirty || isSavingRow || savingAll}
                              onClick={() => handleSaveRow(pkg)}
                            >
                              {isSavingRow ? (
                                'Saving...'
                              ) : pkg.dirty ? (
                                <>
                                  <Save className="h-3.5 w-3.5" />
                                  Save
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                                  Synced
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
