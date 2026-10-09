import React from 'react';
import { Search, Bell, Menu } from 'lucide-react';

export default function DiscordHeader({
  breadcrumbs = ['Workspace', 'Overview'],
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenMobileMenu
}) {
  const getInitials = () => {
    const name = currentUser?.name || currentUser?.storeName || 'Alex Morgan';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Menu Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center text-sm font-normal text-[#64748B]">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              {idx > 0 && <span className="mx-2 text-[#94A3B8]">/</span>}
              <span className={idx === breadcrumbs.length - 1 ? 'text-[#0F172A] font-medium' : ''}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: Search Input, Notifications, User Avatar */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Search Input */}
        <div className="relative hidden sm:block w-64 md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search bots, servers, commands..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-1.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Notifications Icon */}
        <button
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors relative"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Avatar badge */}
        <div className="w-8 h-8 rounded-full bg-[#E2E8F0] text-[#334155] text-xs font-bold flex items-center justify-center shrink-0">
          {getInitials()}
        </div>
      </div>
    </header>
  );
}
