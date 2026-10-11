import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Menu, User, Settings, CreditCard, LogOut } from 'lucide-react';

/**
 * OneProfileTopBar Component
 * Matches screenshot header:
 * - Search bar with shortcut chip ⌘K
 * - Notification bell with active badge
 * - John Doe profile chip with Free Plan tag & dropdown
 * - Mobile hamburger toggle
 */
export default function OneProfileTopBar({
  onToggleMobileSidebar,
  searchQuery,
  setSearchQuery,
  onNavigateTab
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b border-slate-100/90 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile Sidebar Toggle & Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shrink-0"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar matching screenshot */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates, domains, settings..."
            className="w-full pl-10 pr-12 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Notification Bell & User Profile Chip */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {/* Notifications Dropdown (In-Page clean dropdown) */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-xl py-2 z-50 animate-in fade-in duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Notifications</span>
                <span className="text-[10px] text-blue-600 font-semibold cursor-pointer">Mark read</span>
              </div>
              <div className="divide-y divide-slate-50 text-xs">
                <div className="px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer">
                  <div className="font-semibold text-slate-800">Domain active</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">john.uids.app is now live on Anycast edge.</div>
                </div>
                <div className="px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer">
                  <div className="font-semibold text-slate-800">NFC Card shipped</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">Your physical card is on the way.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Chip matching screenshot */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2.5 p-1 sm:pl-1.5 sm:pr-2.5 rounded-full sm:rounded-2xl hover:bg-slate-50 transition select-none"
          >
            {/* Avatar */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-slate-200 ring-2 ring-slate-100 shrink-0">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
                alt="John Doe"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366F1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                }}
              />
            </div>

            {/* Name & Plan info */}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-tight">John Doe</span>
              <span className="text-[10px] font-normal text-slate-400 leading-tight">Free Plan</span>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Profile Dropdown */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-100 shadow-xl py-1.5 z-50 animate-in fade-in duration-150 text-xs">
              <div className="px-3.5 py-2 border-b border-slate-100 sm:hidden">
                <div className="font-bold text-slate-900">John Doe</div>
                <div className="text-[10px] text-blue-600 font-semibold">Free Plan</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onNavigateTab('settings');
                }}
                className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>My Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onNavigateTab('billing');
                }}
                className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Billing & Plans</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onNavigateTab('settings');
                }}
                className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                type="button"
                onClick={() => {
                  setProfileDropdownOpen(false);
                  onNavigateTab('login');
                }}
                className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
