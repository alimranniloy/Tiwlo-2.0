import React, { useEffect, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
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
  onNewProduct
}) {
  const { isDark, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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

  const displayName = currentUser?.storeName || currentUser?.name || 'Tiwlo Store';

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
            className="flex size-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell className="size-[18px]" />
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              <p className="mt-2 text-xs text-neutral-500">You’re all caught up.</p>
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
              src={resolveAvatarUrl(currentUser?.avatar)}
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
                <p className="truncate text-xs text-neutral-500">{currentUser?.email || ''}</p>
                {currentUser?.tiwiId && (
                  <p className="mt-1 text-[10px] font-medium text-neutral-400">Tiwlo ID: {currentUser.tiwiId}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowProfileMenu(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50"
              >
                <UserRound className="size-4 text-neutral-500" />
                Profile settings
              </button>
              <button
                type="button"
                onClick={() => setShowProfileMenu(false)}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-neutral-700 transition hover:bg-neutral-50"
              >
                <ShieldCheck className="size-4 text-neutral-500" />
                Security & roles
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2.5 border-t border-neutral-100 px-4 py-2.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Sign out / switch store
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
