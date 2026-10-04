import React, { useState } from 'react';
import {
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  Store,
  ShieldCheck,
  User,
  Settings,
  Server,
  Key,
  Copy,
  Check,
  Plus,
  Sparkles,
  Zap,
  Menu,
  ExternalLink,
  Database,
  Globe
} from 'lucide-react';
import { resolveAvatarUrl } from '../../../utils/mediaUtils';
import { useTheme } from '../../../config/themeConfig';

export default function CloudHeader({
  searchQuery,
  setSearchQuery,
  currentUser,
  onLogout,
  onOpenStore,
  onOpenCreateDroplet,
  onOpenSettings,
  onOpenBilling,
  showToast,
  onToggleMobileMenu
}) {
  const { isDark, toggleTheme } = useTheme();
  const toggleDarkMode = toggleTheme;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [copiedTiwiId, setCopiedTiwiId] = useState(false);
  const [copiedBillingId, setCopiedBillingId] = useState(false);

  const tiwiId = currentUser?.tiwiId || currentUser?.storeId || '';
  const displayName = currentUser?.name || currentUser?.storeName || 'Tiwlo Store';
  const email = currentUser?.email || '';
  const planName = currentUser?.planName || 'Premium Plan';

  const billingAccountId = `BA-TIWLO-${(tiwiId || '10001').replace(/[^a-zA-Z0-9]/g, '')}-TCP`;

  const copyTiwiId = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(tiwiId);
    setCopiedTiwiId(true);
    showToast?.(`Copied Tiwi ID: ${tiwiId}`);
    setTimeout(() => setCopiedTiwiId(false), 2000);
  };

  const copyBillingId = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(billingAccountId);
    setCopiedBillingId(true);
    showToast?.(`Copied Billing Account ID: ${billingAccountId}`);
    setTimeout(() => setCopiedBillingId(false), 2000);
  };

  return (
    <header className="h-16 px-3 sm:px-6 lg:px-8 bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-gray-800 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Hamburger menu on mobile & Search Bar */}
      <div className="flex items-center flex-1 max-w-xs sm:max-w-md min-w-0 mr-2 sm:mr-4">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden mr-2 p-2 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-2xs shrink-0 cursor-pointer"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Search Input Bar */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search servers, IPs..."
            className="w-full pl-8 sm:pl-10 pr-4 sm:pr-14 py-2 rounded-xl bg-slate-50/80 dark:bg-gray-800/80 border border-slate-200/80 dark:border-gray-700/80 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 transition font-medium min-w-0"
          />
          <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 text-[10px] font-semibold text-slate-400 shadow-2xs">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3.5 shrink-0">
        {/* Tiwlo Cloud Credits & Billing Pill (Direct Link to Billing Page, No Popup) */}
        <button
          type="button"
          onClick={() => {
            if (onOpenBilling) onOpenBilling('overview');
            else if (onOpenSettings) onOpenSettings('billing');
            else showToast?.('Opening Tiwlo Cloud Billing Console...');
          }}
          className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer select-none active:scale-[0.98] bg-white dark:bg-[#202124] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] border-[#DADCE0] dark:border-[#5F6368] text-[#3C4043] dark:text-[#E8EAED] shadow-2xs hover:shadow-xs"
          title="Tiwlo Cloud Credits & Billing Account"
        >
          {/* Official Tiwlo Icon */}
          <div className="w-4 h-4 shrink-0 flex items-center justify-center">
            <img src="/tiwlo-icon.png" alt="Tiwlo" className="w-3.5 h-3.5 object-contain dark:hidden" />
            <img src="/tiwlo-icon-dark.png" alt="Tiwlo" className="w-3.5 h-3.5 object-contain hidden dark:block" />
          </div>

          {/* Balance & Label */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="font-semibold text-[#202124] dark:text-[#F1F3F4] tracking-tight">
              {currentUser?.credits !== undefined ? currentUser.credits : 0}
            </span>
            <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] hidden sm:inline font-normal">
              Credits
            </span>
          </div>

          {/* Tiwlo Blue "+" Add Action Circle */}
          <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-150 flex items-center justify-center shrink-0">
            <Plus className="w-2.5 h-2.5" />
          </div>
        </button>

        {/* Notification Bell with Red Badge */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowCredits(false);
              setShowProfileMenu(false);
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 shadow-xl p-4 text-xs z-50 animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 dark:text-white">Notifications</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  1 new
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700 flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Infrastructure Backup Finished
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Droplet db-backup snapshot succeeded at 10:24 AM.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile matching eCommerce Tiwi ID & Settings menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2.5 p-1 pl-1.5 pr-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/80 transition border border-transparent hover:border-slate-200 dark:hover:border-gray-700 cursor-pointer select-none"
          >
            <div className="relative">
              <img
                src={resolveAvatarUrl(currentUser?.avatar)}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-gray-900"></span>
            </div>

            <div className="text-left hidden sm:block">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {displayName}
              </h2>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold font-mono">
                Tiwi ID: {tiwiId}
              </p>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {/* Profile Menu Dropdown (Exact match to eCommerce Tiwi ID & Settings) */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in duration-150">
              {/* Profile Card Header */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {email}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div
                    onClick={copyTiwiId}
                    title="Click to copy Tiwi ID"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px] cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                  >
                    <span>Tiwi ID: {tiwiId}</span>
                    {copiedTiwiId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-blue-400" />}
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                    {planName}
                  </span>
                </div>
              </div>

              {/* Action Links */}
              <div className="py-1">
                {onOpenStore && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenStore();
                    }}
                    className="w-full flex items-center px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
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
                  className="w-full flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Server className="w-4 h-4 mr-2.5 text-indigo-500" />
                  <span>Deploy New Droplet</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenSettings) onOpenSettings('profile');
                    else showToast?.('Opening Profile Settings');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2.5 text-slate-400" />
                  <span>Profile Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenSettings) onOpenSettings('security');
                    else showToast?.('Opening Security & API Credentials');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 mr-2.5 text-slate-400" />
                  <span>Security & Roles</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onOpenSettings) onOpenSettings('settings');
                    else showToast?.('Opening System & Store Settings');
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2.5 text-slate-400" />
                  <span>System Settings</span>
                </button>
              </div>

              {/* Sign Out */}
              <div className="border-t border-slate-100 dark:border-gray-800 my-1 pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2.5" />
                  <span>Sign Out / Switch Store</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
