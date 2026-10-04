import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
  ShieldCheck,
  Sparkles,
  Menu
} from 'lucide-react';
import { resolveAvatarUrl } from '../utils/mediaUtils';
import { useTheme } from '../config/themeConfig';

export default function Header({
  searchQuery,
  setSearchQuery,
  onOpenSearchModal,
  onUpgrade,
  showToast,
  currentUser,
  onLogout,
  onToggleMobileMenu
}) {
  const { isDark, toggleTheme } = useTheme();
  const setIsDark = toggleTheme;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Keyboard shortcut ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 px-3 sm:px-6 lg:px-8 flex items-center justify-between border-b border-[#EDF2F7] dark:border-gray-800 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md sticky top-0 z-30 transition-colors duration-200">
      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center flex-1 max-w-xl min-w-0 mr-2 sm:mr-4">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden mr-2 p-2 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition shadow-2xs shrink-0 cursor-pointer"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Search Bar */}
        <div className="w-full relative">
          <div className="flex items-center w-full bg-slate-50/80 dark:bg-gray-800/80 hover:bg-slate-100/70 dark:hover:bg-gray-800 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500/20 border border-slate-200/80 dark:border-gray-700/80 rounded-xl px-3 py-1.5 sm:py-2 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 mr-2 shrink-0" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, SKU..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none min-w-0"
            />
            <div className="hidden sm:flex items-center space-x-1 pl-2 shrink-0">
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-400 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-md shadow-2xs font-mono">
                ⌘ K
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Right Action Icons & Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Premium Upgrade Button */}
        <button
          type="button"
          onClick={onUpgrade}
          className="relative group flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-xs shadow-amber-500/25 hover:shadow-md hover:shadow-amber-500/35 transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
          title="Upgrade your Tiwlo workspace"
        >
          <Sparkles className="w-3.5 h-3.5 fill-white/20 group-hover:rotate-12 transition-transform duration-300" />
          <span className="tracking-wide hidden sm:inline">Upgrade</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-800"></span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-700">
                <span className="text-xs font-bold text-slate-800 dark:text-white">Notifications</span>
                <span className="text-[10px] bg-rose-100 text-rose-600 font-semibold px-1.5 py-0.5 rounded-full">3 new</span>
              </div>
              <div className="space-y-2 mt-2 text-xs">
                <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">Restock recommended</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Wireless Headphones low stock (45 left)</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-gray-700/50 text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-white">New Sale Received</p>
                  <p className="text-[11px] text-slate-500">Order #INV-10024 completed</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs cursor-pointer"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-3 p-1 pl-1.5 pr-2 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/80 transition border border-transparent hover:border-slate-200 dark:hover:border-gray-700 cursor-pointer"
          >
            <div className="relative">
              <img
                src={resolveAvatarUrl(currentUser?.avatar)}
                alt={currentUser?.storeName || currentUser?.name || 'Tiwlo Store'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white"></span>
            </div>
            <div className="text-left hidden sm:block">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {currentUser?.storeName || currentUser?.name || 'Tiwlo Store'}
              </h2>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold font-mono">
                Tiwi ID: {currentUser?.tiwiId || currentUser?.storeId || ''}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in duration-150">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-gray-700">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                  {currentUser?.storeName || currentUser?.name || 'Tiwlo Store'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {currentUser?.email || ''}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    Tiwi ID: {currentUser?.tiwiId || currentUser?.storeId || ''}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 font-semibold">
                    {currentUser?.planName || 'Free Starter'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Profile Settings
              </button>
              <button
                onClick={() => setShowProfileMenu(false)}
                className="w-full flex items-center px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Security & Roles
              </button>
              <div className="border-t border-slate-100 dark:border-gray-700 my-1"></div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout?.();
                }}
                className="w-full flex items-center px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign Out / Switch Store
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
