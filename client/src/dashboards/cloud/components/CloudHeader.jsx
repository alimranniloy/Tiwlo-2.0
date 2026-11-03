import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Store,
  ShieldCheck,
  User,
  Settings,
  Server,
  Copy,
  Check,
  Menu,
  LogOut,
  Plus,
} from 'lucide-react';
import { useTheme } from '../../../config/themeConfig';
import { getCloudBillingData } from '../graphql/cloudQueries';

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

  const tiwiId = currentUser?.tiwiId || currentUser?.storeId || '';
  const displayName = currentUser?.name || currentUser?.storeName || 'Tiwlo Store';
  const email = currentUser?.email || '';
  const planName = currentUser?.planName || 'Plan unavailable';

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
          <img src="/tiwlo-icon.png" alt="" className="size-4 object-contain" />
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
            className="relative flex size-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Bell className="size-5" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-4 text-sm shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              <p className="font-semibold text-neutral-900 dark:text-white">Notifications</p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">The notification center is not available yet.</p>
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
            className="flex size-10 items-center justify-center rounded-full bg-[#1ed760] text-sm font-bold text-black transition hover:brightness-95"
          >
            {(displayName.match(/\b\w/g) || ['T', 'W']).slice(0, 2).join('').toUpperCase()}
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
                    if (onOpenSettings) onOpenSettings('profile');
                    else showToast?.('Opening Profile Settings');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>Profile Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenSettings) onOpenSettings('security');
                    else showToast?.('Opening Security & API Credentials');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>Security & Roles</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenSettings) onOpenSettings('settings');
                    else showToast?.('Opening System & Store Settings');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2.5 text-neutral-400" />
                  <span>System Settings</span>
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
