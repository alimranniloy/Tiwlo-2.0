import React from 'react';
import {
  Activity,
  Bot,
  LayoutDashboard,
  Receipt,
  Store,
  Package,
  Gift,
  CreditCard,
  Cpu,
  Server,
  Globe,
  Network,
  HardDrive,
  ShieldAlert,
  MapPin,
  MessageSquare,
  LifeBuoy,
  FileCheck2,
  FileText,
  ShieldCheck,
  Settings,
  X
} from 'lucide-react';

const VIEW_REQUIRED_PERMISSIONS = {
  dashboard: null,
  orders: ['manage_orders', 'view_financials'],
  customers: ['view_stores', 'manage_stores'],
  'identity-reviews': ['view_stores', 'manage_stores', 'manage_users_security'],
  'identity-verification': ['view_stores', 'manage_stores', 'manage_users_security'],
  packages: ['manage_packages_promos'],
  promotions: ['manage_packages_promos'],
  'platform-payments': ['manage_system_settings'],
  servers: ['manage_servers'],
  'server-packages': ['manage_servers', 'manage_packages_promos'],
  'server-allocation': ['manage_servers', 'manage_packages_promos'],
  domains: ['manage_dns_domains'],
  dns: ['manage_dns_domains'],
  'google-drive': ['manage_servers'],
  users: ['manage_users_security', 'ban_users'],
  'user-profile': ['view_stores', 'manage_stores', 'manage_users_security', 'ban_users'],
  'user-locations': ['manage_users_security'],
  'support-desk': ['manage_orders', 'manage_users_security', 'manage_support', 'support_desk'],
  'compliance-audit': ['manage_users_security', 'view_financials', 'view_audit_logs', 'manage_orders'],
  'live-visitors': ['manage_users_security', 'view_stores', 'manage_support'],
  'discord-bot': ['manage_system_settings', 'manage_support'],
  'pick-account-appeals': ['manage_orders', 'manage_users_security'],
  logs: ['manage_users_security'],
  'staff-support': ['manage_staff_roles'],
  'system-settings': ['manage_system_settings'],
  'social-login': ['manage_system_settings'],
  'google-maps': ['manage_system_settings']
};

export function isAdminViewPermitted(viewId, staffAccess) {
  const normalizedView = viewId === 'payment-gateways' ? 'platform-payments' : viewId;
  const baseView = normalizedView.includes('/') ? normalizedView.split('/')[0] : normalizedView;

  if (!staffAccess) {
    return baseView === 'dashboard';
  }
  if (
    staffAccess.isSuperAdmin === true ||
    staffAccess.role === 'super_admin' ||
    staffAccess.roleKey === 'super_admin' ||
    staffAccess.unrestricted === true
  ) {
    return true;
  }

  const perms = staffAccess.permissions ?? staffAccess.allowedViews;
  if (!perms) return baseView === 'dashboard';

  if (Array.isArray(perms)) {
    if (perms.includes('*')) return true;
    // Direct view ID match
    if (perms.includes(normalizedView) || perms.includes(baseView)) return true;
    // Backend permission key match (staffSecurityService.js)
    const requiredAny = VIEW_REQUIRED_PERMISSIONS[baseView];
    if (requiredAny === null) return true;
    if (Array.isArray(requiredAny)) {
      return requiredAny.some((key) => perms.includes(key));
    }
    return false;
  }

  if (typeof perms === 'object') {
    if (Array.isArray(perms.views)) {
      return perms.views.includes('*') || perms.views.includes(normalizedView) || perms.views.includes(baseView);
    }
    if (Array.isArray(perms.allowedViews)) {
      return (
        perms.allowedViews.includes('*') ||
        perms.allowedViews.includes(normalizedView) ||
        perms.allowedViews.includes(baseView)
      );
    }
    if (Object.prototype.hasOwnProperty.call(perms, normalizedView)) {
      return Boolean(perms[normalizedView]);
    }
    if (Object.prototype.hasOwnProperty.call(perms, baseView)) {
      return Boolean(perms[baseView]);
    }
    const requiredAny = VIEW_REQUIRED_PERMISSIONS[baseView];
    if (requiredAny === null) return true;
    if (Array.isArray(requiredAny) && requiredAny.some((key) => perms[key] === true)) {
      return true;
    }
    return false;
  }

  return false;
}

const NAV_SECTIONS = [
  {
    title: 'PLATFORM & FINANCE',
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'orders', label: 'System Orders', icon: Receipt },
      { id: 'customers', label: 'Tiwlo Users & Stores', icon: Store },
      { id: 'identity-reviews', label: 'Identity Review', icon: FileCheck2 },
      { id: 'packages', label: 'Plans & Add-ons', icon: Package },
      { id: 'promotions', label: 'Promotions & Credits', icon: Gift },
      { id: 'platform-payments', label: 'Payment Gateways', icon: CreditCard }
    ]
  },
  {
    title: 'INFRASTRUCTURE',
    items: [
      { id: 'servers', label: 'Server & System Status', icon: Server },
      { id: 'server-packages', label: 'Server Packages', icon: Package },
      { id: 'server-allocation', label: 'Resource Allocation', icon: Cpu },
      { id: 'domains', label: 'Domains & Subdomains', icon: Globe },
      { id: 'dns', label: 'DNS Records', icon: Network },
      { id: 'google-drive', label: 'Google Drive', icon: HardDrive }
    ]
  },
  {
    title: 'TRUST & SETTINGS',
    items: [
      { id: 'users', label: 'Users & Risk Monitor', icon: ShieldAlert },
      { id: 'user-locations', label: 'User Locations', icon: MapPin },
      { id: 'live-visitors', label: 'Live Visitors', icon: Activity },
      { id: 'support-desk', label: 'Support Desk', icon: MessageSquare },
      { id: 'compliance-audit', label: 'Compliance & Audit', icon: FileCheck2 },
      { id: 'discord-bot', label: 'Discord Bot', icon: Bot },
      { id: 'pick-account-appeals', label: 'PICK Reviews', icon: LifeBuoy },
      { id: 'logs', label: 'Security & Email Logs', icon: FileText },
      { id: 'staff-support', label: 'Staff Support & Roles', icon: ShieldCheck },
      { id: 'system-settings', label: 'Settings & Currency', icon: Settings }
    ]
  }
];

export default function AdminSidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  staffAccess,
  isDarkMode
}) {
  const dark =
    typeof isDarkMode === 'boolean'
      ? isDarkMode
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isAdminViewPermitted(item.id, staffAccess))
  })).filter((section) => section.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 border-r border-neutral-200/80 dark:border-neutral-800 select-none">
      {/* Mobile Header in Drawer */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={dark ? '/tiwlo-dark-bg-logo.png' : '/tiwlo-light-logo.png'}
            alt="Tiwlo"
            className="h-6 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/favicon.png';
            }}
          />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-800">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Scroll Area */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Platform Admin Navigation">
        {visibleSections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <h3 className="px-3 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              {sec.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {sec.items.map((item) => {
                const IconComponent = item.icon;
                const isActive =
                  activeView === item.id ||
                  activeView.startsWith(`${item.id}/`) ||
                  (item.id === 'platform-payments' && activeView === 'payment-gateways') ||
                  (item.id === 'customers' && activeView.startsWith('identity-verification/')) ||
                  (item.id === 'system-settings' && (activeView === 'social-login' || activeView === 'google-maps'));

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onCloseMobile?.();
                    }}
                    className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#1ED760]/12 dark:bg-[#1ED760]/15 text-neutral-950 dark:text-white font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#1ED760]"
                        aria-hidden="true"
                      />
                    )}
                    <IconComponent
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#159f46] dark:text-[#1ED760]' : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Tiwlo Branding Card */}
      <div className="p-3 border-t border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#fafafa] dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800">
          <img
            src="/favicon.png"
            alt="Tiwlo"
            className="w-8 h-8 object-contain shrink-0 bg-transparent"
          />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-white truncate">Tiwlo Control</h4>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
              Platform Operations & Trust
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-[calc(100vh-4rem)] sticky top-16 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Flyout */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
