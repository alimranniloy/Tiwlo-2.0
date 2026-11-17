import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  Bell,
  ChevronDown,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { resolveAvatarUrl } from '../utils/mediaUtils';
import { useTheme } from '../config/themeConfig';

export default function Header({
  searchQuery,
  setSearchQuery,
  onUpgrade,
  currentUser,
  onLogout,
  onToggleMobileMenu,
  onNewProduct,
  onNavigateTab,
}) {
  const { isDark, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [effectiveUser, setEffectiveUser] = useState(currentUser);
  const [notifications, setNotifications] = useState([]);
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
    fetch('/api/user/account/activity-log', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => {
        if (!cancelled && Array.isArray(d.logs)) setNotifications(d.logs.slice(0, 12));
      })
      .catch(() => {});
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
  }, [currentUser]);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      if (event?.detail) {
        setEffectiveUser((prev) => ({ ...(prev || {}), ...event.detail }));
      }
    };
    window.addEventListener('tiwlo:user-updated', handleUserUpdated);
    return () => window.removeEventListener('tiwlo:user-updated', handleUserUpdated);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const displayName = effectiveUser?.name || effectiveUser?.email?.split('@')[0] || 'Tiwlo User';

  return (
    <header className="tiwi-v3-topbar sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-neutral-200/70 bg-white/90 px-4 backdrop-blur-xl transition-colors sm:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <label className="flex h-10 w-full max-w-[500px] items-center gap-2.5 rounded-full bg-[#f4f4f4] px-4 transition focus-within:bg-white focus-within:ring-1 focus-within:ring-black/10">
          <Search className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <input
            id="global-search-input"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search products, orders..."
            aria-label="Search products and orders"
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-500"
          />
          <kbd className="hidden rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 sm:inline">
            ⌘ K
          </kbd>
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onUpgrade}
          className="hidden h-9 items-center gap-2 rounded-full bg-[#1ed760] px-4 text-xs font-bold text-black transition hover:bg-[#18c755] sm:inline-flex"
        >
          Upgrade <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px]">PRO</span>
        </button>
        <button
          type="button"
          onClick={onNewProduct}
          className="flex h-9 items-center gap-2 rounded-full bg-black px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New Product</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications((shown) => !shown);
              setShowProfileMenu(false);
            }}
            className="relative flex size-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 cursor-pointer"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell className="size-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#1ED760] px-1 text-[9px] font-bold text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-xs font-semibold text-neutral-900">Notifications</p>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button type="button" onClick={markNotificationsRead} className="text-[11px] font-medium text-emerald-600 hover:underline cursor-pointer">
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigateTab?.('profile-settings/activity');
                    }}
                    className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 cursor-pointer"
                  >
                    Activity Log
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-xs text-neutral-500">You’re all caught up.</p>
                ) : (
                  notifications.slice(0, 6).map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigateTab?.('profile-settings/activity');
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-neutral-50 transition cursor-pointer"
                    >
                      <div className="text-xs font-medium text-neutral-900 truncate">
                        {item.title || item.action || item.type || 'Account event'}
                      </div>
                      {(item.description || item.ip) && (
                        <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                          {item.description || item.ip}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu((shown) => !shown);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 rounded-full p-1 transition hover:bg-neutral-100"
            aria-label="Open account menu"
            aria-expanded={showProfileMenu}
          >
            <img
              src={resolveAvatarUrl(effectiveUser?.avatar)}
              alt=""
              className="size-8 rounded-full object-cover"
            />
            <span className="hidden max-w-36 truncate text-left text-xs font-semibold text-neutral-800 md:block">
              {displayName}
            </span>
            <ChevronDown className="hidden size-3.5 text-neutral-500 md:block" />
          </button>
          {showProfileMenu && (
            <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 shadow-xl">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-neutral-900">{displayName}</p>
                <p className="truncate text-xs text-neutral-500">{effectiveUser?.email || ''}</p>
                {effectiveUser?.tiwiId && (
                  <p className="mt-1 text-[10px] font-medium text-neutral-400">Tiwlo ID: {effectiveUser.tiwiId}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateTab?.('profile-settings');
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <UserRound className="size-4 text-neutral-500" />
                Tiwlo User Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateTab?.('profile-settings/security');
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <ShieldCheck className="size-4 text-neutral-500" />
                Security &amp; preferences
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateTab?.('two-factor-auth');
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <KeyRound className="size-4 text-neutral-500" />
                Two-Factor Auth (2FA)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateTab?.('team-management');
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <Users className="size-4 text-neutral-500" />
                Team management
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onNavigateTab?.('dashboard');
                }}
                className="flex w-full items-center gap-2.5 border-t border-neutral-100 px-4 py-2.5 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
              >
                <LayoutGrid className="size-4 text-neutral-500" />
                Back to Tiwlo Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2.5 border-t border-neutral-100 px-4 py-2.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
