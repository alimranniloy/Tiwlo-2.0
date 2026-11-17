import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { supportFetch } from '../utils/supportFetch';

const CARD_CLASS = 'rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950';
const SURFACE_CLASS = 'rounded-xl border border-neutral-200/80 bg-[#fafafa] dark:border-neutral-800 dark:bg-neutral-900/50';
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-500';
const PRIMARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';

const DEFAULT_PERMISSIONS_CATALOG = [
  { key: 'products', label: 'Products', description: 'Create, edit, and organize store products and pricing.' },
  { key: 'orders', label: 'Orders', description: 'View, fulfill, refund, and manage customer orders.' },
  { key: 'inventory', label: 'Inventory', description: 'Adjust stock levels, suppliers, and warehouse counts.' },
  { key: 'pos', label: 'POS', description: 'Operate point-of-sale checkout and register sessions.' },
  { key: 'analytics', label: 'Analytics', description: 'View revenue dashboards, conversion metrics, and reports.' },
  { key: 'store_settings', label: 'Store Settings', description: 'Modify storefront branding, shipping, and tax rules.' },
  { key: 'cloud_droplets', label: 'Cloud Droplets', description: 'Provision, reboot, and monitor account cloud servers.' },
  { key: 'domains', label: 'Domains', description: 'Manage custom domains, subdomains, and DNS records.' },
  { key: 'billing_view', label: 'Billing View-Only', description: 'Inspect invoices, credit balance, and plan usage.' },
  { key: 'support_tickets', label: 'Support Tickets', description: 'Open and reply to Tiwlo support tickets for this account.' }
];

const DEFAULT_ROLE_PRESETS = [
  {
    name: 'Manager',
    description: 'Full operational access across stores, staff operations, and cloud resources.',
    permissions: [
      'products',
      'orders',
      'inventory',
      'pos',
      'analytics',
      'store_settings',
      'cloud_droplets',
      'domains',
      'billing_view',
      'support_tickets'
    ]
  },
  {
    name: 'Catalog Editor',
    description: 'Manage product listings, categories, stock levels, and storefront updates.',
    permissions: ['products', 'inventory', 'store_settings']
  },
  {
    name: 'Order Operator',
    description: 'Process incoming orders, POS checkouts, and inventory fulfillment.',
    permissions: ['orders', 'inventory', 'pos']
  },
  {
    name: 'Support Agent',
    description: 'Assist customers with order status and handle support tickets.',
    permissions: ['orders', 'support_tickets']
  },
  {
    name: 'Analyst',
    description: 'Read-only visibility into analytics and billing summaries.',
    permissions: ['analytics', 'billing_view']
  },
  {
    name: 'Custom',
    description: 'Hand-pick specific permissions across store and cloud tools.',
    permissions: []
  }
];

const STATUS_BADGE_MAP = {
  active: 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  invited: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
};

async function readJsonPayload(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data;
}

function normalizePermissionsCatalog(rawCatalog) {
  if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) {
    return DEFAULT_PERMISSIONS_CATALOG;
  }
  return rawCatalog.map((entry) => {
    if (typeof entry === 'string') {
      const matched = DEFAULT_PERMISSIONS_CATALOG.find((item) => item.key === entry);
      return matched || { key: entry, label: entry, description: '' };
    }
    const key = entry.key || entry.id || entry.permission || entry.name;
    const fallback = DEFAULT_PERMISSIONS_CATALOG.find((item) => item.key === key);
    return {
      key,
      label: entry.label || entry.name || fallback?.label || key,
      description: entry.description || fallback?.description || ''
    };
  }).filter((item) => Boolean(item.key));
}

function normalizeRolePresets(rawPresets, catalog) {
  const validKeys = new Set(catalog.map((item) => item.key));
  const filterToCatalog = (list) => {
    if (!Array.isArray(list)) return [];
    const matched = list.filter((perm) => validKeys.has(perm));
    return matched.length > 0 ? matched : list;
  };

  if (!rawPresets) return DEFAULT_ROLE_PRESETS;

  if (Array.isArray(rawPresets) && rawPresets.length > 0) {
    const normalized = rawPresets.map((preset) => {
      const name = preset.label || preset.name || preset.role || preset.id;
      const fallback = DEFAULT_ROLE_PRESETS.find((item) => item.name.toLowerCase() === String(name).toLowerCase());
      return {
        name,
        description: preset.description || fallback?.description || '',
        permissions: filterToCatalog(preset.permissions || fallback?.permissions || [])
      };
    });
    if (!normalized.some((p) => String(p.name).toLowerCase() === 'custom')) {
      normalized.push(DEFAULT_ROLE_PRESETS[DEFAULT_ROLE_PRESETS.length - 1]);
    }
    return normalized;
  }

  if (typeof rawPresets === 'object' && !Array.isArray(rawPresets)) {
    const entries = Object.entries(rawPresets);
    if (entries.length === 0) return DEFAULT_ROLE_PRESETS;
    const normalized = entries.map(([name, value]) => {
      const perms = Array.isArray(value) ? value : (value?.permissions || []);
      const fallback = DEFAULT_ROLE_PRESETS.find((item) => item.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        description: value?.description || fallback?.description || '',
        permissions: filterToCatalog(perms)
      };
    });
    if (!normalized.some((p) => String(p.name).toLowerCase() === 'custom')) {
      normalized.push(DEFAULT_ROLE_PRESETS[DEFAULT_ROLE_PRESETS.length - 1]);
    }
    return normalized;
  }

  return DEFAULT_ROLE_PRESETS;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getInitials(name, email) {
  const src = String(name || email || 'TM').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? 'border-[#1ED760] bg-[#1ED760]'
          : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
      }`}
    >
      <span
        className={`inline-block size-3.5 transform rounded-full bg-white shadow-xs transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Dedicated full-page Per-Account Team & Staff Access Management hub.
 */
export default function UserTeamManagementView({
  currentUser,
  onBack,
  onOpenTwoFactor,
  showToast
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [inviteDeliveryNotice, setInviteDeliveryNotice] = useState(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);

  const [members, setMembers] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState(DEFAULT_PERMISSIONS_CATALOG);
  const [rolePresets, setRolePresets] = useState(DEFAULT_ROLE_PRESETS);
  const [auditLogs, setAuditLogs] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // Inline Staff Builder / Editor State
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('Manager');
  const [staffPermissions, setStaffPermissions] = useState(() => [...DEFAULT_ROLE_PRESETS[0].permissions]);
  const [staffStoreScope, setStaffStoreScope] = useState('all');
  const [staffRequire2fa, setStaffRequire2fa] = useState(true);
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [savingMember, setSavingMember] = useState(false);

  // Row-level action state
  const [busyMemberId, setBusyMemberId] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState('');

  const loadTeamStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await supportFetch('/api/user/account/team-staff', { method: 'GET' });
      const data = await readJsonPayload(response, 'Could not load team and staff members.');
      const nextCatalog = normalizePermissionsCatalog(data.permissionsCatalog);
      const nextPresets = normalizeRolePresets(data.rolePresets, nextCatalog);
      setPermissionsCatalog(nextCatalog);
      setRolePresets(nextPresets);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setAuditLogs(Array.isArray(data.auditLogs) ? data.auditLogs : []);
    } catch (err) {
      setError(err.message || 'Could not load team and staff members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadTeamStaff);
  }, [loadTeamStaff]);

  const permissionLabelMap = useMemo(() => {
    const map = new Map();
    for (const item of permissionsCatalog) {
      map.set(item.key, item.label);
    }
    return map;
  }, [permissionsCatalog]);

  const kpiStats = useMemo(() => {
    let active = 0;
    let pending = 0;
    let twoFaEnforced = 0;
    for (const member of members) {
      const status = String(member.status || 'pending').toLowerCase();
      if (status === 'active') active += 1;
      if (status === 'pending' || status === 'invited') pending += 1;
      if (member.require2fa) twoFaEnforced += 1;
    }
    return {
      total: members.length,
      active,
      pending,
      twoFaEnforced
    };
  }, [members]);

  const distinctRoles = useMemo(() => {
    const set = new Set(['all']);
    for (const preset of rolePresets) {
      if (preset.name) set.add(preset.name);
    }
    for (const member of members) {
      if (member.role) set.add(member.role);
    }
    return Array.from(set);
  }, [rolePresets, members]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return members.filter((member) => {
      const status = String(member.status || 'pending').toLowerCase();
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (status !== 'pending' && status !== 'invited') return false;
        } else if (status !== statusFilter) {
          return false;
        }
      }
      if (roleFilter !== 'all' && String(member.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }
      if (!query) return true;
      const haystack = [member.name, member.email, member.role, member.storeScope]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [members, searchQuery, statusFilter, roleFilter]);

  const openNewMemberBuilder = () => {
    const defaultPreset = rolePresets[0] || DEFAULT_ROLE_PRESETS[0];
    setEditingMemberId(null);
    setStaffName('');
    setStaffEmail('');
    setStaffRole(defaultPreset.name);
    setStaffPermissions([...(defaultPreset.permissions || [])]);
    setStaffStoreScope('all');
    setStaffRequire2fa(true);
    setSendInviteEmail(true);
    setBuilderOpen(true);
    setError('');
    setSuccessMsg('');
  };

  const openEditMemberBuilder = (member) => {
    setEditingMemberId(member.id);
    setStaffName(member.name || '');
    setStaffEmail(member.email || '');
    setStaffRole(member.role || 'Custom');
    setStaffPermissions(Array.isArray(member.permissions) ? [...member.permissions] : []);
    setStaffStoreScope(member.storeScope || 'all');
    setStaffRequire2fa(Boolean(member.require2fa));
    setSendInviteEmail(false);
    setBuilderOpen(true);
    setError('');
    setSuccessMsg('');
  };

  const handleSelectRolePreset = (preset) => {
    setStaffRole(preset.name);
    if (String(preset.name).toLowerCase() !== 'custom') {
      setStaffPermissions([...(preset.permissions || [])]);
    }
  };

  const handleTogglePermission = (permKey) => {
    setStaffPermissions((prev) => {
      const exists = prev.includes(permKey);
      const next = exists ? prev.filter((item) => item !== permKey) : [...prev, permKey];

      const matchedPreset = rolePresets.find((preset) => {
        if (String(preset.name).toLowerCase() === 'custom') return false;
        const presetPerms = preset.permissions || [];
        return (
          presetPerms.length === next.length &&
          presetPerms.every((item) => next.includes(item))
        );
      });
      setStaffRole(matchedPreset ? matchedPreset.name : 'Custom');
      return next;
    });
  };

  const handleCopyInviteUrl = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteUrl(true);
      setTimeout(() => setCopiedInviteUrl(false), 2000);
      showToast?.('Invite link copied');
    } catch {
      setError('Could not copy link automatically. Please select and copy it manually.');
    }
  };

  const handleSaveStaffMember = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setInviteDeliveryNotice(null);

    if (!staffName.trim()) {
      setError('Staff member full name is required.');
      return;
    }
    if (!editingMemberId && !staffEmail.trim()) {
      setError('Work email address is required.');
      return;
    }
    if (staffPermissions.length === 0) {
      setError('Select at least one permission for this staff member.');
      return;
    }

    setSavingMember(true);
    try {
      if (editingMemberId) {
        const response = await supportFetch(`/api/user/account/team-staff/${encodeURIComponent(editingMemberId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: staffName.trim(),
            role: staffRole,
            permissions: staffPermissions,
            require2fa: staffRequire2fa,
            storeScope: staffStoreScope.trim() || 'all'
          })
        });
        await readJsonPayload(response, 'Failed to update staff member.');
        setSuccessMsg(`Updated access permissions for ${staffName.trim()}.`);
        showToast?.('Staff permissions updated');
      } else {
        const response = await supportFetch('/api/user/account/team-staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: staffName.trim(),
            email: staffEmail.trim(),
            role: staffRole,
            permissions: staffPermissions,
            require2fa: staffRequire2fa,
            sendInviteEmail,
            storeScope: staffStoreScope.trim() || 'all'
          })
        });
        const data = await readJsonPayload(response, 'Failed to add staff member.');
        if (sendInviteEmail || data.inviteUrl || data.inviteWarning) {
          setInviteDeliveryNotice({
            email: data.member?.email || staffEmail.trim(),
            sent: Boolean(data.inviteEmailSent),
            warning: data.inviteWarning || '',
            inviteUrl: data.inviteUrl || ''
          });
        }
        setSuccessMsg(
          data.inviteEmailSent
            ? `Invitation email sent to ${staffEmail.trim()}.`
            : `${staffName.trim()} added to your team.`
        );
        showToast?.('Staff member added');
      }

      setBuilderOpen(false);
      setEditingMemberId(null);
      await loadTeamStaff();
    } catch (err) {
      setError(err.message || 'Failed to save staff member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberStatus = async (member) => {
    setError('');
    setSuccessMsg('');
    const currentStatus = String(member.status || 'active').toLowerCase();
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setBusyMemberId(member.id);
    try {
      const response = await supportFetch(`/api/user/account/team-staff/${encodeURIComponent(member.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      await readJsonPayload(response, 'Failed to update member status.');
      const msg = nextStatus === 'suspended'
        ? `Suspended access for ${member.name || member.email}.`
        : `Reactivated access for ${member.name || member.email}.`;
      setSuccessMsg(msg);
      showToast?.(msg);
      await loadTeamStaff();
    } catch (err) {
      setError(err.message || 'Failed to update member status.');
    } finally {
      setBusyMemberId('');
    }
  };

  const handleResendInvite = async (member) => {
    setError('');
    setSuccessMsg('');
    setInviteDeliveryNotice(null);
    setBusyMemberId(`resend:${member.id}`);
    try {
      const response = await supportFetch(`/api/user/account/team-staff/${encodeURIComponent(member.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resendInvite: true })
      });
      const data = await readJsonPayload(response, 'Failed to resend invitation email.');
      setInviteDeliveryNotice({
        email: member.email,
        sent: Boolean(data.inviteEmailSent),
        warning: data.inviteWarning || '',
        inviteUrl: data.inviteUrl || ''
      });
      setSuccessMsg(
        data.inviteEmailSent
          ? `Confirmation email re-sent to ${member.email}.`
          : `Generated a new invite link for ${member.email}.`
      );
      showToast?.(data.inviteEmailSent ? 'Invite email re-sent' : 'Invite link generated');
      await loadTeamStaff();
    } catch (err) {
      setError(err.message || 'Failed to resend invitation email.');
    } finally {
      setBusyMemberId('');
    }
  };

  const handleRemoveMember = async (member) => {
    setError('');
    setSuccessMsg('');
    setBusyMemberId(`delete:${member.id}`);
    try {
      const response = await supportFetch(`/api/user/account/team-staff/${encodeURIComponent(member.id)}`, {
        method: 'DELETE'
      });
      await readJsonPayload(response, 'Failed to remove staff member.');
      setConfirmRemoveId('');
      setSuccessMsg(`Removed ${member.name || member.email} from your team.`);
      showToast?.('Staff member removed');
      await loadTeamStaff();
    } catch (err) {
      setError(err.message || 'Failed to remove staff member.');
    } finally {
      setBusyMemberId('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
                Team &amp; Staff Access
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760]">
                <Store className="size-3" />
                <span>Scoped strictly to your Tiwlo account&apos;s stores &amp; workspace resources</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Invite team members under {currentUser?.name || currentUser?.storeName || 'your Tiwlo account'}, assign granular store &amp; cloud permissions, and enforce 2FA policies.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenTwoFactor && (
            <button type="button" onClick={onOpenTwoFactor} className={SECONDARY_BTN_CLASS}>
              <Shield className="size-3.5 text-[#1ED760]" />
              <span>Your 2FA Settings</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (builderOpen && !editingMemberId ? setBuilderOpen(false) : openNewMemberBuilder())}
            className={PRIMARY_BTN_CLASS}
          >
            {builderOpen && !editingMemberId ? <X className="size-3.5" /> : <UserPlus className="size-3.5" />}
            <span>{builderOpen && !editingMemberId ? 'Close Builder' : '+ Add Staff Member'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="size-4 shrink-0" />
          <span className="flex-1">{successMsg}</span>
        </div>
      )}

      {/* Invite Delivery / Fallback Link Card */}
      {inviteDeliveryNotice && (
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  inviteDeliveryNotice.sent
                    ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {inviteDeliveryNotice.sent ? <Mail className="size-4" /> : <AlertTriangle className="size-4" />}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-neutral-950 dark:text-white">
                  {inviteDeliveryNotice.sent
                    ? `Tiwlo confirmation & invite email sent to ${inviteDeliveryNotice.email}`
                    : `Manual invite link ready for ${inviteDeliveryNotice.email}`}
                </p>
                {inviteDeliveryNotice.warning && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    {inviteDeliveryNotice.warning}
                  </p>
                )}
                {inviteDeliveryNotice.inviteUrl && (
                  <p className="break-all font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                    {inviteDeliveryNotice.inviteUrl}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {inviteDeliveryNotice.inviteUrl && (
                <button
                  type="button"
                  onClick={() => handleCopyInviteUrl(inviteDeliveryNotice.inviteUrl)}
                  className={SECONDARY_BTN_CLASS}
                >
                  {copiedInviteUrl ? <Check className="size-3.5 text-[#1ED760]" /> : <Copy className="size-3.5" />}
                  <span>{copiedInviteUrl ? 'Copied Link' : 'Copy Invite Link'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setInviteDeliveryNotice(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                aria-label="Dismiss invite notice"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Team Members</span>
            <Users className="size-4" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {kpiStats.total}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Total scoped seats</p>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Active Access</span>
            <UserCheck className="size-4 text-[#1ED760]" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {kpiStats.active}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Confirmed &amp; active</p>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Pending Invites</span>
            <Mail className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {kpiStats.pending}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Awaiting acceptance</p>
        </div>

        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">2FA Enforced</span>
            <ShieldCheck className="size-4 text-[#1ED760]" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {kpiStats.twoFaEnforced}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Protected staff accounts</p>
        </div>
      </div>

      {/* Inline Expandable Shadcn Staff Builder / Permissions Editor */}
      {builderOpen && (
        <form onSubmit={handleSaveStaffMember} className={`${CARD_CLASS} overflow-hidden shadow-xs`}>
          <div className="flex items-center justify-between border-b border-neutral-200/80 bg-[#fafafa] px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div>
              <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                {editingMemberId ? `Edit Staff Access — ${staffName || staffEmail}` : 'Add Staff Member'}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Choose a role preset or customize exact permissions across your stores and cloud workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBuilderOpen(false);
                setEditingMemberId(null);
              }}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              aria-label="Close staff builder"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-6 p-5">
            {/* Identity & Store Scope */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Nadia Rahman"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingMemberId)}
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={`${INPUT_CLASS} disabled:bg-[#fafafa] disabled:text-neutral-500 dark:disabled:bg-neutral-900/60`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Workspace / Store Scope
                </label>
                <input
                  type="text"
                  value={staffStoreScope}
                  onChange={(e) => setStaffStoreScope(e.target.value)}
                  placeholder="all (or specific Store ID)"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Role Preset Selector */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-neutral-950 dark:text-white">
                  Role Preset
                </label>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Clicking a preset fills default permissions; customize any checkbox below.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {rolePresets.map((preset) => {
                  const isSelected = String(staffRole).toLowerCase() === String(preset.name).toLowerCase();
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectRolePreset(preset)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-[#1ED760] bg-[#1ED760]/10 text-neutral-950 dark:text-white'
                          : 'border-neutral-200/80 bg-[#fafafa] text-neutral-700 hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-xs font-bold">{preset.name}</span>
                      <span className="mt-0.5 text-[10px] text-neutral-500 tabular-nums dark:text-neutral-400">
                        {String(preset.name).toLowerCase() === 'custom'
                          ? 'Flexible'
                          : `${preset.permissions?.length || 0} permissions`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Permissions Matrix */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-neutral-950 dark:text-white">
                    Permissions Matrix <span className="tabular-nums text-neutral-500">({staffPermissions.length}/{permissionsCatalog.length})</span>
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Granular access scoped strictly to your stores and workspace resources.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStaffPermissions(permissionsCatalog.map((item) => item.key));
                      setStaffRole('Manager');
                    }}
                    className="text-[11px] font-semibold text-neutral-700 hover:underline dark:text-neutral-300"
                  >
                    Select All
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStaffPermissions([]);
                      setStaffRole('Custom');
                    }}
                    className="text-[11px] font-semibold text-neutral-500 hover:underline dark:text-neutral-400"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {permissionsCatalog.map((perm) => {
                  const checked = staffPermissions.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                        checked
                          ? 'border-neutral-900/30 bg-white shadow-2xs dark:border-[#1ED760]/50 dark:bg-neutral-900'
                          : 'border-neutral-200/80 bg-[#fafafa] hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleTogglePermission(perm.key)}
                        className="mt-0.5 size-4 shrink-0 accent-[#1ED760]"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                          {perm.label}
                        </p>
                        {perm.description && (
                          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                            {perm.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Invite Email & 2FA Enforcement Switches */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {!editingMemberId && (
                <div className={`${SURFACE_CLASS} flex items-center justify-between gap-4 p-4`}>
                  <div>
                    <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                      Send confirmation &amp; invite email from Tiwlo
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Dispatches an invite email to {staffEmail.trim() || 'the staff email'} or provides an invite link if SMTP is offline.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={sendInviteEmail}
                    onChange={setSendInviteEmail}
                    label="Send confirmation and invite email from Tiwlo"
                  />
                </div>
              )}

              <div className={`${SURFACE_CLASS} flex items-center justify-between gap-4 p-4 ${editingMemberId ? 'md:col-span-2' : ''}`}>
                <div>
                  <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                    Require Two-Factor Authentication (2FA)
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Mandate 2FA verification before this staff member can access your stores or cloud dashboard.
                  </p>
                </div>
                <ToggleSwitch
                  checked={staffRequire2fa}
                  onChange={setStaffRequire2fa}
                  label="Require Two-Factor Authentication for this staff member"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
            <button
              type="button"
              onClick={() => {
                setBuilderOpen(false);
                setEditingMemberId(null);
              }}
              className={SECONDARY_BTN_CLASS}
            >
              Cancel
            </button>
            <button type="submit" disabled={savingMember} className={PRIMARY_BTN_CLASS}>
              {savingMember ? <Loader2 className="size-3.5 animate-spin" /> : editingMemberId ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              <span>
                {savingMember
                  ? 'Saving...'
                  : editingMemberId
                    ? 'Save Staff Changes'
                    : sendInviteEmail
                      ? 'Add & Send Invite'
                      : 'Add Staff Member'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Search, Filters & Team Directory */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, email, role, or scope..."
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white pr-3 pl-9 text-xs text-neutral-950 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending Invite</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              {distinctRoles.map((role) => (
                <option key={role} value={role}>
                  {role === 'all' ? 'All Roles' : role}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={loading}
              onClick={loadTeamStaff}
              className={SECONDARY_BTN_CLASS}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Staff List */}
        {loading && members.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-xs text-neutral-500">
            <Loader2 className="size-4 animate-spin text-[#1ED760]" />
            <span>Loading team directory...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto mb-2.5 size-7 text-neutral-400" />
            <p className="text-sm font-bold text-neutral-900 dark:text-white">
              {members.length === 0 ? 'No team members added yet' : 'No staff match your current filters'}
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {members.length === 0
                ? 'Invite collaborators and assign tailored store, POS, and cloud permissions.'
                : 'Try adjusting your search query, status, or role filter.'}
            </p>
            {members.length === 0 && (
              <button type="button" onClick={openNewMemberBuilder} className={`${PRIMARY_BTN_CLASS} mt-4`}>
                <UserPlus className="size-3.5" />
                <span>Add First Staff Member</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {filteredMembers.map((member) => {
              const statusKey = String(member.status || 'pending').toLowerCase();
              const badgeClass = STATUS_BADGE_MAP[statusKey] || STATUS_BADGE_MAP.pending;
              const perms = Array.isArray(member.permissions) ? member.permissions : [];
              const isBusy =
                busyMemberId === member.id ||
                busyMemberId === `resend:${member.id}` ||
                busyMemberId === `delete:${member.id}`;

              return (
                <div key={member.id} className="space-y-3 p-5 transition hover:bg-[#fafafa]/70 dark:hover:bg-neutral-900/30">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Member Identity */}
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-[#fafafa] text-xs font-bold text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                        {getInitials(member.name, member.email)}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-neutral-950 dark:text-white">
                            {member.name || member.email}
                          </h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${badgeClass}`}>
                            {statusKey}
                          </span>
                          <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                            {member.role || 'Custom'}
                          </span>
                          {member.require2fa && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                              <ShieldCheck className="size-3" />
                              <span>2FA Enforced</span>
                            </span>
                          )}
                        </div>

                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {member.email} · Scope:{' '}
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">
                            {member.storeScope && member.storeScope !== 'all' ? member.storeScope : 'All Account Stores & Cloud'}
                          </span>
                          {member.createdAt ? ` · Added ${formatDateTime(member.createdAt)}` : ''}
                        </p>

                        {/* Permission Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {perms.slice(0, 6).map((permKey) => (
                            <span
                              key={permKey}
                              className="rounded-md border border-neutral-200/80 bg-[#fafafa] px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                            >
                              {permissionLabelMap.get(permKey) || permKey}
                            </span>
                          ))}
                          {perms.length > 6 && (
                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              +{perms.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member Row Actions */}
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditMemberBuilder(member)}
                        className={SECONDARY_BTN_CLASS}
                      >
                        <Pencil className="size-3.5" />
                        <span>Edit Permissions</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleMemberStatus(member)}
                        className={SECONDARY_BTN_CLASS}
                      >
                        {busyMemberId === member.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : statusKey === 'suspended' ? (
                          <CheckCircle2 className="size-3.5 text-[#1ED760]" />
                        ) : (
                          <Ban className="size-3.5 text-amber-600" />
                        )}
                        <span>{statusKey === 'suspended' ? 'Activate' : 'Suspend'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleResendInvite(member)}
                        className={SECONDARY_BTN_CLASS}
                      >
                        {busyMemberId === `resend:${member.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        <span>Resend Invite</span>
                      </button>

                      {confirmRemoveId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRemoveMember(member)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                          >
                            {busyMemberId === `delete:${member.id}` && <Loader2 className="size-3.5 animate-spin" />}
                            <span>Confirm Remove</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId('')}
                            className={SECONDARY_BTN_CLASS}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmRemoveId(member.id)}
                          aria-label={`Remove ${member.name || member.email}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:bg-neutral-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Team Activity Audit Log */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-neutral-500" />
            <div>
              <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                Recent Team Activity Audit Log
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Auditable log of staff invitations, permission updates, suspensions, and removals.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {auditLogs.length === 0 ? (
            <div className={`${SURFACE_CLASS} p-6 text-center text-xs text-neutral-500 dark:text-neutral-400`}>
              No team activity recorded yet. Invitations and permission changes will appear here.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
              {auditLogs.map((log, index) => (
                <div
                  key={log.id || `${log.action || 'team'}-${index}`}
                  className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                        {log.action || log.title || 'Team event'}
                      </span>
                      {(log.targetEmail || log.targetName) && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {log.targetName ? `${log.targetName} (${log.targetEmail || ''})` : log.targetEmail}
                        </span>
                      )}
                    </div>
                    {(log.details || log.description) && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {log.details || log.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-left text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400 sm:text-right">
                    <p>{formatDateTime(log.createdAt || log.timestamp)}</p>
                    {log.actorEmail && (
                      <p className="text-[10px] text-neutral-400">by {log.actorEmail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
