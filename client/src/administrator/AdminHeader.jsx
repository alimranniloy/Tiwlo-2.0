import React, { useState } from 'react';
import {
  Bell,
  Moon,
  Sun,
  Menu,
  Shield,
  LogOut,
  ChevronDown,
  Server,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';

export default function AdminHeader({
  currentUser,
  onLogout,
  onNavigate,
  onToggleMobileMenu,
  isDarkMode,
  onToggleDarkMode
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const isSuperAdmin = currentUser?.role === 'super_admin' ||
    currentUser?.email?.toLowerCase() === 'tiwloltd@gmail.com';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      {/* Left: Mobile Toggle & Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-blue-500/20">
            T
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Tiwlo</span>
            <span className="text-base font-medium text-slate-500 dark:text-slate-400">Admin</span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Notifications, Theme, Locale, User Profile */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Notifications</span>
                <span className="text-[11px] text-slate-400">Live feed not connected</span>
              </div>
              <div className="p-5 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notifications are not connected to a live event source.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>

        {/* User Profile Pill */}
        <div className="relative ml-1 sm:ml-2">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
          >
            <img
              src={currentUser?.avatar || '/default-avatar.svg'}
              alt={currentUser?.name || 'Admin User'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
            />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                {currentUser?.name || 'Admin User'}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 leading-tight">
                {isSuperAdmin ? 'Super Admin' : 'Administrator'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser?.name || 'Admin User'}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || 'Email unavailable'}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                  {isSuperAdmin ? 'Super Admin' : 'Administrator'}
                </span>
              </div>

              <button
                onClick={() => { setShowProfileMenu(false); onNavigate('system-settings'); }}
                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-slate-400" /> System Settings
              </button>

              <button
                onClick={() => { setShowProfileMenu(false); onNavigate('servers'); }}
                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Server className="w-4 h-4 text-slate-400" /> Cloud Clusters
              </button>

              <button
                onClick={() => { setShowProfileMenu(false); window.open('/store', '_blank'); }}
                className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-slate-400" /> Visit Storefront <ExternalLink className="w-3 h-3 ml-auto text-slate-400" />
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                <button
                  onClick={() => { setShowProfileMenu(false); onLogout?.(); }}
                  className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium"
                >
                  <LogOut className="w-4 h-4 text-red-500" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
