import React, { useState, useRef, useEffect } from 'react';
import {
  Grid,
  Search,
  Bell,
  Settings,
  HelpCircle,
  Menu,
  LogOut,
  Home,
  ShieldCheck,
  ExternalLink,
  Mail,
  ShoppingBag,
  Share2,
  HardDrive,
  X,
  CheckCircle2,
  Moon
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';
import { getDashboardUrl, getMainAppUrl, getAuthUrl } from '../../utils/navigation';

function userInitials(user) {
  return String(user?.name || user?.email || 'U')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function OutlookHeader() {
  const {
    currentUser,
    mailbox,
    searchQuery,
    setSearchQuery,
    setMobileDrawerOpen,
    setActiveTab,
    onNavigateHome,
    onSignOut,
    showToast
  } = useEmail();

  const [showWaffle, setShowWaffle] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const waffleRef = useRef(null);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const settingsRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (waffleRef.current && !waffleRef.current.contains(e.target)) {
        setShowWaffle(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const appSuite = [
    { name: 'Tiwlo Mail', icon: Mail, color: 'text-[#0078D4]', bg: 'bg-[#0078D4]/10', active: true },
    { name: 'OneProfile', icon: Users, color: 'text-[#7355D9]', bg: 'bg-[#7355D9]/10', url: getDashboardUrl('/oneprofile') },
    { name: 'Tiwlo Workspace', icon: HardDrive, color: 'text-[#0284C7]', bg: 'bg-[#0284C7]/10', url: getMainAppUrl('/dashboard') },
    { name: 'Store', icon: ShoppingBag, color: 'text-[#107C41]', bg: 'bg-[#107C41]/10', url: getMainAppUrl('/store') },
    { name: 'Tiwi Social', icon: Share2, color: 'text-[#1E75FF]', bg: 'bg-[#1E75FF]/10', url: getMainAppUrl('/tiwi') }
  ];

  const recentSearchFilters = [
    { label: 'Unread messages', action: () => { setActiveTab('unread'); setIsSearchFocused(false); } },
    { label: 'Has attachments', action: () => { setSearchQuery('has:attachment'); setIsSearchFocused(false); } },
    { label: 'Search by sender', action: () => { setSearchQuery('from:'); setIsSearchFocused(false); } },
    { label: 'Search by subject', action: () => { setSearchQuery('subject:'); setIsSearchFocused(false); } }
  ];

  return (
    <header className="h-[48px] bg-gradient-to-r from-[#0078D4] via-[#0F6CBD] to-[#005A9E] text-white flex items-center justify-between px-2 sm:px-4 select-none relative z-40 shadow-xs border-b border-white/10">
      {/* 1. Left: Waffle App Launcher & Brand */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Mobile menu toggle for folder drawer */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="md:hidden p-1.5 hover:bg-white/15 rounded-md transition cursor-pointer text-white"
          title="Open Folders"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Outlook Signature Waffle Launcher (9 Dots) */}
        <div className="relative" ref={waffleRef}>
          <button
            type="button"
            onClick={() => setShowWaffle((prev) => !prev)}
            className="w-8 h-8 hover:bg-white/15 active:bg-white/20 rounded-md transition cursor-pointer text-white flex items-center justify-center group"
            title="App Launcher"
          >
            <Grid className="w-4.5 h-4.5 stroke-[2] group-hover:scale-105 transition-transform" />
          </button>

          {/* Waffle Dropdown App Grid */}
          {showWaffle && (
            <div className="absolute top-[42px] left-0 w-[290px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#F3F2F1] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-3.5 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100 dark:border-gray-800">
                <span className="font-bold text-[12px] text-gray-500 uppercase tracking-wider">
                  Apps & Services
                </span>
                <span className="text-[11px] font-bold text-[#0078D4] bg-[#0078D4]/10 px-2 py-0.5 rounded-full">
                  Tiwlo Apps
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {appSuite.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.name}
                      type="button"
                      onClick={() => {
                        setShowWaffle(false);
                        if (app.url) {
                          window.location.assign(app.url);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-center group ${
                        app.active ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-[#0078D4]' : ''
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${app.bg} ${app.color} flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[12px] font-semibold truncate max-w-full">
                        {app.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Outlook Style Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (onNavigateHome) onNavigateHome();
            else window.location.assign(getMainAppUrl('/dashboard'));
          }}
          className="flex items-center gap-2 cursor-pointer group pr-2 bg-transparent border-0 text-left"
        >
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
            <img src="/tiwlo-icon.png" alt="" className="w-6 h-6 object-contain" />
          </div>
          <div className="flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[16px] tracking-tight text-white group-hover:opacity-95">
                Tiwi Mail
              </span>
            </div>
            <span className="text-[9.5px] text-white/75 font-medium tracking-wide">
              Your business inbox
            </span>
          </div>
        </button>
      </div>

      {/* 2. Center: Outlook Rounded Pill Search Bar with Interactive Dropdown */}
      <div className="flex-1 max-w-[560px] mx-3 hidden sm:block relative" ref={searchContainerRef}>
        <div className={`relative flex items-center transition-all ${
          isSearchFocused ? 'ring-2 ring-white/50 rounded-full' : ''
        }`}>
          <input
            type="text"
            placeholder="Search mail or use from:, subject:, category:"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] pl-9 pr-24 bg-white/20 hover:bg-white/25 focus:bg-white text-white focus:text-[#201F1E] placeholder-white/80 focus:placeholder-gray-400 text-[13px] rounded-full outline-none transition-all shadow-inner border border-white/20 focus:border-transparent"
          />
          <Search className={`w-4 h-4 absolute left-3 pointer-events-none transition-colors ${
            isSearchFocused ? 'text-[#0078D4]' : 'text-white/80'
          }`} />

          {/* Right Search Controls: Clear & Shortcut & Filter */}
          <div className="absolute right-2.5 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-700 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {!isSearchFocused && !searchQuery && (
              <kbd className="hidden lg:inline-flex items-center text-[10px] bg-white/15 px-1.5 py-0.5 rounded text-white/85 font-mono pointer-events-none">
                Ctrl + E
              </kbd>
            )}

          </div>
        </div>

        {/* Interactive Search Suggestions Dropdown */}
        {isSearchFocused && (
          <div className="absolute top-[40px] left-0 right-0 bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#E1DFDD] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-2.5 z-50 animate-fadeIn text-[12.5px]">
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
              <span>Quick Search Filters</span>
              <span className="text-[10px] lowercase text-[#0078D4] font-normal">search updates as you type</span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              {recentSearchFilters.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={f.action}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-[#0078D4]" />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Right: Quick Tools & User Profile */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className="p-2 hover:bg-white/15 rounded-md transition cursor-pointer text-white relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute top-[42px] right-0 w-[310px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#E1DFDD] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-3 z-50 animate-fadeIn">
              <div className="pb-2 border-b border-gray-100 dark:border-gray-800 font-bold text-[13px]">Notifications</div>
              <p className="py-5 text-center text-[12px] text-gray-500">Mail notifications are not available yet.</p>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setShowSettingsMenu((prev) => !prev)}
            className="p-2 hover:bg-white/15 rounded-md transition cursor-pointer text-white"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {showSettingsMenu && (
            <div className="absolute top-[42px] right-0 w-[260px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#E1DFDD] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-3 z-50 animate-fadeIn text-[12.5px]">
              <span className="font-bold text-[13px] block pb-2 border-b border-gray-100 dark:border-gray-800">
                Quick Settings
              </span>
              <div className="flex flex-col gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    document.documentElement.classList.toggle('dark');
                    showToast('Theme toggled', 'info');
                    setShowSettingsMenu(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5" /> Dark mode
                  </span>
                  <span className="text-[11px] text-[#0078D4]">Toggle</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <button
          type="button"
          onClick={() => showToast('Tiwi Mail Shortcuts: Ctrl+N (New mail), Ctrl+E (Search), Delete (Remove)', 'info')}
          className="p-2 hover:bg-white/15 rounded-md transition cursor-pointer text-white hidden sm:flex"
          title="Help & Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Profile Avatar with Outlook Green Presence Dot */}
        <div className="relative ml-1 sm:ml-2" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-white/50 transition cursor-pointer"
            title="Account Manager"
          >
            <div className="relative">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name || 'Account'} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-white/30" />
              ) : (
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-[#005A9E] font-bold text-[11px] flex items-center justify-center ring-1 ring-white/30">
                  {userInitials(currentUser)}
                </span>
              )}
            </div>
          </button>

          {/* User Account Popover */}
          {showUserMenu && (
            <div className="absolute top-[42px] right-0 w-[300px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#F3F2F1] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-4 z-50 animate-fadeIn">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name || 'Account'} className="w-12 h-12 rounded-full object-cover ring-2 ring-[#0078D4]/20" />
                ) : (
                  <span className="w-12 h-12 shrink-0 rounded-full bg-[#0078D4] text-white font-bold text-sm flex items-center justify-center ring-2 ring-[#0078D4]/20">
                    {userInitials(currentUser)}
                  </span>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[14px] truncate">
                    {currentUser?.name || 'Tiwlo account'}
                  </span>
                  <span className="text-[12px] text-gray-500 truncate">
                    {mailbox?.address || currentUser?.email || ''}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#107C41] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tiwlo Mail account</span>
                  </div>
                </div>
              </div>

              {/* Account Quick Links */}
              <div className="flex flex-col gap-1 text-[12.5px]">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onNavigateHome) onNavigateHome();
                    else window.location.assign(getMainAppUrl('/dashboard'));
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#0078D4]" />
                    <span>Tiwlo Workspace Dashboard</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    window.location.assign(getMainAppUrl('/settings'));
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#107C41]" />
                    <span>Security & Sign-in</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>

                <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onSignOut) {
                        onSignOut();
                      } else {
                        window.location.assign(getAuthUrl('/login?logout=1'));
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition cursor-pointer text-left font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
