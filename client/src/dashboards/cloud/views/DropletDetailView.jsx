import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Edit3,
  Globe,
  HardDrive,
  Network,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Shield,
  ShieldAlert,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
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
  TabsTrigger,
} from '../../../components/ui/shadcnPrimitives';
import DropletTerminalPanel from '../components/DropletTerminalPanel';

const VALID_SECTIONS = ['overview', 'console', 'network', 'dns', 'billing'];

const TELEMETRY_RANGES = [
  { id: '1h', label: '1H Live' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All Time (Lifetime)' },
];

const METRIC_SERIES = [
  { id: 'cpu', label: 'CPU %', color: '#1ED760', unit: '%' },
  { id: 'ram', label: 'RAM %', color: '#0284c7', unit: '%' },
  { id: 'disk', label: 'Disk %', color: '#f59e0b', unit: '%' },
  { id: 'network', label: 'Network', color: '#8b5cf6', unit: 'Mbps' },
];

const REGION_FLAG_MAP = {
  dhk1: '/flags/bd.svg',
  sgp1: '/flags/sg.svg',
  fra1: '/flags/de.svg',
  nyc1: '/flags/us.svg',
  lon1: '/flags/gb.svg',
  tyo1: '/flags/jp.svg',
  tor1: '/flags/ca.svg',
};

function getAuthHeaders(extra = {}) {
  let token = '';
  try {
    token = localStorage.getItem('stockpro_session') || sessionStorage.getItem('stockpro_session') || '';
  } catch {}
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function resolveRegionFlagUrl(item) {
  if (item?.flagUrl) return item.flagUrl;
  const code = String(item?.regionCode || item?.regionId || '').trim().toLowerCase();
  if (REGION_FLAG_MAP[code]) return REGION_FLAG_MAP[code];
  const regionStr = String(item?.region || '').toLowerCase();
  for (const [key, url] of Object.entries(REGION_FLAG_MAP)) {
    if (regionStr.includes(key)) return url;
  }
  return null;
}

function formatUsd(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  const num = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  return `$${num.toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatChartAxisLabel(value, range) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (range === '1h' || range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '1y' || range === 'all') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusMeta(status) {
  const s = String(status || 'unknown').trim().toLowerCase();
  if (s === 'active' || s === 'running') {
    return {
      label: 'active',
      variant: 'success',
      dotClass: 'bg-[#1ED760]',
      isRunning: true,
      isStopped: false,
      isSuspended: false,
    };
  }
  if (s === 'stopped' || s === 'off' || s === 'powered_off') {
    return {
      label: 'stopped',
      variant: 'warning',
      dotClass: 'bg-amber-500',
      isRunning: false,
      isStopped: true,
      isSuspended: false,
    };
  }
  if (s === 'suspended' || s === 'past_due' || s === 'grace_period') {
    return {
      label: s.replace(/_/g, ' '),
      variant: 'destructive',
      dotClass: 'bg-rose-500',
      isRunning: false,
      isStopped: false,
      isSuspended: s === 'suspended',
    };
  }
  return {
    label: s,
    variant: 'default',
    dotClass: 'bg-neutral-400',
    isRunning: false,
    isStopped: false,
    isSuspended: false,
  };
}

async function writeClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {}
  }
  return false;
}

function toFiniteOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function normalizeTelemetrySamples(payload) {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.samples)
      ? payload.samples
      : Array.isArray(payload?.points)
        ? payload.points
        : Array.isArray(payload?.series)
          ? payload.series
          : Array.isArray(payload?.telemetry)
            ? payload.telemetry
            : [];

  return rawList
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const ts = item.timestamp || item.recordedAt || item.createdAt || item.ts || item.time || null;
      const cpu = toFiniteOrNull(item.cpuPercent ?? item.cpu_percent ?? item.cpu);
      const ram = toFiniteOrNull(item.ramPercent ?? item.ram_percent ?? item.memoryPercent ?? item.memory_percent ?? item.ram ?? item.memory);
      const disk = toFiniteOrNull(item.diskPercent ?? item.disk_percent ?? item.storagePercent ?? item.storage_percent ?? item.disk);
      const netIn = toFiniteOrNull(item.networkInMbps ?? item.rxMbps ?? item.netInMbps);
      const netOut = toFiniteOrNull(item.networkOutMbps ?? item.txMbps ?? item.netOutMbps);
      const netDirect = toFiniteOrNull(item.networkMbps ?? item.network_mbps ?? item.network);
      const network = netDirect !== null
        ? netDirect
        : (netIn !== null || netOut !== null)
          ? Math.round(((netIn || 0) + (netOut || 0)) * 100) / 100
          : null;

      return {
        idx,
        timestamp: ts,
        cpu,
        ram,
        disk,
        network,
        networkInMbps: netIn,
        networkOutMbps: netOut,
      };
    })
    .filter(Boolean);
}

function computeSeriesStats(samples, key) {
  const vals = samples.map((s) => s[key]).filter((v) => v !== null && Number.isFinite(v));
  if (vals.length === 0) return { latest: null, avg: null, peak: null };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    latest: vals[vals.length - 1],
    avg: Math.round((sum / vals.length) * 10) / 10,
    peak: Math.round(Math.max(...vals) * 10) / 10,
  };
}

function buildSvgPath(points) {
  if (points.length === 0) return '';
  return points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(' ');
}

function TelemetryChartCard({ dropletId }) {
  const [range, setRange] = useState('1h');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [customFilter, setCustomFilter] = useState({ from: '', to: '' });
  const [metricFilter, setMetricFilter] = useState('all'); // 'all' | 'cpu' | 'ram' | 'disk' | 'network'
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailableMsg, setUnavailableMsg] = useState('');
  const [hoverIndex, setHoverIndex] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const svgRef = useRef(null);

  const fetchTelemetry = useCallback(async ({ silent = false } = {}) => {
    if (!dropletId) return;
    if (!silent) setLoading(true);
    setUnavailableMsg('');
    try {
      const effectiveRange = range;
      const fromVal = customFilter.from || '';
      const toVal = customFilter.to || '';
      const qs = new URLSearchParams({
        range: effectiveRange,
        from: fromVal,
        to: toVal,
      });
      const res = await fetch(
        `/api/cloud/droplets/${encodeURIComponent(dropletId)}/telemetry?${qs.toString()}`,
        {
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSamples([]);
        setUnavailableMsg(
          json?.error ||
            (res.status === 404
              ? 'Telemetry service is not connected for this VPS yet.'
              : `Telemetry endpoint returned HTTP ${res.status}.`)
        );
        return;
      }
      const parsed = normalizeTelemetrySamples(json);
      setSamples(parsed);
      setLastFetchedAt(new Date().toISOString());
      if (parsed.length === 0) {
        setUnavailableMsg(json?.message || 'No telemetry samples recorded for the selected timeframe yet.');
      }
    } catch (err) {
      setSamples([]);
      setUnavailableMsg(err?.message || 'Unable to reach telemetry endpoint.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dropletId, range, customFilter.from, customFilter.to]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  useEffect(() => {
    if (range !== '1h' || customFilter.from || customFilter.to) return undefined;
    const timer = window.setInterval(() => {
      fetchTelemetry({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [range, customFilter.from, customFilter.to, fetchTelemetry]);

  const cpuStats = useMemo(() => computeSeriesStats(samples, 'cpu'), [samples]);
  const ramStats = useMemo(() => computeSeriesStats(samples, 'ram'), [samples]);
  const diskStats = useMemo(() => computeSeriesStats(samples, 'disk'), [samples]);
  const netStats = useMemo(() => computeSeriesStats(samples, 'network'), [samples]);

  const visibleSeries = useMemo(() => {
    if (metricFilter === 'all') {
      return METRIC_SERIES.filter((m) => m.id !== 'network');
    }
    return METRIC_SERIES.filter((m) => m.id === metricFilter);
  }, [metricFilter]);

  const networkMax = useMemo(() => {
    const vals = samples.map((s) => s.network).filter((v) => v !== null && v > 0);
    if (vals.length === 0) return 100;
    const rawMax = Math.max(...vals);
    return Math.max(10, Math.ceil(rawMax * 1.2));
  }, [samples]);

  // SVG chart coordinate calculations
  const width = 760;
  const height = 240;
  const pad = { top: 18, right: 18, bottom: 30, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const yMax = metricFilter === 'network' ? networkMax : 100;

  const seriesPaths = useMemo(() => {
    if (samples.length === 0) return [];
    const denom = Math.max(1, samples.length - 1);

    return visibleSeries.map((series) => {
      const pts = [];
      samples.forEach((sample, idx) => {
        const val = sample[series.id];
        if (val === null || !Number.isFinite(val)) return;
        const clamped = Math.max(0, Math.min(yMax, val));
        const x = samples.length === 1 ? pad.left + plotW / 2 : pad.left + (idx / denom) * plotW;
        const y = pad.top + plotH - (clamped / yMax) * plotH;
        pts.push({ x, y, val, idx });
      });

      const linePath = buildSvgPath(pts);
      const areaPath =
        pts.length > 1
          ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${(pad.top + plotH).toFixed(2)} L ${pts[0].x.toFixed(2)} ${(pad.top + plotH).toFixed(2)} Z`
          : '';
      return { ...series, pts, linePath, areaPath };
    });
  }, [samples, visibleSeries, yMax, plotW, plotH, pad.left, pad.top]);

  const handlePointerMove = (clientX) => {
    if (!svgRef.current || samples.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(pad.left, Math.min(pad.left + plotW, relX));
    const ratio = (clampedX - pad.left) / Math.max(1, plotW);
    const idx = Math.round(ratio * (samples.length - 1));
    setHoverIndex(Math.max(0, Math.min(samples.length - 1, idx)));
  };

  const activeSample = hoverIndex !== null ? samples[hoverIndex] : samples[samples.length - 1] || null;
  const activeX =
    hoverIndex !== null && samples.length > 1
      ? pad.left + (hoverIndex / (samples.length - 1)) * plotW
      : samples.length === 1 && hoverIndex !== null
        ? pad.left + plotW / 2
        : null;

  const xTickIndices = useMemo(() => {
    if (samples.length === 0) return [];
    if (samples.length <= 5) return samples.map((_, i) => i);
    const steps = 4;
    const indices = new Set();
    for (let i = 0; i <= steps; i++) {
      indices.add(Math.round((i / steps) * (samples.length - 1)));
    }
    return Array.from(indices);
  }, [samples]);

  return (
    <div className="space-y-4">
      {/* 4 Live/Period KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            id: 'cpu',
            title: 'CPU Utilization',
            icon: Cpu,
            stats: cpuStats,
            unit: '%',
            accent: 'text-[#137333] dark:text-[#1ED760]',
          },
          {
            id: 'ram',
            title: 'Memory Usage',
            icon: Activity,
            stats: ramStats,
            unit: '%',
            accent: 'text-sky-700 dark:text-sky-400',
          },
          {
            id: 'disk',
            title: 'Disk Utilization',
            icon: HardDrive,
            stats: diskStats,
            unit: '%',
            accent: 'text-amber-700 dark:text-amber-400',
          },
          {
            id: 'network',
            title: 'Network Throughput',
            icon: Network,
            stats: netStats,
            unit: ' Mbps',
            accent: 'text-violet-700 dark:text-violet-400',
          },
        ].map((card) => {
          const Icon = card.icon;
          const hasData = card.stats.latest !== null;
          return (
            <Card key={card.id} className="overflow-hidden">
              <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {card.title}
                  </span>
                  <Icon className={`size-4 ${card.accent}`} aria-hidden="true" />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold tabular-nums text-neutral-950 dark:text-white">
                    {loading ? '…' : hasData ? `${card.stats.latest}${card.unit}` : 'Unavailable'}
                  </span>
                  {hasData && (
                    <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                      Avg {card.stats.avg}{card.unit} · Peak {card.stats.peak}{card.unit}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Historical & Live Chart Card */}
      <Card>
        <CardHeader className="gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800/80">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-[#1ED760]" aria-hidden="true" />
                <span>Resource &amp; Historical Telemetry</span>
                {range === '1h' && !customFilter.from && !customFilter.to && (
                  <Badge variant="brand" className="ml-1">
                    <span className="size-1.5 rounded-full bg-[#1ED760] animate-pulse" />
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Historical CPU, RAM, NVMe disk, and network utilization samples
                {lastFetchedAt ? ` · Updated ${formatDateTime(lastFetchedAt)}` : ''}
              </CardDescription>
            </div>

            {/* Timeframe Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TELEMETRY_RANGES.map((item) => {
                const isActive = range === item.id && !customFilter.from && !customFilter.to;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCustomFilter({ from: '', to: '' });
                      setRange(item.id);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#1ED760] text-black shadow-xs'
                        : 'border border-neutral-200/80 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Filter + Metric Toggle Bar */}
          <div className="flex flex-col gap-3 pt-1 xl:flex-row xl:items-center xl:justify-between">
            {/* Metric Series Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMetricFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  metricFilter === 'all'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                }`}
              >
                Combined (%)
              </button>
              {METRIC_SERIES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetricFilter(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    metricFilter === m.id
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Custom Date Range Filter */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!fromInput && !toInput) return;
                setCustomFilter({ from: fromInput, to: toInput });
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                <label htmlFor="telemetry-from" className="sr-only">From date</label>
                <input
                  id="telemetry-from"
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <span>to</span>
                <label htmlFor="telemetry-to" className="sr-only">To date</label>
                <input
                  id="telemetry-to"
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={!fromInput && !toInput}>
                Filter
              </Button>
              {(customFilter.from || customFilter.to || fromInput || toInput) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFromInput('');
                    setToInput('');
                    setCustomFilter({ from: '', to: '' });
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fetchTelemetry()}
                title="Refresh telemetry"
                aria-label="Refresh telemetry"
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </form>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
              <RefreshCw className="size-5 animate-spin text-[#1ED760]" />
              <span>Loading telemetry samples…</span>
            </div>
          ) : samples.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
              <Activity className="size-6 text-neutral-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Telemetry data unavailable
                </p>
                <p className="max-w-md text-xs text-neutral-500 dark:text-neutral-400">
                  {unavailableMsg || 'No real telemetry samples have been recorded for this instance in the selected timeframe.'}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => fetchTelemetry()}>
                <RefreshCw className="size-3.5" />
                Retry Telemetry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Interactive Readout Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50/80 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5 font-medium text-neutral-600 dark:text-neutral-300">
                  <Clock className="size-3.5 text-neutral-400" />
                  <span>
                    {hoverIndex !== null ? 'Sample:' : 'Latest:'}{' '}
                    {formatDateTime(activeSample?.timestamp)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#1ED760]" />
                    <span className="text-neutral-500">CPU</span>
                    <strong className="text-neutral-950 dark:text-white">
                      {activeSample?.cpu !== null && activeSample?.cpu !== undefined ? `${activeSample.cpu}%` : '—'}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-500" />
                    <span className="text-neutral-500">RAM</span>
                    <strong className="text-neutral-950 dark:text-white">
                      {activeSample?.ram !== null && activeSample?.ram !== undefined ? `${activeSample.ram}%` : '—'}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span className="text-neutral-500">Disk</span>
                    <strong className="text-neutral-950 dark:text-white">
                      {activeSample?.disk !== null && activeSample?.disk !== undefined ? `${activeSample.disk}%` : '—'}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-violet-500" />
                    <span className="text-neutral-500">Net</span>
                    <strong className="text-neutral-950 dark:text-white">
                      {activeSample?.network !== null && activeSample?.network !== undefined ? `${activeSample.network} Mbps` : '—'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Interactive SVG Chart */}
              <div className="w-full overflow-hidden rounded-xl border border-neutral-200/70 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${width} ${height}`}
                  className="h-56 w-full select-none sm:h-64"
                  role="img"
                  aria-label="VPS resource telemetry chart"
                  onMouseMove={(e) => handlePointerMove(e.clientX)}
                  onMouseLeave={() => setHoverIndex(null)}
                  onTouchMove={(e) => {
                    if (e.touches?.[0]) handlePointerMove(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => setHoverIndex(null)}
                >
                  <defs>
                    {seriesPaths.map((s) => (
                      <linearGradient key={s.id} id={`area-grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Y-axis Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = pad.top + plotH - fraction * plotH;
                    const labelVal = Math.round(fraction * yMax);
                    return (
                      <g key={fraction}>
                        <line
                          x1={pad.left}
                          y1={y}
                          x2={pad.left + plotW}
                          y2={y}
                          stroke="currentColor"
                          className="text-neutral-200/80 dark:text-neutral-800"
                          strokeDasharray={fraction === 0 ? undefined : '3 3'}
                          strokeWidth="1"
                        />
                        <text
                          x={pad.left - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="fill-neutral-400 text-[10px]"
                        >
                          {metricFilter === 'network' ? `${labelVal}` : `${labelVal}%`}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axis Labels */}
                  {xTickIndices.map((idx) => {
                    const sample = samples[idx];
                    const x =
                      samples.length === 1
                        ? pad.left + plotW / 2
                        : pad.left + (idx / Math.max(1, samples.length - 1)) * plotW;
                    return (
                      <text
                        key={idx}
                        x={x}
                        y={height - 8}
                        textAnchor={idx === 0 ? 'start' : idx === samples.length - 1 ? 'end' : 'middle'}
                        className="fill-neutral-400 text-[10px]"
                      >
                        {formatChartAxisLabel(sample?.timestamp, range)}
                      </text>
                    );
                  })}

                  {/* Area & Line Paths */}
                  {seriesPaths.map((s) => (
                    <g key={s.id}>
                      {s.areaPath && <path d={s.areaPath} fill={`url(#area-grad-${s.id})`} />}
                      {s.linePath && (
                        <path
                          d={s.linePath}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {s.pts.length === 1 && (
                        <circle cx={s.pts[0].x} cy={s.pts[0].y} r="4" fill={s.color} />
                      )}
                    </g>
                  ))}

                  {/* Hover Crosshair & Active Dots */}
                  {activeX !== null && hoverIndex !== null && (
                    <g>
                      <line
                        x1={activeX}
                        y1={pad.top}
                        x2={activeX}
                        y2={pad.top + plotH}
                        stroke="currentColor"
                        className="text-neutral-400 dark:text-neutral-500"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      {seriesPaths.map((s) => {
                        const pt = s.pts.find((p) => p.idx === hoverIndex);
                        if (!pt) return null;
                        return (
                          <circle
                            key={s.id}
                            cx={pt.x}
                            cy={pt.y}
                            r="4"
                            fill={s.color}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DropletDetailView({
  dropletId,
  initialDroplet = null,
  activeSection = 'overview',
  onSectionChange,
  onBack,
  onDropletUpdated,
  onDropletDeleted,
  onOpenBilling,
  showToast,
}) {
  const safeSection = VALID_SECTIONS.includes(activeSection) ? activeSection : 'overview';

  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [detailPayload, setDetailPayload] = useState(null);

  // Header action states (inline - NO popups/modals)
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [powerUpdating, setPowerUpdating] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // DNS Binding inline form state
  const [dnsHostname, setDnsHostname] = useState('');
  const [dnsRecordType, setDnsRecordType] = useState('A+AAAA');
  const [dnsTargetPort, setDnsTargetPort] = useState('80');
  const [dnsTtl] = useState('300');
  const [dnsSubmitting, setDnsSubmitting] = useState(false);
  const [dnsVerifyingId, setDnsVerifyingId] = useState(null);
  const [dnsRemovingId, setDnsRemovingId] = useState(null);
  const [sshMethodTab, setSshMethodTab] = useState(() => {
    if (typeof navigator === 'undefined') return 'windows';
    const platform = String(navigator.platform || '');
    const ua = String(navigator.userAgent || '');
    if (/windows|win32|win64|wow64/i.test(platform)) return 'windows';
    return /mac|linux|ubuntu|fedora|debian|darwin|x11|android|iphone|ipad|ipod|termux|arm/i.test(
      `${platform} ${ua}`
    )
      ? 'unix'
      : 'windows';
  });

  // Firewall Rule inline form state
  const [fwDirection, setFwDirection] = useState('inbound');
  const [fwProtocol, setFwProtocol] = useState('tcp');
  const [fwPort, setFwPort] = useState('');
  const [fwSource, setFwSource] = useState('0.0.0.0/0, ::/0');
  const [fwAction, setFwAction] = useState('allow');
  const [fwLabel, setFwLabel] = useState('');
  const [fwSubmitting, setFwSubmitting] = useState(false);
  const [fwRemovingId, setFwRemovingId] = useState(null);

  // Storage / Backups / Snapshot states
  const [backupUpdating, setBackupUpdating] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotCreating, setSnapshotCreating] = useState(false);
  const [snapshotBusyId, setSnapshotBusyId] = useState(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!dropletId) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/detail`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!initialDroplet) {
          setDetailError(json?.error || `Could not load VPS details (HTTP ${res.status}).`);
        }
        setDetailPayload(null);
        return;
      }
      setDetailPayload(json);
    } catch (err) {
      if (!initialDroplet) {
        setDetailError(err?.message || 'Failed to load VPS details.');
      }
    } finally {
      setDetailLoading(false);
    }
  }, [dropletId, initialDroplet]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const droplet = useMemo(() => {
    const remote = detailPayload?.droplet || (detailPayload?.id ? detailPayload : null);
    if (remote && initialDroplet) return { ...initialDroplet, ...remote };
    return remote || initialDroplet || null;
  }, [detailPayload, initialDroplet]);

  useEffect(() => {
    if (droplet?.name && !isRenaming) {
      setRenameValue(droplet.name);
    }
  }, [droplet?.name, isRenaming]);

  const handleCopy = async (key, value, label) => {
    const ok = await writeClipboard(value);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? '' : curr)), 2000);
      showToast?.(`${label} copied to clipboard.`, 'success');
    } else {
      showToast?.(`Could not copy ${label.toLowerCase()}.`, 'error');
    }
  };

  // Resolved network, DNS, firewall, storage, and billing sections
  const networkInfo = useMemo(() => {
    const net = detailPayload?.networkProfile || detailPayload?.network || {};
    const rawIpv4 = net.publicIpv4 || net.ipv4 || droplet?.publicIpv4 || (droplet?.ip && droplet.ip !== 'Unavailable' ? droplet.ip : null);
    const ipv4 = rawIpv4 && !String(rawIpv4).includes(':') ? rawIpv4 : null;
    const ipv6 = net.ipv6 || droplet?.ipv6 || null;
    const ipv6Prefix = net.ipv6Prefix || droplet?.ipv6Prefix || (ipv6 ? '/128' : null);
    const sshPort = net.sshPort || droplet?.sshPort || 22;
    const accessUsername = net.username || net.accessUsername || droplet?.accessUsername || 'root';
    const sshGatewayUser = net.sshGatewayUser || droplet?.sshGatewayUser || null;
    const rawGatewayHost = net.sshGatewayHost || droplet?.sshGatewayHost || null;
    const sshGatewayHost = rawGatewayHost ? String(rawGatewayHost).trim().replace(/^\[|\]$/g, '') : null;
    const rawSshGatewayCommand =
      net.sshGatewayCommand ||
      droplet?.sshGatewayCommand ||
      (sshGatewayUser && sshGatewayHost ? `ssh ${sshGatewayUser}@${sshGatewayHost}` : null);
    const sshGatewayCommand = rawSshGatewayCommand ? String(rawSshGatewayCommand).replace(/\[([^\]]+)\]/g, '$1') : null;
    const sshIpv4Cmd = ipv4 ? `ssh ${accessUsername}@${ipv4}${sshPort !== 22 ? ` -p ${sshPort}` : ''}` : null;
    const sshIpv6Cmd = sshGatewayCommand && sshGatewayHost?.includes(':')
      ? sshGatewayCommand
      : ipv6
        ? `ssh ${accessUsername}@${String(ipv6).replace(/^\[|\]$/g, '')}${sshPort !== 22 ? ` -p ${sshPort}` : ''}`
        : null;
    const relayCommands = net.sshRelayCommands || droplet?.sshRelayCommands || null;
    const publicHostDomain = relayCommands?.domain || (typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'tiwlo.com');
    const cleanIdForUrl = droplet?.id || dropletId;
    const sshBridgeUrl = net.sshBridgeUrl || droplet?.sshBridgeUrl || `wss://${publicHostDomain}/ssh/${cleanIdForUrl}`;
    const sshPortalUrl = net.sshPortalUrl || droplet?.sshPortalUrl || `https://${publicHostDomain}/ssh/${cleanIdForUrl}`;
    const sshHttpsUrl = net.sshHttpsUrl || droplet?.sshHttpsUrl || `https://${publicHostDomain}/cloud/droplets/${cleanIdForUrl}/console`;
    const ipLifecycleStatus = net.ipLifecycleStatus || droplet?.ipLifecycleStatus || (droplet?.status === 'suspended' ? 'held' : 'active');
    const prefixSyncLogs = Array.isArray(net.prefixSyncLogs)
      ? net.prefixSyncLogs
      : Array.isArray(detailPayload?.prefixSyncLogs)
        ? detailPayload.prefixSyncLogs
        : [];
    return {
      ipv4,
      ipv6,
      ipv6Prefix,
      internalIp: net.internalIp || droplet?.internalIp || null,
      sshPort,
      accessUsername,
      sshGatewayUser,
      sshGatewayHost,
      sshGatewayCommand,
      sshBridgeUrl,
      sshPortalUrl,
      sshHttpsUrl,
      sshRelayCommands: relayCommands,
      sshIpv4Cmd,
      sshIpv6Cmd,
      ipLifecycleStatus,
      heldUntil: net.heldUntil || droplet?.purgeAt || null,
      prefixSyncLogs,
    };
  }, [detailPayload, droplet, dropletId]);

  const dnsRecords = useMemo(() => {
    if (Array.isArray(detailPayload?.dnsRecords)) return detailPayload.dnsRecords;
    if (Array.isArray(detailPayload?.dns?.records)) return detailPayload.dns.records;
    return [];
  }, [detailPayload]);

  const firewallRules = useMemo(() => {
    if (Array.isArray(detailPayload?.firewallRules)) return detailPayload.firewallRules;
    if (Array.isArray(detailPayload?.firewall?.rules)) return detailPayload.firewall.rules;
    return [
      { id: 'default-ssh', direction: 'inbound', protocol: 'tcp', port: String(networkInfo.sshPort || 22), source: '0.0.0.0/0, ::/0', action: 'allow', label: 'SSH Access', system: true },
      { id: 'default-http', direction: 'inbound', protocol: 'tcp', port: '80', source: '0.0.0.0/0, ::/0', action: 'allow', label: 'HTTP', system: true },
      { id: 'default-https', direction: 'inbound', protocol: 'tcp', port: '443', source: '0.0.0.0/0, ::/0', action: 'allow', label: 'HTTPS', system: true },
    ];
  }, [detailPayload, networkInfo.sshPort]);

  const storageInfo = useMemo(() => {
    const st = detailPayload?.storage && typeof detailPayload.storage === 'object' ? detailPayload.storage : {};
    const snapshots = Array.isArray(st.snapshots)
      ? st.snapshots
      : Array.isArray(detailPayload?.snapshots)
        ? detailPayload.snapshots
        : [];
    return {
      capacity: st.capacity || droplet?.storage || '—',
      volumeName: st.volumeName || (droplet?.id ? `vol-${droplet.id}` : '—'),
      type: st.type || 'NVMe SSD',
      mountPath: st.mountPath || '/',
      backupsEnabled: Boolean(st.backupsEnabled ?? droplet?.backupsEnabled ?? droplet?.enableBackups),
      snapshots,
    };
  }, [detailPayload, droplet]);

  const billingInfo = useMemo(() => {
    const b = detailPayload?.billing && typeof detailPayload.billing === 'object' ? detailPayload.billing : {};
    const invoices = Array.isArray(b.invoices)
      ? b.invoices
      : Array.isArray(detailPayload?.invoices)
        ? detailPayload.invoices
        : [];
    return {
      monthlyPrice: b.monthlyPrice ?? droplet?.monthlyPrice ?? null,
      currency: b.currency || 'USD',
      billingCycle: b.billingCycle || droplet?.billingCycle || 'monthly',
      nextBillingAt: b.nextBillingAt || droplet?.nextBillingAt || null,
      graceUntil: b.graceUntil || droplet?.graceUntil || null,
      suspendedAt: b.suspendedAt || droplet?.suspendedAt || null,
      purgeAt: b.purgeAt || droplet?.purgeAt || null,
      invoices,
    };
  }, [detailPayload, droplet]);

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === droplet?.name) {
      setIsRenaming(false);
      return;
    }
    setSavingRename(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/name`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not rename VPS.');
      const updated = json?.droplet || json;
      setDetailPayload((prev) => (prev ? { ...prev, droplet: { ...(prev.droplet || {}), ...updated, name: trimmed } } : prev));
      onDropletUpdated?.({ ...(droplet || {}), ...updated, name: trimmed });
      setIsRenaming(false);
      showToast?.(`Renamed VPS to ${trimmed}.`, 'success');
    } catch (err) {
      showToast?.(err?.message || 'Could not rename VPS.', 'error');
    } finally {
      setSavingRename(false);
    }
  };

  const handlePowerToggle = async () => {
    if (!droplet) return;
    const statusMeta = getStatusMeta(droplet.status);
    if (statusMeta.isSuspended) {
      showToast?.('Suspended VPS cannot be powered on until billing is settled.', 'error');
      return;
    }
    const nextStatus = statusMeta.isRunning ? 'stopped' : 'active';
    setPowerUpdating(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not change power state.');
      const updated = json?.droplet || json;
      setDetailPayload((prev) => (prev ? { ...prev, droplet: { ...(prev.droplet || {}), ...updated, status: nextStatus } } : prev));
      onDropletUpdated?.({ ...droplet, ...updated, status: nextStatus });
      showToast?.(`VPS ${droplet.name} is now ${nextStatus}.`, 'success');
    } catch (err) {
      showToast?.(err?.message || 'Failed to update VPS power state.', 'error');
    } finally {
      setPowerUpdating(false);
    }
  };

  const handleDeleteVps = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json?.error || 'Could not destroy VPS.');
      }
      showToast?.(`VPS ${droplet?.name || dropletId} destroyed.`, 'success');
      onDropletDeleted?.(dropletId);
    } catch (err) {
      showToast?.(err?.message || 'Failed to destroy VPS.', 'error');
      setDeleting(false);
    }
  };

  const handleBindDns = async (e) => {
    e.preventDefault();
    const cleanHost = dnsHostname.trim().toLowerCase();
    if (!cleanHost) return;
    setDnsSubmitting(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/dns`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          hostname: cleanHost,
          recordType: dnsRecordType,
          targetPort: Number.parseInt(String(dnsTargetPort || '80'), 10) || 80,
          ttl: Number(dnsTtl) || 300,
          proxyEnabled: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `DNS binding failed (HTTP ${res.status}).`);
      setDnsHostname('');
      showToast?.(json?.message || `Domain bound for ${cleanHost}.`, 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not bind domain.', 'error');
    } finally {
      setDnsSubmitting(false);
    }
  };

  const handleVerifyDns = async (recordId) => {
    if (!recordId) return;
    setDnsVerifyingId(recordId);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/dns/${encodeURIComponent(recordId)}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not verify DNS.');
      if (json.verified) {
        showToast?.(`${json?.domain?.hostname || 'Domain'} verified and SSL activated.`, 'success');
      } else {
        showToast?.('Nameservers or AAAA record not detected yet. Allow a minute for DNS propagation and retry.', 'warning');
      }
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Verification failed.', 'error');
    } finally {
      setDnsVerifyingId(null);
    }
  };

  const handleRemoveDns = async (recordId) => {
    if (!recordId) return;
    setDnsRemovingId(recordId);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/dns/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not remove DNS record.');
      showToast?.('DNS record removed.', 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not remove DNS record.', 'error');
    } finally {
      setDnsRemovingId(null);
    }
  };

  const handleAddFirewallRule = async (e) => {
    e.preventDefault();
    const cleanPort = fwPort.trim();
    if (!cleanPort) return;
    setFwSubmitting(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/firewall`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          direction: fwDirection,
          protocol: fwProtocol,
          port: cleanPort,
          source: fwSource.trim() || '0.0.0.0/0, ::/0',
          action: fwAction,
          label: fwLabel.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Firewall update failed (HTTP ${res.status}).`);
      setFwPort('');
      setFwLabel('');
      showToast?.(`Firewall rule added for ${fwProtocol.toUpperCase()} ${cleanPort}.`, 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not add firewall rule.', 'error');
    } finally {
      setFwSubmitting(false);
    }
  };

  const handleRemoveFirewallRule = async (ruleId) => {
    if (!ruleId) return;
    setFwRemovingId(ruleId);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/firewall/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not remove firewall rule.');
      showToast?.('Firewall rule deleted.', 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not delete firewall rule.', 'error');
    } finally {
      setFwRemovingId(null);
    }
  };

  const handleToggleBackups = async () => {
    setBackupUpdating(true);
    try {
      const nextVal = !storageInfo.backupsEnabled;
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/backups`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled: nextVal }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Backup toggle unavailable (HTTP ${res.status}).`);
      showToast?.(`Automated backups ${nextVal ? 'enabled' : 'disabled'}.`, 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not update backup setting.', 'error');
    } finally {
      setBackupUpdating(false);
    }
  };

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    const cleanName = snapshotName.trim() || `${droplet?.name || 'vps'}-snap`;
    setSnapshotCreating(true);
    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/snapshots`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: cleanName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Snapshot creation failed (HTTP ${res.status}).`);
      setSnapshotName('');
      showToast?.(`Snapshot "${cleanName}" created.`, 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not create snapshot.', 'error');
    } finally {
      setSnapshotCreating(false);
    }
  };

  const handleRestoreSnapshot = async (snapId) => {
    setSnapshotBusyId(snapId);
    try {
      const res = await fetch(
        `/api/cloud/droplets/${encodeURIComponent(dropletId)}/snapshots/${encodeURIComponent(snapId)}/restore`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not restore snapshot.');
      setRestoreConfirmId(null);
      showToast?.('Snapshot restore initiated.', 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not restore snapshot.', 'error');
    } finally {
      setSnapshotBusyId(null);
    }
  };

  const handleDeleteSnapshot = async (snapId) => {
    setSnapshotBusyId(snapId);
    try {
      const res = await fetch(
        `/api/cloud/droplets/${encodeURIComponent(dropletId)}/snapshots/${encodeURIComponent(snapId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not delete snapshot.');
      showToast?.('Snapshot deleted.', 'success');
      await loadDetail();
    } catch (err) {
      showToast?.(err?.message || 'Could not delete snapshot.', 'error');
    } finally {
      setSnapshotBusyId(null);
    }
  };

  if (detailLoading && !droplet) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to Cloud Overview
        </Button>
        <Card>
          <CardContent className="flex h-56 flex-col items-center justify-center gap-2.5 p-6">
            <RefreshCw className="size-6 animate-spin text-[#1ED760]" />
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Loading VPS instance details…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailError && !droplet) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to Cloud Overview
        </Button>
        <Alert variant="destructive" className="items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{detailError}</span>
          </div>
          <Button size="sm" variant="outline" onClick={loadDetail}>
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  const statusMeta = getStatusMeta(droplet?.status);
  const flagUrl = resolveRegionFlagUrl(droplet);

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* Top Breadcrumb & Compute Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Cloud Overview
          </Button>
          <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
            Instance ID: {droplet?.id || dropletId}
          </span>
        </div>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Identity Cluster */}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    <Server className="size-4" aria-hidden="true" />
                  </div>

                  {isRenaming ? (
                    <form onSubmit={handleRenameSubmit} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        maxLength={255}
                        autoFocus
                        aria-label="New VPS hostname"
                        className="h-8 w-52 rounded-lg border border-[#1ED760] bg-white px-2.5 text-sm font-semibold text-neutral-950 outline-none dark:bg-neutral-900 dark:text-white"
                      />
                      <Button type="submit" size="sm" disabled={savingRename}>
                        <Save className="size-3.5" />
                        {savingRename ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsRenaming(false);
                          setRenameValue(droplet?.name || '');
                        }}
                      >
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <h1 className="truncate text-lg font-bold tracking-tight text-neutral-950 dark:text-white sm:text-xl">
                        {droplet?.name || dropletId}
                      </h1>
                      <button
                        type="button"
                        onClick={() => setIsRenaming(true)}
                        title="Rename VPS"
                        aria-label="Rename VPS"
                        className="inline-flex size-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}

                  <Badge variant={statusMeta.variant} className="capitalize">
                    <span className={`size-1.5 rounded-full ${statusMeta.dotClass} ${statusMeta.isRunning ? 'animate-pulse' : ''}`} />
                    {statusMeta.label}
                  </Badge>
                </div>

                {/* Metadata Badges Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <Badge variant="secondary" className="gap-1.5 font-medium">
                    {flagUrl ? (
                      <img
                        src={flagUrl}
                        alt=""
                        className="h-3.5 w-[18px] rounded-[2px] object-cover ring-1 ring-black/10 dark:ring-white/15"
                      />
                    ) : (
                      <Globe className="size-3" />
                    )}
                    <span>{droplet?.region || droplet?.regionCode || 'Region N/A'}</span>
                  </Badge>

                  <Badge variant="outline" className="font-medium">
                    {droplet?.specs || [droplet?.vcpus && `${droplet.vcpus} vCPU`, droplet?.memory, droplet?.storage].filter(Boolean).join(' · ') || 'Compute Instance'}
                  </Badge>

                  <Badge variant="brand" className="font-semibold tabular-nums">
                    {billingInfo.monthlyPrice !== null ? `${formatUsd(billingInfo.monthlyPrice)}/mo` : 'Monthly Plan'}
                    {billingInfo.nextBillingAt ? ` · Renews ${formatShortDate(billingInfo.nextBillingAt)}` : ''}
                  </Badge>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onSectionChange?.('console')}
                  disabled={!statusMeta.isRunning}
                >
                  <Terminal className="size-3.5" aria-hidden="true" />
                  Open Console
                </Button>

                <Button
                  size="sm"
                  variant={statusMeta.isRunning ? 'outline' : 'default'}
                  onClick={handlePowerToggle}
                  disabled={powerUpdating || statusMeta.isSuspended}
                >
                  <Power className="size-3.5" aria-hidden="true" />
                  {powerUpdating
                    ? 'Updating…'
                    : statusMeta.isRunning
                      ? 'Power Off'
                      : 'Power On'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRenaming((v) => !v)}
                >
                  <Edit3 className="size-3.5" aria-hidden="true" />
                  Rename
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen((v) => !v)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete VPS
                </Button>
              </div>
            </div>

            {/* Inline Delete Confirmation Bar (No modal/popup) */}
            {confirmDeleteOpen && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs text-rose-900 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div>
                    <p className="font-semibold">
                      Permanently destroy "{droplet?.name || dropletId}"?
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      This immediately terminates the VPS, releases its IPv4/IPv6 allocation, and reclaims {droplet?.storage || 'storage'}.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteVps}
                    disabled={deleting}
                  >
                    {deleting ? 'Destroying…' : 'Confirm Destroy'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grace / Suspension Lifecycle Alert if active */}
      {(billingInfo.graceUntil || billingInfo.suspendedAt || billingInfo.purgeAt) && (
        <Alert variant={billingInfo.suspendedAt ? 'destructive' : 'warning'}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {billingInfo.suspendedAt
                  ? 'Instance suspended due to unpaid renewal'
                  : 'Monthly renewal past due — grace period active'}
              </p>
              <p className="mt-0.5 text-[11px]">
                {billingInfo.graceUntil && `Grace ends: ${formatDateTime(billingInfo.graceUntil)} · `}
                {billingInfo.purgeAt && `Scheduled permanent purge: ${formatDateTime(billingInfo.purgeAt)}`}
              </p>
            </div>
            {onOpenBilling && (
              <Button size="sm" variant="outline" onClick={() => onOpenBilling('credits')}>
                Top Up Billing Credits
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Sub-Tabs Synced with /cloud/droplets/:id/:section */}
      <Tabs
        value={safeSection}
        onValueChange={(next) => onSectionChange?.(next)}
        className="space-y-4"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex-nowrap whitespace-nowrap">
            <TabsTrigger value="overview">
              <Activity className="size-3.5" aria-hidden="true" />
              Overview &amp; Metrics
            </TabsTrigger>
            <TabsTrigger value="console">
              <Terminal className="size-3.5" aria-hidden="true" />
              Browser Console
            </TabsTrigger>
            <TabsTrigger value="network">
              <Network className="size-3.5" aria-hidden="true" />
              Network &amp; IPv6
            </TabsTrigger>
            <TabsTrigger value="dns">
              <Shield className="size-3.5" aria-hidden="true" />
              Per-VPS DNS &amp; Firewall
            </TabsTrigger>
            <TabsTrigger value="billing">
              <HardDrive className="size-3.5" aria-hidden="true" />
              Storage, Snapshots &amp; Billing
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: INTERACTIVE BROWSER SSH CONSOLE */}
        {safeSection === 'console' && (
          <DropletTerminalPanel
            dropletId={dropletId}
            dropletName={droplet?.name || dropletId}
            sshCommand={networkInfo.sshGatewayCommand || networkInfo.sshIpv6Cmd || networkInfo.sshIpv4Cmd}
            isRunning={statusMeta.isRunning}
            isSuspended={statusMeta.isSuspended}
          />
        )}

        {/* TAB 1: OVERVIEW & METRICS */}
        {safeSection === 'overview' && (
          <div className="space-y-5">
            <TelemetryChartCard dropletId={dropletId} />

            {/* Compute Configuration Summary Grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="size-4 text-[#1ED760]" aria-hidden="true" />
                    Machine Configuration
                  </CardTitle>
                  <CardDescription>Hardware allocation and operating system metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {[
                    ['OS Image', droplet?.image || 'Ubuntu 24.04 LTS'],
                    ['vCPU Cores', droplet?.vcpus ? `${droplet.vcpus} vCPU` : '—'],
                    ['Memory (RAM)', droplet?.memory || '—'],
                    ['NVMe Storage', droplet?.storage || '—'],
                    ['Cluster Node', droplet?.nodeId || 'primary-ubuntu-node'],
                    ['Tenant Namespace', droplet?.tenantId || '—'],
                    ['Provisioned At', formatDateTime(droplet?.createdAt || droplet?.created)],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-b-0 dark:border-neutral-800/80"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
                      <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100 text-right">
                        {val}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="size-4 text-[#1ED760]" aria-hidden="true" />
                    Quick SSH &amp; Network Access
                  </CardTitle>
                  <CardDescription>Connect via tiwlo.com (Port 443 · any ISP/Wi-Fi) or direct IPv6</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {(() => {
                    const relay = networkInfo.sshRelayCommands;
                    const quickOsMode = sshMethodTab === 'unix' ? 'unix' : 'windows';
                    const preferredCmd =
                      quickOsMode === 'unix'
                        ? relay?.unixCommand || networkInfo.sshGatewayCommand || networkInfo.sshIpv6Cmd
                        : relay?.windowsCommand || networkInfo.sshGatewayCommand || networkInfo.sshIpv6Cmd;
                    return (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-neutral-700 dark:text-neutral-200">
                            {quickOsMode === 'unix'
                              ? 'SSH Terminal (Linux / macOS / Termux)'
                              : 'SSH Terminal (Windows PowerShell / CMD)'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="inline-flex rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950">
                              <button
                                type="button"
                                onClick={() => setSshMethodTab('windows')}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
                                  quickOsMode === 'windows'
                                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                    : 'text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                Windows
                              </button>
                              <button
                                type="button"
                                onClick={() => setSshMethodTab('unix')}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer ${
                                  quickOsMode === 'unix'
                                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                    : 'text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                Termux / Linux / Mac
                              </button>
                            </div>
                            {preferredCmd && (
                              <button
                                type="button"
                                onClick={() => handleCopy('ov-ssh-gw', preferredCmd, 'SSH command')}
                                className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:text-black dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:text-white cursor-pointer"
                              >
                                {copiedKey === 'ov-ssh-gw' ? <Check className="size-3 text-[#1ED760]" /> : <Copy className="size-3" />}
                                {copiedKey === 'ov-ssh-gw' ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>
                        </div>
                        <code className="mt-1.5 block truncate font-mono text-[11px] text-neutral-900 dark:text-neutral-100">
                          {preferredCmd || 'SSH gateway assignment pending'}
                        </code>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                          <span>
                            Portal: <a href={networkInfo.sshPortalUrl} target="_blank" rel="noreferrer" className="font-mono text-neutral-800 underline decoration-neutral-300 underline-offset-2 hover:text-black dark:text-neutral-200 dark:hover:text-white">{networkInfo.sshPortalUrl}</a>
                          </span>
                          <span>User: <code className="font-mono text-neutral-800 dark:text-neutral-200">{networkInfo.sshGatewayUser || networkInfo.accessUsername}</code></span>
                        </div>
                      </div>
                    );
                  })()}

                  {networkInfo.sshIpv4Cmd && (
                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-neutral-500">Public IPv4 SSH Command</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('ov-ssh4', networkInfo.sshIpv4Cmd, 'IPv4 SSH command')}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white cursor-pointer"
                        >
                          {copiedKey === 'ov-ssh4' ? <Check className="size-3 text-[#1ED760]" /> : <Copy className="size-3" />}
                          {copiedKey === 'ov-ssh4' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <code className="mt-1.5 block truncate font-mono text-[11px] text-neutral-900 dark:text-neutral-100">
                        {networkInfo.sshIpv4Cmd}
                      </code>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-neutral-500">
                      Gateway User: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{networkInfo.sshGatewayUser || networkInfo.accessUsername}</strong> · Container User{' '}
                      <strong className="font-mono text-neutral-800 dark:text-neutral-200">{networkInfo.accessUsername}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="default" onClick={() => onSectionChange?.('console')} disabled={!statusMeta.isRunning}>
                        Open Terminal
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onSectionChange?.('network')}>
                        Full Network Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: NETWORK & IPv6 */}
        {safeSection === 'network' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Primary IPv4 Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="size-4 text-[#1ED760]" aria-hidden="true" />
                      Primary IPv4 Interface
                    </CardTitle>
                    <Badge variant={networkInfo.ipv4 ? 'success' : 'secondary'}>
                      {networkInfo.ipv4 ? 'Assigned' : 'Unavailable'}
                    </Badge>
                  </div>
                  <CardDescription>Public or node-routed IPv4 address and SSH endpoint</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <div>
                      <div className="text-[11px] text-neutral-500">IPv4 Address</div>
                      <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                        {networkInfo.ipv4 || '—'}
                      </div>
                    </div>
                    {networkInfo.ipv4 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy('net-ipv4', networkInfo.ipv4, 'IPv4 address')}
                      >
                        {copiedKey === 'net-ipv4' ? <Check className="size-3.5 text-[#1ED760]" /> : <Copy className="size-3.5" />}
                        {copiedKey === 'net-ipv4' ? 'Copied' : 'Copy IP'}
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        {networkInfo.sshIpv4Cmd ? 'Direct SSH (IPv4)' : 'IPv4 Clients (No Public IPv4)'}
                      </span>
                      {networkInfo.sshIpv4Cmd && (
                        <button
                          type="button"
                          onClick={() => handleCopy('net-ssh4', networkInfo.sshIpv4Cmd, 'IPv4 SSH command')}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          {copiedKey === 'net-ssh4' ? <Check className="size-3 text-[#1ED760]" /> : <Copy className="size-3" />}
                          {copiedKey === 'net-ssh4' ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <code className="mt-1.5 block overflow-x-auto font-mono text-xs text-neutral-900 dark:text-neutral-100">
                      {networkInfo.sshIpv4Cmd || 'Use tiwlo.com SSH Access below — works on any IPv4 Wi-Fi or mobile network.'}
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* Dedicated IPv6 (/128) Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Network className="size-4 text-neutral-600 dark:text-neutral-300" aria-hidden="true" />
                      Dedicated IPv6 ({networkInfo.ipv6Prefix || '/128'})
                    </CardTitle>
                    <Badge variant={networkInfo.ipv6 ? 'secondary' : 'secondary'}>
                      {networkInfo.ipv6 ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </div>
                  <CardDescription>Server IPv6 endpoint for IPv6-capable networks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-500">IPv6 Address</div>
                      <div className="mt-0.5 truncate font-mono text-sm font-semibold text-neutral-950 dark:text-white">
                        {networkInfo.ipv6 ? `${networkInfo.ipv6}${networkInfo.ipv6Prefix || '/128'}` : 'Not assigned'}
                      </div>
                    </div>
                    {networkInfo.ipv6 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy('net-ipv6', networkInfo.ipv6, 'IPv6 address')}
                      >
                        {copiedKey === 'net-ipv6' ? <Check className="size-3.5 text-[#1ED760]" /> : <Copy className="size-3.5" />}
                        {copiedKey === 'net-ipv6' ? 'Copied' : 'Copy IP'}
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Direct IPv6 SSH (Port 22 · IPv6 ISP only)</span>
                      {networkInfo.sshIpv6Cmd && (
                        <button
                          type="button"
                          onClick={() => handleCopy('net-ssh6', networkInfo.sshIpv6Cmd, 'IPv6 SSH command')}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          {copiedKey === 'net-ssh6' ? <Check className="size-3 text-[#1ED760]" /> : <Copy className="size-3" />}
                          {copiedKey === 'net-ssh6' ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <code className="mt-1.5 block overflow-x-auto font-mono text-xs text-neutral-900 dark:text-neutral-100">
                      {networkInfo.sshIpv6Cmd || 'Assign an IPv6 prefix on the host node to enable IPv6 SSH'}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Clean Minimalist Terminal & SSH Access via tiwlo.com (Directly below IPv4 & IPv6 Cards) */}
            {(() => {
              const relay = networkInfo.sshRelayCommands;
              const activeCode =
                sshMethodTab === 'windows'
                  ? relay?.windowsCommand || networkInfo.sshGatewayCommand || ''
                  : sshMethodTab === 'unix'
                    ? relay?.unixCommand || networkInfo.sshGatewayCommand || ''
                    : sshMethodTab === 'config'
                      ? (typeof navigator !== 'undefined' &&
                        !/windows|win32|win64|wow64/i.test(String(navigator.platform || '')) &&
                        /mac|linux|ubuntu|fedora|debian|darwin|x11|android|iphone|ipad|ipod|termux|arm/i.test(
                          `${navigator.platform || ''} ${navigator.userAgent || ''}`
                        )
                        ? relay?.sshConfigUnix
                        : relay?.sshConfigWindows) || ''
                      : networkInfo.sshIpv6Cmd || '';

              const activeCaption =
                sshMethodTab === 'windows'
                  ? 'Run in Windows PowerShell or Command Prompt and enter your VPS root password. Works on IPv4-only Wi-Fi and mobile data.'
                  : sshMethodTab === 'unix'
                    ? 'Run in Android Termux (install Python once with: pkg install -y python), macOS Terminal, or Linux shell.'
                    : sshMethodTab === 'config'
                      ? `Save this block into ~/.ssh/config once, then connect anytime with: ssh ${droplet?.name || dropletId}`
                      : 'Direct Port 22 skips the HTTPS bridge and works only when your ISP or router assigns an IPv6 route.';

              return (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>SSH &amp; Terminal Access via tiwlo.com</CardTitle>
                        <CardDescription>
                          Root container access on Port 443 — connects cleanly even if your local internet has no IPv6.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onSectionChange?.('console')}
                          disabled={!statusMeta.isRunning}
                        >
                          <Terminal className="size-3.5" />
                          Open Web Terminal
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 text-xs">
                    {/* Crisp 3-column metadata strip */}
                    <div className="grid grid-cols-1 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-3 md:divide-x md:divide-y-0">
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="text-[11px] text-neutral-500">SSH Username (Root Access)</div>
                          <div className="mt-0.5 truncate font-mono text-xs font-semibold text-neutral-950 dark:text-white">
                            {networkInfo.sshGatewayUser || networkInfo.accessUsername || '—'}
                          </div>
                        </div>
                        {networkInfo.sshGatewayUser && (
                          <button
                            type="button"
                            onClick={() => handleCopy('net-gw-user', networkInfo.sshGatewayUser, 'SSH username')}
                            className="shrink-0 rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white cursor-pointer"
                          >
                            {copiedKey === 'net-gw-user' ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="text-[11px] text-neutral-500">tiwlo.com SSH Endpoint</div>
                          <div className="mt-0.5 truncate font-mono text-xs font-semibold text-neutral-950 dark:text-white">
                            {networkInfo.sshBridgeUrl}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('net-bridge-url', networkInfo.sshBridgeUrl, 'SSH endpoint')}
                          className="shrink-0 rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white cursor-pointer"
                        >
                          {copiedKey === 'net-bridge-url' ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="text-[11px] text-neutral-500">Direct Web SSH Link</div>
                          <a
                            href={networkInfo.sshPortalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block truncate font-mono text-xs font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:text-black dark:text-neutral-100 dark:decoration-neutral-700 dark:hover:text-white"
                          >
                            {networkInfo.sshPortalUrl}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy('net-portal-url', networkInfo.sshPortalUrl, 'Web SSH link')}
                          className="shrink-0 rounded border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-950 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-white cursor-pointer"
                        >
                          {copiedKey === 'net-portal-url' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Method Switcher + Single Clean Code Field */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex flex-wrap rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
                          {[
                            { id: 'windows', label: 'Windows (PowerShell / CMD)' },
                            { id: 'unix', label: 'Linux / macOS / Termux' },
                            { id: 'config', label: 'SSH Config' },
                            { id: 'ipv6', label: 'IPv6 Port 22' },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setSshMethodTab(tab.id)}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                sshMethodTab === tab.id
                                  ? 'bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white'
                                  : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {activeCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopy(`net-ssh-${sshMethodTab}`, activeCode, 'SSH command')}
                          >
                            {copiedKey === `net-ssh-${sshMethodTab}` ? <Check className="size-3.5 text-[#1ED760]" /> : <Copy className="size-3.5" />}
                            {copiedKey === `net-ssh-${sshMethodTab}` ? 'Copied' : 'Copy Command'}
                          </Button>
                        )}
                      </div>

                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-neutral-200 bg-neutral-50/80 px-3.5 py-3 font-mono text-[12px] leading-relaxed text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-100">
                        {activeCode || 'Command unavailable until SSH gateway user is assigned.'}
                      </pre>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {activeCaption}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* IP Lifecycle & Prefix Sync Log */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>IP Lifecycle &amp; Prefix Sync Log</CardTitle>
                    <CardDescription>
                      Tracks IP allocation state ({networkInfo.ipLifecycleStatus}) and automated prefix updates across bound DNS records
                    </CardDescription>
                  </div>
                  <Badge
                    variant={networkInfo.ipLifecycleStatus === 'held' ? 'warning' : 'success'}
                    className="capitalize"
                  >
                    IP Lifecycle: {networkInfo.ipLifecycleStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {networkInfo.ipLifecycleStatus === 'held' && (
                  <Alert variant="warning">
                    <Clock className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">IP allocation is currently held</p>
                      <p className="mt-0.5 text-[11px]">
                        This VPS's IPv4/IPv6 lease is reserved while suspended
                        {networkInfo.heldUntil ? ` until ${formatDateTime(networkInfo.heldUntil)}.` : '.'}
                      </p>
                    </div>
                  </Alert>
                )}

                {networkInfo.prefixSyncLogs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    No prefix sync events recorded for this VPS yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                    <table className="w-full min-w-[540px] text-left text-xs">
                      <thead className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold">Timestamp</th>
                          <th className="px-3.5 py-2.5 font-semibold">Event</th>
                          <th className="px-3.5 py-2.5 font-semibold">Previous Prefix</th>
                          <th className="px-3.5 py-2.5 font-semibold">New Prefix</th>
                          <th className="px-3.5 py-2.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                        {networkInfo.prefixSyncLogs.map((log, i) => (
                          <tr key={log.id || i}>
                            <td className="px-3.5 py-2.5 whitespace-nowrap text-neutral-500">
                              {formatDateTime(log.syncedAt || log.createdAt)}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                              {log.event || 'Prefix Sync'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-neutral-600 dark:text-neutral-300">
                              {log.oldPrefix || '—'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-neutral-900 dark:text-white">
                              {log.newPrefix || '—'}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <Badge variant={String(log.status || '').toLowerCase() === 'failed' ? 'destructive' : 'success'}>
                                {log.status || 'synced'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: PER-VPS DNS & FIREWALL */}
        {safeSection === 'dns' && (
          <div className="space-y-5">
            {/* Domain Routing & Nameserver Info */}
            <Alert variant="info">
              <Globe className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Custom Domains, Tiwlo Nameservers &amp; Cloudflare Origin Routing</p>
                <p className="text-[11px]">
                  Point your domain&apos;s nameservers to <code className="font-mono font-semibold">dns1.tiwlo.com</code> &amp;{' '}
                  <code className="font-mono font-semibold">dns2.tiwlo.com</code>, or add a Cloudflare <code className="font-mono">AAAA</code> record pointing to{' '}
                  <code className="font-mono font-semibold">{networkInfo.sshGatewayHost || '2401:f40:126f:f0:b62e:99ff:fe5b:df13'}</code> (Proxy ON for IPv4+IPv6 global CDN).
                  Tiwlo automatically terminates HTTPS (Port 443) and forwards web &amp; WebSocket traffic to your chosen container port.
                </p>
              </div>
            </Alert>

            {/* Per-VPS Domain Bindings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="size-4 text-[#1ED760]" aria-hidden="true" />
                  Connected Domains &amp; Container Port Mapping
                </CardTitle>
                <CardDescription>
                  Connect any custom domain (e.g. app.yourdomain.com) or your free .uids.app domain to {droplet?.name || 'this VPS'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleBindDns}
                  className="grid grid-cols-1 gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5">
                    <label htmlFor="vps-dns-host" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Domain or Subdomain
                    </label>
                    <input
                      id="vps-dns-host"
                      type="text"
                      value={dnsHostname}
                      onChange={(e) => setDnsHostname(e.target.value)}
                      placeholder="example.com or app.example.com"
                      required
                      className="h-9 w-full rounded-lg border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="vps-dns-type" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      DNS Mode
                    </label>
                    <select
                      id="vps-dns-type"
                      value={dnsRecordType}
                      onChange={(e) => setDnsRecordType(e.target.value)}
                      className="h-9 box-border w-full rounded-lg border border-neutral-200/80 bg-white px-2.5 py-0 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="A+AAAA">Nameserver / Edge Proxy</option>
                      <option value="AAAA">AAAA (IPv6 Edge)</option>
                      <option value="A">A (IPv4 Edge)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="vps-dns-port" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      VPS HTTP Port
                    </label>
                    <input
                      id="vps-dns-port"
                      type="number"
                      min="1"
                      max="65535"
                      value={dnsTargetPort}
                      onChange={(e) => setDnsTargetPort(e.target.value)}
                      placeholder="80"
                      className="h-9 box-border w-full rounded-lg border border-neutral-200/80 bg-white px-2.5 py-0 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div className="flex items-end sm:col-span-2">
                    <Button type="submit" className="h-9 w-full" disabled={dnsSubmitting || !dnsHostname.trim()}>
                      <Plus className="size-3.5" />
                      {dnsSubmitting ? 'Saving…' : 'Connect'}
                    </Button>
                  </div>
                </form>

                {dnsRecords.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    No domains are connected to this VPS yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold">Hostname</th>
                          <th className="px-3.5 py-2.5 font-semibold">Target</th>
                          <th className="px-3.5 py-2.5 font-semibold">Port</th>
                          <th className="px-3.5 py-2.5 font-semibold">Status &amp; SSL</th>
                          <th className="px-3.5 py-2.5 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                        {dnsRecords.map((rec) => {
                          const isActiveDomain = rec.status === 'active';
                          const targetVal = rec.serverIpv6 || rec.value || rec.target || networkInfo.sshGatewayHost || '—';
                          return (
                            <tr key={rec.id || rec.hostname || rec.domain}>
                              <td className="px-3.5 py-2.5">
                                <div className="font-mono font-medium text-neutral-950 dark:text-white">
                                  {rec.hostname || rec.domain}
                                </div>
                                {!isActiveDomain && rec.verificationTxt?.value && (
                                  <div className="mt-0.5 text-[10px] text-neutral-500">
                                    TXT verify: <code className="font-mono">{rec.verificationTxt.name}</code>
                                  </div>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-neutral-600 dark:text-neutral-300">
                                {targetVal}
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-neutral-700 dark:text-neutral-200">
                                :{rec.targetPort || 80}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <Badge variant={isActiveDomain ? 'success' : 'warning'}>
                                  {isActiveDomain ? 'Active · SSL Ready' : 'Pending DNS'}
                                </Badge>
                              </td>
                              <td className="px-3.5 py-2.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {!isActiveDomain && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={dnsVerifyingId === rec.id}
                                      onClick={() => handleVerifyDns(rec.id)}
                                    >
                                      <RefreshCw className={`size-3 ${dnsVerifyingId === rec.id ? 'animate-spin' : ''}`} />
                                      {dnsVerifyingId === rec.id ? 'Checking…' : 'Verify'}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={dnsRemovingId === rec.id}
                                    onClick={() => handleRemoveDns(rec.id)}
                                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                  >
                                    <Trash2 className="size-3.5" />
                                    Remove
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Firewall Port Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-4 text-[#1ED760]" aria-hidden="true" />
                  Inbound &amp; Outbound Firewall Port Rules
                </CardTitle>
                <CardDescription>
                  Manage allowed or denied TCP/UDP ports for this VPS instance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleAddFirewallRule}
                  className="grid grid-cols-1 gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40 sm:grid-cols-12"
                >
                  <div className="sm:col-span-2">
                    <label htmlFor="fw-dir" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Direction
                    </label>
                    <select
                      id="fw-dir"
                      value={fwDirection}
                      onChange={(e) => setFwDirection(e.target.value)}
                      className="h-9 w-full rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fw-proto" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Protocol
                    </label>
                    <select
                      id="fw-proto"
                      value={fwProtocol}
                      onChange={(e) => setFwProtocol(e.target.value)}
                      className="h-9 w-full rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fw-port" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Port / Range
                    </label>
                    <input
                      id="fw-port"
                      type="text"
                      value={fwPort}
                      onChange={(e) => setFwPort(e.target.value)}
                      placeholder="8080"
                      required
                      className="h-9 w-full rounded-lg border border-neutral-200/80 bg-white px-2.5 font-mono text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fw-source" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Source / CIDR
                    </label>
                    <input
                      id="fw-source"
                      type="text"
                      value={fwSource}
                      onChange={(e) => setFwSource(e.target.value)}
                      placeholder="0.0.0.0/0, ::/0"
                      className="h-9 w-full rounded-lg border border-neutral-200/80 bg-white px-2.5 font-mono text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="fw-label" className="mb-1 block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Action &amp; Label
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        aria-label="Rule action"
                        value={fwAction}
                        onChange={(e) => setFwAction(e.target.value)}
                        className="h-9 w-20 shrink-0 rounded-lg border border-neutral-200/80 bg-white px-1.5 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      >
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                      <input
                        id="fw-label"
                        type="text"
                        value={fwLabel}
                        onChange={(e) => setFwLabel(e.target.value)}
                        placeholder="Label"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-end sm:col-span-2">
                    <Button type="submit" className="w-full" disabled={fwSubmitting || !fwPort.trim()}>
                      <Plus className="size-3.5" />
                      {fwSubmitting ? 'Adding…' : 'Add Rule'}
                    </Button>
                  </div>
                </form>

                <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                  <table className="w-full min-w-[600px] text-left text-xs">
                    <thead className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">Direction</th>
                        <th className="px-3.5 py-2.5 font-semibold">Protocol / Port</th>
                        <th className="px-3.5 py-2.5 font-semibold">Source CIDR</th>
                        <th className="px-3.5 py-2.5 font-semibold">Action</th>
                        <th className="px-3.5 py-2.5 font-semibold">Label</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                      {firewallRules.map((rule) => {
                        const isDeny = String(rule.action || '').toLowerCase() === 'deny';
                        return (
                          <tr key={rule.id || `${rule.direction}-${rule.protocol}-${rule.port}`}>
                            <td className="px-3.5 py-2.5 capitalize text-neutral-700 dark:text-neutral-300">
                              {rule.direction || 'inbound'}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-semibold text-neutral-950 dark:text-white">
                              {String(rule.protocol || 'tcp').toUpperCase()} {rule.port}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-neutral-600 dark:text-neutral-300">
                              {rule.source || '0.0.0.0/0, ::/0'}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <Badge variant={isDeny ? 'destructive' : 'success'} className="uppercase">
                                {rule.action || 'allow'}
                              </Badge>
                            </td>
                            <td className="px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300">
                              {rule.label || 'Custom Rule'}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              {rule.system ? (
                                <span className="text-[11px] text-neutral-400">Default</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={fwRemovingId === rule.id}
                                  onClick={() => handleRemoveFirewallRule(rule.id)}
                                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="size-3.5" />
                                  Delete
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: STORAGE, SNAPSHOTS & BILLING */}
        {safeSection === 'billing' && (
          <div className="space-y-5">
            {/* NVMe Volume & Automated Backups Row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="size-4 text-[#1ED760]" aria-hidden="true" />
                    NVMe Volume Specifications
                  </CardTitle>
                  <CardDescription>Primary root block storage attached to this VPS</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {[
                    ['Volume ID', storageInfo.volumeName],
                    ['Capacity', storageInfo.capacity],
                    ['Storage Tier', storageInfo.type],
                    ['Root Mount', storageInfo.mountPath],
                    ['Host Node', droplet?.nodeId || 'primary-ubuntu-node'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-b-0 dark:border-neutral-800/80"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">{k}</span>
                      <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="size-4 text-[#1ED760]" aria-hidden="true" />
                        Backups &amp; Snapshots
                      </CardTitle>
                      <CardDescription>Toggle scheduled backups or capture on-demand disk snapshots</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant={storageInfo.backupsEnabled ? 'secondary' : 'outline'}
                      onClick={handleToggleBackups}
                      disabled={backupUpdating}
                    >
                      {backupUpdating
                        ? 'Updating…'
                        : storageInfo.backupsEnabled
                          ? 'Backups: Enabled'
                          : 'Enable Backups'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <form onSubmit={handleCreateSnapshot} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder={`${droplet?.name || 'vps'}-snapshot`}
                      aria-label="Snapshot name"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                    <Button type="submit" size="sm" disabled={snapshotCreating}>
                      <Plus className="size-3.5" />
                      {snapshotCreating ? 'Creating…' : 'Create Snapshot'}
                    </Button>
                  </form>

                  {storageInfo.snapshots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-5 text-center text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      No snapshots recorded for this VPS yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/80 dark:divide-neutral-800/80 dark:border-neutral-800">
                      {storageInfo.snapshots.map((snap) => (
                        <div key={snap.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-neutral-900 dark:text-white">{snap.name}</p>
                            <p className="text-[11px] text-neutral-500">
                              {snap.sizeGb ? `${snap.sizeGb} GB · ` : ''}{formatDateTime(snap.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {restoreConfirmId === snap.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  disabled={snapshotBusyId === snap.id}
                                  onClick={() => handleRestoreSnapshot(snap.id)}
                                >
                                  Confirm Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRestoreConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={snapshotBusyId === snap.id}
                                  onClick={() => setRestoreConfirmId(snap.id)}
                                >
                                  <RotateCcw className="size-3" />
                                  Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={snapshotBusyId === snap.id}
                                  onClick={() => handleDeleteSnapshot(snap.id)}
                                  className="text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Billing Lifecycle & Itemized Invoices */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="size-4 text-[#1ED760]" aria-hidden="true" />
                      VPS Billing Schedule &amp; Monthly Invoices
                    </CardTitle>
                    <CardDescription>
                      Renewal timeline, grace/purge dates, and itemized monthly invoices
                    </CardDescription>
                  </div>
                  {onOpenBilling && (
                    <Button size="sm" variant="outline" onClick={() => onOpenBilling('overview')}>
                      Open Cloud Billing
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="text-[11px] text-neutral-500">Monthly Rate</div>
                    <div className="mt-1 text-base font-bold tabular-nums text-neutral-950 dark:text-white">
                      {billingInfo.monthlyPrice !== null ? `${formatUsd(billingInfo.monthlyPrice)}/mo` : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="text-[11px] text-neutral-500">Next Renewal Date</div>
                    <div className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                      {formatShortDate(billingInfo.nextBillingAt)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="text-[11px] text-neutral-500">Grace Deadline</div>
                    <div className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                      {formatShortDate(billingInfo.graceUntil)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <div className="text-[11px] text-neutral-500">Scheduled Purge</div>
                    <div className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                      {formatShortDate(billingInfo.purgeAt)}
                    </div>
                  </div>
                </div>

                <Separator />

                {billingInfo.invoices.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    No itemized invoices recorded for this VPS yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold">Invoice #</th>
                          <th className="px-3.5 py-2.5 font-semibold">Billing Period</th>
                          <th className="px-3.5 py-2.5 font-semibold">Line Items</th>
                          <th className="px-3.5 py-2.5 font-semibold">Status</th>
                          <th className="px-3.5 py-2.5 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                        {billingInfo.invoices.map((inv) => {
                          const invStatus = String(inv.status || 'paid').toLowerCase();
                          const badgeVariant =
                            invStatus === 'paid'
                              ? 'success'
                              : invStatus === 'past_due'
                                ? 'warning'
                                : invStatus === 'failed'
                                  ? 'destructive'
                                  : 'secondary';
                          const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
                          return (
                            <tr key={inv.id || inv.invoiceNumber}>
                              <td className="px-3.5 py-2.5 font-mono font-semibold text-neutral-950 dark:text-white">
                                {inv.invoiceNumber || inv.id}
                              </td>
                              <td className="px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300">
                                {inv.billingPeriodStart && inv.billingPeriodEnd
                                  ? `${formatShortDate(inv.billingPeriodStart)} – ${formatShortDate(inv.billingPeriodEnd)}`
                                  : formatShortDate(inv.createdAt)}
                              </td>
                              <td className="px-3.5 py-2.5 text-neutral-700 dark:text-neutral-300">
                                {items.length > 0 ? (
                                  <ul className="space-y-0.5">
                                    {items.map((li, idx) => (
                                      <li key={idx} className="flex items-center justify-between gap-2">
                                        <span>{li.description || li.label || 'Monthly VPS Compute'}</span>
                                        {li.amount !== undefined && (
                                          <span className="font-mono text-[11px] text-neutral-500">
                                            {formatUsd(li.amount)}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span>{droplet?.specs || 'Monthly VPS Compute'}</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <Badge variant={badgeVariant} className="capitalize">
                                  {invStatus.replace(/_/g, ' ')}
                                </Badge>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums text-neutral-950 dark:text-white">
                                {formatUsd(inv.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Tabs>
    </div>
  );
}
