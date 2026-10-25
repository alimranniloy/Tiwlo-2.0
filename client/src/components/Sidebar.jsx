import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ShoppingCart,
  Receipt,
  Users,
  Truck,
  FileText,
  BarChart3,
  Settings,
  Box,
  Server,
  Store,
  Globe,
  ExternalLink,
  Sparkles,
  LayoutGrid,
  HelpCircle,
  ArrowLeft,
  Mail,
  X,
  BriefcaseBusiness,
  CreditCard,
  Tag
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  onVisitSite,
  onBackToCloud,
  mobileOpen = false,
  setMobileOpen
}) {
  const handleNavClick = (tabId) => {
    if (tabId === 'help-support') {
      window.dispatchEvent(new CustomEvent('tiwlo:open-support'));
    }
    setActiveTab(tabId);
    setMobileOpen?.(false);
  };

  const navItems = [
    { id: 'subscription', name: 'Upgrade & Plans', icon: Sparkles, isUpgrade: true, section: 'Workspace' },
    { id: 'ecommerce-dashboard', name: 'Store Dashboard', icon: LayoutDashboard, section: 'Workspace' },
    { id: 'workspace', name: 'Workspace', icon: BriefcaseBusiness, section: 'Workspace' },
    { id: 'email', name: 'Tiwi Mail', icon: Mail, isNew: true, section: 'Store management' },
    { id: 'pos', name: 'POS System', icon: Store, isNew: true, section: 'Store management' },
    { id: 'products', name: 'Products', icon: Package, section: 'Store management' },
    { id: 'categories', name: 'Categories & Subs', icon: Layers, section: 'Store management' },
    { id: 'inventory', name: 'Inventory Control', icon: Boxes, section: 'Store management' },
    { id: 'purchases', name: 'Purchases (PO)', icon: ShoppingCart, section: 'Store management' },
    { id: 'sales', name: 'Sales & Orders', icon: Receipt, section: 'Store management' },
    { id: 'courier', name: 'Courier', icon: Truck, isCourier: true, section: 'Store management' },
    { id: 'customers', name: 'Customers', icon: Users, section: 'Store management' },
    { id: 'suppliers', name: 'Suppliers', icon: Truck, section: 'Store management' },
    { id: 'reports', name: 'Reports Ledger', icon: FileText, section: 'Insights' },
    { id: 'analytics', name: 'Analytics', icon: BarChart3, section: 'Insights' },
    { id: 'settings', name: 'Settings', icon: Server, section: 'Settings & support' },
    { id: 'store-settings', name: 'Storefront & Theme', icon: Settings, section: 'Settings & support' },
    { id: 'payments', name: 'Payments', icon: CreditCard, section: 'Store settings' },
    { id: 'shipping', name: 'Shipping', icon: Truck, section: 'Store settings' },
    { id: 'promotions', name: 'Promo Codes', icon: Tag, section: 'Marketing' },
    { id: 'help-support', name: 'Help & Support', icon: HelpCircle, section: 'Settings & support' },
  ];
  const visibleNavItems = activeTab === 'ecommerce-dashboard'
    ? navItems.filter(item => item.id !== 'workspace' && item.id !== 'email')
    : navItems;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen?.(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside className={`
        w-[270px] sm:w-[280px] lg:w-[260px] h-screen overflow-y-auto bg-white dark:bg-[#111827] border-r border-[#EDF2F7] dark:border-gray-800 flex flex-col justify-between p-5 select-none transition-all duration-300 ease-in-out shrink-0
        fixed inset-y-0 left-0 z-50
        lg:static lg:translate-x-0 lg:z-20 lg:sticky lg:top-0
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          {/* Top Bar: macOS Window Controls & Mobile Close Button */}
          <div className="flex items-center justify-between mb-5 pt-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 cursor-pointer shadow-xs"></div>
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 cursor-pointer shadow-xs"></div>
              <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 cursor-pointer shadow-xs"></div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center space-x-3 mb-7 px-1 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 flex items-center justify-center p-1.5 shadow-xs group-hover:scale-105 group-hover:border-blue-500/40 transition shrink-0">
            <img
              src="/tiwlo-icon.png"
              alt="Tiwlo"
              className="w-full h-full object-contain dark:hidden"
            />
            <img
              src="/tiwlo-icon-dark.png"
              alt="Tiwlo"
              className="w-full h-full object-contain hidden dark:block"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h1 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Tiwlo
              </h1>
              <span className="text-[9px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate">
              Inventory Enterprise
            </p>
          </div>
        </div>

        {/* Switch to Main Control Center */}
        <button
          onClick={() => {
            setMobileOpen?.(false);
            if (onBackToCloud) onBackToCloud();
            else setActiveTab('dashboard');
          }}
          className="w-full mb-4 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 text-xs font-bold hover:bg-blue-100/80 dark:hover:bg-blue-900/40 transition cursor-pointer flex items-center justify-between shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Main Control Center</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-blue-500 group-hover:translate-x-0.5 transition" />
        </button>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {visibleNavItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'products' && activeTab === 'add-product');
            const showSectionHeading = index === 0 || visibleNavItems[index - 1].section !== item.section;

            return (
              <div key={item.id}>
                {showSectionHeading && (
                  <p className={`px-3.5 ${index === 0 ? 'pt-1' : 'pt-4'} pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500`}>
                    {item.section}
                  </p>
                )}
                <button
                  onClick={() => handleNavClick(item.id, item.hasSub)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Icon
                      className={`w-[18px] h-[18px] ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 stroke-[2.2]'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {item.isNew && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                      POS
                    </span>
                  )}

                  {item.isCourier && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Ship
                    </span>
                  )}

                  {item.isUpgrade && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 fill-white" />
                      PRO
                    </span>
                  )}

                </button>
              </div>
            );
          })}
        </nav>

        {/* Visit Site Button matching user request: System Settings এর নিচে Visit Site */}
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-gray-800/80 flex flex-col gap-2">
          {/* Tiwi Social Web Button */}
          <div
            onClick={() => {
              setMobileOpen?.(false);
              setActiveTab('tiwi');
            }}
            className="group relative w-full p-2.5 rounded-xl bg-gradient-to-r from-[#0B57D0] to-[#4285F4] hover:from-[#0842A0] hover:to-[#0B57D0] text-white shadow-md shadow-[#0B57D0]/20 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 select-none"
            title="Open Tiwi Social Media Experience"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition font-extrabold text-sm">
                  T
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold tracking-tight">Tiwi Social</span>
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400"></span>
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-100 font-medium leading-none mt-0.5">
                    Social Media & Ecosystem
                  </p>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-white/10 group-hover:bg-white/25 flex items-center justify-center transition shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              setMobileOpen?.(false);
              if (onVisitSite) {
                onVisitSite();
              } else {
                window.open('/?view=store', '_blank');
              }
            }}
            className="group relative w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 select-none"
            title="Open TiwiMart Online eCommerce Store"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold tracking-tight">Visit Site</span>
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-100 font-medium leading-none mt-0.5">
                    TiwiMart Global Store
                  </p>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-white/10 group-hover:bg-white/25 flex items-center justify-center transition shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Promo & Status */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-gray-800/80">
        {/* Smart Inventory Card */}
        <div
          onClick={() => setActiveTab('settings')}
          className="bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#EBF3FF] dark:from-gray-800/80 dark:to-gray-800/30 border border-slate-200/70 dark:border-gray-700/60 rounded-2xl p-3 shadow-xs cursor-pointer hover:border-blue-300 transition"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-700 shadow-xs flex items-center justify-center shrink-0 border border-blue-100 dark:border-gray-600">
              <Box className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                Enterprise v3.2.0
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                JSON DB Connected
              </p>
            </div>
          </div>
        </div>

        {/* System Online Status */}
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">
              Database Online
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
            Port: 5000
          </span>
        </div>
      </div>
    </aside>
  </>
);
}
