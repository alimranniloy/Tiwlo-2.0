import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import { supportFetch } from '../utils/supportFetch';
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Ban, Calendar, ShieldAlert, Lock, RefreshCw, LogOut, Sparkles, Users } from 'lucide-react';
import { useTheme } from '../config/themeConfig';
import { AdminCurrencyProvider, useAdminCurrency } from './AdminCurrencyContext';
import AdminHeader, { isSuperAdminSensitiveItem, isSuperAdminUser } from './AdminHeader';
import AdminSidebar, { isAdminViewPermitted } from './AdminSidebar';
import MetricCards from './MetricCards';
import SalesOverviewChart from './SalesOverviewChart';
import RevenueBreakdownChart from './RevenueBreakdownChart';
import RecentActivities from './RecentActivities';
import PlatformStoresOverview from './PlatformStoresOverview';
import CloudOverview from './CloudOverview';
import QuickActions from './QuickActions';
import SystemInfoCard from './SystemInfoCard';
import AdminCustomersView from './AdminCustomersView';
import AdminUserLocationsView from './AdminUserLocationsView';
import AdminUsersView from './AdminUsersView';
import AdminGoogleDrivePage from './AdminGoogleDrivePage';
import AdminIdentityVerificationPage from './AdminIdentityVerificationPage';
import AdminSocialLoginSettings from './AdminSocialLoginSettings';
import AdminGoogleMapsSettings from './AdminGoogleMapsSettings';
import AdminPlatformPaymentsView from './AdminPlatformPaymentsView';
import AdminPackagesView from './AdminPackagesView';
import AdminPromotionsView from './AdminPromotionsView';
import AdminPickAccountAppealsView from './AdminPickAccountAppealsView';
import AdminDnsView from './AdminDnsView';
import AdminSystemOrdersView from './AdminSystemOrdersView';
import AdminDomainsView from './AdminDomainsView';
import AdminServersView from './AdminServersView';
import AdminLogsView from './AdminLogsView';
import AdminSystemSettingsView from './AdminSystemSettingsView';
import AdminStaffSupportView from './AdminStaffSupportView';
import AdminSupportDeskView from './AdminSupportDeskView';
import AdminComplianceAuditView from './AdminComplianceAuditView';
import AdminLiveVisitorsView from './AdminLiveVisitorsView';
import { AdminPinMandatoryPage } from './AdminPinGateModal';

const AdminDiscordBotView = lazy(() => import('./AdminDiscordBotView.jsx'));

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

function resolveInitialView() {
  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (pathname === 'administrator/customers' || pathname === 'admin/customers') return 'customers';
  if (pathname === 'administrator/users' || pathname === 'admin/users') return 'users';
  if (pathname === 'administrator/orders' || pathname === 'admin/orders') return 'orders';
  if (pathname === 'administrator/servers' || pathname === 'admin/servers') return 'servers';
  if (
    pathname === 'administrator/platform-payments' ||
    pathname === 'admin/platform-payments' ||
    pathname === 'administrator/payments' ||
    pathname === 'admin/payments'
  ) {
    return 'platform-payments';
  }
  if (pathname.startsWith('administrator/')) return pathname.replace('administrator/', '');
  if (pathname.startsWith('admin/')) return pathname.replace('admin/', '');
  return 'dashboard';
}

function isIpBlockedPayload(status, json) {
  if (status !== 403) return false;
  const code = String(json?.code || '');
  const message = String(json?.error || json?.message || '');
  return code === 'ADMIN_IP_NOT_ALLOWED' || /your ip is not whitelisted/i.test(message);
}

function isAddressVerificationRequiredPayload(status, json) {
  return status === 403 && String(json?.code || '') === 'ADDRESS_VERIFICATION_REQUIRED';
}

function AdminDashboardContent({
  currentUser,
  onLogout,
  showToast,
  ipBlockedMessage,
  onIpBlocked,
  onRetryIpCheck,
  onRequireAddressVerification
}) {
  const [activeView, setActiveView] = useState(resolveInitialView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [selectedRange, setSelectedRange] = useState('7days');
  const [staffAccess, setStaffAccess] = useState(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [safetyTelemetry, setSafetyTelemetry] = useState(null);
  const { isDark: isDarkMode, toggleTheme: toggleDarkMode } = useTheme();
  const { currency, activeRate, warning: rateWarning } = useAdminCurrency();

  const isSuperAdmin = isSuperAdminUser(currentUser, staffAccess);

  const handleNavigate = useCallback((view) => {
    setActiveView(view);
    const targetUrl = view === 'dashboard' ? '/administrator' : `/administrator/${view}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setActiveView(resolveInitialView());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const fetchStaffMe = useCallback(async () => {
    setStaffLoading(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/staff-support/me`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json().catch(() => ({}));
      if (isAddressVerificationRequiredPayload(res.status, json)) {
        onRequireAddressVerification?.();
        return;
      }
      if (isIpBlockedPayload(res.status, json)) {
        setAdminData(null);
        onIpBlocked(json?.error || 'Your IP is not whitelisted');
        return;
      }
      if (res.ok && json.success !== false) {
        setStaffAccess(json.data || json);
      }
    } catch (err) {
      console.error('[Admin] Error loading staff access context:', err);
    } finally {
      setStaffLoading(false);
    }
  }, [onIpBlocked, onRequireAddressVerification]);

  const fetchOverview = useCallback(
    async (range = selectedRange) => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const res = await fetch(`${API_BASE}/admin/overview?range=${encodeURIComponent(range)}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const json = await res.json().catch(() => ({}));
        if (isAddressVerificationRequiredPayload(res.status, json)) {
          onRequireAddressVerification?.();
          return;
        }
        if (isIpBlockedPayload(res.status, json)) {
          setAdminData(null);
          onIpBlocked(json?.error || 'Your IP is not whitelisted');
          return;
        }
        if (!res.ok || !json.success) {
          throw new Error(json.error || `Overview request failed (${res.status}).`);
        }
        setAdminData(json.data);
        setOverviewError('');
      } catch (err) {
        console.error('[Admin] Error fetching overview:', err);
        setAdminData(null);
        setOverviewError(err.message || 'Live dashboard data could not be loaded.');
      }
    },
    [onIpBlocked, onRequireAddressVerification, selectedRange]
  );

  useEffect(() => {
    fetchStaffMe();
  }, [fetchStaffMe]);

  useEffect(() => {
    if (ipBlockedMessage) return undefined;
    fetchOverview(selectedRange);
    const timer = setInterval(() => fetchOverview(selectedRange), 15000);
    return () => clearInterval(timer);
  }, [fetchOverview, ipBlockedMessage, selectedRange]);

  useEffect(() => {
    if (ipBlockedMessage) return undefined;
    supportFetch(`${API_BASE}/admin/support/analytics/platform-ops-summary?timeframe=7d`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && json.success !== false) setSafetyTelemetry(json);
      })
      .catch(() => {});
    return undefined;
  }, [ipBlockedMessage]);

  const filteredActivities = useMemo(() => {
    const raw = adminData?.recentActivities;
    if (!Array.isArray(raw)) return raw;
    return isSuperAdmin ? raw : raw.filter((item) => !isSuperAdminSensitiveItem(item));
  }, [adminData?.recentActivities, isSuperAdmin]);

  if (ipBlockedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950 px-4 py-10">
        <div className="max-w-md w-full bg-white dark:bg-neutral-950 rounded-xl border border-rose-200 dark:border-rose-900/60 p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              Your IP is not whitelisted
            </div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white pt-1">
              Access Denied
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {ipBlockedMessage === 'Your IP is not whitelisted'
                ? 'Your IP is not whitelisted. Wrong information or unauthorized connection.'
                : ipBlockedMessage}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onRetryIpCheck();
                fetchStaffMe();
                fetchOverview(selectedRange);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
            <button
              type="button"
              onClick={() => onLogout?.()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!staffLoading && staffAccess?.requiresPinSetup === true) {
    return (
      <AdminPinMandatoryPage
        currentUser={currentUser}
        onSuccess={() => fetchStaffMe()}
        onLogout={onLogout}
      />
    );
  }

  const effectiveStaffAccess = staffAccess || (isSuperAdmin ? { isSuperAdmin: true, roleKey: 'super_admin' } : null);
  const viewPermitted = isAdminViewPermitted(activeView, effectiveStaffAccess);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeFormatted =
    now.toLocaleDateString('en-US', { weekday: 'long' }) +
    ', ' +
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const storesOverviewData = adminData?.storesOverview || adminData?.platformStoresOverview || adminData?.metrics;

  const renderActiveView = () => {
    if (staffLoading && !isSuperAdmin && activeView !== 'dashboard') {
      return (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-8 text-center max-w-lg mx-auto my-8 space-y-2">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">Verifying staff access...</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Checking role permissions before opening this module.</p>
        </div>
      );
    }

    if (!viewPermitted) {
      return (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-8 text-center max-w-lg mx-auto my-8 space-y-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            Section Restricted by Role Policy
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Your staff role does not include permission to open this module.
          </p>
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1ED760] hover:bg-[#19c354] text-black transition-colors"
          >
            Back to Overview
          </button>
        </div>
      );
    }

    if (activeView === 'orders') {
      return <AdminSystemOrdersView onBackToDashboard={() => handleNavigate('dashboard')} />;
    }
    if (activeView === 'customers') {
      return (
        <AdminCustomersView
          onBackToDashboard={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          showToast={showToast}
          currentUser={currentUser}
        />
      );
    }
    if (activeView === 'domains') {
      return <AdminDomainsView onBackToDashboard={() => handleNavigate('dashboard')} />;
    }
    if (activeView === 'servers') {
      return <AdminServersView onBackToDashboard={() => handleNavigate('dashboard')} />;
    }
    if (activeView === 'logs') {
      return <AdminLogsView onBackToDashboard={() => handleNavigate('dashboard')} showToast={showToast} />;
    }
    if (activeView === 'system-settings') {
      return (
        <AdminSystemSettingsView
          onBackToDashboard={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'packages') {
      return (
        <AdminPackagesView
          onBackToDashboard={() => handleNavigate('dashboard')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'promotions') {
      return (
        <AdminPromotionsView
          onBackToDashboard={() => handleNavigate('dashboard')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'platform-payments' || activeView === 'payment-gateways') {
      return (
        <AdminPlatformPaymentsView
          onBackToDashboard={() => handleNavigate('dashboard')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'dns') {
      return <AdminDnsView showToast={showToast} />;
    }
    if (activeView === 'users') {
      return (
        <AdminUsersView
          onBackToDashboard={() => handleNavigate('dashboard')}
          showToast={showToast}
          currentUser={currentUser}
        />
      );
    }
    if (activeView === 'user-locations' || activeView.startsWith('user-locations/')) {
      return (
        <AdminUserLocationsView
          userId={
            activeView.startsWith('user-locations/')
              ? decodeURIComponent(activeView.slice('user-locations/'.length))
              : null
          }
          onNavigate={handleNavigate}
        />
      );
    }
    if (activeView.startsWith('identity-verification/')) {
      return (
        <AdminIdentityVerificationPage
          userId={decodeURIComponent(activeView.slice('identity-verification/'.length))}
          onBackToCustomers={() => handleNavigate('customers')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'support-desk' || activeView.startsWith('support-desk/')) {
      return (
        <AdminSupportDeskView
          initialTicketId={
            activeView.startsWith('support-desk/')
              ? decodeURIComponent(activeView.slice('support-desk/'.length))
              : null
          }
          onBackToDashboard={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          showToast={showToast}
          currentUser={currentUser}
          staffAccess={effectiveStaffAccess}
        />
      );
    }
    if (activeView === 'pick-account-appeals') {
      return <AdminPickAccountAppealsView />;
    }
    if (activeView === 'google-drive') {
      return <AdminGoogleDrivePage showToast={showToast} />;
    }
    if (activeView === 'social-login') {
      return (
        <AdminSocialLoginSettings
          onBackToDashboard={() => handleNavigate('system-settings')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'google-maps') {
      return (
        <AdminGoogleMapsSettings
          onBackToDashboard={() => handleNavigate('system-settings')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'staff-support') {
      return (
        <AdminStaffSupportView
          currentUser={currentUser}
          showToast={showToast}
          onBackToDashboard={() => handleNavigate('dashboard')}
        />
      );
    }
    if (activeView === 'compliance-audit') {
      return (
        <AdminComplianceAuditView
          onBackToDashboard={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'live-visitors') {
      return (
        <AdminLiveVisitorsView
          onBackToDashboard={() => handleNavigate('dashboard')}
          showToast={showToast}
        />
      );
    }
    if (activeView === 'discord-bot') {
      return (
        <Suspense
          fallback={
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center text-xs text-neutral-500">
              Loading Discord Bot console...
            </div>
          }
        >
          <AdminDiscordBotView
            currentUser={currentUser}
            showToast={showToast}
            onBackToDashboard={() => handleNavigate('dashboard')}
          />
        </Suspense>
      );
    }

    if (activeView !== 'dashboard') {
      return (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-8 text-center max-w-lg mx-auto my-8 space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            Admin Section Not Found
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            The requested view ({activeView}) does not exist.
          </p>
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1ED760] hover:bg-[#19c354] text-black transition-colors"
          >
            Return to Overview
          </button>
        </div>
      );
    }

    return (
      <>
        {/* Executive Overview Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#1ED760]" />
              <span>Welcome back, {currentUser?.name?.split(' ')[0] || 'Administrator'}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Platform Overview
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Real-time cash profit, tenant storefronts, infrastructure telemetry, and trust alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Card */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-lg bg-[#fafafa] dark:bg-neutral-900 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{dateFormatted}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{timeFormatted}</p>
              </div>
            </div>

            {/* System Status Card */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  !adminData && !overviewError
                    ? 'bg-amber-500'
                    : overviewError || !adminData?.systemInfo?.operational
                      ? 'bg-rose-500'
                      : 'bg-[#1ED760]'
                }`}
              />
              <div>
                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">System Status</p>
                <p
                  className={`text-[11px] font-medium ${
                    !adminData && !overviewError
                      ? 'text-amber-600 dark:text-amber-400'
                      : overviewError || !adminData?.systemInfo?.operational
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-[#159f46] dark:text-[#1ED760]'
                  }`}
                >
                  {!adminData && !overviewError
                    ? 'Checking services…'
                    : overviewError || adminData?.systemInfo?.status || 'Status unavailable'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {(rateWarning || (currency !== 'USD' && !activeRate)) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
            <span>
              {rateWarning || `Live exchange rate for ${currency} is unavailable — amounts are shown in USD.`}
            </span>
          </div>
        )}

        {/* Top 6 KPI Metric Cards */}
        <MetricCards metrics={adminData?.metrics} onNavigate={handleNavigate} />

        {/* Clean Shadcn Safety & Live Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => handleNavigate('live-visitors')}
            className="text-left rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs hover:border-[#1ED760] transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Live Visitors</span>
              <Activity className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {Number(
                safetyTelemetry?.quotaMetrics?.liveVisitors ??
                  adminData?.metrics?.liveVisitors ??
                  adminData?.metrics?.activeVisitors ??
                  0
              ).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-[#1ED760]">
              View Live Telemetry →
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('users')}
            className="text-left rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs hover:border-neutral-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Total Users</span>
              <Users className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {Number(
                safetyTelemetry?.quotaMetrics?.totalUsers ??
                  adminData?.metrics?.totalUsers ??
                  0
              ).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Registered accounts</p>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('users')}
            className="text-left rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs hover:border-neutral-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Banned Users</span>
              <Ban className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {Number(
                safetyTelemetry?.integrity?.bannedUsersCount ??
                  adminData?.metrics?.bannedUsers ??
                  0
              ).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Restricted / Suspended</p>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('compliance-audit')}
            className="text-left rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs hover:border-[#1ED760] transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Multi-Account Risk</span>
              <ShieldAlert className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {Number(
                safetyTelemetry?.integrity?.multiAccountRiskCount ??
                  safetyTelemetry?.integrity?.highRiskUsersCount ??
                  adminData?.metrics?.highRiskUsers ??
                  0
              ).toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Flagged rings &amp; audits →</p>
          </button>
        </div>

        {/* Middle Section: Platform Cash vs Free Credit Flow + Revenue Mix + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6">
            <SalesOverviewChart
              chartSeries={adminData?.chartSeries}
              salesData={adminData?.salesOverview}
              currentRange={selectedRange}
              onRangeChange={(range) => setSelectedRange(range)}
            />
          </div>

          <div className="lg:col-span-3">
            <RevenueBreakdownChart breakdown={adminData?.revenueBreakdown} />
          </div>

          <div className="lg:col-span-3">
            <RecentActivities activities={filteredActivities} isSuperAdmin={isSuperAdmin} />
          </div>
        </div>

        {/* Bottom Section: Platform Stores Overview + Infrastructure & Cloud + Quick Actions & System Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5">
            <PlatformStoresOverview
              data={storesOverviewData}
              onViewDetails={() => handleNavigate('customers')}
            />
          </div>

          <div className="lg:col-span-4">
            <CloudOverview
              data={adminData?.cloudOverview}
              systemInfo={adminData?.systemInfo}
              onViewDetails={() => handleNavigate('servers')}
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            <QuickActions onAction={(target) => handleNavigate(target)} staffAccess={effectiveStaffAccess} />
            <SystemInfoCard info={adminData?.systemInfo} />
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'dark bg-neutral-950 text-neutral-100' : 'bg-[#fafafa] text-neutral-900'
      } font-sans antialiased transition-colors duration-200`}
    >
      <AdminHeader
        currentUser={currentUser}
        staffAccess={staffAccess}
        onLogout={onLogout}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onIpBlocked={onIpBlocked}
      />

      <div className="flex min-h-[calc(100vh-4rem)]">
        <AdminSidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          staffAccess={effectiveStaffAccess}
          isDarkMode={isDarkMode}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-5 lg:p-6 space-y-5 overflow-x-hidden">
          {renderActiveView()}

          <footer className="pt-6 pb-2 border-t border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 gap-2">
            <div>
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Tiwlo Platform Admin</span>
              <span className="mx-2">•</span>
              <span>Cloud, Billing &amp; Trust Operations</span>
            </div>
            <div className="text-[11px]">
              <span>Tiwlo Control Plane</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function AdminDashboard({ currentUser, onLogout, showToast, onRequireAddressVerification }) {
  const [ipBlockedMessage, setIpBlockedMessage] = useState('');

  const isAuthorizedAdmin =
    currentUser &&
    (currentUser.role === 'admin' ||
      currentUser.role === 'super_admin' ||
      currentUser.email?.toLowerCase().trim() === 'tiwloltd@gmail.com');

  const requiresAddressVerification = Boolean(
    isAuthorizedAdmin && currentUser?.addressVerified !== true
  );

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      window.location.replace('/');
    }
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    if (!requiresAddressVerification) return;
    if (typeof onRequireAddressVerification === 'function') {
      onRequireAddressVerification();
      return;
    }
    const returnTo = encodeURIComponent(window.location.href);
    window.location.replace(`/address-verification?return_to=${returnTo}`);
  }, [requiresAddressVerification, onRequireAddressVerification]);

  useEffect(() => {
    const handleIpEvent = (event) => {
      const message = event?.detail?.message || 'Your IP is not whitelisted';
      setIpBlockedMessage(message);
    };
    window.addEventListener('tiwlo-admin-ip-blocked', handleIpEvent);
    return () => window.removeEventListener('tiwlo-admin-ip-blocked', handleIpEvent);
  }, []);

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-sans">
        <p className="text-sm">Redirecting to user workspace...</p>
      </div>
    );
  }

  if (requiresAddressVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 font-sans">
        <p className="text-sm">Redirecting to address verification...</p>
      </div>
    );
  }

  return (
    <AdminCurrencyProvider onIpBlocked={(msg) => setIpBlockedMessage(msg || 'Your IP is not whitelisted')}>
      <AdminDashboardContent
        currentUser={currentUser}
        onLogout={onLogout}
        showToast={showToast}
        ipBlockedMessage={ipBlockedMessage}
        onIpBlocked={(msg) => setIpBlockedMessage(msg || 'Your IP is not whitelisted')}
        onRetryIpCheck={() => setIpBlockedMessage('')}
        onRequireAddressVerification={onRequireAddressVerification}
      />
    </AdminCurrencyProvider>
  );
}
