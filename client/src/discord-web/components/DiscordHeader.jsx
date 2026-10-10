import React from 'react';
import { Search, Bell, Menu, HelpCircle, ChevronDown, Bot } from 'lucide-react';

export default function DiscordHeader({
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenMobileMenu,
  onNavigateHome
}) {
  const getInitials = () => {
    const name = currentUser?.name || currentUser?.storeName || currentUser?.email || '';
    if (!name.trim()) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = currentUser?.name || currentUser?.storeName || 'Account';
  const displayEmail = currentUser?.email || '';

  return (
    <header className="h-16 border-b border-[#E0E2EC] bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 font-sans select-none">
      {/* Left: Mobile Toggle, Product Title & Environment Selector */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-full text-[#444746] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tiwlo Discord Console Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#0B57D0] text-white flex items-center justify-center font-bold text-xs shadow-none">
            <Bot className="w-4 h-4 stroke-[2.2]" />
          </div>
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else window.location.href = '/';
            }}
            className="text-[15px] font-medium text-[#1F1F1F] hover:text-[#0B57D0] transition-colors hidden sm:inline cursor-pointer"
          >
            Tiwlo
          </button>
          <span className="text-[#C4C7C5] hidden sm:inline">|</span>
          <span className="text-[14px] font-normal text-[#444746] hidden sm:inline">
            Discord Console
          </span>
        </div>

        {/* Google Style Project / Organization Selector */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#F0F4F9] hover:bg-[#E9EEF6] border border-transparent rounded-full px-3 py-1.5 text-[12px] text-[#1F1F1F] transition-colors cursor-pointer ml-3">
          <span className="text-[#747775]">Environment:</span>
          <span className="font-medium truncate max-w-[140px]">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#747775]" />
        </div>
      </div>

      {/* Center: Modern Google Omnibox Pill Search */}
      <div className="flex-1 max-w-xl mx-4 sm:mx-8 hidden sm:block">
        <div className="relative flex items-center w-full bg-[#F0F4F9] hover:bg-[#E9EEF6] focus-within:bg-white focus-within:border-[#0B57D0] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 border border-transparent rounded-full px-4 py-2 transition-all">
          <Search className="w-4 h-4 text-[#747775] shrink-0 mr-2.5" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search bots, servers, automations, and logs (/)"
            className="w-full bg-transparent text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none"
          />
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          className="p-2 text-[#444746] hover:text-[#1F1F1F] hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer"
          title="Console Documentation & Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          className="p-2 text-[#444746] hover:text-[#1F1F1F] hover:bg-[#F0F4F9] rounded-full transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Avatar Circle */}
        <div
          className="w-8 h-8 rounded-full bg-[#0B57D0] text-white text-[12px] font-medium flex items-center justify-center shrink-0 ml-1.5 cursor-pointer ring-2 ring-transparent hover:ring-[#C2E7FF]"
          title={displayEmail ? `${displayName} (${displayEmail})` : displayName}
        >
          {getInitials()}
        </div>
      </div>
    </header>
  );
}
