import { applicationFetch } from '../api/graphqlTransport.js';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import { getDeviceTrackingHeaders } from '../utils/deviceFingerprint.js';
import PaginationBar from '../components/PaginationBar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  Eye,
  Fingerprint,
  Globe,
  History,
  Laptop,
  Lock,
  LogOut,
  MapPin,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Users,
  X
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const DEFAULT_PAGE_LIMIT = 10;

const RISK_FILTER_TABS = [
  { id: 'all', label: 'All Users' },
  { id: 'active', label: 'Active' },
  { id: 'ban_evasion', label: 'Ban Evasion Risk' },
  { id: 'multi_account_ring', label: 'Multi-Account Ring' },
  { id: 'high_risk', label: 'High Risk (50+)' },
  { id: 'banned', label: 'Banned' },
  { id: 'verified', label: 'Verified' }
];

const DOSSIER_TABS = [
  { id: 'timeline', label: 'Security & Login Timeline' },
  { id: 'locations', label: 'Login Locations & IPs' },
  { id: 'sessions', label: 'Active Sessions' },
  { id: 'claims', label: 'Claims & Billing Activity' },
  { id: 'governance', label: 'Permissions, Comms & Appeals' }
];

function isSuperAdminUser(user) {
  return (
    user?.role === 'super_admin' ||
    String(user?.email || '').trim().toLowerCase() === 'tiwloltd@gmail.com'
  );
}

async function adminFetch(url, options = {}) {
  try {
    return await applicationFetch(url, options);
  } catch (err) {
    if (String(err?.message || '').includes('No GraphQL operation is registered')) {
      const deviceHeaders = await getDeviceTrackingHeaders().catch(() => ({}));
      const mergedHeaders = {
        ...deviceHeaders,
        ...(options.headers instanceof Headers
          ? Object.fromEntries(options.headers.entries())
          : (options.headers || {}))
      };
      return globalThis.fetch(url, {
        ...options,
        headers: mergedHeaders
      });
    }
    throw err;
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatUsd(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

function compactSignalLabel(signal) {
  const map = {
    'Shared Device Fingerprint': 'Same Device',
    'Shared Device Token': 'Device Token',
    'Same Persistent Browser': 'Same Browser',
    'Shared Hardware+Browser Identity': 'Hardware+Browser',
    'Same IP Address': 'Same IP',
    'Same /24 Network Subnet': 'Same Subnet',
    'Alias/Duplicate Contact': 'Duplicate Contact',
    'Blocked Device/Network Signal': 'Blocked Signal'
  };
  return map[signal] || signal;
}

function getRiskBadgeStyle(riskLevel) {
  switch (riskLevel) {
    case 'critical':
      return {
        pill: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
        bar: 'bg-rose-500',
        label: 'Critical'
      };
    case 'high':
      return {
        pill: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-neutral-200 dark:border-neutral-800',
        bar: 'bg-rose-400',
        label: 'High'
      };
    case 'medium':
      return {
        pill: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700',
        bar: 'bg-neutral-500 dark:bg-neutral-400',
        label: 'Medium'
      };
    default:
      return {
        pill: 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30',
        bar: 'bg-[#1ED760]',
        label: 'Clean'
      };
  }
}

function getSeverityBadge(severity) {
  const sev = String(severity || 'info').toLowerCase();
  if (sev === 'critical') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  if (sev === 'warning') return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700';
  if (sev === 'error') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25';
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

export default function AdminUsersView({ onBackToDashboard, showToast, currentUser, initialFilter = 'all' }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(() =>
    initialFilter === 'banned' ? 'banned' : initialFilter === 'active' ? 'active' : 'all'
  );
  const [riskFilter, setRiskFilter] = useState(() =>
    ['all', 'active', 'ban_evasion', 'multi_account_ring', 'high_risk', 'banned', 'verified'].includes(initialFilter)
      ? initialFilter
      : 'all'
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Risk intelligence state
  const [riskSummary, setRiskSummary] = useState({
    totalUsers: 0,
    banEvasionCount: 0,
    multiAccountRingCount: 0,
    highRiskCount: 0,
    bannedCount: 0
  });
  const [riskByUserId, setRiskByUserId] = useState({});
  const [flaggedUsers, setFlaggedUsers] = useState([]);
  const [riskLoading, setRiskLoading] = useState(false);

  // Modals state
  const [editUserTarget, setEditUserTarget] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', email: '', role: 'owner', planId: 'free' });
  const [banUserTarget, setBanUserTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banLinkedCluster, setBanLinkedCluster] = useState(false);
  const [blockDeviceSignals, setBlockDeviceSignals] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Meta-style inspection drawer state
  const [inspectTarget, setInspectTarget] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [userContext, setUserContext] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');
  const [dossierTab, setDossierTab] = useState('timeline');
  const [terminatingSessions, setTerminatingSessions] = useState(false);
  const [govPage, setGovPage] = useState(1);
  const [govPageSize, setGovPageSize] = useState(10);

  // Paginated chronological live activity trail inside Dossier
  const [liveTrail, setLiveTrail] = useState([]);
  const [liveTrailCursor, setLiveTrailCursor] = useState(null);
  const [liveTrailHasMore, setLiveTrailHasMore] = useState(false);
  const [liveTrailLoadingMore, setLiveTrailLoadingMore] = useState(false);

  const isSuperAdminActor = isSuperAdminUser(currentUser);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRiskIntel = useCallback(async () => {
    try {
      setRiskLoading(true);
      const res = await adminFetch(`${API_BASE}/admin/users/risk-intel`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success) return null;
      setRiskSummary(data.summary || {
        totalUsers: 0,
        banEvasionCount: 0,
        multiAccountRingCount: 0,
        highRiskCount: 0,
        bannedCount: 0
      });
      setRiskByUserId(data.riskByUserId || {});
      setFlaggedUsers(Array.isArray(data.flaggedUsers) ? data.flaggedUsers : []);
      return data;
    } catch (err) {
      console.warn('[Admin Risk Intel] Unavailable:', err.message);
      return null;
    } finally {
      setRiskLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchUsers = useCallback(async (targetPage = 1, riskPayload = null) => {
    try {
      setLoading(true);
      const isRiskTab = ['ban_evasion', 'multi_account_ring', 'high_risk'].includes(riskFilter);

      if (isRiskTab) {
        const intelData = riskPayload || { flaggedUsers, riskByUserId };
        let pool = Array.isArray(intelData.flaggedUsers) ? intelData.flaggedUsers : [];
        const q = search.trim().toLowerCase();

        pool = pool.filter((u) => {
          if (!isSuperAdminActor && isSuperAdminUser(u)) return false;
          const intel = u.riskIntelligence || intelData.riskByUserId?.[u.id] || {};
          const flags = intel.flags || [];
          if (riskFilter === 'ban_evasion' && !flags.includes('BAN_EVASION_RISK')) return false;
          if (riskFilter === 'multi_account_ring' && !flags.includes('MULTI_ACCOUNT_RING')) return false;
          if (riskFilter === 'high_risk' && (intel.riskScore || 0) < 50) return false;
          if (roleFilter !== 'all' && u.role !== roleFilter) return false;
          if (statusFilter === 'active' && u.isBanned) return false;
          if (statusFilter === 'banned' && !u.isBanned) return false;
          if (q) {
            const matches =
              String(u.tiwiId || '').toLowerCase().includes(q) ||
              String(u.email || '').toLowerCase().includes(q) ||
              String(u.name || '').toLowerCase().includes(q) ||
              String(u.id || '').toLowerCase().includes(q);
            if (!matches) return false;
          }
          return true;
        });

        const nextTotal = pool.length;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
        const safePage = Math.min(Math.max(1, targetPage), nextTotalPages);
        const startIdx = (safePage - 1) * pageSize;
        setUsers(pool.slice(startIdx, startIdx + pageSize));
        setTotal(nextTotal);
        setPage(safePage);
        setTotalPages(nextTotalPages);
        setFetchError('');
        return;
      }

      const effectiveStatus = riskFilter === 'banned'
        ? 'banned'
        : riskFilter === 'active'
          ? 'active'
          : statusFilter;
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: riskFilter === 'verified' ? '100' : String(pageSize),
        q: search.trim(),
        role: roleFilter,
        status: effectiveStatus
      });

      const res = await adminFetch(`${API_BASE}/admin/users?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status}).`);

      let fetched = Array.isArray(data.users) ? data.users : [];
      if (riskFilter === 'verified') {
        fetched = fetched.filter((u) => u.identityVerified === true);
        const vTotal = fetched.length;
        const vPages = Math.max(1, Math.ceil(vTotal / pageSize));
        const safeP = Math.min(Math.max(1, targetPage), vPages);
        const start = (safeP - 1) * pageSize;
        setUsers(fetched.slice(start, start + pageSize));
        setTotal(vTotal);
        setPage(safeP);
        setTotalPages(vPages);
      } else {
        setUsers(fetched);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      }
      setFetchError('');
    } catch (err) {
      console.error('[Admin Users] Fetch error:', err);
      setUsers([]);
      setFetchError('Live user data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, riskFilter, pageSize, getAuthHeaders, flaggedUsers, riskByUserId, isSuperAdminActor]);

  const refreshAll = useCallback(async (targetPage = 1) => {
    const intelData = await fetchRiskIntel();
    await fetchUsers(targetPage, intelData);
  }, [fetchRiskIntel, fetchUsers]);

  useEffect(() => {
    const normalized = String(initialFilter || 'all').trim();
    const validFilters = new Set([
      'all',
      'active',
      'ban_evasion',
      'multi_account_ring',
      'high_risk',
      'banned',
      'verified'
    ]);
    const nextFilter = validFilters.has(normalized) ? normalized : 'all';
    setRiskFilter(nextFilter);
    if (nextFilter === 'banned') setStatusFilter('banned');
    else if (nextFilter === 'active') setStatusFilter('active');
    else setStatusFilter('all');
    setPage(1);
  }, [initialFilter]);

  useEffect(() => {
    fetchRiskIntel();
  }, [fetchRiskIntel]);

  useEffect(() => {
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter, riskFilter, pageSize]);

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const isSuper = isSuperAdminUser(u);
      if (isSuper && !isSuperAdminActor) {
        return {
          ...u,
          riskIntelligence: {
            riskScore: 0,
            riskLevel: 'low',
            flags: [],
            matchedSignals: [],
            linkedAccounts: [],
            deviceCount: 0,
            lastIp: null,
            lastLocation: null,
            securityEventCount: 0,
            protectedAccount: true
          }
        };
      }
      return {
        ...u,
        riskIntelligence: u.riskIntelligence || riskByUserId[u.id] || {
          riskScore: 0,
          riskLevel: 'low',
          flags: [],
          matchedSignals: [],
          linkedAccounts: [],
          deviceCount: 0,
          lastIp: null,
          lastLocation: null,
          securityEventCount: 0
        }
      };
    });
  }, [users, riskByUserId, isSuperAdminActor]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchUsers(newPage);
  };

  // Open Meta-Style Inspection Drawer
  const openInspectionDrawer = async (targetUser) => {
    if (!targetUser?.id) return;
    if (isSuperAdminUser(targetUser) && !isSuperAdminActor) {
      showToast?.('Restricted: Super Administrator activity is isolated.', 'error');
      return;
    }
    setInspectTarget(targetUser);
    setDossier(null);
    setUserContext(null);
    setDossierError('');
    setDossierTab('timeline');
    setGovPage(1);
    setDossierLoading(true);
    setLiveTrail([]);
    setLiveTrailCursor(null);
    setLiveTrailHasMore(false);
    try {
      const encodedId = encodeURIComponent(targetUser.id);
      const [res, trailRes, ctxRes] = await Promise.all([
        adminFetch(`${API_BASE}/admin/users/${encodedId}/activity`, {
          credentials: 'include',
          headers: getAuthHeaders()
        }),
        adminFetch(`${API_BASE}/admin/telemetry/users/${encodedId}/live-trail?limit=30`, {
          credentials: 'include',
          headers: getAuthHeaders()
        }).catch(() => null),
        globalThis.fetch(`${API_BASE}/admin/support/users/${encodedId}/context`, {
          credentials: 'include',
          headers: getAuthHeaders()
        }).catch(() => null)
      ]);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to load activity dossier (${res.status}).`);
      }
      setDossier(data);

      if (ctxRes && ctxRes.ok) {
        const ctxJson = await ctxRes.json().catch(() => ({}));
        if (ctxJson?.success !== false) {
          setUserContext(ctxJson.context || ctxJson);
        }
      }

      if (trailRes && trailRes.ok) {
        const trailJson = await trailRes.json().catch(() => ({}));
        if (trailJson?.success) {
          setLiveTrail(Array.isArray(trailJson.items) ? trailJson.items : []);
          setLiveTrailCursor(trailJson.nextCursorId || null);
          setLiveTrailHasMore(Boolean(trailJson.hasMore));
        }
      }
    } catch (err) {
      setDossierError(err.message || 'Could not load user activity dossier.');
    } finally {
      setDossierLoading(false);
    }
  };

  const handleTerminateUserSessions = async (userId) => {
    if (!userId || terminatingSessions) return;
    setTerminatingSessions(true);
    try {
      const res = await globalThis.fetch(`${API_BASE}/admin/support/security/terminate-sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          reason: 'Terminated from User Inspection Drawer',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not terminate active sessions');
      }
      showToast?.('All active sessions terminated for user.', 'success');
      if (inspectTarget) await openInspectionDrawer(inspectTarget);
    } catch (err) {
      showToast?.(err.message || 'Session termination failed.', 'error');
    } finally {
      setTerminatingSessions(false);
    }
  };

  const handleLoadOlderLiveTrail = async () => {
    if (!inspectTarget?.id || !liveTrailCursor || liveTrailLoadingMore) return;
    try {
      setLiveTrailLoadingMore(true);
      const params = new URLSearchParams({
        cursor: String(liveTrailCursor),
        limit: '30'
      });
      const res = await adminFetch(
        `${API_BASE}/admin/telemetry/users/${encodeURIComponent(inspectTarget.id)}/live-trail?${params.toString()}`,
        {
          credentials: 'include',
          headers: getAuthHeaders()
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not load older activity logs.');
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setLiveTrail((prev) => [...prev, ...nextItems]);
      setLiveTrailCursor(json.nextCursorId || null);
      setLiveTrailHasMore(Boolean(json.hasMore));
    } catch (err) {
      showToast?.(err.message || 'Failed to load older logs.', 'error');
    } finally {
      setLiveTrailLoadingMore(false);
    }
  };

  // Ban / Cluster Ban / Unban User
  const handleClusterBanSubmit = async ({
    user,
    isBanning,
    reason = '',
    clusterBan = false,
    blockSignals = false
  }) => {
    if (!user?.id) return;
    try {
      setActionLoading(true);
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_BASE.replace(/\/api\/?$/, '')
      );

      const useClusterEndpoint = clusterBan || blockSignals || isBanning;
      const endpoint = useClusterEndpoint
        ? `${API_BASE}/admin/users/${encodeURIComponent(user.id)}/ban-cluster`
        : `${API_BASE}/admin/users/${encodeURIComponent(user.id)}/ban`;

      let res = await adminFetch(endpoint, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(
          useClusterEndpoint
            ? {
                isBanned: isBanning,
                reason,
                banLinkedCluster: clusterBan,
                blockDeviceSignals: blockSignals
              }
            : { isBanned: isBanning, reason }
        )
      });

      // Graceful fallback to /ban if /ban-cluster isn't mounted yet and cluster options weren't requested
      if (res.status === 404 && !clusterBan && !blockSignals) {
        res = await adminFetch(`${API_BASE}/admin/users/${encodeURIComponent(user.id)}/ban`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ isBanned: isBanning, reason })
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'User enforcement status updated.');
        setBanUserTarget(null);
        setBanReason('');
        setBanLinkedCluster(false);
        setBlockDeviceSignals(false);
        await refreshAll(page);
        if (inspectTarget?.id === user.id) {
          openInspectionDrawer(user);
        }
      } else {
        showToast?.(data.error || 'Failed to update user ban status', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error updating ban status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Require Identity Verification
  const handleRequireIdentityVerification = async (user) => {
    if (!user?.id) return;
    try {
      setActionLoading(true);
      const res = await adminFetch(
        `${API_BASE}/admin/users/${encodeURIComponent(user.id)}/identity-verification/require`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: '{}'
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'Identity verification is now required.');
        await refreshAll(page);
        if (inspectTarget?.id === user.id) {
          openInspectionDrawer(user);
        }
      } else {
        showToast?.(data.error || 'Could not require identity verification.', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to require identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit User Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editUserTarget) return;

    try {
      setActionLoading(true);
      const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_BASE.replace(/\/api\/?$/, '')
      );
      const res = await adminFetch(`${API_BASE}/admin/users/${encodeURIComponent(editUserTarget.id)}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(
          isSuperAdminActor
            ? editFormData
            : Object.fromEntries(Object.entries(editFormData).filter(([key]) => key !== 'role'))
        )
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.('User updated successfully');
        setEditUserTarget(null);
        await refreshAll(page);
      } else {
        showToast?.(data.error || 'Failed to update user', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error updating user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User
  const handleDeleteSubmit = async () => {
    if (!deleteUserTarget) return;

    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_BASE.replace(/\/api\/?$/, '')
      );
      const res = await adminFetch(`${API_BASE}/admin/users/${encodeURIComponent(deleteUserTarget.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'User deleted');
        if (inspectTarget?.id === deleteUserTarget.id) {
          setInspectTarget(null);
          setDossier(null);
        }
        setDeleteUserTarget(null);
        await refreshAll(page);
      } else {
        showToast?.(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error deleting user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openBanModal = (target, { presetCluster = false, presetBlockSignals = false } = {}) => {
    setBanUserTarget(target);
    setBanReason('');
    setBanLinkedCluster(presetCluster);
    setBlockDeviceSignals(presetBlockSignals);
  };

  const kpiCards = [
    {
      id: 'total',
      label: 'Total Users',
      value: riskSummary.totalUsers || total || 0,
      hint: 'Platform directory',
      icon: Users,
      accent: 'text-neutral-700 dark:text-neutral-200',
      iconBg: 'bg-neutral-100 dark:bg-neutral-800',
      active: riskFilter === 'all' && statusFilter === 'all',
      onClick: () => {
        setRiskFilter('all');
        setStatusFilter('all');
      }
    },
    {
      id: 'ban_evasion',
      label: 'Ban Evasion Risks',
      value: riskSummary.banEvasionCount || 0,
      hint: 'Linked to banned sibling',
      icon: ShieldAlert,
      accent: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      active: riskFilter === 'ban_evasion',
      onClick: () => {
        setRiskFilter((prev) => (prev === 'ban_evasion' ? 'all' : 'ban_evasion'));
        setStatusFilter('all');
      }
    },
    {
      id: 'multi_account_ring',
      label: 'Multi-Account Rings',
      value: riskSummary.multiAccountRingCount || 0,
      hint: 'Shared device / browser',
      icon: Network,
      accent: 'text-neutral-900 dark:text-white',
      iconBg: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
      active: riskFilter === 'multi_account_ring',
      onClick: () => {
        setRiskFilter((prev) => (prev === 'multi_account_ring' ? 'all' : 'multi_account_ring'));
        setStatusFilter('all');
      }
    },
    {
      id: 'banned',
      label: 'Banned Accounts',
      value: riskSummary.bannedCount || 0,
      hint: 'Suspended & restricted',
      icon: Ban,
      accent: 'text-neutral-900 dark:text-white',
      iconBg: 'bg-neutral-900/5 dark:bg-white/10 text-neutral-700 dark:text-neutral-300',
      active: riskFilter === 'banned' || statusFilter === 'banned',
      onClick: () => {
        setRiskFilter((prev) => (prev === 'banned' ? 'all' : 'banned'));
      }
    }
  ];

  const banTargetIntel = banUserTarget
    ? (banUserTarget.riskIntelligence || riskByUserId[banUserTarget.id] || dossier?.riskIntelligence)
    : null;
  const activeNonAdminSiblingsCount = (banTargetIntel?.linkedAccounts || []).filter(
    (s) => !s.isBanned && s.role !== 'admin' && !isSuperAdminUser(s)
  ).length;

  const dossierUser = dossier?.user || inspectTarget;
  const dossierIntel = dossier?.riskIntelligence || inspectTarget?.riskIntelligence || {};
  const dossierRiskStyle = getRiskBadgeStyle(dossierIntel.riskLevel);
  const dossierIsSuperAdmin = isSuperAdminUser(dossierUser);
  const canManageDossierUser = dossierUser && !dossierIsSuperAdmin && (dossierUser.role !== 'admin' || isSuperAdminActor);

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-950 px-4 py-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white tracking-tight">
              Users & Identity Risk Intelligence
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border border-[#1ED760]/30 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
              {total} Shown
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Trust & Safety cluster monitoring for multi-account rings, ban evasion, device fingerprints, and account lifecycle actions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => refreshAll(page)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || riskLoading ? 'animate-spin' : ''}`} />
            <span>Sync Graph</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className={`text-left p-3.5 rounded-2xl border transition-all bg-white dark:bg-neutral-950 ${
                card.active
                  ? 'border-[#1ED760] ring-2 ring-[#1ED760]/20'
                  : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                  {card.label}
                </span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`mt-1.5 text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${card.accent}`}>
                {card.value}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                {card.hint}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs overflow-hidden">
        {/* Risk Filter Tabs */}
        <div className="px-3 sm:px-4 pt-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {RISK_FILTER_TABS.map((tab) => {
            const isActive = riskFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setRiskFilter(tab.id);
                  if (tab.id === 'banned') setStatusFilter('banned');
                  else if (tab.id === 'active') setStatusFilter('active');
                  else if (statusFilter === 'banned' || statusFilter === 'active') setStatusFilter('all');
                }}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#1ED760] text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls */}
        <div className="p-3 px-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Search by Tiwi ID (TIW-xxxx), email, or name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-[#1ED760]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                if (riskFilter === 'banned' && e.target.value !== 'banned') {
                  setRiskFilter('all');
                }
              }}
              className="flex-1 sm:flex-none px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-[#1ED760]"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="banned">Suspended / Banned</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
              }}
              className="flex-1 sm:flex-none px-2.5 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-[#1ED760]"
            >
              <option value="all">All Roles</option>
              <option value="owner">Tiwlo Users (Owners)</option>
              <option value="super_admin">Super Admins</option>
              <option value="staff">Staff Members</option>
              <option value="customer">Customers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead>
              <tr className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-50/70 dark:bg-neutral-900/50 border-b border-neutral-200/80 dark:border-neutral-800">
                <th className="py-2.5 px-4">User & Tiwi ID</th>
                <th className="py-2.5 px-3">Role & Plan</th>
                <th className="py-2.5 px-3">Identity & 2FA</th>
                <th className="py-2.5 px-3">Risk Intelligence</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <div className="w-6 h-6 border-2 border-[#1ED760] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading users & risk intelligence (20/page)...</span>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-500">{fetchError}</td>
                </tr>
              ) : enrichedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    No users found matching your current filters.
                  </td>
                </tr>
              ) : (
                enrichedUsers.map((u) => {
                  const isSuperAdmin = isSuperAdminUser(u);
                  const canManageUser = !isSuperAdmin && (u.role !== 'admin' || isSuperAdminActor);
                  const hideSuperAdminIntel = isSuperAdmin && !isSuperAdminActor;
                  const intel = u.riskIntelligence || {};
                  const riskStyle = getRiskBadgeStyle(intel.riskLevel);
                  const linkedCount = intel.linkedAccounts?.length || 0;
                  const bannedSiblingCount = (intel.linkedAccounts || []).filter((s) => s.isBanned).length;

                  return (
                    <tr
                      key={u.id}
                      onClick={() => {
                        if (!hideSuperAdminIntel) openInspectionDrawer(u);
                      }}
                      onKeyDown={(e) => {
                        if (!hideSuperAdminIntel && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openInspectionDrawer(u);
                        }
                      }}
                      tabIndex={hideSuperAdminIntel ? undefined : 0}
                      title={hideSuperAdminIntel ? undefined : 'Click to inspect user activity logs & dossier'}
                      className={`transition-colors ${
                        hideSuperAdminIntel
                          ? 'hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40'
                          : 'cursor-pointer hover:bg-neutral-50/90 dark:hover:bg-neutral-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/40'
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-800 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate leading-tight">
                                {u.name}
                              </p>
                              {u.registrationSource === 'pick_app' && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700">
                                  PICK
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-tight mt-0.5">
                              {u.email}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                                {u.tiwiId || u.id}
                              </span>
                              {u.deliveryRegistration ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  {u.deliveryRegistration.status === 'pending'
                                    ? 'Delivery · Pending'
                                    : u.deliveryRegistration.isOnDuty
                                      ? 'Delivery · On duty'
                                      : `Delivery · ${u.deliveryRegistration.status}`}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Plan */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isSuperAdmin
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25'
                                : u.role === 'admin'
                                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
                                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {isSuperAdmin ? 'Super Admin' : u.role === 'owner' ? 'Tiwlo User' : u.role}
                          </span>
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-400 tabular-nums">
                            {u.planName || 'Free Starter'} · {u.storeCount || 0} store{u.storeCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>

                      {/* Identity & Security Badges */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {u.identityVerified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border border-[#1ED760]/30">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          ) : u.identityVerificationRequired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700">
                              <Clock className="w-3 h-3" /> ID Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700">
                              Unverified
                            </span>
                          )}
                          {u.twoFactorEnabled && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                              <Lock className="w-2.5 h-2.5" /> 2FA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Risk Intelligence */}
                      <td className="py-3 px-3">
                        {hideSuperAdminIntel ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700">
                            <Lock className="w-3 h-3" /> Protected
                          </span>
                        ) : (
                          <div className="space-y-1.5 max-w-[240px]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums ${riskStyle.pill}`}
                              >
                                {riskStyle.label} · {intel.riskScore || 0}
                              </span>
                              <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden min-w-[44px]">
                                <div
                                  className={`h-full rounded-full ${riskStyle.bar}`}
                                  style={{ width: `${Math.min(100, Math.max(4, intel.riskScore || 0))}%` }}
                                />
                              </div>
                            </div>

                            {(intel.matchedSignals?.length > 0 || bannedSiblingCount > 0) && (
                              <div className="flex flex-wrap gap-1">
                                {bannedSiblingCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 tabular-nums">
                                    Banned Sibling ({bannedSiblingCount})
                                  </span>
                                )}
                                {(intel.matchedSignals || []).slice(0, 2).map((sig) => (
                                  <span
                                    key={sig}
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700"
                                  >
                                    {compactSignalLabel(sig)}
                                  </span>
                                ))}
                                {linkedCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border border-neutral-200/70 dark:border-neutral-800 tabular-nums">
                                    +{linkedCount} linked
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            u.isBanned
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                              : 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30'
                          }`}
                        >
                          {u.isBanned ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {!hideSuperAdminIntel && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openInspectionDrawer(u);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] hover:text-neutral-900 dark:hover:text-white transition-colors"
                              title="Inspect Activity & Cluster Dossier"
                            >
                              <Eye className="w-3 h-3" />
                              <span className="hidden xl:inline">Inspect Activity</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={!canManageUser}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditUserTarget(u);
                              setEditFormData({
                                name: u.name,
                                email: u.email,
                                role: u.role,
                                planId: u.planId
                              });
                            }}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {canManageUser && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (u.isBanned) {
                                  handleClusterBanSubmit({ user: u, isBanning: false });
                                } else {
                                  openBanModal(u);
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                u.isBanned
                                  ? 'text-emerald-600 dark:text-[#1ED760] hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title={u.isBanned ? 'Restore User Access' : 'Suspend User Account'}
                            >
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                          )}

                          {canManageUser && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteUserTarget(u);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Clean 10 / 25 / 50 / 100 Pagination Bar */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          itemLabel="users"
        />
      </div>

      {/* Meta-Style Identity & Activity Inspection Drawer */}
      {inspectTarget && (
        <div className="fixed inset-0 z-50 flex justify-end bg-neutral-950/50 backdrop-blur-xs">
          <div className="w-full sm:max-w-2xl h-full bg-white dark:bg-neutral-950 border-l border-neutral-200/80 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={dossierUser?.avatar || '/default-avatar.svg'}
                  alt={dossierUser?.name || 'User'}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-neutral-200 dark:ring-neutral-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white truncate">
                      {dossierUser?.name || 'User Activity Dossier'}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums ${dossierRiskStyle.pill}`}
                    >
                      Risk {dossierIntel.riskScore || 0}/100 · {dossierRiskStyle.label}
                    </span>
                    {dossierUser?.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        BANNED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                    {dossierUser?.email} · Billing ID:{' '}
                    <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-200">
                      {userContext?.billingId || dossierUser?.billingId || dossierUser?.tiwiId || dossierUser?.id}
                    </span>{' '}
                    · Stores:{' '}
                    <span className="font-semibold tabular-nums">
                      {userContext?.storeCreatorsCount ?? userContext?.stores?.length ?? dossierUser?.storeCount ?? 0}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {(dossierIntel.flags || []).map((flag) => (
                      <span
                        key={flag}
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800"
                      >
                        {flag.replaceAll('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInspectTarget(null);
                  setDossier(null);
                  setLiveTrail([]);
                  setLiveTrailCursor(null);
                  setLiveTrailHasMore(false);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0"
                aria-label="Close inspection drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Telemetry Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 sm:px-5 py-3 bg-neutral-50/70 dark:bg-neutral-900/50 border-b border-neutral-200/80 dark:border-neutral-800 text-[11px]">
              <div className="min-w-0">
                <span className="text-neutral-400 block">Devices Observed</span>
                <span className="font-semibold text-neutral-900 dark:text-white tabular-nums flex items-center gap-1 mt-0.5">
                  <Laptop className="w-3 h-3 text-neutral-400" />
                  {dossierIntel.deviceCount ?? dossier?.deviceIdentities?.length ?? 0}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-neutral-400 block">Last Seen IP</span>
                <span className="font-mono font-semibold text-neutral-900 dark:text-white truncate block mt-0.5">
                  {dossierIntel.lastIp || 'Unavailable'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-neutral-400 block">Last Location</span>
                <span className="font-semibold text-neutral-900 dark:text-white truncate block mt-0.5">
                  {dossierIntel.lastLocation || 'Unavailable'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-neutral-400 block">Security Events</span>
                <span className="font-semibold text-neutral-900 dark:text-white tabular-nums block mt-0.5">
                  {dossierIntel.securityEventCount ?? dossier?.securityEvents?.length ?? 0}
                </span>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {dossierLoading ? (
                <div className="py-16 text-center text-xs text-neutral-400">
                  <div className="w-6 h-6 border-2 border-[#1ED760] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Building Meta-style Trust & Safety dossier...
                </div>
              ) : dossierError ? (
                <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  {dossierError}
                </div>
              ) : (
                <>
                  {/* Linked Account Cluster Graph */}
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-[#1ED760]" />
                        Linked Account Cluster Graph ({dossier?.linkedAccounts?.length || 0} Siblings)
                      </h4>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {dossierIntel.matchedSignals?.length || 0} shared signal types
                      </span>
                    </div>

                    {!dossier?.linkedAccounts?.length ? (
                      <div className="p-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 text-center">
                        No sibling accounts linked by device fingerprint, persistent browser, IP, or contact alias.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {dossier.linkedAccounts.map((sibling) => (
                          <div
                            key={sibling.id}
                            className={`p-3 rounded-xl border transition-colors ${
                              sibling.isBanned
                                ? 'border-rose-500/35 bg-rose-500/5 dark:bg-rose-950/20'
                                : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                                    {sibling.name}
                                  </p>
                                  {sibling.isBanned && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-600 text-white">
                                      BANNED
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                                  {sibling.email}
                                </p>
                                <p className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                                  Role: {sibling.role} · Joined {formatDateTime(sibling.createdAt)}
                                </p>
                              </div>

                              {(!isSuperAdminUser(sibling) || isSuperAdminActor) && (
                                <button
                                  type="button"
                                  onClick={() => openInspectionDrawer(sibling)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-medium border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] shrink-0"
                                >
                                  Inspect
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 mt-2">
                              {(sibling.matchedSignals || []).map((sig) => (
                                <span
                                  key={sig}
                                  className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800"
                                >
                                  {compactSignalLabel(sig)}
                                </span>
                              ))}
                            </div>

                            {sibling.isBanned && sibling.banReason && (
                              <p className="mt-2 text-[10px] text-rose-600 dark:text-rose-400 line-clamp-2">
                                Ban reason: {sibling.banReason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Chronological Dossier Tabs */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-1 border-b border-neutral-200/80 dark:border-neutral-800 overflow-x-auto no-scrollbar">
                      {DOSSIER_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDossierTab(tab.id)}
                          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                            dossierTab === tab.id
                              ? 'border-[#1ED760] text-neutral-900 dark:text-white'
                              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {dossierTab === 'timeline' && (
                      <div className="space-y-4">
                        {/* Paginated Chronological Page Visits, Clicks & Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#1ED760]" />
                              <span>Chronological Page Visits &amp; Action Logs ({liveTrail.length})</span>
                            </h5>
                          </div>
                          {liveTrail.length === 0 ? (
                            <p className="text-xs text-neutral-400 py-3 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                              No live page visits or click actions recorded yet.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {liveTrail.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col gap-1"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold border border-[#1ED760]/30 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]">
                                        {entry.eventKind}
                                      </span>
                                      <span className="font-mono text-xs font-medium text-neutral-900 dark:text-white truncate">
                                        {entry.pagePath || '—'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                                      When: {formatDateTime(entry.createdAt)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-3">
                                    <span>
                                      What: {entry.targetLabel || entry.metadata?.title || entry.eventKind}
                                    </span>
                                    {entry.ipAddress && <span className="font-mono">IP: {entry.ipAddress}</span>}
                                  </div>
                                </div>
                              ))}
                              {liveTrailHasMore && (
                                <button
                                  type="button"
                                  disabled={liveTrailLoadingMore}
                                  onClick={handleLoadOlderLiveTrail}
                                  className="w-full py-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#1ED760] text-xs font-semibold text-neutral-700 dark:text-neutral-200 disabled:opacity-50 transition-colors"
                                >
                                  {liveTrailLoadingMore ? 'Loading older logs...' : 'Load older logs'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Security & Login Events */}
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" /> Security &amp; Login Events ({dossier?.securityEvents?.length || 0})
                          </h5>
                          {!dossier?.securityEvents?.length ? (
                            <p className="text-xs text-neutral-400 py-4 text-center">No security events recorded for this account.</p>
                          ) : (
                            dossier.securityEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col gap-1"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-neutral-400" />
                                    <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                                      {ev.event_type}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${getSeverityBadge(ev.severity)}`}>
                                      {ev.severity}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-neutral-400 tabular-nums">
                                    {formatDateTime(ev.created_at)}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-3">
                                  {ev.remote_ip && <span className="font-mono">IP: {ev.remote_ip}</span>}
                                  {ev.user_agent && <span className="truncate max-w-full">UA: {ev.user_agent}</span>}
                                </div>
                                {ev.details && Object.keys(ev.details).length > 0 && (
                                  <pre className="mt-1 p-2 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-[10px] text-neutral-600 dark:text-neutral-400 overflow-x-auto">
                                    {JSON.stringify(ev.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {dossierTab === 'locations' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> Captured Login Locations
                          </h5>
                          {!dossier?.loginLocations?.length ? (
                            <p className="text-xs text-neutral-400 py-4 text-center">No login location records found.</p>
                          ) : (
                            dossier.loginLocations.map((loc, idx) => (
                              <div
                                key={`${loc.captured_at}-${idx}`}
                                className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-neutral-900 dark:text-white">
                                    {loc.formatted_address || loc.area || 'Resolved coordinate'}
                                  </p>
                                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                                    Source: {String(loc.location_source || 'ip').toUpperCase()} · {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
                                  </p>
                                </div>
                                <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                                  {formatDateTime(loc.captured_at)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                            <Fingerprint className="w-3.5 h-3.5" /> Known Device Signatures
                          </h5>
                          {!dossier?.deviceIdentities?.length ? (
                            <p className="text-xs text-neutral-400 py-4 text-center">No device identity hashes recorded.</p>
                          ) : (
                            dossier.deviceIdentities.map((dev) => (
                              <div
                                key={dev.id}
                                className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between gap-2 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-neutral-900 dark:text-white capitalize">
                                    {dev.platform_class || 'unknown'}
                                  </span>
                                  <span className="ml-2 font-mono text-[11px] text-neutral-500">
                                    fp:{dev.device_preview || '—'} · ip:{dev.ip_preview || '—'}
                                  </span>
                                </div>
                                <div className="text-right text-[10px] text-neutral-400 tabular-nums">
                                  <div>{dev.login_count} logins</div>
                                  <div>Last: {formatDateTime(dev.last_seen_at)}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {dossierTab === 'sessions' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                            Active Sessions ({userContext?.activeSessions?.length ?? dossier?.activeSessions?.length ?? 0})
                          </span>
                          <button
                            type="button"
                            disabled={terminatingSessions}
                            onClick={() => handleTerminateUserSessions(dossierUser?.id || inspectTarget?.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            {terminatingSessions ? 'Terminating...' : 'Terminate All Sessions'}
                          </button>
                        </div>
                        {!(userContext?.activeSessions?.length || dossier?.activeSessions?.length) ? (
                          <p className="text-xs text-neutral-400 py-6 text-center">No active sessions found for this user.</p>
                        ) : (
                          (userContext?.activeSessions || dossier?.activeSessions || []).map((sess, idx) => (
                            <div
                              key={`${sess.sessionPreview || sess.id || idx}`}
                              className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-mono font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5 text-[#1ED760]" />
                                  {sess.ip || sess.ipAddress || 'IP unavailable'}
                                </span>
                                <span className="text-[10px] text-neutral-400 tabular-nums">
                                  Created {formatDateTime(sess.createdAt)} · Expires {formatDateTime(sess.expiresAt)}
                                </span>
                              </div>
                              {sess.userAgent && (
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 break-all">
                                  {sess.userAgent}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {dossierTab === 'claims' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                            Free Store Claims ({dossier?.freeStoreClaims?.length || 0})
                          </h5>
                          {!dossier?.freeStoreClaims?.length ? (
                            <p className="text-xs text-neutral-400 py-3">No free store claims recorded.</p>
                          ) : (
                            dossier.freeStoreClaims.map((claim) => (
                              <div
                                key={claim.id}
                                className="p-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">{claim.store_id}</span>
                                  <span className="ml-2 text-neutral-500">({claim.plan_id} · {claim.platform_class})</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 tabular-nums">{formatDateTime(claim.created_at)}</span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                            Promo Claims ({dossier?.promoClaims?.length || 0})
                          </h5>
                          {!dossier?.promoClaims?.length ? (
                            <p className="text-xs text-neutral-400 py-3">No promotional claims recorded.</p>
                          ) : (
                            dossier.promoClaims.map((promo) => (
                              <div
                                key={promo.id}
                                className="p-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-neutral-900 dark:text-white">
                                    {promo.promo_code || promo.claim_type}
                                  </span>
                                  <span className="ml-2 text-emerald-600 dark:text-[#1ED760] font-semibold tabular-nums">
                                    {formatUsd(promo.amount_usd)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-400 tabular-nums">{formatDateTime(promo.created_at)}</span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Credit Top-ups & Billing ({dossier?.billingOrdersOrTopups?.length || 0})
                          </h5>
                          {!dossier?.billingOrdersOrTopups?.length ? (
                            <p className="text-xs text-neutral-400 py-3">No credit top-ups or billing orders recorded.</p>
                          ) : (
                            dossier.billingOrdersOrTopups.map((order) => (
                              <div
                                key={order.id}
                                className="p-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-neutral-900 dark:text-white capitalize">
                                    {order.provider}
                                  </span>
                                  <span className="ml-2 font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                                    {formatUsd(order.amount)} {order.currency}
                                  </span>
                                  <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                    {order.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-400 tabular-nums">{formatDateTime(order.created_at)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {dossierTab === 'governance' && (() => {
                      const overrides = Array.isArray(userContext?.permissionOverrides) ? userContext.permissionOverrides : [];
                      const comms = Array.isArray(userContext?.communicationHistory) ? userContext.communicationHistory : [];
                      const appeals = Array.isArray(userContext?.supportAppeals) ? userContext.supportAppeals : [];
                      const banAudits = Array.isArray(userContext?.banHistory) ? userContext.banHistory : (Array.isArray(userContext?.banAuditHistory) ? userContext.banAuditHistory : []);
                      const allRecords = [
                        ...overrides.map((o, i) => ({ _type: 'Permission Override', title: o.permission || o.key || 'Override', meta: o.grantedBy || o.effect || '', at: o.updatedAt || o.createdAt, key: `ov-${i}` })),
                        ...appeals.map((a, i) => ({ _type: 'Support Appeal', title: a.subject || a.serialNumber || 'Appeal Ticket', meta: a.status || 'open', at: a.createdAt, key: `ap-${i}` })),
                        ...banAudits.map((b, i) => ({ _type: 'Ban Reason Audit', title: b.reason || b.action || 'Account Restriction', meta: b.actorName || b.actorEmail || '', at: b.createdAt, key: `bn-${i}` })),
                        ...comms.map((c, i) => ({ _type: 'Communication', title: c.subject || c.channel || 'Message', meta: c.preview || c.summary || '', at: c.createdAt, key: `cm-${i}` })),
                      ];
                      const pagedGov = allRecords.slice((govPage - 1) * govPageSize, govPage * govPageSize);

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-2.5">
                              <span className="text-[10px] text-neutral-400 block">Billing ID</span>
                              <span className="font-mono font-semibold text-neutral-900 dark:text-white truncate block">
                                {userContext?.billingId || dossierUser?.tiwiId || '—'}
                              </span>
                            </div>
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-2.5">
                              <span className="text-[10px] text-neutral-400 block">Store Creators</span>
                              <span className="font-semibold tabular-nums text-neutral-900 dark:text-white flex items-center gap-1">
                                <Store className="w-3 h-3 text-[#1ED760]" />
                                {userContext?.storeCreatorsCount ?? userContext?.stores?.length ?? 0}
                              </span>
                            </div>
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-2.5">
                              <span className="text-[10px] text-neutral-400 block">Support Appeals</span>
                              <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                                {appeals.length}
                              </span>
                            </div>
                            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-2.5">
                              <span className="text-[10px] text-neutral-400 block">Permission Overrides</span>
                              <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                                {overrides.length}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
                            {pagedGov.length === 0 ? (
                              <p className="py-8 text-center text-xs text-neutral-400">
                                No permission overrides, support appeals, communication logs, or ban audit history recorded.
                              </p>
                            ) : (
                              <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                                {pagedGov.map((rec) => (
                                  <div key={rec.key} className="p-3 flex items-start justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                      <span className="inline-flex items-center gap-1 rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">
                                        <History className="w-2.5 h-2.5 text-[#1ED760]" />
                                        {rec._type}
                                      </span>
                                      <p className="font-semibold text-neutral-900 dark:text-white mt-1 truncate">
                                        {rec.title}
                                      </p>
                                      {rec.meta && (
                                        <p className="text-[11px] text-neutral-500 truncate">{rec.meta}</p>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                                      {formatDateTime(rec.at)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <PaginationBar
                              page={govPage}
                              pageSize={govPageSize}
                              total={allRecords.length}
                              onPageChange={setGovPage}
                              onPageSizeChange={(n) => {
                                setGovPageSize(n);
                                setGovPage(1);
                              }}
                              itemLabel="records"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                </>
              )}
            </div>

            {/* Trust & Safety Actions Footer */}
            {canManageDossierUser && (
              <div className="p-4 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!dossierUser.isBanned ? (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => openBanModal(dossierUser, { presetCluster: false, presetBlockSignals: false })}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors"
                      >
                        Ban User
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => openBanModal(dossierUser, { presetCluster: true, presetBlockSignals: true })}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                      >
                        Ban Cluster & Block Signals
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading || dossierUser.identityVerified || dossierUser.identityVerificationRequired}
                        onClick={() => handleRequireIdentityVerification(dossierUser)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          {dossierUser.identityVerified
                            ? 'ID Verified'
                            : dossierUser.identityVerificationRequired
                              ? 'ID Already Required'
                              : 'Require Identity Verification'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleClusterBanSubmit({ user: dossierUser, isBanning: false })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1ED760] hover:bg-[#19c055] text-neutral-950 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Restore / Unban Account</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditUserTarget(dossierUser);
                      setEditFormData({
                        name: dossierUser.name,
                        email: dossierUser.email,
                        role: dossierUser.role,
                        planId: dossierUser.planId
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteUserTarget(dossierUser)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl max-w-md w-full p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Edit User: {editUserTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditUserTarget(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:border-[#1ED760]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:border-[#1ED760]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Role</label>
                  <select
                    value={editFormData.role}
                    disabled={!isSuperAdminActor}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full p-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 disabled:opacity-60"
                  >
                    <option value="owner">Account Owner</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Plan</label>
                  <select
                    value={editFormData.planId}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      planId: e.target.value,
                      planName: ({
                        free: 'Free Starter',
                        growth: 'Growth Retailer',
                        pro: 'Pro Business',
                        enterprise: 'Enterprise VIP'
                      })[e.target.value]
                    })}
                    className="w-full p-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
                  >
                    <option value="free">Free Starter</option>
                    <option value="growth">Growth Retailer</option>
                    <option value="pro">Pro Business</option>
                    <option value="enterprise">Enterprise VIP</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditUserTarget(null)}
                  className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-[#1ED760] hover:bg-[#19c055] rounded-xl shadow-xs"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban / Cluster Enforcement Modal */}
      {banUserTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl max-w-md w-full p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Suspend / Ban Account
                </h3>
                <p className="text-[11px] text-neutral-500 truncate">
                  {banUserTarget.name} ({banUserTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Suspended accounts are immediately signed out and redirected to the disabled account appeal screen.
            </p>

            <div className="space-y-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={banLinkedCluster}
                  onChange={(e) => setBanLinkedCluster(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  <span className="font-semibold text-neutral-900 dark:text-white block">
                    Ban linked multi-account cluster ({activeNonAdminSiblingsCount} active non-admin sibling{activeNonAdminSiblingsCount === 1 ? '' : 's'})
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Automatically skips admin and super_admin accounts for safety.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={blockDeviceSignals}
                  onChange={(e) => setBlockDeviceSignals(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  <span className="font-semibold text-neutral-900 dark:text-white block">
                    Block device fingerprints, browser cookies & IP/subnet signals
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Prevents new signup & free-tier ban evasion from associated hardware/networks.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Reason for suspension:
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Multi-account ban evasion, free-tier abuse, policy violation..."
                rows={2}
                className="w-full p-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setBanUserTarget(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleClusterBanSubmit({
                  user: banUserTarget,
                  isBanning: true,
                  reason: banReason,
                  clusterBan: banLinkedCluster,
                  blockSignals: blockDeviceSignals
                })}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {actionLoading ? 'Enforcing...' : (banLinkedCluster ? 'Ban Cluster' : 'Confirm Suspension')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl max-w-md w-full p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Permanently Delete User?
                </h3>
                <p className="text-[11px] text-neutral-400 truncate">
                  {deleteUserTarget.name} ({deleteUserTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              This action cannot be undone. The user account and their active sessions will be permanently removed from the system database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
