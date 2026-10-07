import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Store,
  Ticket,
  Truck,
  CreditCard,
  Star,
  Settings,
  Server,
  Globe,
  HardDrive,
  Receipt,
  Terminal,
  ShieldCheck,
  Activity,
  Sliders,
  UserCheck,
  ShieldAlert,
  FileText,
  Bell,
  ChevronRight,
  X
} from 'lucide-react';

export default function AdminSidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onCloseMobile
}) {
  const navSections = [
    {
      title: 'ECOMMERCE',
      items: [
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'products', label: 'Products', icon: Package },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'vendors', label: 'Vendors', icon: Store },
        { id: 'coupons', label: 'Coupons & Discounts', icon: Ticket },
        { id: 'shipping', label: 'Shipping', icon: Truck },
        { id: 'transactions', label: 'Transactions', icon: CreditCard },
        { id: 'reviews', label: 'Reviews', icon: Star },
        { id: 'ecommerce-settings', label: 'Settings', icon: Settings }
      ]
    },
    {
      title: 'CLOUD',
      items: [
        { id: 'servers', label: 'Servers', icon: Server },
        { id: 'domains', label: 'Domains', icon: Globe },
        { id: 'storage', label: 'Storage', icon: HardDrive },
        { id: 'usage-billing', label: 'Usage & Billing', icon: Receipt },
        { id: 'ssh-access', label: 'SSH / Access', icon: Terminal },
        { id: 'backups', label: 'Backups', icon: ShieldCheck },
        { id: 'monitoring', label: 'Monitoring', icon: Activity },
        { id: 'cloud-settings', label: 'Settings', icon: Sliders }
      ]
    },
    {
      title: 'STORAGE',
      items: [
        { id: 'google-drive', label: 'Google Drive', icon: HardDrive }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'users', label: 'Users', icon: UserCheck },
        { id: 'roles', label: 'Roles & Permissions', icon: ShieldAlert },
        { id: 'logs', label: 'Logs', icon: FileText },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'system-settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 select-none">
      {/* Mobile Header in Drawer */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <span className="font-bold text-slate-900 dark:text-white">Tiwlo Admin</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
        {/* Main Dashboard item */}
        <div>
          <button
            onClick={() => { onNavigate('dashboard'); onCloseMobile?.(); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeView === 'dashboard'
                ? 'bg-[#e8f0fe] dark:bg-blue-900/40 text-[#1a73e8] dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className={`w-4 h-4 ${activeView === 'dashboard' ? 'text-[#1a73e8] dark:text-blue-400' : 'text-slate-500'}`} />
              <span>Dashboard</span>
            </div>
          </button>
        </div>

        {/* Categorized Groups */}
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <h3 className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {sec.title}
            </h3>
            <div className="space-y-0.5 pt-1">
              {sec.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onCloseMobile?.(); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-[#e8f0fe] dark:bg-blue-900/40 text-[#1a73e8] dark:text-blue-400 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-[#1a73e8] dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`} />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-600 transition-transform ${
                        isActive ? 'text-[#1a73e8] dark:text-blue-400 rotate-90' : 'group-hover:translate-x-0.5'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Tiwlo Branding Card */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-slate-800 dark:to-slate-800/80 border border-blue-100/80 dark:border-slate-700/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/25">
            <span className="font-bold text-base">T</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">Tiwlo</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Build • Sell • Grow</p>
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
