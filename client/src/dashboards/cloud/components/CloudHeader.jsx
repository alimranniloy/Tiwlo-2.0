import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Store,
  ShieldCheck,
  User,
  KeyRound,
  Users,
  Server,
  Copy,
  Check,
  Menu,
  LogOut,
  Plus,
} from 'lucide-react';
import { useTheme } from '../../../config/themeConfig';
import { getCloudBillingData } from '../graphql/cloudQueries';
import { resolveAvatarUrl } from '../../../utils/mediaUtils';

export default function CloudHeader({
  searchQuery,
  setSearchQuery,
  currentUser,
  onOpenStore,
  onOpenCreateDroplet,
  onOpenSettings,
  onOpenBilling,
  onSwitchStore,
  onLogout,
  showToast,
  onToggleMobileMenu
}) {
  const { isDark, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [copiedTiwiId, setCopiedTiwiId] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [effectiveUser, setEffectiveUser] = useState(currentUser);
  const [notifications, setNotifications] = useState([]);
  const [notifFilter, setNotifFilter] = useState('all');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSeenAt, setNotifSeenAt] = useState(() => {
    try {
      return Number(localStorage.getItem(`tiwlo.notifSeen.${currentUser?.id || 'anon'}`) || 0);
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) return;
    setNotifLoading(true);
    fetch('/api/user/account/activity-log', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => {
        const entries = Array.isArray(d?.logs) ? d.logs : (Array.isArray(d?.activities) ? d.activities : []);
        if (!cancelled && entries.length) {
          setNotifications(entries.slice(0, 15));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const unreadCount = notifications.filter((n) => {
    const ts = Date.parse(n.createdAt || n.timestamp || 0);
    return Number.isFinite(ts) && ts > notifSeenAt;
  }).length;

  const markNotificationsRead = () => {
    const now = Date.now();
    setNotifSeenAt(now);
    try {
      localStorage.setItem(`tiwlo.notifSeen.${currentUser?.id || 'anon'}`, String(now));
    } catch {}
  };

  useEffect(() => {
    setEffectiveUser(currentUser);
    setAvatarLoadError(false);
  }, [currentUser]);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      if (event?.detail) {
        setEffectiveUser((prev) => ({ ...(prev || {}), ...event.detail }));
        setAvatarLoadError(false);
      }
    };
    window.addEventListener('tiwlo:user-updated', handleUserUpdated);
    return () => window.removeEventListener('tiwlo:user-updated', handleUserUpdated);
  }, []);

  const [headerCredits, setHeaderCredits] = useState(null);

  useEffect(() => {
    const userId = currentUser?.id || currentUser?.tiwiId;
    setHeaderCredits(null);
    if (!userId) return;
    let active = true;
    getCloudBillingData(userId)
      .then(res => {
        if (active && res?.account) {
          const creds = Number(res.account.credits);
          setHeaderCredits(Number.isFinite(creds) && creds >= 0 ? creds : null);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [currentUser?.id, currentUser?.tiwiId]);

  const tiwiId = effectiveUser?.tiwiId || effectiveUser?.storeId || '';
  const displayName = effectiveUser?.name || effectiveUser?.email?.split('@')[0] || 'Tiwlo User';
  const email = effectiveUser?.email || '';
  const planName = effectiveUser?.planName || 'Plan unavailable';
  const hasCustomAvatar = Boolean(
    effectiveUser?.avatar &&
    effectiveUser.avatar !== '/default-avatar.svg' &&
    !avatarLoadError
  );

  const copyTiwiId = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(tiwiId);
    setCopiedTiwiId(true);
    showToast?.(`Copied Tiwi ID: ${tiwiId}`);
    setTimeout(() => setCopiedTiwiId(false), 2000);
  };

  return (
    <header className="tiwi-v3-topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 font-sans backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:px-6 lg:px-8">
      <div className="flex min-w-0 max-w-md flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 lg:hidden"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        <label className="relative hidden min-w-0 flex-1 md:block">
          <span className="sr-only">Search resources and services</span>
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources, services, and docs..."
            className="h-10 w-full rounded-full bg-neutral-100 pl-11 pr-14 text-sm text-neutral-900 outline-none ring-neutral-900/10 transition placeholder:text-neutral-500 focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-900"
          />
          <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 sm:block">/</span>
        </label>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            if (onOpenBilling) onOpenBilling('overview');
            else if (onOpenSettings) onOpenSettings('billing');
            else showToast?.('Opening Tiwlo Cloud Billing Console...');
          }}
          className="hidden h-10 items-center gap-2 rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 sm:flex"
          title="Tiwlo Cloud Credits & Billing Account"
        >
          <img src="/favicon.png" alt="" className="size-4 object-contain" />
          Credits <span className="font-bold">{headerCredits === null ? '—' : `$${headerCredits.toFixed(2)}`}</span>
        </button>

        <button
          type="button"
          onClick={onOpenCreateDroplet}
          className="flex h-10 items-center gap-1.5 rounded-full bg-black px-4 text-sm font-bold text-white transition hover:bg-black/80"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            type="button"
            aria-label="Notifications"
            className="relative flex size-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#1ED760] px-1 text-[10px] font-bold text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200/80 bg-white text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3">
                <span className="font-semibold text-neutral-950 dark:text-white text-xs">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markNotificationsRead}
                      className="text-[11px] font-medium text-emerald-600 dark:text-[#1ED760] hover:underline cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onOpenSettings?.('workspace/security-alerts');
                    }}
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  >
                    Alert Center
                  </button>
                </div>
              </div>
              <div className="flex gap-1 border-b border-neutral-100 dark:border-neutral-800/80 px-3 py-2 text-[11px]">
                {['all', 'security', 'team', 'workspace'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNotifFilter(cat)}
                    className={`rounded-md px-2 py-0.5 capitalize font-medium cursor-pointer ${
                      notifFilter === cat
                        ? 'bg-[#1ED760] text-black font-semibold'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {notifLoading ? (
                  <p className="p-4 text-center text-xs text-neutral-400">Syncing live events...</p>
                ) : (() => {
                  const items = notifications.filter((n) => notifFilter === 'all' || String(n.category || '').toLowerCase() === notifFilter);
                  if (!items.length) {
                    return <p className="p-5 text-center text-xs text-neutral-500 dark:text-neutral-400">No recent alerts in this category.</p>;
                  }
                  return items.slice(0, 8).map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        const cat = String(item.category || '').toLowerCase();
                        onOpenSettings?.(cat === 'team' ? 'team-management' : 'profile-settings/activity');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                          {item.title || item.action || item.type || 'Account event'}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400 tabular-nums">
                          {item.createdAt || item.timestamp ? new Date(item.createdAt || item.timestamp).toLocaleDateString() : ''}
                        </span>
                      </div>
                      {(item.description || item.ip) && (
                        <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {item.description || item.ip}
                        </p>
                      )}
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            aria-label="Account settings"
            className={`flex size-10 items-center justify-center overflow-hidden rounded-full transition ${
              hasCustomAvatar
                ? 'border border-neutral-200 bg-neutral-100 hover:brightness-95 dark:border-neutral-700 dark:bg-neutral-800'
                : 'bg-[#1ed760] text-sm font-bold text-black hover:brightness-95'
            }`}
          >
            {hasCustomAvatar ? (
              <img
                src={resolveAvatarUrl(effectiveUser.avatar)}
                alt={displayName}
                onError={() => setAvatarLoadError(true)}
                className="size-full object-cover"
              />
            ) : (
              (displayName.match(/\b\w/g) || ['T', 'W']).slice(0, 2).join('').toUpperCase()
            )}
          </button>

          {/* Profile Menu Dropdown (Exact match to eCommerce Tiwi ID & Settings) */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in duration-150">
              {/* Profile Card Header */}
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-gray-800">
                <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-neutral-400 truncate">
                  {email}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div
                    onClick={copyTiwiId}
                    title="Click to copy Tiwi ID"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 font-mono font-bold text-[10px] cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition"
                  >
                    <span>Tiwi ID: {tiwiId}</span>
                    {copiedTiwiId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                    {planName}
                  </span>
                </div>
              </div>

              {/* Action Links */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  {isDark ? <Sun className="w-4 h-4 mr-2.5 text-neutral-500" /> : <Moon className="w-4 h-4 mr-2.5 text-neutral-500" />}
                  <span>{isDark ? 'Light theme' : 'Dark theme'}</span>
                </button>
                {onOpenStore && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenStore();
                    }}
                    className="w-full flex items-center px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-950/40 transition cursor-pointer"
                  >
                    <Store className="w-4 h-4 mr-2.5" />
                    <span>Storefront & POS</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenCreateDroplet?.();
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Server className="w-4 h-4 mr-2.5 text-neutral-500" />
                  <span>Deploy New Droplet</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings?.('profile');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>User Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings?.('security');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>Security &amp; Preferences</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings?.('two-factor-auth');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>Two-Factor Auth (2FA)</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings?.('team-management');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Users className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>Team Management</span>
                </button>
              </div>

              {/* Store switching stays within the signed-in account. */}
              <div className="border-t border-neutral-100 dark:border-gray-800 my-1 pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSwitchStore?.();
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-950/30 transition cursor-pointer"
                >
                  <Store className="w-4 h-4 mr-2.5" />
                  <span>Switch Store</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
