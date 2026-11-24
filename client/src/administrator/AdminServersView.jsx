import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import { sanitizeHttpUrl } from '../utils/safeHtml.js';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  Copy,
  Cpu,
  Database,
  FileSpreadsheet,
  Globe,
  HardDrive,
  History,
  KeyRound,
  Lock,
  MemoryStick,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Sparkles,
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

const PANEL_LABELS = {
  ubuntu_node: 'Ubuntu Cluster Node',
  tiwlo_panel: 'Tiwlo Panel',
  cpanel_whm: 'cPanel / WHM',
  kvm_hypervisor: 'KVM Hypervisor',
  plesk: 'Plesk Obsidian',
  directadmin: 'DirectAdmin',
  docker_swarm: 'Docker Swarm',
  kubernetes_node: 'Kubernetes Node',
  custom_panel: 'Custom / Dedicated',
};

const FILTER_PANEL_TYPES = Object.entries(PANEL_LABELS).map(([id, label]) => ({ id, label }));

const EMPTY_NODE_FORM = {
  name: '',
  hostname: '',
  ipAddress: '',
  ipv6Address: '',
  sshPort: 22,
  sshUser: 'root',
  sshPassword: '',
  sshPrivateKey: '',
  apiPort: 9443,
  panelUrl: '',
  bearerToken: '',
  region: 'sgp1',
  cpuCores: 4,
  ramGb: 16,
  storageGb: 200,
  maxDroplets: 100,
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
  if (s === 'degraded') {
    return {
      label: 'degraded',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      Icon: AlertTriangle,
    };
  }
  if (s === 'maintenance') {
    return {
      label: 'maintenance',
      cls: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      Icon: Clock,
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
    label: status || 'unknown',
    cls: 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    Icon: Radio,
  };
}

function normalizeBulkRow(raw = {}) {
  const mapped = { ...raw };
  if (!mapped.hostname && mapped.host) mapped.hostname = mapped.host;
  if (!mapped.ipAddress && mapped.ip) mapped.ipAddress = mapped.ip;
  if (mapped.apiPort == null && mapped.port != null) mapped.apiPort = mapped.port;
  if (mapped.storageGb == null && mapped.diskGb != null) mapped.storageGb = mapped.diskGb;
  if (mapped.maxDroplets == null && mapped.maxCapacity != null) mapped.maxDroplets = mapped.maxCapacity;
  if (!mapped.bearerToken && mapped.authToken) mapped.bearerToken = mapped.authToken;
  if (!mapped.panelType) mapped.panelType = 'ubuntu_node';
  delete mapped.host;
  delete mapped.ip;
  delete mapped.port;
  delete mapped.diskGb;
  delete mapped.maxCapacity;
  delete mapped.authToken;
  return mapped;
}

function parseBulkServerInput(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(normalizeBulkRow);
  }
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const firstCols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const hasHeader =
    firstCols.includes('hostname') ||
    firstCols.includes('host') ||
    firstCols.includes('ipaddress') ||
    firstCols.includes('ip') ||
    firstCols.includes('name');
  const headers = hasHeader
    ? lines[0].split(',').map((c) => c.trim())
    : ['name', 'hostname', 'ipAddress', 'apiPort', 'sshPort', 'region', 'cpuCores', 'ramGb', 'storageGb', 'maxDroplets', 'bearerToken'];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => {
      if (cols[i] !== undefined && cols[i] !== '') {
        if (['port', 'apiPort', 'sshPort', 'cpuCores', 'ramGb', 'diskGb', 'storageGb', 'maxCapacity', 'maxDroplets'].includes(h)) {
          const num = Number(cols[i]);
          if (Number.isFinite(num)) obj[h] = num;
        } else {
          obj[h] = cols[i];
        }
      }
    });
    return normalizeBulkRow(obj);
  });
}

export default function AdminServersView({ onBackToDashboard, showToast }) {
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'telemetry' | 'guide'

  // Host Telemetry state
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState('');

  // Fleet & Live Cluster state
  const [nodes, setNodes] = useState([]);
  const [fleetTotal, setFleetTotal] = useState(0);
  const [fleetPage, setFleetPage] = useState(1);
  const [fleetPageSize, setFleetPageSize] = useState(25);
  const [fleetSummary, setFleetSummary] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupUpdating, setBackupUpdating] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [fleetSearch, setFleetSearch] = useState('');
  const [panelFilter, setPanelFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fleetLoading, setFleetLoading] = useState(true);
  const [fleetError, setFleetError] = useState('');

  // Modals / Drawers / Interactive UI state
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [nodeForm, setNodeForm] = useState(EMPTY_NODE_FORM);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [logsDrawerNode, setLogsDrawerNode] = useState(null);
  const [nodeLogs, setNodeLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [probingId, setProbingId] = useState('');
  const [batchProbing, setBatchProbing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedIp, setCopiedIp] = useState('');

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
    const needsReauth =
      (res.status === 403 || res.status === 428) &&
      (json.reauthRequired ||
        json.error === 'RECENT_VERIFICATION_REQUIRED' ||
        /reauth|verification|grant/i.test(json.error || json.message || ''));
    if (needsReauth) {
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      res = await fetch(url, { credentials: 'include', ...options, headers });
      json = await res.json().catch(() => ({}));
    }
    return { res, json };
  }, [getHeaders]);

  const fetchLiveStatus = useCallback(async () => {
    const token = localStorage.getItem('stockpro_session');
    const res = await fetch(`${API_BASE}/admin/fleet/live-status`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Live status unavailable (${res.status}).`);
    }
    setLiveStatus(data);
    if (typeof data?.automation?.backupEnabled === 'boolean') {
      setBackupEnabled(data.automation.backupEnabled);
    }
    setLastSyncedAt(new Date().toISOString());
    return data;
  }, []);

  const fetchFleetNodes = useCallback(async () => {
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
    setNodes(Array.isArray(data.nodes) ? data.nodes : []);
    setFleetTotal(Number(data.pagination?.total ?? data.total ?? 0));
    setFleetSummary(data.summary || null);
    setFleetError('');
    return data;
  }, [fleetPage, fleetPageSize, fleetSearch, panelFilter, regionFilter, statusFilter]);

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

  // Load Fleet Nodes & Live Status on mount / filter / reloadTick
  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      try {
        const [nodesRes, liveRes] = await Promise.allSettled([
          fetchFleetNodes(),
          fetchLiveStatus(),
        ]);
        if (!active) return;
        if (nodesRes.status === 'rejected') {
          setNodes([]);
          setFleetError(nodesRes.reason?.message || 'Fleet nodes could not be loaded.');
        }
        if (liveRes.status === 'rejected' && nodesRes.status === 'rejected') {
          setFleetError(liveRes.reason?.message || 'Fleet live status unavailable.');
        }
      } finally {
        if (active) setFleetLoading(false);
      }
    };
    loadAll();
    return () => {
      active = false;
    };
  }, [fetchFleetNodes, fetchLiveStatus, reloadTick]);

  // 15-second live auto-refresh for cluster status and node table
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveStatus().catch(() => {});
      fetchFleetNodes().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchLiveStatus, fetchFleetNodes]);

  const handleRefreshAll = () => {
    setTelemetryLoading(true);
    setFleetLoading(true);
    setReloadTick((t) => t + 1);
  };

  const handleToggleBackup = async () => {
    if (backupUpdating) return;
    const nextValue = !backupEnabled;
    try {
      setBackupUpdating(true);
      const { res, json } = await fetchWithOptionalReauth(`${API_BASE}/admin/fleet/automation`, {
        method: 'PATCH',
        body: JSON.stringify({ backupEnabled: nextValue }),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to update backup setting.');
      }
      const confirmed =
        typeof json?.automation?.backupEnabled === 'boolean'
          ? json.automation.backupEnabled
          : nextValue;
      setBackupEnabled(confirmed);
      setLiveStatus((prev) =>
        prev
          ? {
              ...prev,
              automation: {
                ...(prev.automation || {}),
                ...(json.automation || {}),
                backupEnabled: confirmed,
              },
            }
          : prev
      );
      showToast?.(
        confirmed
          ? 'Cluster Backups activated.'
          : 'Cluster Backups turned off (saving storage).',
        'success'
      );
    } catch (err) {
      showToast?.(err.message || 'Could not toggle cluster backups.', 'error');
    } finally {
      setBackupUpdating(false);
    }
  };

  const handleCopyAddress = async (addr) => {
    if (!addr) return;
    try {
      await navigator.clipboard?.writeText(addr);
      setCopiedIp(addr);
      showToast?.(`Copied ${addr}`, 'success');
      setTimeout(() => setCopiedIp((cur) => (cur === addr ? '' : cur)), 1600);
    } catch {
      showToast?.(`Address: ${addr}`, 'info');
    }
  };

  const openAddNodeModal = () => {
    setEditingNode(null);
    setNodeForm(EMPTY_NODE_FORM);
    setShowAdvancedFields(false);
    setNodeModalOpen(true);
  };

  const openEditNodeModal = (node) => {
    setEditingNode(node);
    setNodeForm({
      name: node.name || '',
      hostname: node.hostname || '',
      ipAddress: node.ipAddress || '',
      ipv6Address: node.ipv6Address || '',
      sshPort: node.sshPort ?? 22,
      sshUser: 'root',
      sshPassword: '',
      sshPrivateKey: '',
      apiPort: node.apiPort ?? 9443,
      panelUrl: node.panelUrl || '',
      bearerToken: '',
      region: node.region || 'sgp1',
      cpuCores: node.cpuCores ?? 4,
      ramGb: node.ramGb ?? 16,
      storageGb: node.storageGb ?? 200,
      maxDroplets: node.maxDroplets ?? 100,
    });
    setShowAdvancedFields(true);
    setNodeModalOpen(true);
  };

  const isSshAutoLinkMode =
    !editingNode &&
    Boolean(nodeForm.sshPassword.trim() || nodeForm.sshPrivateKey.trim());

  const handleSaveNode = async (e) => {
    e.preventDefault();
    try {
      const cleanIp = nodeForm.ipAddress.trim();
      if (!cleanIp) {
        showToast?.('IP Address is required.', 'error');
        return;
      }

      setSaving(true);

      if (isSshAutoLinkMode) {
        const sshPayload = {
          ...(nodeForm.name.trim() ? { name: nodeForm.name.trim() } : {}),
          ...(nodeForm.hostname.trim() ? { hostname: nodeForm.hostname.trim() } : {}),
          ipAddress: cleanIp,
          sshPort: Number(nodeForm.sshPort || 22),
          sshUser: nodeForm.sshUser.trim() || 'root',
          ...(nodeForm.sshPassword.trim() ? { sshPassword: nodeForm.sshPassword } : {}),
          ...(nodeForm.sshPrivateKey.trim() ? { sshPrivateKey: nodeForm.sshPrivateKey.trim() } : {}),
          apiPort: Number(nodeForm.apiPort || 9443),
          region: nodeForm.region.trim() || 'sgp1',
          installAgent: true,
        };
        const { res, json } = await fetchWithOptionalReauth(`${API_BASE}/admin/fleet/nodes/link-ssh`, {
          method: 'POST',
          body: JSON.stringify(sshPayload),
        });
        if (!res.ok || json.success === false) {
          throw new Error(json.error || json.message || 'SSH auto-link onboarding failed.');
        }
        const linked = json.node || {};
        const tel = json.telemetry || {};
        showToast?.(
          `Auto-linked ${linked.name || cleanIp} (${tel.cpuCores ?? linked.cpuCores ?? '?'} vCPU, ${tel.ramGb ?? linked.ramGb ?? '?'} GB RAM, ${tel.storageGb ?? linked.storageGb ?? '?'} GB Disk) — Online`,
          'success'
        );
        setNodeModalOpen(false);
        handleRefreshAll();
        return;
      }

      const cleanName = nodeForm.name.trim();
      const cleanHost = nodeForm.hostname.trim();
      if (!cleanName || !cleanHost) {
        showToast?.(
          'Hostname and Node Name are required for manual registration (or provide SSH Password / Private Key to auto-discover).',
          'error'
        );
        return;
      }

      const payload = {
        name: cleanName,
        hostname: cleanHost,
        ipAddress: cleanIp,
        ...(nodeForm.ipv6Address.trim() ? { ipv6Address: nodeForm.ipv6Address.trim() } : {}),
        panelType: editingNode ? (editingNode.panelType || 'ubuntu_node') : 'ubuntu_node',
        apiPort: Number(nodeForm.apiPort || 9443),
        sshPort: Number(nodeForm.sshPort || 22),
        panelUrl: nodeForm.panelUrl.trim() || null,
        region: nodeForm.region.trim() || 'sgp1',
        cpuCores: Number(nodeForm.cpuCores || 1),
        ramGb: Number(nodeForm.ramGb || 1),
        storageGb: Number(nodeForm.storageGb || 10),
        maxDroplets: Number(nodeForm.maxDroplets || 100),
        ...(nodeForm.bearerToken.trim() ? { bearerToken: nodeForm.bearerToken.trim() } : {}),
      };

      const url = editingNode
        ? `${API_BASE}/admin/fleet/nodes/${encodeURIComponent(editingNode.id)}`
        : `${API_BASE}/admin/fleet/nodes`;
      const method = editingNode ? 'PATCH' : 'POST';

      const { res, json } = await fetchWithOptionalReauth(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Could not save server node.');
      }
      showToast?.(editingNode ? 'Server node updated.' : 'Server node added to cluster fleet.', 'success');
      setNodeModalOpen(false);
      handleRefreshAll();
    } catch (err) {
      showToast?.(err.message || 'Failed to save server node.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNode = async (node) => {
    if (node.isPrimary || node.id === 'primary-ubuntu-node') {
      showToast?.('Primary Cluster Master Host is locked and cannot be deleted.', 'error');
      return;
    }
    try {
      setSaving(true);
      const { res, json } = await fetchWithOptionalReauth(
        `${API_BASE}/admin/fleet/nodes/${encodeURIComponent(node.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to delete server node.');
      }
      showToast?.(`Removed ${node.name || node.hostname} from fleet.`, 'success');
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
        throw new Error(json.error || json.message || 'Bulk import failed.');
      }
      showToast?.(`Imported ${json.imported ?? json.importedCount ?? json.count ?? parsedNodes.length} server nodes.`, 'success');
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
        throw new Error(json.error || json.message || 'Probe failed.');
      }
      const updated = json.node || {};
      const probe = json.probe || {};
      const nextStatus = updated.status || probe.status || node.status;
      const nextLatency = updated.lastLatencyMs ?? probe.latencyMs ?? node.lastLatencyMs;
      const nextError = updated.lastProbeError ?? probe.errorMessage ?? null;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? {
                ...n,
                ...updated,
                status: nextStatus,
                lastLatencyMs: nextLatency,
                lastProbeError: nextError,
                lastHeartbeatAt: updated.lastHeartbeatAt || new Date().toISOString(),
              }
            : n
        )
      );
      fetchLiveStatus().catch(() => {});
      showToast?.(
        `Probe ${node.name || node.hostname}: ${nextStatus}${nextLatency != null ? ` (${nextLatency} ms)` : ''}`,
        nextStatus === 'offline' ? 'error' : 'success'
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
        throw new Error(json.error || json.message || 'Batch probe failed.');
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

  // Cluster summary & automation metrics
  const summary = fleetSummary || liveStatus?.summary || {};
  const automation = liveStatus?.automation || {};
  const activeAlerts = Array.isArray(automation.activeAlerts) ? automation.activeAlerts : [];

  const totalNodesCount = summary.total ?? fleetTotal;
  const onlineNodesCount = summary.online ?? nodes.filter((n) => n.status === 'online').length;
  const offlineNodesCount = summary.offline ?? nodes.filter((n) => n.status === 'offline').length;
  const totalCpuCores = summary.totalCpuCores ?? nodes.reduce((acc, n) => acc + Number(n.cpuCores || 0), 0);
  const onlineCpuCores = summary.onlineCpuCores ?? nodes.filter((n) => n.status === 'online' || n.status === 'degraded').reduce((acc, n) => acc + Number(n.cpuCores || 0), 0);
  const totalRamGb = summary.totalRamGb ?? nodes.reduce((acc, n) => acc + Number(n.ramGb || 0), 0);
  const onlineRamGb = summary.onlineRamGb ?? nodes.filter((n) => n.status === 'online' || n.status === 'degraded').reduce((acc, n) => acc + Number(n.ramGb || 0), 0);
  const totalStorageGb = summary.totalStorageGb ?? nodes.reduce((acc, n) => acc + Number(n.storageGb || 0), 0);
  const totalStorageUsedGb = summary.totalStorageUsedGb ?? 0;
  const totalStorageFreeGb = summary.totalStorageFreeGb ?? totalStorageGb;
  const clusterStoragePct = totalStorageGb > 0
    ? Math.min(100, Math.max(0, Math.round((Number(totalStorageUsedGb) / Number(totalStorageGb)) * 100)))
    : 0;

  const totalPages = Math.max(1, Math.ceil(fleetTotal / fleetPageSize));

  return (
    <div className="space-y-5">
      {/* Header & Top Control Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:flex-row lg:items-center">
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
            Server &amp; System Status
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Autonomous multi-server hardware pool, one-click SSH node onboarding, failover engine, and live host telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Cluster Backup Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={backupEnabled}
            disabled={backupUpdating}
            onClick={handleToggleBackup}
            title="Toggle automated cluster-wide backups (requires security verification)"
            className={`inline-flex h-9 items-center gap-2.5 rounded-xl border px-3 text-xs font-semibold transition disabled:opacity-60 ${
              backupEnabled
                ? 'border-[#1ED760]/40 bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760]'
                : 'border-neutral-200/80 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <span
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                backupEnabled ? 'bg-[#1ED760]' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  backupEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span>
              {backupUpdating
                ? 'Updating Backups...'
                : backupEnabled
                  ? 'Cluster Backups: Active'
                  : 'Cluster Backups: Off (Saving Storage)'}
            </span>
          </button>

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
          { id: 'fleet', label: `Cluster Fleet (${fleetTotal})`, icon: Server },
          { id: 'telemetry', label: 'Host & DB Telemetry', icon: Activity },
          { id: 'guide', label: 'Auto-Link & Cluster Guide', icon: BookOpen },
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
          {/* Cluster Hardware Pool Summary Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Connected Servers</span>
                <Server className="h-4 w-4 text-[#1ED760]" />
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {onlineNodesCount}{' '}
                <span className="text-sm font-normal text-neutral-400">/ {totalNodesCount}</span>
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                {offlineNodesCount > 0 ? (
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {offlineNodesCount} offline
                  </span>
                ) : (
                  <span className="text-emerald-700 dark:text-[#1ED760]">All nodes healthy</span>
                )}
                {summary.avgLatencyMs != null ? ` · ${summary.avgLatencyMs} ms avg` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Total Cluster CPU Cores</span>
                <Cpu className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {totalCpuCores} <span className="text-sm font-normal text-neutral-400">vCPU</span>
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                <span className="font-semibold text-emerald-700 dark:text-[#1ED760]">{onlineCpuCores}</span> online cores available
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Total Cluster RAM</span>
                <MemoryStick className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {totalRamGb} <span className="text-sm font-normal text-neutral-400">GB</span>
              </p>
              <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                <span className="font-semibold text-emerald-700 dark:text-[#1ED760]">{onlineRamGb} GB</span> online RAM pooled
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Total Cluster Storage</span>
                <HardDrive className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {totalStorageGb} <span className="text-sm font-normal text-neutral-400">GB</span>
              </p>
              <div className="mt-1.5 space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-[#1ED760]"
                    style={{ width: `${clusterStoragePct}%` }}
                  />
                </div>
                <p className="text-[11px] tabular-nums text-neutral-500">
                  {totalStorageUsedGb} GB used / {totalStorageFreeGb} GB free
                </p>
              </div>
            </div>
          </div>

          {/* Autonomous Cluster Engine Banner */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ED760]/30 bg-[#1ED760]/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Autonomous Cluster Engine
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 font-mono text-[11px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Policy: {automation.loadBalancingPolicy || 'weighted_least_load_overflow'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Auto-Failovers:{' '}
                  <strong className="tabular-nums text-neutral-950 dark:text-white">
                    {automation.autoFailoverCount ?? 0}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  Self-Healed:{' '}
                  <strong className="tabular-nums text-emerald-700 dark:text-[#1ED760]">
                    {automation.selfHealedCount ?? 0}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 font-mono text-[11px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <Globe className="h-3 w-3 text-neutral-400" />
                  TZ: {automation.timezone || 'UTC'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/30 bg-[#1ED760]/10 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:text-[#1ED760]">
                  <CheckCircle2 className="h-3 w-3" />
                  Auto-Log Pruning: {automation.autoLogPruningEnabled !== false ? 'Active' : 'Off'}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#1ED760]" />
                  15s Auto-Refresh Active
                </span>
                {lastSyncedAt && (
                  <span className="tabular-nums text-neutral-400">
                    Synced {new Date(lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {activeAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Active Offline Alerts ({activeAlerts.length})
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {activeAlerts.map((alert, idx) => (
                    <div
                      key={`${alert.nodeId || idx}-${alert.type || 'alert'}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold">{alert.nodeName || alert.nodeId}</span>
                        <span className="mx-1.5 text-rose-400">·</span>
                        <span>
                          {alert.failoverTargetName
                            ? `Failover routed to ${alert.failoverTargetName}`
                            : 'Node offline — awaiting recovery'}
                        </span>
                      </div>
                      {alert.at && (
                        <span className="shrink-0 font-mono text-[10px] text-rose-500">
                          {new Date(alert.at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                    placeholder="Search hostname, IP, node name..."
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
                  <option value="">All Node Types</option>
                  {FILTER_PANEL_TYPES.map((p) => (
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
                  placeholder="Region (e.g. sgp1, bd1)"
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
                    <option value="degraded">Degraded</option>
                    <option value="offline">Offline</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="unknown">Unknown</option>
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
              <table className="w-full min-w-[1060px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                    <th className="px-4 py-3">Node / Host &amp; Network IPs</th>
                    <th className="px-3 py-3">OS / Region</th>
                    <th className="px-3 py-3">Hardware &amp; Storage</th>
                    <th className="px-3 py-3 text-center">Connectivity &amp; Latency</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                  {fleetLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                        Loading server fleet...
                      </td>
                    </tr>
                  ) : nodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                        No server nodes found. Click Add Server Node to link an Ubuntu server via SSH or register manually.
                      </td>
                    </tr>
                  ) : (
                    nodes.map((node) => {
                      const badge = getNodeStatusBadge(node.status);
                      const BadgeIcon = badge.Icon;
                      const isPrimaryNode = Boolean(node.isPrimary || node.id === 'primary-ubuntu-node');
                      const ipv4List = Array.isArray(node.networkAddresses?.ipv4) && node.networkAddresses.ipv4.length > 0
                        ? node.networkAddresses.ipv4
                        : (node.ipAddress ? [node.ipAddress] : []);
                      const ipv6List = Array.isArray(node.networkAddresses?.ipv6) && node.networkAddresses.ipv6.length > 0
                        ? node.networkAddresses.ipv6
                        : (node.ipv6Address ? [node.ipv6Address] : []);
                      const osLabel = node.detectedOsName || node.detectedOsId || PANEL_LABELS[node.panelType] || node.panelType || 'Linux Node';

                      const storageGb = Number(node.storageGb || 0);
                      const storageFreeGb = node.storageFreeGb != null ? Number(node.storageFreeGb) : null;
                      const storageUsedGb = node.storageUsedGb != null
                        ? Number(node.storageUsedGb)
                        : (storageFreeGb != null ? Math.max(0, Number((storageGb - storageFreeGb).toFixed(1))) : null);
                      const storageUsedPct =
                        storageGb > 0 && storageUsedGb != null
                          ? Math.min(100, Math.max(0, Math.round((storageUsedGb / storageGb) * 100)))
                          : null;

                      return (
                        <tr key={node.id} className="align-top hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40">
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-neutral-950 dark:text-white">
                                {node.name || node.hostname}
                              </span>
                              {isPrimaryNode && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-[#1ED760]">
                                  <Lock className="h-2.5 w-2.5" />
                                  Primary Master Host (Locked)
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                              {node.hostname || '—'} · API :{node.apiPort ?? 9443} · SSH :{node.sshPort ?? 22}
                            </div>

                            {/* All detected IPv4 and IPv6 addresses */}
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {ipv4List.map((v4) => (
                                <button
                                  key={`v4-${v4}`}
                                  type="button"
                                  onClick={() => handleCopyAddress(v4)}
                                  title="Click to copy IPv4 address"
                                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 transition hover:border-[#1ED760] hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                >
                                  <span className="font-semibold text-emerald-700 dark:text-[#1ED760]">IPv4</span>
                                  <span>{v4}</span>
                                  {copiedIp === v4 ? <Check className="h-2.5 w-2.5 text-[#1ED760]" /> : <Copy className="h-2.5 w-2.5 opacity-50" />}
                                </button>
                              ))}
                              {ipv6List.map((v6) => (
                                <button
                                  key={`v6-${v6}`}
                                  type="button"
                                  onClick={() => handleCopyAddress(v6)}
                                  title="Click to copy IPv6 address"
                                  className="inline-flex max-w-[230px] items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 transition hover:border-[#1ED760] hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                                >
                                  <span className="shrink-0 font-semibold text-sky-600 dark:text-sky-400">IPv6</span>
                                  <span className="truncate">{v6}</span>
                                  {copiedIp === v6 ? <Check className="h-2.5 w-2.5 shrink-0 text-[#1ED760]" /> : <Copy className="h-2.5 w-2.5 shrink-0 opacity-50" />}
                                </button>
                              ))}
                              {ipv4List.length === 0 && ipv6List.length === 0 && (
                                <span className="font-mono text-[10px] text-neutral-400">No IP detected</span>
                              )}
                            </div>

                            {(() => {
                              const safePanelUrl = sanitizeHttpUrl(node.panelUrl);
                              return safePanelUrl ? (
                                <a
                                  href={safePanelUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block font-mono text-[10px] text-emerald-700 hover:underline dark:text-[#1ED760]"
                                >
                                  {safePanelUrl}
                                </a>
                              ) : null;
                            })()}
                          </td>

                          <td className="px-3 py-3">
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                                <Terminal className="h-3 w-3 text-[#1ED760]" />
                                {osLabel}
                              </span>
                              <div className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                                Region: {node.region || '—'}
                              </div>
                              {node.timezone && (
                                <div className="font-mono text-[10px] text-neutral-500">
                                  TZ: {node.timezone}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                            <div className="font-medium">
                              {node.cpuCores ?? '—'} vCPU · {node.ramGb ?? '—'} GB RAM · {storageGb || '—'} GB Disk
                            </div>

                            {/* Used / Free Storage Bar */}
                            {storageGb > 0 && (
                              <div className="mt-1.5 max-w-[230px] space-y-1">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                                  <div
                                    className={`h-full rounded-full ${
                                      storageUsedPct != null && storageUsedPct > 85
                                        ? 'bg-rose-500'
                                        : 'bg-[#1ED760]'
                                    }`}
                                    style={{ width: `${storageUsedPct ?? 0}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {storageUsedGb != null && storageFreeGb != null
                                    ? `${storageUsedGb} GB used / ${storageFreeGb} GB free`
                                    : `${storageGb} GB allocated`}
                                </div>
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                              <span>
                                Containers: {node.activeDroplets ?? 0} / {node.maxDroplets ?? '—'}
                              </span>
                              {node.loadPct != null && (
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  Load {node.loadPct}%
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${badge.cls}`}
                              >
                                <BadgeIcon className="h-3 w-3" />
                                {badge.label}
                                {node.lastLatencyMs != null && ` · ${node.lastLatencyMs} ms`}
                              </span>
                              {node.lastProbeError && (
                                <span
                                  className="max-w-[190px] truncate text-[10px] text-rose-600 dark:text-rose-400"
                                  title={node.lastProbeError}
                                >
                                  {node.lastProbeError}
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
                              {!isPrimaryNode && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNode(node)}
                                  title="Delete node"
                                  className="rounded-lg border border-neutral-200/80 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-neutral-800 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
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

      {/* Auto-Link & Cluster Guide Tab */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              title: 'One-Click Ubuntu SSH Auto-Link (Zero Config)',
              steps: [
                'Click "Add Server Node" and enter your server IP Address, SSH Port (22), Username (root), and SSH Password or Private Key.',
                'Tiwlo connects over SSH, auto-discovers CPU cores, RAM, NVMe/Disk free & used, OS image, timezone, and all IPv4/IPv6 addresses.',
                'The persistent systemd tiwlo-node-agent is installed on port 9443 and the node immediately joins the cluster pool as Online.',
              ],
            },
            {
              title: 'Weighted Overflow Load Balancing & Pooling',
              steps: [
                'Every connected server contributes CPU, RAM, and free disk capacity into the unified Cluster Hardware Pool.',
                'New workloads use weighted_least_load_overflow scheduling to automatically route around full servers to nodes with free disk and RAM.',
                'Primary Cluster Master Host is locked against accidental deletion and synced continuously with host hardware telemetry.',
              ],
            },
            {
              title: 'Auto-Failover, Self-Healing & Log Pruning',
              steps: [
                'If a node drops offline during automated sweeps, active tenants automatically fail over to the healthiest node with free capacity.',
                'When an offline server recovers, the cluster engine marks it self-healed and clears its active offline alert.',
                'Connectivity & audit logs are automatically pruned so host storage never fills up.',
              ],
            },
            {
              title: 'Cluster Backups Toggle (Storage Saver)',
              steps: [
                'Use the top control bar switch to toggle Cluster Backups between Off (Saving Storage) and Active.',
                'Sensitive changes—including backup toggles, node onboarding, edits, and deletions—are protected by Admin Security PIN re-authentication.',
                'Use Bulk Import (CSV/JSON) when onboarding large server batches.',
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

      {/* Simplified Plug-and-Play Add / Edit Server Node Modal (NO Panel Type Dropdown) */}
      {nodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <form
            onSubmit={handleSaveNode}
            className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {editingNode ? 'Edit Server Node' : 'Add Server Node (Plug & Play)'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {editingNode
                    ? 'Update node network, region, or hardware allocation.'
                    : 'Enter SSH credentials for one-click auto-discovery & systemd agent setup, or expand manual fields.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNodeModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!editingNode && (
              <div className="rounded-xl border border-[#1ED760]/30 bg-[#1ED760]/10 px-3.5 py-2.5 text-[11px] text-neutral-800 dark:text-neutral-200">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-[#1ED760]">
                  <KeyRound className="h-3.5 w-3.5" />
                  {isSshAutoLinkMode
                    ? 'One-Click SSH Auto-Link Active'
                    : 'Optional: Paste SSH Password or Key for Zero-Config Onboarding'}
                </div>
                <p className="mt-0.5 text-neutral-600 dark:text-neutral-300">
                  {isSshAutoLinkMode
                    ? 'Tiwlo will connect via SSH, auto-detect CPU/RAM/Disk/OS/IPv4/IPv6, install the persistent systemd agent, and mark the node Online.'
                    : 'Leave SSH credentials blank only if you want to register manual node metadata below.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Node Label / Name {!isSshAutoLinkMode ? '*' : '(Optional)'}
                </label>
                <input
                  type="text"
                  required={!isSshAutoLinkMode}
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="sgp-ubuntu-01"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Hostname {!isSshAutoLinkMode ? '*' : '(Auto-detected if blank)'}
                </label>
                <input
                  type="text"
                  required={!isSshAutoLinkMode}
                  value={nodeForm.hostname}
                  onChange={(e) => setNodeForm((f) => ({ ...f, hostname: e.target.value }))}
                  placeholder="node01.tiwlo.net"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  IP Address (IPv4) *
                </label>
                <input
                  type="text"
                  required
                  value={nodeForm.ipAddress}
                  onChange={(e) => setNodeForm((f) => ({ ...f, ipAddress: e.target.value }))}
                  placeholder="203.0.113.10"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={nodeForm.sshPort}
                    onChange={(e) => setNodeForm((f) => ({ ...f, sshPort: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
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
                    placeholder="sgp1"
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              {!editingNode && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      SSH Username
                    </label>
                    <input
                      type="text"
                      value={nodeForm.sshUser}
                      onChange={(e) => setNodeForm((f) => ({ ...f, sshUser: e.target.value }))}
                      placeholder="root"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      SSH Password (Optional)
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={nodeForm.sshPassword}
                      onChange={(e) => setNodeForm((f) => ({ ...f, sshPassword: e.target.value }))}
                      placeholder="Root / sudo SSH password"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      SSH Private Key (Optional — PEM / OpenSSH)
                    </label>
                    <textarea
                      rows={3}
                      value={nodeForm.sshPrivateKey}
                      onChange={(e) => setNodeForm((f) => ({ ...f, sshPrivateKey: e.target.value }))}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className="w-full rounded-xl border border-neutral-200/80 bg-white p-2.5 font-mono text-[11px] text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              {!editingNode && !isSshAutoLinkMode && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFields((v) => !v)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-[#1ED760]"
                  >
                    {showAdvancedFields
                      ? 'Hide Manual Hardware & Agent API Fields'
                      : 'Show Manual Hardware & Agent API Fields (for non-SSH registration)'}
                  </button>
                </div>
              )}

              {(editingNode || (!isSshAutoLinkMode && showAdvancedFields)) && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      IPv6 Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={nodeForm.ipv6Address}
                      onChange={(e) => setNodeForm((f) => ({ ...f, ipv6Address: e.target.value }))}
                      placeholder="2001:db8::1"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Agent API Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={nodeForm.apiPort}
                      onChange={(e) => setNodeForm((f) => ({ ...f, apiPort: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Panel / Agent URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={nodeForm.panelUrl}
                      onChange={(e) => setNodeForm((f) => ({ ...f, panelUrl: e.target.value }))}
                      placeholder="https://node01.tiwlo.net:9443"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Agent Bearer Token {editingNode ? '(blank to keep)' : '(Optional)'}
                    </label>
                    <input
                      type="password"
                      value={nodeForm.bearerToken}
                      onChange={(e) => setNodeForm((f) => ({ ...f, bearerToken: e.target.value }))}
                      placeholder="Node agent bearer token"
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
                        Storage (GB)
                      </label>
                      <input
                        type="number"
                        min="10"
                        value={nodeForm.storageGb}
                        onChange={(e) => setNodeForm((f) => ({ ...f, storageGb: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Max Droplets
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={nodeForm.maxDroplets}
                        onChange={(e) => setNodeForm((f) => ({ ...f, maxDroplets: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}
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
                {saving
                  ? isSshAutoLinkMode
                    ? 'Connecting & Onboarding via SSH...'
                    : 'Saving...'
                  : editingNode
                    ? 'Save Changes'
                    : isSshAutoLinkMode
                      ? 'Auto-Link & Onboard via SSH'
                      : 'Add Server Node'}
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
                  Import up to 500 Ubuntu cluster nodes in one batch (`POST /api/admin/fleet/nodes/bulk`).
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
              CSV columns: name,hostname,ipAddress,apiPort,sshPort,region,cpuCores,ramGb,storageGb,maxDroplets,bearerToken
            </div>

            <textarea
              rows={8}
              required
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={'name,hostname,ipAddress,apiPort,sshPort,region,cpuCores,ramGb,storageGb,maxDroplets\nsgp-01,sgp01.tiwlo.net,203.0.113.10,9443,22,sgp1,8,32,500,300'}
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
                  Probe &amp; Config Logs · {logsDrawerNode.name || logsDrawerNode.hostname}
                </h3>
                <p className="font-mono text-[11px] text-neutral-500">
                  {logsDrawerNode.ipAddress || '—'}:{logsDrawerNode.apiPort ?? 9443}
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
                        {log.eventType || log.event || log.action || log.status || 'probe'}
                      </span>
                      <span className="tabular-nums text-[11px] text-neutral-500">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                    {(log.errorMessage || log.message || log.error || log.latencyMs != null) && (
                      <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        {log.errorMessage || log.message || log.error || `Latency: ${log.latencyMs} ms`}
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
