import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Droplet,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Save,
  Settings,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';

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

function resolveSshCommand(item) {
  if (item?.sshGatewayCommand) return item.sshGatewayCommand;
  if (item?.sshCommand) return item.sshCommand;
  if (item?.sshGatewayUser && item?.sshGatewayHost) {
    const h = String(item.sshGatewayHost).trim();
    return h.includes(':') ? `ssh ${item.sshGatewayUser}@[${h}]` : `ssh ${item.sshGatewayUser}@${h}`;
  }
  const username = item?.accessUsername || 'root';
  const host = item?.publicIpv4 || (item?.ip && item.ip !== 'Unavailable' ? item.ip : null);
  if (host && item?.sshPort && Number(item.sshPort) !== 22) return `ssh ${username}@${host} -p ${item.sshPort}`;
  if (host && item?.accessUsername) return `ssh ${username}@${host}`;
  return null;
}

function DropletRowMenu({
  item,
  isRunning,
  isSuspended,
  busyId,
  onOpenDroplet,
  onStartRename,
  onTogglePower,
  onRequestDelete,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const menuHeight = menu?.height || 190;
      const menuWidth = menu?.width || 208;
      const top =
        anchor.bottom + menuHeight + 12 <= window.innerHeight
          ? anchor.bottom + 6
          : Math.max(12, anchor.top - menuHeight - 6);
      const left = Math.max(12, Math.min(anchor.right - menuWidth, window.innerWidth - menuWidth - 12));
      setCoords({ top, left });
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
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const isBusy = busyId === item.id;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Actions for ${item.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close VPS actions menu"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="fixed inset-0 z-[70] cursor-default"
            />
            <div
              ref={menuRef}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-[71] w-52 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl py-1.5 text-left"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenDroplet?.(item);
                }}
                className="w-full px-3.5 py-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#1ED760]" />
                <span>Manage VPS</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onStartRename?.(item);
                }}
                className="w-full px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                <span>Edit Hostname</span>
              </button>

              <button
                type="button"
                role="menuitem"
                disabled={isBusy || isSuspended}
                onClick={() => {
                  setOpen(false);
                  onTogglePower?.(item);
                }}
                className="w-full px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5 text-neutral-500" />
                <span>{isRunning ? 'Power Off' : 'Power On'}</span>
              </button>

              <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

              <button
                type="button"
                role="menuitem"
                disabled={isBusy}
                onClick={() => {
                  setOpen(false);
                  onRequestDelete?.(item);
                }}
                className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Destroy VPS</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export default function DropletsTable({
  droplets = [],
  onOpenCreateDroplet,
  onOpenDroplet,
  onViewAll,
  onToggleStatus,
  onRenameDroplet,
  onDeleteDroplet,
  showToast,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const copyTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    },
    []
  );

  const navigateToDroplet = (item, section = 'overview') => {
    if (!item?.id) return;
    if (onOpenDroplet) {
      onOpenDroplet(item, section);
      return;
    }
    try {
      const targetPath =
        section && section !== 'overview'
          ? `/cloud/droplets/${encodeURIComponent(item.id)}/${encodeURIComponent(section)}`
          : `/cloud/droplets/${encodeURIComponent(item.id)}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch {}
  };

  const handleCopySsh = async (e, id, sshCommand) => {
    e.stopPropagation();
    if (!sshCommand) return;
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sshCommand);
        copied = true;
      }
    } catch {}
    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = sshCommand;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {}
    }

    if (copied) {
      setCopiedId(id);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 2000);
      showToast?.('SSH command copied to clipboard.', 'success');
    } else {
      showToast?.('Could not copy SSH command automatically.', 'error');
    }
  };

  const handleSaveRename = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === item.name) {
      setEditingId(null);
      return;
    }
    setBusyId(item.id);
    try {
      if (onRenameDroplet) {
        await onRenameDroplet(item, trimmed);
      } else {
        const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}/name`, {
          method: 'PATCH',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Could not rename VPS.');
        showToast?.(`Renamed VPS to ${trimmed}.`, 'success');
      }
      setEditingId(null);
    } catch (err) {
      showToast?.(err?.message || 'Could not rename VPS.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handlePowerToggle = async (item) => {
    const status = String(item.status || '').toLowerCase();
    if (status === 'suspended') {
      showToast?.('Suspended VPS cannot change power state until billing is settled.', 'error');
      return;
    }
    const isRunning = ['running', 'active'].includes(status);
    const nextStatus = isRunning ? 'stopped' : 'active';
    setBusyId(item.id);
    try {
      if (onToggleStatus) {
        await onToggleStatus(item, nextStatus);
      } else {
        const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: nextStatus }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Could not update VPS power state.');
        showToast?.(`VPS ${item.name} is now ${nextStatus}.`, 'success');
      }
    } catch (err) {
      showToast?.(err?.message || 'Could not update VPS power state.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async (e, item) => {
    e.stopPropagation();
    setBusyId(item.id);
    try {
      if (onDeleteDroplet) {
        await onDeleteDroplet(item);
      } else {
        const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          throw new Error(json?.error || 'Could not destroy VPS.');
        }
        showToast?.(`VPS ${item.name} destroyed.`, 'success');
      }
      setConfirmDeleteId(null);
    } catch (err) {
      showToast?.(err?.message || 'Could not destroy VPS.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-neutral-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
            <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-neutral-600 dark:fill-neutral-400 stroke-none" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
            Your Droplets
          </h2>
          <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-gray-800 text-neutral-600 dark:text-neutral-400">
            {droplets.length}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenCreateDroplet}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900/40 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Add Droplet</span>
          </button>
          <button
            type="button"
            onClick={onViewAll || onOpenCreateDroplet}
            className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
          >
            View all
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-gray-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-400">
              <th className="py-3 px-3 sm:px-6 font-semibold">Name</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">IP &amp; SSH Login</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Region</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Status</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Created</th>
              <th className="py-3 px-3 sm:px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-gray-800/80 text-xs font-medium">
            {droplets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  <div className="max-w-xs mx-auto text-center space-y-3">
                    <Droplet className="w-8 h-8 mx-auto text-neutral-300 dark:text-gray-600" />
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                      No droplets provisioned yet
                    </p>
                    <p className="text-xs text-neutral-400">
                      Deploy your first high-performance cloud droplet in seconds.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenCreateDroplet}
                      className="px-4 py-2 rounded-xl bg-[#1ED760] hover:bg-[#18c254] text-black font-bold text-xs shadow-xs cursor-pointer"
                    >
                      Create First Droplet
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              droplets.map((item) => {
                const status = item.status || 'Unknown';
                const statusLower = String(status).toLowerCase();
                const isRunning = ['running', 'active'].includes(statusLower);
                const isSuspended = statusLower === 'suspended';
                const flagUrl = resolveRegionFlagUrl(item);
                const sshCommand = resolveSshCommand(item);
                const isEditing = editingId === item.id;
                const isConfirmingDelete = confirmDeleteId === item.id;
                const isBusy = busyId === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (!isEditing && !isConfirmingDelete) navigateToDroplet(item);
                    }}
                    className="hover:bg-neutral-50/80 dark:hover:bg-gray-800/40 transition group cursor-pointer"
                  >
                    {/* Name + Specs */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
                          <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-neutral-600 dark:fill-neutral-400 stroke-none" />
                        </div>
                        <div className="min-w-0">
                          {isEditing ? (
                            <form
                              onSubmit={(e) => handleSaveRename(e, item)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5"
                            >
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                maxLength={255}
                                autoFocus
                                aria-label="Edit droplet hostname"
                                className="h-7 w-36 rounded-lg border border-[#1ED760] bg-white px-2 text-xs font-semibold text-neutral-950 outline-none dark:bg-neutral-900 dark:text-white"
                              />
                              <button
                                type="submit"
                                disabled={isBusy}
                                title="Save hostname"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ED760] text-black hover:bg-[#18c254] cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(null);
                                }}
                                title="Cancel rename"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToDroplet(item);
                                }}
                                className="font-bold text-left text-neutral-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-[#1ED760] transition cursor-pointer"
                              >
                                {item.name}
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-400">
                            {item.specs || [item.vcpus && `${item.vcpus} vCPU`, item.memory, item.storage].filter(Boolean).join(' • ') || 'Specifications unavailable'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* IP Address & SSH Command */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="font-mono text-[11px] text-neutral-700 dark:text-neutral-200 font-medium">
                        {item.ip || item.ipv4 || '—'}
                      </div>
                      {item.ipv6 && (
                        <div className="font-mono text-[10px] text-neutral-400 dark:text-neutral-400 truncate max-w-[210px]">
                          {item.ipv6}
                        </div>
                      )}
                      {sshCommand && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 px-2 py-1 border border-neutral-200/80 dark:border-neutral-700/70"
                        >
                          <Terminal className="w-3 h-3 text-[#0f7a37] dark:text-[#1ed760] shrink-0" aria-hidden="true" />
                          <code className="font-mono text-[10px] text-neutral-800 dark:text-neutral-200 select-all truncate max-w-[200px]">
                            {sshCommand}
                          </code>
                          <button
                            type="button"
                            onClick={(e) => handleCopySsh(e, item.id, sshCommand)}
                            title={`Copy ${sshCommand}`}
                            aria-label={`Copy SSH command ${sshCommand}`}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-neutral-600 hover:text-black hover:bg-white dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-700 transition cursor-pointer shrink-0"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#0f7a37] dark:text-[#1ed760]" />
                                <span className="text-[#0f7a37] dark:text-[#1ed760]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Region */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-neutral-700 dark:text-neutral-200">
                      <div className="flex items-center gap-2">
                        {flagUrl ? (
                          <img
                            src={flagUrl}
                            alt=""
                            className="h-[15px] w-[20px] rounded-[3px] object-cover ring-1 ring-black/10 dark:ring-white/15 shrink-0"
                          />
                        ) : (
                          <span className="text-base shrink-0">{item.regionFlag || '🌐'}</span>
                        )}
                        <span className="font-medium text-xs">{item.region || '—'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRunning
                              ? 'bg-emerald-500 shadow-2xs shadow-emerald-500/50 animate-pulse'
                              : isSuspended
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                          }`}
                        />
                        <span
                          className={
                            isRunning
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isSuspended
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {status}
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                      {item.created || (item.createdAt ? new Date(item.createdAt).toLocaleString() : '—')}
                    </td>

                    {/* Actions */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="py-3 sm:py-4 px-3 sm:px-6 text-right relative whitespace-nowrap"
                    >
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(e) => handleConfirmDelete(e, item)}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                          >
                            {isBusy ? 'Destroying…' : 'Confirm Destroy'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!isRunning}
                            onClick={() => navigateToDroplet(item, 'console')}
                            title="Open Browser SSH Console (HTTPS Port 443)"
                            className="inline-flex items-center gap-1 rounded-xl border border-neutral-200/80 bg-neutral-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 dark:border-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 transition cursor-pointer"
                          >
                            <Terminal className="w-3 h-3 text-[#1ED760]" />
                            <span>Console</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => navigateToDroplet(item, 'overview')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:border-[#1ED760] hover:bg-[#1ED760]/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-[#1ED760] transition cursor-pointer"
                          >
                            <Settings className="w-3 h-3 text-[#1ED760]" />
                            <span>Manage VPS</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || isSuspended}
                            onClick={() => handlePowerToggle(item)}
                            title={isRunning ? 'Power Off VPS' : 'Power On VPS'}
                            aria-label={isRunning ? `Power off ${item.name}` : `Power on ${item.name}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer disabled:opacity-40 ${
                              isRunning
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <DropletRowMenu
                            item={item}
                            isRunning={isRunning}
                            isSuspended={isSuspended}
                            busyId={busyId}
                            onOpenDroplet={navigateToDroplet}
                            onStartRename={(target) => {
                              setConfirmDeleteId(null);
                              setEditingId(target.id);
                              setEditingName(target.name || '');
                            }}
                            onTogglePower={handlePowerToggle}
                            onRequestDelete={(target) => {
                              setEditingId(null);
                              setConfirmDeleteId(target.id);
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
