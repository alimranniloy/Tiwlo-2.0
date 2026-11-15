import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Moon,
  Sun,
  Menu,
  Shield,
  LogOut,
  ChevronDown,
  Server,
  RefreshCw,
  Globe2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  FileText,
  Users
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

export function isSuperAdminUser(user, staffAccess) {
  if (staffAccess?.isSuperAdmin === true) return true;
  if (!user) return false;
  return (
    user.role === 'super_admin' ||
    String(user.email || '').toLowerCase().trim() === 'tiwloltd@gmail.com'
  );
}

export function isSuperAdminSensitiveItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (
    item.superAdminOnly === true ||
    item.isSuperAdminEvent === true ||
    item.actorRole === 'super_admin' ||
    item.targetRole === 'super_admin' ||
    item.role === 'super_admin'
  ) {
    return true;
  }
  const haystack = `${item.title || ''} ${item.message || ''} ${item.target || ''} ${item.detail || ''} ${item.actorEmail || ''} ${item.type || ''}`.toLowerCase();
  if (haystack.includes('tiwloltd@gmail.com') || haystack.includes('super_admin') || haystack.includes('super admin')) {
    if (
      haystack.includes('login') ||
      haystack.includes('sign in') ||
      haystack.includes('signin') ||
      haystack.includes('session') ||
      haystack.includes('auth') ||
      haystack.includes('ip')
    ) {
      return true;
    }
  }
  return false;
}

function resolveAlertTarget(alert) {
  const explicit = String(alert?.targetView || alert?.view || '').trim().toLowerCase();
  if (['users', 'customers', 'pick-account-appeals', 'logs'].includes(explicit)) {
    return explicit;
  }
  const category = String(alert?.category || alert?.type || '').toLowerCase();
  if (category.includes('pick') || category.includes('appeal')) return 'pick-account-appeals';
  if (category.includes('store') || category.includes('merchant') || category.includes('customer')) return 'customers';
  if (category.includes('log') || category.includes('email') || category.includes('security')) return 'logs';
  return 'users';
}

const ALERT_ICONS = {
  users: ShieldAlert,
  customers: Users,
  'pick-account-appeals': UserCheck,
  logs: FileText
};

export default function AdminHeader({
  currentUser,
  staffAccess,
  onLogout,
  onNavigate,
  onToggleMobileMenu,
  isDarkMode,
  onToggleDarkMode,
  onIpBlocked
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const isSuperAdmin = isSuperAdminUser(currentUser, staffAccess);

  const {
    currency,
    activeRate,
    rateSource,
    observedAt,
    loading: ratesLoading,
    warning: rateWarning,
    availableCurrencies,
    setDisplayCurrency,
    refreshRates
  } = useAdminCurrency();

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/alerts`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json().catch(() => ({}));
      if (
        res.status === 403 &&
        (json?.code === 'ADMIN_IP_NOT_ALLOWED' || /your ip is not whitelisted/i.test(json?.error || ''))
      ) {
        const msg = json?.error || 'Your IP is not whitelisted';
        onIpBlocked?.(msg);
        return;
      }
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Alerts request failed (${res.status}).`);
      }
      const rawAlerts = Array.isArray(json.alerts)
        ? json.alerts
        : Array.isArray(json.data?.alerts)
          ? json.data.alerts
          : Array.isArray(json.data)
            ? json.data
            : [];
      const visibleAlerts = isSuperAdmin
        ? rawAlerts
        : rawAlerts.filter((item) => !isSuperAdminSensitiveItem(item));
      setAlerts(visibleAlerts);
    } catch (err) {
      setAlertsError(err.message || 'Could not load alerts.');
    } finally {
      setAlertsLoading(false);
    }
  }, [isSuperAdmin, onIpBlocked]);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 30000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rateTooltip =
    currency === 'USD'
      ? 'Base currency: 1 USD = $1.00'
      : activeRate
        ? `1 USD = ${currency === 'BDT' ? '৳' : ''}${activeRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${currency}${rateSource ? ` · ${rateSource}` : ''}${observedAt ? ` (${observedAt})` : ''}`
        : `Exchange rate for ${currency} is currently unavailable`;

  const badgeCount = alerts.filter((a) => !a.read && !a.resolved).length || alerts.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-5 lg:px-6 bg-white dark:bg-neutral-950 border-b border-neutral-200/80 dark:border-neutral-800 transition-colors">
      {/* Left: Mobile Toggle & Tiwlo Logo */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:outline-none shrink-0"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none min-w-0"
        >
          <img
            src={isDarkMode ? '/tiwlologo-dark.png' : '/tiwlo-light-logo.png'}
            alt="Tiwlo"
            className="h-7 w-auto object-contain shrink-0"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/tiwlo-icon.png';
            }}
          />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-800 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760]" />
            Platform Admin
          </span>
        </button>
      </div>

      {/* Right: Live Currency Selector, Notifications, Theme Toggle, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live Currency Selector */}
        <div
          className="flex items-center gap-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-1"
          title={rateTooltip}
        >
          <Globe2 className="w-3.5 h-3.5 text-[#159f46] dark:text-[#1ED760] hidden sm:block shrink-0" />
          <select
            aria-label="Display Currency"
            value={currency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            className="bg-transparent text-xs font-semibold text-neutral-800 dark:text-neutral-100 focus:outline-none cursor-pointer pr-1 max-w-[110px] sm:max-w-none"
          >
            {availableCurrencies.map((c) => (
              <option key={c.code} value={c.code} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                {c.code === 'BDT' ? 'BDT (৳ বাংলা)' : c.label}
              </option>
            ))}
          </select>
          {currency !== 'USD' && (
            <span className="hidden md:inline-block text-[11px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700 pl-1.5">
              {activeRate ? `1$=${currency === 'BDT' ? '৳' : ''}${activeRate.toFixed(2)}` : 'No rate'}
            </span>
          )}
          <button
            type="button"
            onClick={refreshRates}
            disabled={ratesLoading}
            title={rateTooltip}
            className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-50"
            aria-label="Refresh exchange rates"
          >
            <RefreshCw className={`w-3 h-3 ${ratesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) fetchAlerts();
            }}
            className="relative p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:outline-none transition-colors"
            title="Platform Alerts"
            aria-label="Platform Alerts"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#1ED760] text-black text-[10px] font-bold flex items-center justify-center tabular-nums">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg py-2 z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200/70 dark:border-neutral-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Platform Alerts
                </span>
                <button
                  type="button"
                  onClick={fetchAlerts}
                  className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${alertsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {alertsError ? (
                <div className="p-4 text-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">{alertsError}</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {alertsLoading ? 'Checking platform alerts…' : 'No active alerts right now.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
                  {alerts.map((alert, idx) => {
                    const target = resolveAlertTarget(alert);
                    const Icon = ALERT_ICONS[target] || AlertTriangle;
                    const severity = String(alert.severity || 'info').toLowerCase();
                    const dotColor =
                      severity === 'critical' || severity === 'high' || severity === 'error'
                        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                        : severity === 'warning' || severity === 'medium'
                          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : 'text-[#159f46] dark:text-[#1ED760] bg-[#1ED760]/15';

                    return (
                      <button
                        type="button"
                        key={alert.id || idx}
                        onClick={() => {
                          setShowNotifications(false);
                          onNavigate(target);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/70 transition-colors flex items-start gap-2.5"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${dotColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                              {alert.title || 'System Alert'}
                            </p>
                            {alert.count != null && (
                              <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0">
                                {alert.count}
                              </span>
                            )}
                          </div>
                          {alert.message && (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
                              {alert.message}
                            </p>
                          )}
                          <span className="inline-block text-[10px] font-medium text-[#159f46] dark:text-[#1ED760] mt-1">
                            Open {target.replace(/-/g, ' ')} →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {rateWarning && (
                <div className="px-4 py-2 border-t border-neutral-200/70 dark:border-neutral-800 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300">
                  {rateWarning}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dark / Light Toggle */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:outline-none transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* User Profile Pill */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:outline-none transition-colors"
          >
            <img
              src={currentUser?.avatar || '/default-avatar.svg'}
              alt={currentUser?.name || 'Admin User'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
            />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight max-w-[120px] truncate">
                {currentUser?.name || 'Admin User'}
              </span>
              <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 leading-tight">
                {isSuperAdmin ? 'Super Admin' : staffAccess?.roleLabel || 'Platform Staff'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 hidden md:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-lg py-1 z-50">
              <div className="px-4 py-2.5 border-b border-neutral-200/70 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  {currentUser?.name || 'Admin User'}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {currentUser?.email || 'Email unavailable'}
                </p>
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760] rounded-full">
                  {isSuperAdmin ? 'Super Admin' : staffAccess?.roleLabel || 'Administrator'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigate('system-settings');
                }}
                className="w-full text-left px-4 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-neutral-400" /> Settings & Currency
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigate('servers');
                }}
                className="w-full text-left px-4 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center gap-2"
              >
                <Server className="w-4 h-4 text-neutral-400" /> Server & System Status
              </button>

              <div className="border-t border-neutral-200/70 dark:border-neutral-800 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout?.();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 font-medium"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
