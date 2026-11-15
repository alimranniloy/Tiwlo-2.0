import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Cpu,
  Database,
  FileSpreadsheet,
  HardDrive,
  History,
  MemoryStick,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || window.location.origin;

const PANEL_TYPES = [
  { id: 'tiwlo_panel', label: 'Tiwlo Panel', defaultPort: 8443 },
  { id: 'cpanel_whm', label: 'cPanel / WHM', defaultPort: 2087 },
  { id: 'kvm', label: 'KVM Hypervisor / Droplet', defaultPort: 22 },
  { id: 'plesk', label: 'Plesk Obsidian', defaultPort: 8443 },
  { id: 'directadmin', label: 'DirectAdmin', defaultPort: 2222 },
  { id: 'custom', label: 'Custom / Dedicated', defaultPort: 443 },
];

const EMPTY_NODE_FORM = {
  name: '',
  host: '',
  ip: '',
  port: 8443,
  panelType: 'tiwlo_panel',
  panelUrl: '',
  authToken: '',
  region: 'ap-south-1',
  cpuCores: 4,
  ramGb: 16,
  diskGb: 200,
  maxCapacity: 250,
};

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return null;
  const value = Number(bytes);
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
}

function formatUptime(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
  const total = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${total % 60}s`;
}

function getNodeStatusBadge(status) {
  const s = String(status || 'unknown').toLowerCase();
  if (['online', 'healthy', 'connected', 'active'].includes(s)) {
    return {
      label: status || 'online',
      cls: 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]',
      Icon: Wifi,
    };
  }
  if (['offline', 'unreachable', 'error', 'down'].includes(s)) {
    return {
      label: status || 'offline',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      Icon: WifiOff,
    };
  }
  return {
    label: status || 'unprobed',
    cls: 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    Icon: Radio,
  };
}

function parseBulkServerInput(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader = firstCols.includes('host') || firstCols.includes('ip') || firstCols.includes('name');
  const headers = hasHeader
    ? lines[0].split(',').map((c) => c.trim())
    : ['name', 'host', 'ip', 'port', 'panelType', 'panelUrl', 'region', 'cpuCores', 'ramGb', 'diskGb', 'maxCapacity', 'authToken'];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => {
      if (cols[i] !== undefined && cols[i] !== '') {
        if (['port', 'cpuCores', 'ramGb', 'diskGb', 'maxCapacity'].includes(h)) {
          const num = Number(cols[i]);
          if (Number.isFinite(num)) obj[h] = num;
        } else {
          obj[h] = cols[i];
        }
      }
    });
    return obj;
  });
}

export default function AdminServersView({ onBackToDashboard, showToast }) {
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'telemetry' | 'guide'

  // Host Telemetry state
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState('');

  // Fleet state
  const [nodes, setNodes] = useState([]);
  const [fleetTotal, setFleetTotal] = useState(0);
  const [fleetPage, setFleetPage] = useState(1);
  const [fleetPageSize, setFleetPageSize] = useState(25);
  const [fleetSummary, setFleetSummary] = useState(null);
  const [fleetSearch, setFleetSearch] = useState('');
  const [panelFilter, setPanelFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fleetLoading, setFleetLoading] = useState(true);
  const [fleetError, setFleetError] = useState('');

  // Modals / Drawers
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [nodeForm, setNodeForm] = useState(EMPTY_NODE_FORM);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [logsDrawerNode, setLogsDrawerNode] = useState(null);
  const [nodeLogs, setNodeLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [probingId, setProbingId] = useState('');
  const [batchProbing, setBatchProbing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchWithOptionalReauth = useCallback(async (url, options = {}) => {
    const headers = { ...getHeaders(), ...(options.headers || {}) };
    let res = await fetch(url, { credentials: 'include', ...options, headers });
    let json = await res.json().catch(() => ({}));
    if (res.status === 403 && (json.reauthRequired || /reauth|verification|grant/i.test(json.error || ''))) {
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      res = await fetch(url, { credentials: 'include', ...options, headers });
      json = await res.json().catch(() => ({}));
    }
    return { res, json };
  }, [getHeaders]);

  // Load Host Telemetry (/api/admin/servers)
  useEffect(() => {
    let active = true;
    const loadTelemetry = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const res = await fetch(`${API_BASE}/admin/servers`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Failed to load server telemetry (${res.status}).`);
        }
        if (!active) return;
        setTelemetry(data);
        setTelemetryError('');
      } catch (err) {
        if (!active) return;
        setTelemetryError(err.message || 'Could not load host telemetry.');
      } finally {
        if (active) setTelemetryLoading(false);
      }
    };
    loadTelemetry();
    return () => {
      active = false;
    };
  }, [reloadTick]);

  // Load Fleet Nodes (/api/admin/fleet/nodes)
  useEffect(() => {
    let active = true;
    const loadFleet = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const params = new URLSearchParams({
          page: String(fleetPage),
          pageSize: String(fleetPageSize),
          q: fleetSearch.trim(),
          panelType: panelFilter,
          region: regionFilter.trim(),
          status: statusFilter,
        });
        const res = await fetch(`${API_BASE}/admin/fleet/nodes?${params.toString()}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `Fleet API unavailable (${res.status}).`);
        }
        if (!active) return;
        setNodes(Array.isArray(data.nodes) ? data.nodes : []);
        setFleetTotal(Number(data.total || 0));
        setFleetSummary(data.summary || null);
        setFleetError('');
      } catch (err) {
        if (!active) return;
        setNodes([]);
        setFleetError(err.message || 'Fleet nodes could not be loaded.');
      } finally {
        if (active) setFleetLoading(false);
      }
    };
    loadFleet();
    return () => {
      active = false;
    };
  }, [fleetPage, fleetPageSize, fleetSearch, panelFilter, regionFilter, statusFilter, reloadTick]);

  const handleRefreshAll = () => {
    setTelemetryLoading(true);
    setFleetLoading(true);
    setReloadTick((t) => t + 1);
  };

  const openAddNodeModal = () => {
    setEditingNode(null);
    setNodeForm(EMPTY_NODE_FORM);
    setNodeModalOpen(true);
  };

  const openEditNodeModal = (node) => {
    setEditingNode(node);
    setNodeForm({
      name: node.name || '',
      host: node.host || '',
      ip: node.ip || '',
      port: node.port ?? 8443,
      panelType: node.panelType || 'tiwlo_panel',
      panelUrl: node.panelUrl || '',
      authToken: '',
      region: node.region || '',
      cpuCores: node.cpuCores ?? 4,
      ramGb: node.ramGb ?? 16,
      diskGb: node.diskGb ?? 200,
      maxCapacity: node.maxCapacity ?? 250,
    });
    setNodeModalOpen(true);
  };

  const handleSaveNode = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...nodeForm,
        port: Number(nodeForm.port || 8443),
        cpuCores: Number(nodeForm.cpuCores || 1),
        ramGb: Number(nodeForm.ramGb || 1),
        diskGb: Number(nodeForm.diskGb || 10),
        maxCapacity: Number(nodeForm.maxCapacity || 100),
      };
      if (editingNode && !payload.authToken) {
        delete payload.authToken;
      }

      const url = editingNode
        ? `${API_BASE}/admin/fleet/nodes/${encodeURIComponent(editingNode.id)}`
        : `${API_BASE}/admin/fleet/nodes`;
      const method = editingNode ? 'PATCH' : 'POST';

      const { res, json } = await fetchWithOptionalReauth(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not save server node.');
      }
      showToast?.(editingNode ? 'Server node updated.' : 'Server node added to fleet.', 'success');
      setNodeModalOpen(false);
      handleRefreshAll();
    } catch (err) {
      showToast?.(err.message || 'Failed to save server node.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNode = async (node) => {
    try {
      setSaving(true);
      const { res, json } = await fetchWithOptionalReauth(
        `${API_BASE}/admin/fleet/nodes/${encodeURIComponent(node.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to delete server node.');
      }
      showToast?.(`Removed ${node.name || node.host} from fleet.`, 'success');
      handleRefreshAll();
    } catch (err) {
      showToast?.(err.message || 'Delete failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async (e) => {
    e.preventDefault();
    try {
      const parsedNodes = parseBulkServerInput(bulkInput);
      if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
        showToast?.('Paste valid JSON array or CSV rows first.', 'error');
        return;
      }
      setSaving(true);
      const { res, json } = await fetchWithOptionalReauth(`${API_BASE}/admin/fleet/nodes/bulk`, {
        method: 'POST',
        body: JSON.stringify({ nodes: parsedNodes }),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Bulk import failed.');
      }
      showToast?.(`Imported ${json.importedCount ?? json.count ?? parsedNodes.length} server nodes.`, 'success');
      setBulkModalOpen(false);
      setBulkInput('');
      handleRefreshAll();
    } catch (err) {
      showToast?.(err.message || 'Invalid JSON/CSV or bulk import failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProbeNode = async (node) => {
    try {
      setProbingId(node.id);
      const { res, json } = await fetchWithOptionalReauth(
        `${API_BASE}/admin/fleet/nodes/${encodeURIComponent(node.id)}/probe`,
        { method: 'POST', body: '{}' }
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Probe failed.');
      }
      const updated = json.node || json;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? {
                ...n,
                status: updated.status || n.status,
                latencyMs: updated.latencyMs ?? json.latencyMs ?? n.latencyMs,
                lastError: updated.lastError ?? json.error ?? null,
                lastProbedAt: updated.lastProbedAt || new Date().toISOString(),
              }
            : n
        )
      );
      showToast?.(
        `Probe ${node.name || node.host}: ${updated.status || 'checked'}${
          updated.latencyMs != null ? ` (${updated.latencyMs} ms)` : ''
        }`,
        updated.status === 'offline' ? 'error' : 'success'
      );
    } catch (err) {
      showToast?.(err.message || 'Connectivity probe failed.', 'error');
    } finally {
      setProbingId('');
    }
  };

  const handleProbeBatch = async () => {
    const ids = nodes.map((n) => n.id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      setBatchProbing(true);
      const { res, json } = await fetchWithOptionalReauth(`${API_BASE}/admin/fleet/probe-batch`, {
        method: 'POST',
        body: JSON.stringify({ nodeIds: ids }),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Batch probe failed.');
      }
      showToast?.(`Probed ${ids.length} server nodes on current page.`, 'success');
      handleRefreshAll();
    } catch (err) {
      showToast?.(err.message || 'Batch probe failed.', 'error');
    } finally {
      setBatchProbing(false);
    }
  };

  const handleOpenLogs = async (node) => {
    setLogsDrawerNode(node);
    setNodeLogs([]);
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/fleet/nodes/${encodeURIComponent(node.id)}/logs`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setNodeLogs(Array.isArray(json.logs) ? json.logs : []);
      }
    } catch {
      setNodeLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Host telemetry extraction
  const host = telemetry?.host || telemetry?.telemetry || telemetry?.system || {};
  const cpu = host.cpu || telemetry?.cpu || {};
  const memory = host.memory || host.ram || telemetry?.memory || telemetry?.ram || {};
  const db = telemetry?.postgres || telemetry?.database || telemetry?.db || {};
  const media = telemetry?.mediaStorage || telemetry?.mediaDisk || telemetry?.disk || telemetry?.storage || {};
  const droplets = Array.isArray(telemetry?.droplets) ? telemetry.droplets : [];
  const providerConnected = Boolean(telemetry?.providerConnected);

  const cpuCores = cpu.cores ?? host.cpuCores ?? telemetry?.cpuCores ?? null;
  const loadAvg = Array.isArray(cpu.loadAverage || host.loadAverage)
    ? (cpu.loadAverage || host.loadAverage).map((n) => Number(n).toFixed(2)).join(' / ')
    : cpu.load1m ?? host.loadAvg ?? null;
  const ramUsedBytes = memory.usedBytes ?? memory.used ?? null;
  const ramTotalBytes = memory.totalBytes ?? memory.total ?? null;
  const ramUsedText = memory.usedFormatted || formatBytes(ramUsedBytes);
  const ramTotalText = memory.totalFormatted || formatBytes(ramTotalBytes);
  const ramPercent =
    memory.usedPercent ??
    (ramUsedBytes != null && ramTotalBytes > 0
      ? Math.round((Number(ramUsedBytes) / Number(ramTotalBytes)) * 100)
      : null);
  const uptimeText =
    host.uptimeFormatted ||
    formatUptime(host.uptimeSeconds ?? host.processUptimeSeconds ?? telemetry?.uptimeSeconds);
  const nodeVersion = host.nodeVersion || telemetry?.nodeVersion || null;
  const pgVersion = db.version || db.pgVersion || null;
  const pgSize = db.sizeFormatted || formatBytes(db.sizeBytes) || db.databaseSize || null;
  const pgConnections = db.activeConnections ?? db.connections ?? null;
  const mediaSize = media.usedFormatted || formatBytes(media.usedBytes ?? media.bytes) || media.sizeFormatted || null;
  const mediaFiles = media.fileCount ?? media.files ?? null;

  const totalPages = Math.max(1, Math.ceil(fleetTotal / fleetPageSize));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
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
            Servers, Control Panel Fleet &amp; Host Telemetry
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Manage thousands of Tiwlo Panel, cPanel/WHM, KVM, Plesk, and DirectAdmin nodes alongside live host telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={fleetLoading || telemetryLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fleetLoading || telemetryLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={openAddNodeModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition hover:bg-[#19c354]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Server Node
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
        {[
          { id: 'fleet', label: `Server Fleet (${fleetTotal})`, icon: Server },
          { id: 'telemetry', label: 'Host & DB Telemetry', icon: Activity },
          { id: 'guide', label: 'Panel Connectivity Guide', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                active
                  ? 'bg-[#1ED760] font-semibold text-black'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Fleet Tab */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          {/* Fleet Summary Strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-xs font-medium text-neutral-500">Registered Nodes</span>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {fleetSummary?.total ?? fleetTotal}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-xs font-medium text-neutral-500">Online / Reachable</span>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                {fleetSummary?.online ?? nodes.filter((n) => n.status === 'online').length}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-xs font-medium text-neutral-500">Offline / Error</span>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {fleetSummary?.offline ?? nodes.filter((n) => n.status === 'offline').length}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-xs font-medium text-neutral-500">Total Tenant Capacity</span>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {fleetSummary?.totalCapacity ??
                  nodes.reduce((acc, n) => acc + Number(n.maxCapacity || 0), 0)}
              </p>
            </div>
          </div>

          {/* Search, Filters & Table */}
          <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-col gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={fleetSearch}
                    onChange={(e) => {
                      setFleetSearch(e.target.value);
                      setFleetPage(1);
                    }}
                    placeholder="Search host, IP, node name..."
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                <select
                  value={panelFilter}
                  onChange={(e) => {
                    setPanelFilter(e.target.value);
                    setFleetPage(1);
                  }}
                  className="h-9 rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="">All Control Panels</option>
                  {PANEL_TYPES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={regionFilter}
                  onChange={(e) => {
                    setRegionFilter(e.target.value);
                    setFleetPage(1);
                  }}
                  placeholder="Region (e.g. ap-south-1)"
                  className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />

                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setFleetPage(1);
                    }}
                    className="h-9 flex-1 rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="unprobed">Unprobed</option>
                  </select>

                  <button
                    type="button"
                    disabled={batchProbing || nodes.length === 0}
                    onClick={handleProbeBatch}
                    title="Ping / Probe all nodes on this page"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-xs font-semibold text-neutral-800 transition hover:border-[#1ED760] hover:bg-[#1ED760] hover:text-black disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    <Radio className={`h-3.5 w-3.5 ${batchProbing ? 'animate-pulse' : ''}`} />
                    {batchProbing ? 'Probing...' : 'Probe Page'}
                  </button>
                </div>
              </div>
            </div>

            {fleetError && (
              <div className="m-4 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
                {fleetError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                    <th className="px-4 py-3">Node / Host</th>
                    <th className="px-3 py-3">Panel Type</th>
                    <th className="px-3 py-3">Region</th>
                    <th className="px-3 py-3">Hardware / Capacity</th>
                    <th className="px-3 py-3 text-center">Connectivity &amp; Latency</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                  {fleetLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                        Loading server fleet...
                      </td>
                    </tr>
                  ) : nodes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                        No server nodes found. Add a node or bulk import CSV/JSON to manage your fleet.
                      </td>
                    </tr>
                  ) : (
                    nodes.map((node) => {
                      const badge = getNodeStatusBadge(node.status);
                      const BadgeIcon = badge.Icon;
                      const panelLabel =
                        PANEL_TYPES.find((p) => p.id === node.panelType)?.label || node.panelType || 'Custom';

                      return (
                        <tr key={node.id} className="align-top hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-neutral-950 dark:text-white">
                              {node.name || node.host}
                            </div>
                            <div className="font-mono text-[11px] text-neutral-500">
                              {node.host} · {node.ip || 'No IP'}:{node.port || '—'}
                            </div>
                            {node.panelUrl && (
                              <a
                                href={node.panelUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 inline-block font-mono text-[10px] text-emerald-700 hover:underline dark:text-[#1ED760]"
                              >
                                {node.panelUrl}
                              </a>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                              {panelLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-neutral-600 dark:text-neutral-300">
                            {node.region || '—'}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                            <div>
                              {node.cpuCores ?? '—'} vCPU · {node.ramGb ?? '—'} GB RAM · {node.diskGb ?? '—'} GB Disk
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              Load: {node.currentTenants ?? 0} / {node.maxCapacity ?? '—'} tenants
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${badge.cls}`}
                              >
                                <BadgeIcon className="h-3 w-3" />
                                {badge.label}
                                {node.latencyMs != null && ` · ${node.latencyMs} ms`}
                              </span>
                              {node.lastError && (
                                <span
                                  className="max-w-[190px] truncate text-[10px] text-rose-600 dark:text-rose-400"
                                  title={node.lastError}
                                >
                                  {node.lastError}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={probingId === node.id}
                                onClick={() => handleProbeNode(node)}
                                title="Run real-time ping/probe"
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-[#1ED760] hover:bg-[#1ED760] hover:text-black disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                              >
                                <Radio className={`h-3 w-3 ${probingId === node.id ? 'animate-spin' : ''}`} />
                                Ping
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLogs(node)}
                                title="Audit & Probe Logs"
                                className="rounded-lg border border-neutral-200/80 p-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                <History className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditNodeModal(node)}
                                title="Edit node"
                                className="rounded-lg border border-neutral-200/80 p-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(node)}
                                title="Delete node"
                                className="rounded-lg border border-neutral-200/80 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-neutral-800 dark:hover:bg-rose-950/30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200/80 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {fleetPage} of {totalPages} ({fleetTotal} total nodes)
                </span>
                <select
                  value={fleetPageSize}
                  onChange={(e) => {
                    setFleetPageSize(Number(e.target.value));
                    setFleetPage(1);
                  }}
                  className="h-7 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  {[25, 50, 100].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={fleetPage <= 1}
                  onClick={() => setFleetPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={fleetPage >= totalPages}
                  onClick={() => setFleetPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Telemetry Tab */}
      {activeTab === 'telemetry' && (
        <div className="space-y-4">
          {telemetryError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {telemetryError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* CPU */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">CPU Load &amp; Cores</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                  <Cpu className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {telemetryLoading ? '—' : cpuCores != null ? `${cpuCores} Cores` : 'Unavailable'}
              </p>
              <p className="mt-1 text-xs tabular-nums text-neutral-500">
                Load Avg: <span className="font-mono text-neutral-800 dark:text-neutral-200">{loadAvg ?? 'Unavailable'}</span>
              </p>
            </div>

            {/* OS RAM */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">OS RAM (Used / Total)</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <MemoryStick className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {telemetryLoading ? '—' : ramUsedText && ramTotalText ? `${ramUsedText} / ${ramTotalText}` : 'Unavailable'}
              </p>
              {ramPercent != null && (
                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#1ED760]"
                      style={{ width: `${Math.min(100, Math.max(0, Number(ramPercent)))}%` }}
                    />
                  </div>
                  <p className="text-[11px] tabular-nums text-neutral-500">{ramPercent}% allocated</p>
                </div>
              )}
            </div>

            {/* Uptime & Node.js */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Server Uptime &amp; Node.js</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <Activity className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {telemetryLoading ? '—' : uptimeText || 'Unavailable'}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Node: <span className="font-mono text-neutral-800 dark:text-neutral-200">{nodeVersion || 'Unavailable'}</span>
              </p>
            </div>

            {/* PostgreSQL */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">PostgreSQL Database</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                  <Database className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {telemetryLoading ? '—' : pgSize || 'Unavailable'}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
                <p>Version: <span className="font-mono text-neutral-800 dark:text-neutral-200">{pgVersion || 'Unavailable'}</span></p>
                <p>Active Connections: <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{pgConnections ?? 'Unavailable'}</span></p>
              </div>
            </div>

            {/* Media Disk */}
            <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Local Media Disk Usage</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <HardDrive className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {telemetryLoading ? '—' : mediaSize || 'Unavailable'}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Stored Files: <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{mediaFiles ?? 'Unavailable'}</span>
              </p>
            </div>

            {/* Cloud Droplets Status */}
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Cloud Droplets</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-200/70 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {providerConnected ? <CheckCircle2 className="h-4 w-4 text-[#1ED760]" /> : <CloudOff className="h-4 w-4" />}
                </span>
              </div>
              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    providerConnected
                      ? 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                      : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {providerConnected ? `${droplets.length} Active Droplets` : 'External Cloud Provider not connected'}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {providerConnected
                  ? 'Cloud provider provisioning API is active.'
                  : telemetry?.message || 'External Cloud Provider not connected.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connectivity Guide Tab */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              title: 'Tiwlo Panel Agent (Port 8443)',
              steps: [
                'Install the Tiwlo Panel daemon on Ubuntu/Debian/AlmaLinux and generate a cluster API token.',
                'Ensure TCP port 8443 (HTTPS) is reachable from the primary control plane.',
                'Add the node using Panel Type "Tiwlo Panel" and click Ping to verify live TLS handshake & latency.',
              ],
            },
            {
              title: 'cPanel / WHM (Port 2087)',
              steps: [
                'Create a WHM API Token in WHM → Development → Manage API Tokens with acctinfo & createacct scopes.',
                'Set Panel URL to https://hostname:2087 and paste the WHM API token into Auth Token.',
                'Click Ping to validate live connectivity and monitor account capacity.',
              ],
            },
            {
              title: 'KVM Hypervisor / Dedicated Droplet (Port 22 / 8006)',
              steps: [
                'Expose the hypervisor management API or SSH health endpoint on the designated port.',
                'Provide host, IP, CPU/RAM/Disk allocation, and max tenant capacity.',
                'Use Bulk Import (CSV/JSON) to register hundreds or thousands of hypervisor nodes in one batch.',
              ],
            },
            {
              title: 'Plesk / DirectAdmin / Custom Panels',
              steps: [
                'Plesk Obsidian defaults to port 8443; DirectAdmin defaults to port 2222.',
                'Use API Key / Login Key tokens rather than root passwords for automated probing.',
                'Review per-node probe & configuration history anytime via the node Logs drawer.',
              ],
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Terminal className="h-4 w-4 text-[#1ED760]" />
                {card.title}
              </div>
              <ul className="mt-3 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                {card.steps.map((s, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-mono font-semibold text-neutral-400">{idx + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Node Modal */}
      {nodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <form
            onSubmit={handleSaveNode}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                {editingNode ? 'Edit Server Node' : 'Add Control Panel / Server Node'}
              </h3>
              <button
                type="button"
                onClick={() => setNodeModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Node Name
                </label>
                <input
                  type="text"
                  required
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="sgp-node-01"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Panel Type
                </label>
                <select
                  value={nodeForm.panelType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const meta = PANEL_TYPES.find((p) => p.id === nextType);
                    setNodeForm((f) => ({
                      ...f,
                      panelType: nextType,
                      port: meta?.defaultPort ?? f.port,
                    }));
                  }}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {PANEL_TYPES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Hostname
                </label>
                <input
                  type="text"
                  required
                  value={nodeForm.host}
                  onChange={(e) => setNodeForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="node01.tiwlo.net"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    IP Address
                  </label>
                  <input
                    type="text"
                    required
                    value={nodeForm.ip}
                    onChange={(e) => setNodeForm((f) => ({ ...f, ip: e.target.value }))}
                    placeholder="203.0.113.10"
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Port
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    required
                    value={nodeForm.port}
                    onChange={(e) => setNodeForm((f) => ({ ...f, port: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Control Panel URL
                </label>
                <input
                  type="url"
                  value={nodeForm.panelUrl}
                  onChange={(e) => setNodeForm((f) => ({ ...f, panelUrl: e.target.value }))}
                  placeholder="https://node01.tiwlo.net:8443"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  API / Auth Token {editingNode ? '(leave blank to keep)' : ''}
                </label>
                <input
                  type="password"
                  value={nodeForm.authToken}
                  onChange={(e) => setNodeForm((f) => ({ ...f, authToken: e.target.value }))}
                  placeholder="Bearer / WHM / Panel API token"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Region
                </label>
                <input
                  type="text"
                  value={nodeForm.region}
                  onChange={(e) => setNodeForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="ap-south-1 / us-east-1 / eu-central-1"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    CPU Cores
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nodeForm.cpuCores}
                    onChange={(e) => setNodeForm((f) => ({ ...f, cpuCores: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    RAM (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nodeForm.ramGb}
                    onChange={(e) => setNodeForm((f) => ({ ...f, ramGb: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Disk (GB)
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={nodeForm.diskGb}
                    onChange={(e) => setNodeForm((f) => ({ ...f, diskGb: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nodeForm.maxCapacity}
                    onChange={(e) => setNodeForm((f) => ({ ...f, maxCapacity: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setNodeModalOpen(false)}
                className="rounded-xl border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#1ED760] px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingNode ? 'Save Changes' : 'Add Server Node'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <form
            onSubmit={handleBulkImport}
            className="w-full max-w-2xl space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Bulk Import Server Fleet (JSON or CSV)
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Import hundreds or thousands of servers in one request (`POST /api/admin/fleet/nodes/bulk`).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 font-mono text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              CSV columns: name,host,ip,port,panelType,panelUrl,region,cpuCores,ramGb,diskGb,maxCapacity,authToken
            </div>

            <textarea
              rows={8}
              required
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={'name,host,ip,port,panelType,panelUrl,region,cpuCores,ramGb,diskGb,maxCapacity\nsgp-01,sgp01.tiwlo.net,203.0.113.10,8443,tiwlo_panel,https://sgp01.tiwlo.net:8443,ap-southeast-1,8,32,500,300'}
              className="w-full rounded-xl border border-neutral-200/80 bg-white p-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />

            <div className="flex justify-end gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="rounded-xl border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#1ED760] px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
              >
                {saving ? 'Importing...' : 'Import Fleet Nodes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Node Logs Drawer */}
      {logsDrawerNode && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-2xs">
          <div className="flex h-full w-full max-w-lg flex-col border-l border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-200/80 p-5 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Probe &amp; Config Logs · {logsDrawerNode.name || logsDrawerNode.host}
                </h3>
                <p className="font-mono text-[11px] text-neutral-500">
                  {logsDrawerNode.ip}:{logsDrawerNode.port}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogsDrawerNode(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
              {logsLoading ? (
                <p className="py-10 text-center text-xs text-neutral-400">Loading node logs...</p>
              ) : nodeLogs.length === 0 ? (
                <p className="py-10 text-center text-xs text-neutral-400">
                  No probe or configuration events recorded for this node yet.
                </p>
              ) : (
                nodeLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                        {log.event || log.action || log.status || 'probe'}
                      </span>
                      <span className="tabular-nums text-[11px] text-neutral-500">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    {(log.message || log.error || log.latencyMs != null) && (
                      <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        {log.message || log.error || `Latency: ${log.latencyMs} ms`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
