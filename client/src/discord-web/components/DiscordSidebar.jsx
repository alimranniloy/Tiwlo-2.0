import React from 'react';
import {
  Home,
  Bot,
  Server,
  Zap,
  Shield,
  Ticket,
  BarChart2,
  Settings,
  HelpCircle,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  ChevronDown
} from 'lucide-react';

export default function DiscordSidebar({
  currentPath,
  onNavigate,
  currentUser,
  mobileOpen,
  onCloseMobile
}) {
  // Pure Discord bot management items (NO Marketplace per user request)
  const mainNavItems = [
    { id: 'overview', label: 'Overview', icon: Home, path: '/discord' },
    { id: 'bots', label: 'My bots', icon: Bot, path: '/discord/bots' },
    { id: 'servers', label: 'Your servers', icon: Server, path: '/discord/servers' },
    { id: 'automations', label: 'Automations', icon: Zap, path: '/discord/automations' },
    { id: 'moderation', label: 'Moderation', icon: Shield, path: '/discord/moderation' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/discord/tickets' },
    { id: 'activity', label: 'Activity logs', icon: BarChart2, path: '/discord/activity' },
  ];

  const adminNavItems = [
    { id: 'settings', label: 'Console settings', icon: Settings, path: '/discord/settings' },
  ];

  const isCurrentActive = (itemPath) => {
    if (itemPath === '/discord') {
      return currentPath === '/discord' || currentPath === '/discord/overview' || currentPath === '';
    }
    return currentPath.startsWith(itemPath);
  };

  const getInitials = () => {
    const name = currentUser?.name || currentUser?.storeName || 'Alex Morgan';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = currentUser?.name || currentUser?.storeName || 'Alex Morgan';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-[#202124] border-r border-[#DADCE0] select-none font-sans">
      {/* Top Console Title */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-[#F1F3F4]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#1A73E8] text-white flex items-center justify-center">
            <Bot className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <div className="text-[14px] font-medium text-[#202124] leading-tight">
              Bot Platform
            </div>
            <div className="text-[11px] text-[#5F6368]">
              Tiwlo Cloud Extensions
            </div>
          </div>
        </div>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 rounded-full text-[#5F6368] hover:bg-[#F1F3F4]"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation Links (Google Cloud Drawer styling) */}
      <div className="py-2 flex-1 overflow-y-auto space-y-0.5">
        <div className="px-4 py-1.5 text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
          Bot Management
        </div>

        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.path);
                if (mobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors text-left cursor-pointer mr-2 rounded-r-full ${
                active
                  ? 'bg-[#E8F0FE] text-[#1A73E8] font-medium'
                  : 'text-[#3C4043] hover:bg-[#F8F9FA] hover:text-[#202124]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#1A73E8]' : 'text-[#5F6368]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="px-4 pt-4 pb-1.5 text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
          Configuration
        </div>

        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.path);
                if (mobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors text-left cursor-pointer mr-2 rounded-r-full ${
                active
                  ? 'bg-[#E8F0FE] text-[#1A73E8] font-medium'
                  : 'text-[#3C4043] hover:bg-[#F8F9FA] hover:text-[#202124]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#1A73E8]' : 'text-[#5F6368]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Area: Link back to Main Cloud Platform */}
      <div className="p-3 border-t border-[#DADCE0] space-y-2 bg-[#FAFAFA]">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium text-[#1A73E8] hover:bg-[#E8F0FE] rounded-md transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Main Cloud Platform</span>
          </div>
          <ExternalLink className="w-3 h-3" />
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div className="w-7 h-7 rounded-full bg-[#1A73E8] text-white text-[11px] font-medium flex items-center justify-center shrink-0">
            {getInitials()}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#202124] truncate leading-tight">
              {displayName}
            </div>
            <div className="text-[11px] text-[#5F6368] truncate">
              Standard tier
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex flex-col w-64 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
