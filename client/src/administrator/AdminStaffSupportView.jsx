import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

const ROLE_BADGE_STYLES = {
  super_admin: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  operations_admin: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
  support_lead: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/60',
  trust_safety: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  finance_analyst: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60',
  support_agent: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
};

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function formatDateShort(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AdminStaffSupportView({ onBackToDashboard, showToast, currentUser }) {
  const [staffList, setStaffList] = useState([]);
  const [rolePresets, setRolePresets] = useState({});
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'roles' | 'activity'

  // Add / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formRoleKey, setFormRoleKey] = useState('support_agent');
  const [formPermissions, setFormPermissions] = useState([]);
  const [formAllowedIpsText, setFormAllowedIpsText] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Remove confirmation modal state
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const actorIsSuperAdmin = currentUser?.role === 'super_admin' ||
    String(currentUser?.email || '').trim().toLowerCase() === 'tiwloltd@gmail.com';

  const permissionLabelMap = useMemo(() => {
    const map = {};
    for (const item of permissionCatalog) {
      map[item.key] = item.label;
    }
    return map;
  }, [permissionCatalog]);

  const roleCountMap = useMemo(() => {
    const counts = {};
    for (const member of staffList) {
      counts[member.roleKey] = (counts[member.roleKey] || 0) + 1;
    }
    return counts;
  }, [staffList]);

  const fetchStaffPayload = useCallback(async () => {
    const [staffRes, activityRes] = await Promise.all([
      fetch(`${API_BASE}/admin/staff-support`, {
        credentials: 'include',
        headers: getAuthHeaders()
      }),
      fetch(`${API_BASE}/admin/staff-support/activity?limit=40`, {
        credentials: 'include',
        headers: getAuthHeaders()
      }).catch(() => null)
    ]);

    const staffData = await staffRes.json().catch(() => ({}));
    if (!staffRes.ok || !staffData.success) {
      throw new Error(staffData.error || `Failed to load staff directory (${staffRes.status}).`);
    }

    const actData = activityRes && activityRes.ok
      ? await activityRes.json().catch(() => ({}))
      : {};

    return { staffData, actData };
  }, []);

  const loadStaffData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError('');
      const { staffData, actData } = await fetchStaffPayload();
      setStaffList(Array.isArray(staffData.staff) ? staffData.staff : []);
      setRolePresets(staffData.rolePresets || {});
      setPermissionCatalog(Array.isArray(staffData.permissionCatalog) ? staffData.permissionCatalog : []);
      setCanManageStaff(Boolean(staffData.canManageStaff));
      setActivityEvents(Array.isArray(actData.events) ? actData.events : []);
    } catch (err) {
      console.error('[AdminStaffSupport] Load error:', err);
      setFetchError(err.message || 'Could not load staff support configuration.');
    } finally {
      setLoading(false);
    }
  }, [fetchStaffPayload]);

  useEffect(() => {
    let cancelled = false;
    fetchStaffPayload()
      .then(({ staffData, actData }) => {
        if (cancelled) return;
        setStaffList(Array.isArray(staffData.staff) ? staffData.staff : []);
        setRolePresets(staffData.rolePresets || {});
        setPermissionCatalog(Array.isArray(staffData.permissionCatalog) ? staffData.permissionCatalog : []);
        setCanManageStaff(Boolean(staffData.canManageStaff));
        setActivityEvents(Array.isArray(actData.events) ? actData.events : []);
        setFetchError('');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[AdminStaffSupport] Load error:', err);
        setFetchError(err.message || 'Could not load staff support configuration.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchStaffPayload]);

  const openCreateModal = () => {
    const defaultRole = 'support_agent';
    setEditingStaff(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setShowPassword(false);
    setFormRoleKey(defaultRole);
    setFormPermissions([...(rolePresets[defaultRole]?.permissions || [])]);
    setFormAllowedIpsText('');
    setFormIsActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingStaff(member);
    setFormName(member.name || '');
    setFormEmail(member.email || '');
    setFormPassword('');
    setShowPassword(false);
    setFormRoleKey(member.roleKey || 'support_agent');
    setFormPermissions(Array.isArray(member.permissions) ? [...member.permissions] : []);
    setFormAllowedIpsText(Array.isArray(member.allowedIps) ? member.allowedIps.join(', ') : '');
    setFormIsActive(member.isActive !== false);
    setFormError('');
    setModalOpen(true);
  };

  const handleRolePresetChange = (nextRoleKey) => {
    setFormRoleKey(nextRoleKey);
    const presetPerms = rolePresets[nextRoleKey]?.permissions;
    if (Array.isArray(presetPerms)) {
      setFormPermissions([...presetPerms]);
    }
  };

  const togglePermission = (permKey) => {
    setFormPermissions((prev) =>
      prev.includes(permKey)
        ? prev.filter((item) => item !== permKey)
        : [...prev, permKey]
    );
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!editingStaff) {
      if (!formName.trim()) {
        setFormError('Staff full name is required.');
        return;
      }
      if (!formEmail.trim()) {
        setFormError('Staff email address is required.');
        return;
      }
      if (formPassword.length < 8) {
        setFormError('Password must be at least 8 characters.');
        return;
      }
    }

    try {
      setSaving(true);
      const baseHeaders = getAuthHeaders({ 'Content-Type': 'application/json' });
      const grant = await requestSensitiveActionGrant(baseHeaders, API_ORIGIN, {
        mode: 'admin_pin',
        title: editingStaff ? 'Confirm Staff Role Update' : 'Confirm New Support Staff',
        description: editingStaff
          ? `Enter your Admin Security PIN to update ${editingStaff.email}.`
          : `Enter your Admin Security PIN to create staff access for ${formEmail.trim()}.`
      });

      const endpoint = editingStaff
        ? `${API_BASE}/admin/staff-support/${encodeURIComponent(editingStaff.userId)}`
        : `${API_BASE}/admin/staff-support`;
      const method = editingStaff ? 'PUT' : 'POST';

      const payload = editingStaff
        ? {
            name: formName.trim() || undefined,
            roleKey: formRoleKey,
            permissions: formPermissions,
            allowedIps: formAllowedIpsText,
            isActive: formIsActive
          }
        : {
            name: formName.trim(),
            email: formEmail.trim(),
            password: formPassword,
            roleKey: formRoleKey,
            permissions: formPermissions,
            allowedIps: formAllowedIpsText,
            isActive: formIsActive
          };

      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: {
          ...baseHeaders,
          'x-tiwlo-reauth-grant': grant
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not save staff configuration.');
      }

      showToast?.(data.message || (editingStaff ? 'Staff permissions updated.' : 'Support staff created.'));
      setModalOpen(false);
      await loadStaffData();
    } catch (err) {
      setFormError(err.message || 'Could not save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      const baseHeaders = getAuthHeaders({ 'Content-Type': 'application/json' });
      const grant = await requestSensitiveActionGrant(baseHeaders, API_ORIGIN, {
        mode: 'admin_pin',
        title: 'Revoke Staff Access',
        description: `Enter your Admin Security PIN to revoke admin access for ${removeTarget.email}.`
      });

      const res = await fetch(`${API_BASE}/admin/staff-support/${encodeURIComponent(removeTarget.userId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...baseHeaders,
          'x-tiwlo-reauth-grant': grant
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not remove staff member.');
      }

      showToast?.(data.message || 'Staff access revoked.');
      setRemoveTarget(null);
      await loadStaffData();
    } catch (err) {
      showToast?.(err.message || 'Failed to revoke staff access.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const visibleRolePresets = useMemo(() => {
    return Object.values(rolePresets).filter((preset) => {
      if (preset.key === 'super_admin' && !actorIsSuperAdmin) return false;
      return true;
    });
  }, [rolePresets, actorIsSuperAdmin]);

  return (
    <div className="space-y-4 sm:space-y-5 font-sans">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:underline dark:text-neutral-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Dashboard</span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Staff Support & Access Control
              </h1>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {staffList.length} {staffList.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Assign Meta-style support role templates, granular permissions, mandatory Security PINs, and optional IP whitelists.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadStaffData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>

            {canManageStaff && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ED760] px-3.5 py-2 text-xs sm:text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953]"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Support Staff</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {[
            { id: 'directory', label: 'Staff Directory', icon: Users },
            { id: 'roles', label: 'Role Templates', icon: Shield },
            { id: 'activity', label: 'Security Activity', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!canManageStaff && !loading && !fetchError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You have read-only access to the staff directory. Modifying staff roles or IP whitelists requires the <strong className="font-semibold">Manage Staff &amp; Roles</strong> permission.
          </span>
        </div>
      )}

      {/* Role Templates Overview */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRolePresets.map((preset) => {
            const count = roleCountMap[preset.key] || 0;
            const badgeStyle = ROLE_BADGE_STYLES[preset.key] || ROLE_BADGE_STYLES.support_agent;
            return (
              <div
                key={preset.key}
                className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeStyle}`}>
                      {preset.label}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      {count} assigned
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-neutral-900 dark:text-white">
                    {preset.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Capabilities ({preset.permissions?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(preset.permissions || []).map((permKey) => (
                      <span
                        key={permKey}
                        className="inline-flex items-center rounded-lg bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {permissionLabelMap[permKey] || permKey}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Directory */}
      {activeTab === 'directory' && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-2xs overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400">
              <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-2 border-[#1ED760] border-t-transparent" />
              <span>Loading staff support profiles...</span>
            </div>
          ) : fetchError ? (
            <div className="p-6 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" />
              <p className="text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400">{fetchError}</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">No support staff configured</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Add dedicated support staff with tailored permissions and optional IP restrictions.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-400">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Granular Permissions</th>
                      <th className="py-3 px-3">Security PIN</th>
                      <th className="py-3 px-3">IP Whitelist</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                    {staffList.map((member) => {
                      const badgeStyle = ROLE_BADGE_STYLES[member.roleKey] || ROLE_BADGE_STYLES.support_agent;
                      const ipCount = member.allowedIps?.length || 0;
                      const canEditRow = canManageStaff && (!member.isSuperAdmin || actorIsSuperAdmin);
                      const canRemoveRow = canEditRow && !member.isSuperAdmin && member.userId !== currentUser?.id;

                      return (
                        <tr key={member.userId} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-700">
                                {(member.name || member.email || 'S').slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-semibold text-neutral-900 dark:text-white">
                                    {member.name}
                                  </p>
                                  {!member.isActive && (
                                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${badgeStyle}`}>
                              {rolePresets[member.roleKey]?.label || member.roleTitle || member.roleKey}
                            </span>
                          </td>

                          <td className="py-3 px-3 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {(member.permissions || []).slice(0, 3).map((perm) => (
                                <span
                                  key={perm}
                                  className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                >
                                  {permissionLabelMap[perm] || perm}
                                </span>
                              ))}
                              {(member.permissions?.length || 0) > 3 && (
                                <span className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                  +{member.permissions.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {member.hasPin ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>PIN Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                <KeyRound className="h-3 w-3" />
                                <span>Setup Required</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {ipCount > 0 ? (
                              <span
                                title={member.allowedIps.join(', ')}
                                className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760]"
                              >
                                <Lock className="h-3 w-3" />
                                <span>Locked to {ipCount} {ipCount === 1 ? 'IP' : 'IPs'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                <Globe className="h-3 w-3" />
                                <span>Any IP</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canEditRow && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(member)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  <span>Edit Role &amp; IPs</span>
                                </button>
                              )}
                              {canRemoveRow && (
                                <button
                                  type="button"
                                  onClick={() => setRemoveTarget(member)}
                                  aria-label={`Remove ${member.name}`}
                                  className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (375px-friendly) */}
              <div className="md:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                {staffList.map((member) => {
                  const badgeStyle = ROLE_BADGE_STYLES[member.roleKey] || ROLE_BADGE_STYLES.support_agent;
                  const ipCount = member.allowedIps?.length || 0;
                  const canEditRow = canManageStaff && (!member.isSuperAdmin || actorIsSuperAdmin);
                  const canRemoveRow = canEditRow && !member.isSuperAdmin && member.userId !== currentUser?.id;

                  return (
                    <div key={member.userId} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-700">
                            {(member.name || member.email || 'S').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">
                              {member.name}
                            </p>
                            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeStyle}`}>
                          {rolePresets[member.roleKey]?.label || member.roleKey}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {member.hasPin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>PIN Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <KeyRound className="h-3 w-3" />
                            <span>Setup Required</span>
                          </span>
                        )}

                        {ipCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#1ED760]/40 bg-[#1ED760]/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760]">
                            <Lock className="h-3 w-3" />
                            <span>Locked to {ipCount} {ipCount === 1 ? 'IP' : 'IPs'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            <Globe className="h-3 w-3" />
                            <span>Any IP</span>
                          </span>
                        )}

                        {!member.isActive && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {(member.permissions || []).slice(0, 4).map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                          >
                            {permissionLabelMap[perm] || perm}
                          </span>
                        ))}
                        {(member.permissions?.length || 0) > 4 && (
                          <span className="inline-flex rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            +{member.permissions.length - 4}
                          </span>
                        )}
                      </div>

                      {(canEditRow || canRemoveRow) && (
                        <div className="flex items-center gap-2 pt-1">
                          {canEditRow && (
                            <button
                              type="button"
                              onClick={() => openEditModal(member)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              <span>Edit Role &amp; IPs</span>
                            </button>
                          )}
                          {canRemoveRow && (
                            <button
                              type="button"
                              onClick={() => setRemoveTarget(member)}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Security Activity Tab (Super Admin events isolated server-side) */}
      {activeTab === 'activity' && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-2xs overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-100 px-4 py-3.5 dark:border-neutral-800">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Staff &amp; PIN Security Events
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Audit trail for IP whitelist blocks, PIN verification lockouts, and staff role changes.
            </p>
          </div>

          {activityEvents.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No recent staff security events recorded.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {activityEvents.map((ev) => (
                <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        ev.severity === 'warning' || ev.severity === 'critical'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}>
                        {ev.eventType}
                      </span>
                      {ev.userEmail && (
                        <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                          {ev.userEmail}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {ev.remoteIp && <span className="font-mono">{ev.remoteIp}</span>}
                    <span>{formatDateShort(ev.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Support Staff Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={editingStaff ? 'Edit Support Staff' : 'Add Support Staff'}
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-100 bg-white px-4 py-3.5 sm:px-6 sm:py-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#149642] dark:text-[#1ED760]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm sm:text-base font-bold">
                    {editingStaff ? 'Edit Staff Role & IP Whitelist' : 'Add Support Staff Member'}
                  </h2>
                  <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                    {editingStaff ? editingStaff.email : 'Create dedicated staff credentials with least-privilege RBAC'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 p-4 sm:p-6">
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ayesha Rahman"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    required={!editingStaff}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    disabled={Boolean(editingStaff)}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="staff@tiwlo.com"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:disabled:bg-neutral-800/50"
                    required={!editingStaff}
                  />
                </div>
              </div>

              {!editingStaff && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Initial Password (min 8 characters)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Strong staff password"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    required
                    minLength={8}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Role Preset
                  </label>
                  <select
                    value={formRoleKey}
                    onChange={(e) => handleRolePresetChange(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm text-neutral-900 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    {visibleRolePresets.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.title}
                      </option>
                    ))}
                  </select>
                </div>

                {editingStaff && (
                  <div className="flex items-end">
                    <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
                      <span>Staff Access Active</span>
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="h-4 w-4 accent-[#1ED760]"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Granular Permissions */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Granular Permissions ({formPermissions.length} selected)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRolePresetChange(formRoleKey)}
                    className="text-[11px] font-semibold text-[#149642] hover:underline dark:text-[#1ED760]"
                  >
                    Reset to preset defaults
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissionCatalog.map((perm) => {
                    const checked = formPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          checked
                            ? 'border-[#1ED760]/60 bg-[#1ED760]/10 dark:border-[#1ED760]/40 dark:bg-[#1ED760]/10'
                            : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.key)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1ED760]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight">
                            {perm.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional IP Whitelist */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Allowed Whitelist IPs <span className="font-normal text-neutral-400">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formAllowedIpsText}
                  onChange={(e) => setFormAllowedIpsText(e.target.value)}
                  placeholder="e.g. 103.x.x.x, 203.x.x.x — Leave empty for any IP; if provided, access from other IPs is immediately blocked"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-900 placeholder:font-sans placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  Separate multiple IPv4 or IPv6 addresses with commas or new lines. Leave blank to allow sign-in from any IP.
                </p>
              </div>

              {/* Mandatory PIN status note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-300">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#149642] dark:text-[#1ED760]" />
                <span>
                  {editingStaff?.hasPin
                    ? 'This staff member already has an active scrypt-hashed Security PIN.'
                    : 'Mandatory Security PIN: this member will be required to complete 2-step PIN setup before accessing Admin Console tools.'}
                </span>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-5 py-2 text-xs sm:text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953] disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{saving ? 'Saving...' : (editingStaff ? 'Save Changes' : 'Create Staff Account')}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Remove Staff Confirmation Modal */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !removing) setRemoveTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Revoke Staff Access"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Revoke Staff Privileges?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  Remove admin &amp; support access for <strong className="font-semibold text-neutral-900 dark:text-white">{removeTarget.email}</strong>. Active sessions will be immediately terminated.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={handleConfirmRemove}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {removing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{removing ? 'Revoking...' : 'Confirm & Revoke'}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
