import {
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  Home,
  LayoutGrid,
  ShoppingBag,
  Zap,
  Shield,
  Ticket,
  BarChart2,
  Settings,
  HelpCircle,
  X
} from 'lucide-react';

export default function DiscordSidebar({
  currentPath,
  onNavigate,
  currentUser,
  mobileOpen,
  onCloseMobile
}) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Home, path: '/discord' },
    { id: 'bots', label: 'My bots', icon: Bot, path: '/discord/bots' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, path: '/discord/marketplace' },
    { id: 'automations', label: 'Automations', icon: Zap, path: '/discord/automations' },
    { id: 'moderation', label: 'Moderation', icon: Shield, path: '/discord/moderation' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/discord/tickets' },
    { id: 'activity', label: 'Activity', icon: BarChart2, path: '/discord/activity' },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings, path: '/discord/settings' },
    { id: 'help', label: 'Help', icon: HelpCircle, path: '/discord/help' },
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
    <div className="flex flex-col h-full bg-[#FAFAFA] text-[#1E293B] border-r border-[#E2E8F0] select-none">
      {/* Top Brand Header */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center text-[#0F172A]">
            <Bot className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="font-bold text-[17px] text-[#0F172A] tracking-tight">Bot Manager</span>
        </div>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      <div className="px-4 mb-3">
        <button
          onClick={() => onNavigate('/discord')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-gray-50 border border-[#E2E8F0] shadow-xs text-sm font-medium text-[#1E293B] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="truncate">My workspace</span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>

      {/* Main Navigation Links */}
      <div className="px-3 py-2 flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.path);
                if (mobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                active
                  ? 'bg-[#EBF1FA] text-[#0F172A] font-semibold shadow-xs'
                  : 'text-[#475569] hover:bg-gray-100/70 hover:text-[#0F172A]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0F172A]' : 'text-gray-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Actions & User Profile */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.path);
                if (mobileOpen) onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                active
                  ? 'bg-[#EBF1FA] text-[#0F172A] font-semibold'
                  : 'text-[#475569] hover:bg-gray-100/70 hover:text-[#0F172A]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-gray-500" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* User Profile Card */}
        <div className="pt-2">
          <button
            onClick={() => onNavigate('/discord/settings')}
            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100/80 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#E2E8F0] text-[#334155] text-xs font-bold flex items-center justify-center shrink-0">
                {getInitials()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate leading-tight">
                  {displayName}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
