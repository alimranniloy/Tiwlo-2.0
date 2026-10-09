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
  // Pure Discord bot management items
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
    <div className="flex flex-col h-full bg-white text-[#1F1F1F] border-r border-[#E0E2EC] select-none font-sans">
      {/* Top Console Title */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#E0E2EC]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#0B57D0] text-white flex items-center justify-center shadow-none">
            <Bot className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <div className="text-[14px] font-medium text-[#1F1F1F] leading-tight">
              Bot Platform
            </div>
            <div className="text-[11px] text-[#747775]">
              Tiwlo Cloud Extensions
            </div>
          </div>
        </div>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-full text-[#444746] hover:bg-[#F0F4F9]"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation Links (Google Material 3 Pill Drawer Items) */}
      <div className="py-3 flex-1 overflow-y-auto space-y-1">
        <div className="px-5 py-2 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
          Bot Management
        </div>

        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <div key={item.id} className="px-3">
              <button
                onClick={() => {
                  onNavigate(item.path);
                  if (mobileOpen) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors text-left cursor-pointer rounded-full ${
                  active
                    ? 'bg-[#C2E7FF] text-[#001D35] font-semibold'
                    : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#001D35]' : 'text-[#747775]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}

        <div className="px-5 pt-5 pb-2 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
          Configuration
        </div>

        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <div key={item.id} className="px-3">
              <button
                onClick={() => {
                  onNavigate(item.path);
                  if (mobileOpen) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors text-left cursor-pointer rounded-full ${
                  active
                    ? 'bg-[#C2E7FF] text-[#001D35] font-semibold'
                    : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#001D35]' : 'text-[#747775]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Area: Link back to Main Cloud Platform */}
      <div className="p-3 border-t border-[#E0E2EC] space-y-2 bg-white">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium text-[#0B57D0] hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Main Cloud Platform</span>
          </div>
          <ExternalLink className="w-3 h-3" />
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-[#0B57D0] text-white text-[11px] font-medium flex items-center justify-center shrink-0">
            {getInitials()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[#1F1F1F] truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-[#747775] truncate">
              Standard Workspace
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 min-h-screen">
        <div className="fixed top-0 bottom-0 w-64 z-30">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer (with backdrop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
