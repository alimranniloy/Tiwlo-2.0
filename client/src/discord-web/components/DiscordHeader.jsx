import React from 'react';
import { Search, Bell, Menu, HelpCircle, ChevronDown, Bot } from 'lucide-react';

export default function DiscordHeader({
  breadcrumbs = ['Discord Console', 'Overview'],
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenMobileMenu,
  onNavigateHome
}) {
  const getInitials = () => {
    const name = currentUser?.name || currentUser?.storeName || 'Alex Morgan';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = currentUser?.name || currentUser?.storeName || 'Alex Morgan';
  const displayEmail = currentUser?.email || 'admin@tiwlo.internal';

  return (
    <header className="h-14 border-b border-[#DADCE0] bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20 font-sans select-none">
      {/* Left: Mobile Toggle, Product Title & Environment Selector */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-full text-[#5F6368] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tiwlo Discord Console Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#1A73E8] text-white flex items-center justify-center font-bold text-xs">
            <Bot className="w-4 h-4 stroke-[2.2]" />
          </div>
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else window.location.href = '/';
            }}
            className="text-[15px] font-medium text-[#202124] hover:text-[#1A73E8] transition-colors hidden sm:inline cursor-pointer"
          >
            Tiwlo
          </button>
          <span className="text-[#BDC1C6] hidden sm:inline">|</span>
          <span className="text-[14px] font-normal text-[#202124] hidden sm:inline">
            Discord Console
          </span>
        </div>

        {/* Google Cloud Style Project / Organization Selector */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#F1F3F4] hover:bg-[#E8EAED] border border-transparent rounded px-2.5 py-1 text-[12px] text-[#202124] transition-colors cursor-pointer ml-3">
          <span className="text-[#5F6368]">Environment:</span>
          <span className="font-medium truncate max-w-[140px]">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#5F6368]" />
        </div>
      </div>

      {/* Center: Google Cloud Style Omnibox Search */}
      <div className="flex-1 max-w-xl mx-3 sm:mx-6 hidden sm:block">
        <div className="relative flex items-center w-full bg-[#F1F3F4] hover:bg-[#E8EAED] focus-within:bg-white focus-within:border-[#1A73E8] focus-within:ring-1 focus-within:ring-[#1A73E8] border border-transparent rounded-lg px-3 py-1.5 transition-all">
          <Search className="w-4 h-4 text-[#5F6368] shrink-0 mr-2" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search bots, servers, automations, and logs (/)"
            className="w-full bg-transparent text-[13px] text-[#202124] placeholder-[#5F6368] focus:outline-none"
          />
        </div>
      </div>

      {/* Right: Actions & Google Profile */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          className="p-2 text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] rounded-full transition-colors cursor-pointer"
          title="Console Documentation & Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          className="p-2 text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] rounded-full transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#1A73E8] absolute top-2 right-2" />
        </button>

        {/* User Avatar Circle */}
        <div
          className="w-8 h-8 rounded-full bg-[#1A73E8] text-white text-[12px] font-medium flex items-center justify-center shrink-0 ml-1 cursor-pointer ring-2 ring-transparent hover:ring-[#D2E3FC]"
          title={`${displayName} (${displayEmail})`}
        >
          {getInitials()}
        </div>
      </div>
    </header>
  );
}
