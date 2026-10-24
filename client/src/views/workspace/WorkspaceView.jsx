import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  RotateCw,
  CreditCard,
  Search,
  ArrowDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Shield,
  MessageSquare,
  BarChart2,
  Activity,
  Layers,
  Bot,
  MessageCircle,
  Store,
  Server,
  Play,
  Pause,
  Trash2,
  Pencil,
  Settings,
  ExternalLink,
  X,
  AlertTriangle
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

function WorkspaceRowMenu({ service, onNavigate, onOpenStoreDashboard, onToggle, onRequestDialog }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const isPaused = ['paused', 'suspended', 'inactive'].includes(String(service.status || '').toLowerCase());

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!anchor || !menu) return;

      const top = anchor.bottom + menu.height + 12 <= window.innerHeight
        ? anchor.bottom + 8
        : Math.max(12, anchor.top - menu.height - 8);
      const left = Math.max(12, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - 12));
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const closeAndRun = (callback) => {
    setOpen(false);
    callback();
  };

  const menuItems = service.workspaceItemType === 'store'
    ? [
        { label: 'Open store dashboard', icon: ExternalLink, onClick: () => closeAndRun(() => onOpenStoreDashboard?.(service.store)) },
        { label: isPaused ? 'Resume store' : 'Pause store', icon: isPaused ? Play : Pause, onClick: () => closeAndRun(() => onToggle(service)) },
        { label: 'Delete store permanently', icon: Trash2, destructive: true, onClick: () => closeAndRun(() => onRequestDialog('delete-store', service)) }
      ]
    : service.workspaceItemType === 'droplet'
      ? [
          { label: 'Open cloud dashboard', icon: ExternalLink, onClick: () => closeAndRun(() => onNavigate?.('dashboard')) },
          { label: 'Rename in Workspace', icon: Pencil, onClick: () => closeAndRun(() => onRequestDialog('rename-droplet', service)) }
        ]
      : [
          { label: 'Edit service configuration', icon: Settings, onClick: () => closeAndRun(() => onNavigate?.(`workspace/service/${service.id}`)) },
          { label: isPaused ? 'Resume service' : 'Pause service', icon: isPaused ? Play : Pause, onClick: () => closeAndRun(() => onToggle(service)) },
          { label: 'Remove from Workspace', icon: Trash2, destructive: true, onClick: () => closeAndRun(() => onRequestDialog('delete-marketplace', service)) }
        ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${service.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`p-2 rounded-xl transition-colors cursor-pointer ${
          open ? 'bg-[#E8F0FE] text-[#0B57D0]' : 'text-[#5F6368] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && createPortal(
        <>
          <button
            type="button"
            aria-label="Close service actions"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] cursor-default"
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label={`${service.name} actions`}
            style={{ top: position.top, left: position.left }}
            className="fixed z-[81] w-[280px] max-w-[calc(100vw-24px)] rounded-xl border border-[#E8EAED] bg-white p-2 shadow-[0_4px_12px_rgba(60,64,67,0.16)]"
          >
            <div className="px-3 py-3">
              <p className="truncate text-sm font-medium text-[#202124]">{service.name}</p>
              <p className="mt-1 text-xs text-[#5F6368]">
                {service.workspaceItemType === 'store' ? 'Store' : service.workspaceItemType === 'droplet' ? 'Cloud droplet' : 'Marketplace service'} · Workspace
              </p>
            </div>
            <div className="my-1 border-t border-[#E8EAED]" />
            {menuItems.map(({ label, icon: Icon, destructive, onClick }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={onClick}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${
                  destructive
                    ? 'text-[#B3261E] hover:bg-[#FCE8E6]'
                    : 'text-[#3C4043] hover:bg-[#F1F3F4]'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-[#5F6368]" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function WorkspaceActionDialog({ dialog, value, setValue, busy, error, onClose, onConfirm }) {
  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, busy, onClose]);

  const isRename = dialog?.type === 'rename-droplet';
  const isStoreDelete = dialog?.type === 'delete-store';
  if (!dialog) return null;

  const title = isRename
    ? 'Rename cloud droplet'
    : isStoreDelete
      ? 'Permanently delete this store?'
      : 'Remove this service?';
  const description = isRename
    ? 'This changes the name shown in your Workspace only. It does not rename the virtual machine at the cloud provider.'
    : isStoreDelete
      ? 'The storefront address and store records, including products, orders, customers, and settings, will be removed. Uploaded media files may remain in shared storage. This cannot be undone.'
      : 'This removes the service activation from your Workspace. It does not delete the Marketplace product or stop resources at an external provider.';
  const canSubmit = !busy && (!isRename || (value.trim() && value.trim() !== dialog.service.name));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#202124]/32 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-action-title"
        className="w-full max-w-[440px] overflow-hidden rounded-[28px] border border-[#E8EAED] bg-white shadow-[0_8px_24px_rgba(60,64,67,0.16)]"
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isRename ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'bg-[#FCE8E6] text-[#B3261E]'
          }`}>
            {isRename ? <Pencil className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="workspace-action-title" className="text-[22px] font-normal leading-7 tracking-[-0.2px] text-[#202124]">{title}</h2>
            <p className="mt-2 text-sm leading-5 text-[#5F6368]">{description}</p>
            <p className="mt-4 truncate rounded-xl bg-[#F8F9FA] px-3 py-2.5 text-sm font-medium text-[#3C4043]">
              {dialog.service.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="rounded-full p-2 text-[#5F6368] transition hover:bg-[#F1F3F4] hover:text-[#202124] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onConfirm();
          }}
          className="px-6 pb-6 pt-5"
        >
          {isRename && (
            <label className="block text-sm font-medium text-[#3C4043]">
              New Workspace name
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={80}
                className="mt-2 w-full rounded-xl border border-[#747775] bg-white px-4 py-3 text-sm text-[#202124] outline-none transition placeholder:text-[#80868B] hover:border-[#5F6368] focus:border-2 focus:border-[#1A73E8]"
                placeholder="Enter a name"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-[#F9DEDC] bg-[#FCE8E6] px-3 py-2.5 text-sm text-[#B3261E]">
              {error}
            </p>
          )}
          <div className="mt-7 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-10 rounded-full px-5 text-sm font-medium text-[#1A73E8] transition hover:bg-[#F1F3F4] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isRename
                  ? 'bg-[#1A73E8] text-white hover:bg-[#1765CC]'
                  : 'bg-[#B3261E] text-white hover:bg-[#8C1D18]'
              }`}
            >
              {busy && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
              {busy ? 'Working…' : isRename ? 'Save name' : isStoreDelete ? 'Delete store' : 'Remove service'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

export default function WorkspaceView({ onNavigate, onOpenStoreDashboard, showToast }) {
  const [services, setServices] = useState([]);
  const [operations, setOperations] = useState([]);
  const [stats, setStats] = useState({ totalServices: 0, connectedServersCount: 0, allServicesHealthy: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [actionError, setActionError] = useState('');
  const [actionDialog, setActionDialog] = useState(null);
  const [dialogValue, setDialogValue] = useState('');
  const [dialogBusy, setDialogBusy] = useState(false);

  const loadWorkspace = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const data = await WorkspaceAPI.getWorkspace({ search });
      setServices(data.services || []);
      setOperations(data.operations || []);
      setStats({
        totalServices: data.totalServices ?? (data.services || []).length,
        connectedServersCount: data.connectedServersCount ?? 0,
        allServicesHealthy: data.allServicesHealthy
      });
    } catch (err) {
      setLoadError(err.message || 'Could not load Workspace data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadWorkspace();
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(services.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSortToggle = () => {
    const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextOrder);
    setServices((prev) =>
      [...prev].sort((a, b) => {
        return nextOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      })
    );
  };

  const requestActionDialog = (type, service) => {
    setActionError('');
    setDialogValue(type === 'rename-droplet' ? service.name : '');
    setActionDialog({ type, service });
  };

  const runServiceAction = async (service, action, value) => {
    setActionError('');
    try {
      if (action === 'toggle') {
        const isPaused = ['paused', 'suspended', 'inactive'].includes(String(service.status || '').toLowerCase());
        if (service.workspaceItemType === 'store') {
          await WorkspaceAPI.setStoreStatus(service.storeId, isPaused ? 'active' : 'suspended');
        } else {
          await WorkspaceAPI.setWorkspaceServiceStatus(service.id, isPaused ? 'Active' : 'Paused');
        }
        showToast?.(`${service.name} ${isPaused ? 'resumed' : 'stopped'}.`);
      } else if (action === 'delete-store') {
        await WorkspaceAPI.deleteStore(service.storeId);
        showToast?.(`${service.name} and its store records were permanently deleted.`);
      } else if (action === 'delete-marketplace') {
        await WorkspaceAPI.deleteWorkspaceService(service.id);
        showToast?.(`${service.name} was removed from Workspace.`);
      } else if (action === 'rename-droplet') {
        await WorkspaceAPI.renameDroplet(service.dropletId, value.trim());
        showToast?.(`Workspace name updated to "${value.trim()}".`);
      }
      setSelectedIds([]);
      await loadWorkspace(true);
      return true;
    } catch (error) {
      setActionError(error.message || 'The Workspace action could not be completed.');
      return false;
    }
  };

  const handleActionDialogConfirm = async () => {
    if (!actionDialog || dialogBusy) return;
    setDialogBusy(true);
    const completed = await runServiceAction(
      actionDialog.service,
      actionDialog.type,
      dialogValue
    );
    setDialogBusy(false);
    if (completed) {
      setActionDialog(null);
      setDialogValue('');
    }
  };

  const renderServiceIcon = (iconType) => {
    switch (iconType) {
      case 'store':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'cloud':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'discord':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#5865F2] text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'whatsapp':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'shield':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#C4EED0] text-[#072711] flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#FEEDAD] text-[#2C1F00] flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-[#F0F4F9] text-[#444746] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Workspace Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">
              Workspace
            </h1>
            <span className="text-xs px-3 py-1 rounded-full bg-[#E8F0FE] text-[#0B57D0] font-medium">
              Enterprise Hub
            </span>
          </div>
          <p className="text-sm text-[#444746] mt-1">
            Manage the products you have enabled, their workspace settings, and service activity.
          </p>
        </div>

        {/* Action Buttons (Modern Google Material 3 Pill Styling) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary: browse Marketplace */}
          <button
            onClick={() => onNavigate?.('marketplace')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add service</span>
          </button>

          {/* Secondary: REFRESH */}
          <button
            onClick={() => loadWorkspace(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Secondary: BILLING */}
          <button
            onClick={() => onNavigate?.('workspace/billing')}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#1F1F1F] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#444746]" />
            <span>Billing</span>
          </button>

          {/* Secondary: AUDIT LOG */}
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#1F1F1F] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#444746]" />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl border border-[#F9DEDC] bg-[#FCE8E6] px-4 py-3 text-[13px] text-[#B3261E]">
          {actionError}
        </div>
      )}

      {/* 2. Modern Google Summary Status Card */}
      <div className="bg-[#F8FAFD] border border-[#E0E2EC] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
        <div className="text-[#444746] flex items-center gap-3">
          <span className="font-semibold text-[#1F1F1F] text-base">{stats.totalServices}</span> Workspace resources
          <span className="text-[#C4C7C5]">•</span>
          <span className="font-semibold text-[#1F1F1F] text-base">{stats.connectedServersCount}</span> connected clusters
          <span className="text-[#C4C7C5]">•</span>
          <span>Stores, cloud droplets, and Marketplace services</span>
        </div>
        <p className="text-[11px] text-[#747775]">
          Marketplace pause controls this Workspace activation; connected provider services may require separate setup.
        </p>

      </div>

      {/* 3. Modern Google Table Card Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl shadow-xs overflow-hidden">
        {/* Modern Pill Omnibox Filter Toolbar */}
        <form
          onSubmit={handleSearchSubmit}
          className="p-4 bg-white border-b border-[#E0E2EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-[#444746] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services by name, cluster, plan or status..."
              className="w-full bg-[#F0F4F9] hover:bg-[#E9EEF6] focus:bg-white border border-transparent focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] rounded-full pl-11 pr-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#444746] transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-[#444746] shrink-0">
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); loadWorkspace(); }}
                className="text-[12px] font-medium text-[#0B57D0] hover:underline px-2 py-1 cursor-pointer"
              >
                Clear filter
              </button>
            )}
            <button
              type="button"
              onClick={() => loadWorkspace(true)}
              className="p-2 hover:bg-[#F0F4F9] text-[#444746] hover:text-[#1F1F1F] rounded-full transition-colors cursor-pointer"
              title="Refresh table"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[840px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F8FAFD] text-[11px] font-medium text-[#444746] uppercase tracking-wider">
                <th className="py-3.5 px-5 w-12">
                  <input
                    type="checkbox"
                    checked={services.length > 0 && selectedIds.length === services.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-[#C4C7C5] accent-[#0B57D0] cursor-pointer"
                  />
                </th>
                <th
                  onClick={handleSortToggle}
                  className="py-3.5 px-5 font-medium text-[#444746] hover:text-[#1F1F1F] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Service name</span>
                    <ArrowDown className={`w-3.5 h-3.5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  </div>
                </th>
                <th className="py-3.5 px-5 font-medium">Status</th>
                <th className="py-3.5 px-5 font-medium">Cluster / Environment</th>
                <th className="py-3.5 px-5 font-medium">Tier Plan</th>
                <th className="py-3.5 px-5 font-medium">Resource Usage</th>
                <th className="py-3.5 px-5 font-medium">Renewal</th>
                <th className="py-3.5 px-5 font-medium text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F8]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-[#444746]">
                    <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
                    <span>Loading workspace services...</span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="py-16 text-center text-[#B3261E]">{loadError}</td></tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-[#444746]">
                    <Layers className="w-10 h-10 text-[#C4C7C5] mx-auto mb-3" />
                    <p className="font-medium text-[#1F1F1F] text-base">{search ? 'No services match your search' : 'No Marketplace services activated'}</p>
                    <button
                      onClick={() => { setSearch(''); loadWorkspace(); }}
                      className="mt-3 px-4 py-1.5 rounded-full text-[13px] font-medium text-[#0B57D0] border border-[#747775]/30 hover:bg-[#F2F6FC] transition-colors"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              ) : (
                services.map((service) => {
                  const isSelected = selectedIds.includes(service.id);
                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-[#F8FAFD] transition-colors ${isSelected ? 'bg-[#E8F0FE]/50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(service.id)}
                          className="w-4 h-4 rounded border-[#C4C7C5] accent-[#0B57D0] cursor-pointer"
                        />
                      </td>

                      {/* Service Name & Category */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          {service.logoUrl
                            ? <img src={service.logoUrl} alt="" className="w-10 h-10 rounded-xl object-contain shrink-0" />
                            : renderServiceIcon(service.iconType)}
                          <div>
                            <button
                              disabled={service.workspaceItemType === 'store' &&
                                ['paused', 'suspended', 'inactive'].includes(String(service.status || '').toLowerCase())}
                              onClick={() => {
                                if (service.workspaceItemType === 'store') onOpenStoreDashboard?.(service.store);
                                else if (service.workspaceItemType === 'droplet') onNavigate?.('dashboard');
                                else onNavigate?.(`workspace/service/${service.id}`);
                              }}
                              className="font-medium text-[#0B57D0] hover:underline text-left leading-tight cursor-pointer text-[14px] disabled:text-[#747775] disabled:no-underline disabled:cursor-not-allowed"
                            >
                              {service.name}
                            </button>
                            <div className="text-[12px] text-[#444746] mt-0.5 capitalize">
                              <span>{service.productName || service.category || 'Extension Service'}</span>
                              {service.category && service.productName && (
                                <span className="text-[#747775]"> · {service.category}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium ${service.status?.toLowerCase() === 'active' ? 'bg-[#C4EED0] text-[#072711]' : 'bg-[#F0F4F9] text-[#444746]'}`}>
                          {service.status?.toLowerCase() === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#072711]" />}
                          <span>{service.status || 'Status unavailable'}</span>
                        </span>
                      </td>

                      {/* Cluster */}
                      <td className="py-4 px-5 text-[#1F1F1F] font-mono text-[12px]">
                        {service.serverName || '—'}
                      </td>

                      {/* Plan */}
                      <td className="py-4 px-5">
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-[#F0F4F9] text-[#1F1F1F]">
                          {service.plan || '—'}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-5 min-w-[140px]">
                        <span>{service.usageLabel || '—'}</span>
                      </td>

                      {/* Renewal */}
                      <td className="py-4 px-5 text-[#444746] text-[12px] whitespace-nowrap">
                        {service.renewalDate || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right pr-6">
                        <WorkspaceRowMenu
                          service={service}
                          onNavigate={onNavigate}
                          onOpenStoreDashboard={onOpenStoreDashboard}
                          onToggle={(item) => runServiceAction(item, 'toggle')}
                          onRequestDialog={requestActionDialog}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#E0E2EC] px-6 py-4 bg-white text-[12px] text-[#444746] gap-3">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <span className="font-semibold text-[#1F1F1F]">10</span>
          </div>

          <div className="flex items-center gap-4">
            <span>{services.length === 0 ? '0-0 of 0' : `1-${services.length} of ${services.length}`}</span>
            <div className="flex items-center gap-1">
              <button
                disabled
                className="p-1.5 rounded-full hover:bg-[#F0F4F9] text-[#C4C7C5] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled
                className="p-1.5 rounded-full hover:bg-[#F0F4F9] text-[#C4C7C5] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modern Google Operations Audit Card */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#F1F3F8] pb-4 mb-4">
          <div>
            <h2 className="text-[16px] font-medium text-[#1F1F1F]">
              Recent Lifecycle Operations
            </h2>
            <p className="text-[12px] text-[#444746] mt-0.5">
              Recorded Workspace changes and Marketplace activation events.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="text-[13px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
          >
            View all logs →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#E0E2EC] text-[#444746] uppercase text-[11px] font-medium">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Operation</th>
                <th className="py-2.5 px-4">Target Service</th>
                <th className="py-2.5 px-4">Initiator</th>
                <th className="py-2.5 px-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F8]">
              {operations.length === 0 ? (
                <tr><td colSpan="5" className="py-8 text-center text-[#747775]">No lifecycle operations recorded.</td></tr>
              ) : (operations.slice(0, 4)).map((op) => (
                <tr key={op.id} className="hover:bg-[#F8FAFD] transition-colors">
                  <td className="py-3 px-4 text-[#444746] font-mono">{op.createdAt ? new Date(op.createdAt).toLocaleString() : '—'}</td>
                  <td className="py-3 px-4 font-medium text-[#1F1F1F]">{op.operation}</td>
                  <td className="py-3 px-4 text-[#0B57D0] font-medium">{op.serviceName || '—'}</td>
                  <td className="py-3 px-4 text-[#444746]">—</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F0F4F9] text-[#444746]">
                      {op.result || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <WorkspaceActionDialog
        dialog={actionDialog}
        value={dialogValue}
        setValue={setDialogValue}
        busy={dialogBusy}
        error={actionError}
        onClose={() => {
          if (!dialogBusy) {
            setActionDialog(null);
            setActionError('');
          }
        }}
        onConfirm={handleActionDialogConfirm}
      />
    </div>
  );
}
