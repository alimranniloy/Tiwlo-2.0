import React, { useState, useRef, useEffect } from 'react';
import {
  Grid,
  Search,
  SlidersHorizontal,
  Video,
  Calendar,
  Edit3,
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
  HardDrive
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookHeader() {
  const {
    currentUser,
    searchQuery,
    setSearchQuery,
    setMobileDrawerOpen,
    onNavigateHome,
    showToast
  } = useEmail();

  const [showWaffle, setShowWaffle] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const waffleRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (waffleRef.current && !waffleRef.current.contains(e.target)) {
        setShowWaffle(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const appSuite = [
    { name: 'Tiwi Mail', icon: Mail, color: 'text-[#0078D4]', bg: 'bg-[#0078D4]/10', active: true },
    { name: 'Tiwlo Cloud', icon: HardDrive, color: 'text-[#0284C7]', bg: 'bg-[#0284C7]/10', path: '/dashboard' },
    { name: 'TiwiMart Store', icon: ShoppingBag, color: 'text-[#107C41]', bg: 'bg-[#107C41]/10', path: '/store' },
    { name: 'Tiwi Social', icon: Share2, color: 'text-[#1E75FF]', bg: 'bg-[#1E75FF]/10', path: '/tiwi' },
    { name: 'Settings', icon: Settings, color: 'text-[#605E5C]', bg: 'bg-[#605E5C]/10', path: '/settings' }
  ];

  return (
    <header className="h-[48px] bg-[#0078D4] text-white flex items-center justify-between px-2 sm:px-4 select-none relative z-40 shadow-xs">
      {/* 1. Left: Waffle App Launcher & Brand */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="md:hidden p-1.5 hover:bg-white/15 rounded-sm transition cursor-pointer text-white"
          title="Open Folders"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Outlook Signature Waffle Launcher (9 Dots) */}
        <div className="relative" ref={waffleRef}>
          <button
            type="button"
            onClick={() => setShowWaffle((prev) => !prev)}
            className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white flex items-center justify-center"
            title="App Launcher"
          >
            <Grid className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Waffle Dropdown App Grid */}
          {showWaffle && (
            <div className="absolute top-[44px] left-0 w-[280px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#F3F2F1] rounded-lg shadow-2xl border border-black/10 dark:border-white/10 p-3 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="font-bold text-[13px] text-gray-500 uppercase tracking-wider">
                  Apps & Services
                </span>
                <span className="text-[11px] text-[#0078D4] font-semibold">Tiwlo 365</span>
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
                        if (app.path) {
                          window.location.href = app.path;
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
        <div
          onClick={() => {
            if (onNavigateHome) onNavigateHome();
            else window.location.href = '/dashboard';
          }}
          className="flex items-center gap-2 cursor-pointer group pr-2"
        >
          <div className="w-6 h-6 rounded-sm bg-white text-[#0078D4] flex items-center justify-center shadow-xs font-black text-[13px]">
            ✉
          </div>
          <span className="font-bold text-[16px] tracking-tight text-white group-hover:opacity-95">
            Tiwi Mail
          </span>
        </div>
      </div>

      {/* 2. Center: Outlook Rounded Search Bar */}
      <div className="flex-1 max-w-[560px] mx-2 hidden sm:block">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search mail, people, and files (Ctrl + E)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[32px] pl-9 pr-9 bg-[#005A9E] hover:bg-[#004578] focus:bg-white text-white focus:text-[#323130] placeholder-white/80 focus:placeholder-gray-400 text-[13px] rounded-md outline-none border border-transparent focus:border-transparent transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-white/80 absolute left-2.5 pointer-events-none" />
          <button
            type="button"
            onClick={() => showToast('Search filters: From, To, Has attachments, Date', 'info')}
            className="absolute right-2 text-white/80 hover:text-white transition cursor-pointer"
            title="Advanced Search Filter"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Right: Quick Tools & User Profile */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* Meet / Video Call */}
        <button
          type="button"
          onClick={() => showToast('Starting Instant Meeting...', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white hidden md:flex"
          title="Meet Now"
        >
          <Video className="w-4 h-4" />
        </button>

        {/* Quick Notes */}
        <button
          type="button"
          onClick={() => showToast('OneNote Notebook opened', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white hidden lg:flex"
          title="OneNote Feed"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        {/* Calendar day pane */}
        <button
          type="button"
          onClick={() => showToast('Calendar preview', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white hidden lg:flex"
          title="Calendar Day"
        >
          <Calendar className="w-4 h-4" />
        </button>

        {/* Notifications Bell */}
        <button
          type="button"
          onClick={() => showToast('No pending urgent notifications', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-300 ring-1 ring-[#0078D4]" />
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => showToast('Outlook Mail Settings', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Help */}
        <button
          type="button"
          onClick={() => showToast('Tiwi Mail Support & Shortcuts (Press ? for Help)', 'info')}
          className="p-2 hover:bg-white/15 rounded-sm transition cursor-pointer text-white hidden sm:flex"
          title="Help"
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
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={currentUser?.name || 'Ahmad'}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-1 ring-white/30"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#107C41] ring-2 ring-[#0078D4]" title="Available" />
            </div>
          </button>

          {/* User Account Popover */}
          {showUserMenu && (
            <div className="absolute top-[40px] right-0 w-[300px] bg-white dark:bg-[#201F1E] text-[#323130] dark:text-[#F3F2F1] rounded-lg shadow-2xl border border-black/10 dark:border-white/10 p-4 z-50 animate-fadeIn">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                  alt={currentUser?.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#0078D4]"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[14px] text-gray-900 dark:text-white truncate">
                    {currentUser?.name || 'Ahmad Nur Fawaid'}
                  </span>
                  <span className="text-[12px] text-gray-500 truncate">
                    {currentUser?.email || 'fawait@tiwlo.com'}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-[#107C41] font-semibold mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified Microsoft Exchange Sync</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onNavigateHome) onNavigateHome();
                    else window.location.href = '/dashboard';
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-[13px] font-medium text-gray-700 dark:text-gray-200 transition cursor-pointer text-left"
                >
                  <Home className="w-4 h-4 text-gray-500" />
                  <span>Return to Tiwlo Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    window.location.href = '/tiwi';
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-[13px] font-medium text-gray-700 dark:text-gray-200 transition cursor-pointer text-left"
                >
                  <Share2 className="w-4 h-4 text-gray-500" />
                  <span>Open Tiwi Social Web</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    window.location.href = '/login?logout=1';
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-[13px] font-medium text-red-600 transition cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
