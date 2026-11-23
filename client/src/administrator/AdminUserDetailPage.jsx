import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  Laptop,
  LogOut,
  MapPin,
  Network,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserCheck,
  Wallet
} from 'lucide-react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import AdminBiometricVaultCard from './components/AdminBiometricVaultCard.jsx';
import {
  ADMIN_API_BASE as API_BASE,
  adminFetch,
  compactSignalLabel,
  countryCodeToFlag,
  formatDateTime,
  formatUsd,
  getAdminAuthHeaders,
  getRiskBadgeStyle,
  getSeverityBadge,
  isSuperAdminUser
} from './components/adminUserHelpers.js';

const DETAIL_TABS = [
  { id: 'timeline', label: 'Live Trail & Security Timeline' },
  { id: 'stores', label: 'Stores & Wallet' },
  { id: 'locations', label: 'Login Locations & Devices' },
  { id: 'sessions', label: 'Active Sessions' },
  { id: 'claims', label: 'Claims & Billing' },
  { id: 'governance', label: 'Linked Accounts & Governance' }
];

export default function AdminUserDetailPage({
  userId,
  backView = 'customers',
  onBack,
  onNavigate,
  showToast,
  currentUser
}) {
  const [dossier, setDossier] = useState(null);
  const [userContext, setUserContext] = useState(null);
  const [liveTrail, setLiveTrail] = useState([]);
  const [liveTrailCursor, setLiveTrailCursor] = useState(null);
  const [liveTrailHasMore, setLiveTrailHasMore] = useState(false);
  const [liveTrailLoadingMore, setLiveTrailLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');

  const [actionLoading, setActionLoading] = useState(false);
  const [terminatingSessions, setTerminatingSessions] = useState(false);
  const [revokingBiometric, setRevokingBiometric] = useState(false);

  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banLinkedCluster, setBanLinkedCluster] = useState(false);
  const [blockDeviceSignals, setBlockDeviceSignals] = useState(false);

  const loadUserDossier = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const encodedId = encodeURIComponent(userId);
      const headers = getAdminAuthHeaders();
      const [activityRes, trailRes, ctxRes] = await Promise.all([
        adminFetch(`${API_BASE}/admin/users/${encodedId}/activity`, {
          credentials: 'include',
          cache: 'no-store',
          headers
        }),
        adminFetch(`${API_BASE}/admin/telemetry/users/${encodedId}/live-trail?limit=30`, {
          credentials: 'include',
          cache: 'no-store',
          headers
        }).catch(() => null),
        globalThis.fetch(`${API_BASE}/admin/support/users/${encodedId}/context`, {
          credentials: 'include',
          cache: 'no-store',
          headers
        }).catch(() => null)
      ]);

      const activityJson = await activityRes.json().catch(() => ({}));
      if (!activityRes.ok || !activityJson.success) {
        throw new Error(activityJson.error || `Failed to load user profile (${activityRes.status}).`);
      }
      setDossier(activityJson);

      if (ctxRes && ctxRes.ok) {
        const ctxJson = await ctxRes.json().catch(() => ({}));
        if (ctxJson?.success !== false) {
          setUserContext(ctxJson.context || ctxJson);
        }
      } else {
        setUserContext(null);
      }

      if (trailRes && trailRes.ok) {
        const trailJson = await trailRes.json().catch(() => ({}));
        if (trailJson?.success) {
          setLiveTrail(Array.isArray(trailJson.items) ? trailJson.items : []);
          setLiveTrailCursor(trailJson.nextCursorId || null);
          setLiveTrailHasMore(Boolean(trailJson.hasMore));
        }
      } else {
        setLiveTrail([]);
        setLiveTrailCursor(null);
        setLiveTrailHasMore(false);
      }
    } catch (err) {
      setError(err.message || 'Could not load user profile & biometric details.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setActiveTab('timeline');
    loadUserDossier();
  }, [loadUserDossier]);

  const handleLoadOlderLiveTrail = async () => {
    if (!userId || !liveTrailCursor || liveTrailLoadingMore) return;
    setLiveTrailLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: '30', beforeId: String(liveTrailCursor) });
      const res = await adminFetch(
        `${API_BASE}/admin/telemetry/users/${encodeURIComponent(userId)}/live-trail?${params.toString()}`,
        {
          credentials: 'include',
          headers: getAdminAuthHeaders()
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        const nextItems = Array.isArray(json.items) ? json.items : [];
        setLiveTrail((prev) => [...prev, ...nextItems]);
        setLiveTrailCursor(json.nextCursorId || null);
        setLiveTrailHasMore(Boolean(json.hasMore));
      }
    } catch {
      showToast?.('Could not load older activity logs.', 'error');
    } finally {
      setLiveTrailLoadingMore(false);
    }
  };

  const handleTerminateUserSessions = async () => {
    const targetId = dossier?.user?.id || userId;
    if (!targetId || terminatingSessions) return;
    setTerminatingSessions(true);
    try {
      const res = await globalThis.fetch(`${API_BASE}/admin/support/security/terminate-sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetId,
          reason: 'Terminated from Dedicated User Profile Page'
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not terminate active sessions.');
      }
      showToast?.('All active sessions terminated for user.', 'success');
      await loadUserDossier();
    } catch (err) {
      showToast?.(err.message || 'Session termination failed.', 'error');
    } finally {
      setTerminatingSessions(false);
    }
  };

  const handleRevokeBiometric = async () => {
    const targetId = dossier?.user?.id || userId;
    if (!targetId || revokingBiometric) return;
    setRevokingBiometric(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/admin/users/${encodeURIComponent(targetId)}/biometric/revoke`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Revoked from Dedicated User Profile Page' })
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not revoke biometric credential.');
      }
      showToast?.(json.message || 'Mobile biometric credential revoked.', 'success');
      await loadUserDossier();
    } catch (err) {
      showToast?.(err.message || 'Biometric revocation failed.', 'error');
    } finally {
      setRevokingBiometric(false);
    }
  };

  const handleToggleOtp = async () => {
    const target = dossier?.user;
    if (!target?.id) return;
    setActionLoading(true);
    try {
      const nextOtpDisabled = !target.otpDisabled;
      const res = await globalThis.fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(target.id)}/otp`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpDisabled: nextOtpDisabled })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update Two-Factor setting.');
      }
      showToast?.(
        data.message || `Two-Factor ${nextOtpDisabled ? 'disabled' : 'enabled'} for ${target.name}.`,
        'success'
      );
      await loadUserDossier();
    } catch (err) {
      showToast?.(err.message || 'Failed to update Two-Factor setting.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequireIdentityVerification = async () => {
    const target = dossier?.user;
    if (!target?.id) return;
    setActionLoading(true);
    try {
      const res = await adminFetch(
        `${API_BASE}/admin/users/${encodeURIComponent(target.id)}/identity-verification/require`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
          body: '{}'
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not require identity verification.');
      }
      showToast?.(data.message || 'Identity verification is now required.', 'success');
      await loadUserDossier();
    } catch (err) {
      showToast?.(err.message || 'Failed to require identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanSubmit = async ({ isBanning }) => {
    const target = dossier?.user;
    if (!target?.id) return;
    if (isBanning && !banReason.trim()) {
      showToast?.('Please enter a suspension/ban reason.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders()
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_BASE.replace(/\/api\/?$/, '')
      );

      const useCluster = banLinkedCluster || blockDeviceSignals || isBanning;
      const endpoint = useCluster
        ? `${API_BASE}/admin/users/${encodeURIComponent(target.id)}/ban-cluster`
        : `${API_BASE}/admin/users/${encodeURIComponent(target.id)}/ban`;

      let res = await adminFetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(
          useCluster
            ? {
                isBanned: isBanning,
                reason: banReason.trim(),
                banLinkedCluster,
                blockDeviceSignals
              }
            : { isBanned: isBanning, reason: banReason.trim() }
        )
      });

      if (res.status === 404 && !banLinkedCluster && !blockDeviceSignals) {
        res = await adminFetch(`${API_BASE}/admin/users/${encodeURIComponent(target.id)}/ban`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ isBanned: isBanning, reason: banReason.trim() })
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update enforcement status.');
      }

      showToast?.(data.message || 'Account enforcement updated.', 'success');
      setBanModalOpen(false);
      setBanReason('');
      setBanLinkedCluster(false);
      setBlockDeviceSignals(false);
      await loadUserDossier();
    } catch (err) {
      showToast?.(err.message || 'Failed to update enforcement status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const dossierUser = dossier?.user || null;
  const dossierIntel = dossier?.riskIntelligence || {};
  const riskStyle = getRiskBadgeStyle(dossierIntel.riskLevel);
  const isSuperAdminActor = isSuperAdminUser(currentUser);
  const targetIsSuperAdmin = isSuperAdminUser(dossierUser);
  const canManageUser = Boolean(
    dossierUser && !targetIsSuperAdmin && (dossierUser.role !== 'admin' || isSuperAdminActor)
  );

  const mainCode = dossier?.mainCountryCode || dossierUser?.mainCountryCode || null;
  const mainName = dossier?.mainCountry || dossierUser?.mainCountry || mainCode;
  const lastCode = dossier?.lastLoginCountryCode || dossierUser?.lastLoginCountryCode || null;
  const lastName = dossier?.lastLoginCountry || dossierUser?.lastLoginCountry || lastCode;
  const crossBorder = Boolean(mainCode && lastCode && mainCode !== lastCode);

  const walletCash =
    userContext?.wallet?.credits ??
    userContext?.cashBalance ??
    dossierUser?.cashBalance ??
    0;
  const walletPromo =
    userContext?.wallet?.promotionalCredits ??
    userContext?.promoCreditBalance ??
    dossierUser?.promoCreditBalance ??
    0;
  const userStores = Array.isArray(userContext?.stores)
    ? userContext.stores
    : Array.isArray(dossier?.stores)
      ? dossier.stores
      : [];
  const activeSessionsList = Array.isArray(userContext?.activeSessions)
    ? userContext.activeSessions
    : Array.isArray(dossier?.activeSessions)
      ? dossier.activeSessions
      : [];

  const backLabel =
    backView === 'users' ? 'Back to Users & Risk Monitor' : 'Back to Tiwlo Users & Stores';

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : onNavigate?.(backView || 'customers'))}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </button>

          <button
            type="button"
            onClick={loadUserDossier}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Profile
          </button>
        </div>

        {loading && !dossier ? (
          <div className="py-16 text-center text-neutral-400 text-xs space-y-2">
            <div className="w-7 h-7 border-2 border-[#1ED760] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading complete user dossier, stores, and biometric vault...</p>
          </div>
        ) : error && !dossier ? (
          <div className="p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 text-center space-y-2">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={loadUserDossier}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <img
                  src={dossierUser?.avatar || '/tiwlo-icon.png'}
                  alt={dossierUser?.name || 'User'}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-neutral-200 dark:ring-neutral-800 shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white truncate">
                      {dossierUser?.name || 'Tiwlo User'}
                    </h1>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
                      {targetIsSuperAdmin
                        ? 'Super Admin'
                        : dossierUser?.role === 'owner'
                          ? 'Tiwlo User'
                          : dossierUser?.role || 'User'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tabular-nums ${riskStyle.pill}`}
                    >
                      Risk {dossierIntel.riskScore || 0}/100 · {riskStyle.label}
                    </span>
                    {dossierUser?.isBanned ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        BANNED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border border-[#1ED760]/30">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {dossierUser?.email} · ID:{' '}
                    <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-200">
                      {userContext?.billingId || dossierUser?.tiwiId || dossierUser?.id}
                    </span>
                    {dossierUser?.phone ? ` · ${dossierUser.phone}` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(mainCode || mainName) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-800">
                        <span>{countryCodeToFlag(mainCode) || '🌐'}</span>
                        <span>Main: {mainName}</span>
                      </span>
                    )}
                    {(lastCode || lastName) && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          crossBorder
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-800'
                        }`}
                      >
                        <span>{countryCodeToFlag(lastCode) || '🌐'}</span>
                        <span>Last Login: {lastName}</span>
                      </span>
                    )}
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

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate?.(`user-locations/${encodeURIComponent(dossierUser?.id || userId)}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760]"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Location History
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate?.(`identity-verification/${encodeURIComponent(dossierUser?.id || userId)}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760]"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Identity Files
                </button>

                {canManageUser && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleToggleOtp}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1ED760]" />
                      2FA: {dossierUser?.otpDisabled ? 'Off' : 'On'}
                    </button>

                    {!dossierUser?.identityVerified && !dossierUser?.identityVerificationRequired && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleRequireIdentityVerification}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] disabled:opacity-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Require ID Check
                      </button>
                    )}

                    {!dossierUser?.isBanned ? (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setBanReason('');
                          setBanLinkedCluster(false);
                          setBlockDeviceSignals(false);
                          setBanModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Suspend / Ban
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleBanSubmit({ isBanning: false })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c354] text-black text-xs font-semibold disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Lift Suspension
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {dossierUser?.isBanned && dossierUser?.banReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Account Suspended:</span> {dossierUser.banReason}
                </div>
              </div>
            )}

            {/* Quick Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-[#1ED760]" /> Wallet Cash
                </span>
                <p className="text-sm font-bold text-neutral-900 dark:text-white mt-0.5 tabular-nums">
                  {formatUsd(walletCash)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Gift className="w-3 h-3 text-amber-500" /> Promo Credits
                </span>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                  {formatUsd(walletPromo)}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Store className="w-3 h-3 text-[#1ED760]" /> Stores
                </span>
                <p className="text-sm font-bold text-neutral-900 dark:text-white mt-0.5 tabular-nums">
                  {userStores.length || dossierUser?.storeCount || 0}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Laptop className="w-3 h-3" /> Devices
                </span>
                <p className="text-sm font-bold text-neutral-900 dark:text-white mt-0.5 tabular-nums">
                  {dossierIntel.deviceCount ?? dossier?.deviceIdentities?.length ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3 min-w-0">
                <span className="text-[10px] text-neutral-400 block">Last Seen IP</span>
                <p className="text-xs font-mono font-semibold text-neutral-900 dark:text-white mt-1 truncate">
                  {dossierIntel.lastIp || 'Unavailable'}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3">
                <span className="text-[10px] text-neutral-400 block">Joined</span>
                <p className="text-xs font-semibold text-neutral-900 dark:text-white mt-1 tabular-nums truncate">
                  {formatDateTime(dossierUser?.createdAt)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dedicated Fingerprint & Biometric Vault Section */}
      {dossier && (
        <AdminBiometricVaultCard
          biometric={dossier.biometric}
          identitySummary={dossier.identityVerification}
          policy={dossier.countryFeaturePolicy || dossierUser?.countryFeaturePolicy}
          dossierUser={dossierUser}
          canManageUser={canManageUser}
          terminatingSessions={terminatingSessions}
          revokingBiometric={revokingBiometric}
          onTerminateSessions={handleTerminateUserSessions}
          onRevokeBiometric={handleRevokeBiometric}
          onOpenIdentityReview={() =>
            onNavigate?.(`identity-verification/${encodeURIComponent(dossierUser?.id || userId)}`)
          }
        />
      )}

      {/* Detailed Tabs Section */}
      {dossier && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-1 border-b border-neutral-200/80 dark:border-neutral-800 overflow-x-auto no-scrollbar">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#1ED760] text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'timeline' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Live Trail */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1ED760]" />
                  Live Page Visits &amp; Clicks ({liveTrail.length})
                </h4>
                {liveTrail.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No live page visits or click actions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {liveTrail.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-1"
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
                          <span className="text-[10px] text-neutral-400 tabular-nums">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-3">
                          <span>{entry.targetLabel || entry.metadata?.title || entry.eventKind}</span>
                          {entry.ipAddress && <span className="font-mono">IP: {entry.ipAddress}</span>}
                        </div>
                      </div>
                    ))}
                    {liveTrailHasMore && (
                      <button
                        type="button"
                        disabled={liveTrailLoadingMore}
                        onClick={handleLoadOlderLiveTrail}
                        className="w-full py-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-[#1ED760] text-xs font-semibold text-neutral-700 dark:text-neutral-200 disabled:opacity-50"
                      >
                        {liveTrailLoadingMore ? 'Loading older logs...' : 'Load older logs'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Security Events */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Security &amp; Login Events ({dossier?.securityEvents?.length || 0})
                </h4>
                {!dossier?.securityEvents?.length ? (
                  <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No security or authentication events recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {dossier.securityEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${getSeverityBadge(ev.severity)}`}
                            >
                              {ev.severity}
                            </span>
                            <span className="font-mono text-xs font-medium text-neutral-900 dark:text-white truncate">
                              {ev.event_type || ev.eventType}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 tabular-nums">
                            {formatDateTime(ev.created_at || ev.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap gap-3">
                          {ev.remote_ip && <span className="font-mono">IP: {ev.remote_ip}</span>}
                          {ev.subnet_24 && <span className="font-mono">Subnet: {ev.subnet_24}</span>}
                          {ev.path && <span className="font-mono">{ev.method} {ev.path}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'stores' && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Owned Stores ({userStores.length})
              </h4>
              {userStores.length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                  This user has not created any stores yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {userStores.map((st) => (
                    <div
                      key={st.id || st.tiwiId}
                      className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                            {st.storeName || st.name || 'Tiwlo Store'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border border-[#1ED760]/30">
                            {st.status || 'active'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-neutral-500 truncate">
                          {st.subdomain || st.tiwiId || st.id}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Plan: {st.planName || st.planId || 'Free'} · Created {formatDateTime(st.createdAt)}
                        </p>
                      </div>
                      {st.subdomain && (
                        <a
                          href={`https://${st.subdomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-[#1ED760]"
                          title="Open storefront"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Captured Login Locations ({dossier?.loginLocations?.length || 0})
                </h4>
                {!dossier?.loginLocations?.length ? (
                  <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No login locations recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dossier.loginLocations.map((loc, idx) => (
                      <div
                        key={loc.id || idx}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#1ED760] shrink-0" />
                            <span className="truncate">
                              {loc.formattedAddress || loc.area || loc.city || 'Location Capture'}
                            </span>
                          </p>
                          <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                            Source: {loc.source} · IP: {loc.ipAddress || '—'}
                          </p>
                        </div>
                        <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                          {formatDateTime(loc.capturedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Device Identities &amp; Fingerprints ({dossier?.deviceIdentities?.length || 0})
                </h4>
                {!dossier?.deviceIdentities?.length ? (
                  <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No device identities recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dossier.deviceIdentities.map((dev) => (
                      <div
                        key={dev.id}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-semibold text-neutral-900 dark:text-white truncate">
                            FP: {dev.device_fingerprint_hash || dev.device_token_hash || '—'}
                          </span>
                          <span className="text-[10px] text-neutral-400 tabular-nums">
                            Seen: {formatDateTime(dev.last_seen_at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 flex flex-wrap gap-3 font-mono">
                          {dev.ip_address && <span>IP: {dev.ip_address}</span>}
                          {dev.subnet_24 && <span>Subnet: {dev.subnet_24}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Active Sessions ({activeSessionsList.length})
                </h4>
                {canManageUser && (
                  <button
                    type="button"
                    disabled={terminatingSessions}
                    onClick={handleTerminateUserSessions}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <LogOut className="w-3 h-3" />
                    {terminatingSessions ? 'Terminating...' : 'Revoke All Remote Sessions'}
                  </button>
                )}
              </div>

              {activeSessionsList.length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                  No active sessions found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {activeSessionsList.map((sess, idx) => (
                    <div
                      key={sess.sessionId || sess.id || idx}
                      className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-neutral-900 dark:text-white truncate">
                          {sess.deviceName || sess.platform || 'Web / Mobile Session'}
                        </span>
                        <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                          {formatDateTime(sess.lastSeenAt || sess.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 font-mono truncate">
                        IP: {sess.ipAddress || sess.ip || 'Unknown'} · {sess.countryCode || 'Unknown'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Free Store Claims ({dossier?.freeStoreClaims?.length || 0})
                </h4>
                {!dossier?.freeStoreClaims?.length ? (
                  <p className="text-xs text-neutral-400 py-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No free store claim history.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dossier.freeStoreClaims.map((claim) => (
                      <div
                        key={claim.id}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            Store: {claim.store_name || claim.tiwi_id}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            IP: {claim.ip_address || '—'} · FP: {claim.device_fingerprint_hash || '—'}
                          </p>
                        </div>
                        <span className="text-[10px] text-neutral-400 tabular-nums">
                          {formatDateTime(claim.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Credit Top-ups &amp; Billing ({dossier?.billingOrdersOrTopups?.length || 0})
                </h4>
                {!dossier?.billingOrdersOrTopups?.length ? (
                  <p className="text-xs text-neutral-400 py-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No credit top-ups or billing orders recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dossier.billingOrdersOrTopups.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {order.description || order.planId || order.type || 'Billing Order'} · {formatUsd(order.amountUsd)}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            Method: {order.method || '—'} · Status: {order.status || 'completed'}
                          </p>
                        </div>
                        <span className="text-[10px] text-neutral-400 tabular-nums">
                          {formatDateTime(order.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-[#1ED760]" />
                  Linked Multi-Account Cluster ({dossierIntel.linkedAccounts?.length || 0})
                </h4>
                {!dossierIntel.linkedAccounts?.length ? (
                  <p className="text-xs text-neutral-400 py-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                    No shared hardware, browser, IP, or contact links detected with other accounts.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {dossierIntel.linkedAccounts.map((sibling) => (
                      <div
                        key={sibling.id}
                        className={`p-3 rounded-xl border ${
                          sibling.isBanned
                            ? 'border-rose-500/35 bg-rose-500/5 dark:bg-rose-950/20'
                            : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40'
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
                            <p className="text-[11px] text-neutral-500 truncate">{sibling.email}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                              Role: {sibling.role} · Joined {formatDateTime(sibling.createdAt)}
                            </p>
                          </div>

                          {(!isSuperAdminUser(sibling) || isSuperAdminActor) && (
                            <button
                              type="button"
                              onClick={() => onNavigate?.(`user-profile/${encodeURIComponent(sibling.id)}`)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] shrink-0"
                            >
                              Open Profile
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 p-3.5 text-xs space-y-1">
                <p>
                  <span className="text-neutral-400">Billing ID:</span>{' '}
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                    {userContext?.billingId || dossierUser?.tiwiId || '—'}
                  </span>
                </p>
                <p>
                  <span className="text-neutral-400">Support Tickets:</span>{' '}
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {userContext?.supportTickets?.length ?? 0}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ban / Cluster Enforcement Modal */}
      {banModalOpen && dossierUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-xs"
          onClick={() => setBanModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Ban className="w-5 h-5" />
              <h3 className="text-sm font-semibold">Suspend {dossierUser.name}</h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Specify the enforcement reason for suspending <span className="font-semibold">{dossierUser.email}</span>.
            </p>
            <textarea
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Reason for suspension / ban..."
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={banLinkedCluster}
                  onChange={(e) => setBanLinkedCluster(e.target.checked)}
                />
                <span>Also ban linked multi-account cluster siblings</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={blockDeviceSignals}
                  onChange={(e) => setBlockDeviceSignals(e.target.checked)}
                />
                <span>Block associated device &amp; network signals</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBanModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleBanSubmit({ isBanning: true })}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Applying...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
