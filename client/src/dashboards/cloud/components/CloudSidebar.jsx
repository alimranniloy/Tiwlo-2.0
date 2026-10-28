import React, { useState } from 'react';
import {
  LayoutDashboard,
  BriefcaseBusiness,
  ShoppingBag,
  Server,
  Globe2,
  HelpCircle,
  CreditCard,
  Settings,
  ChevronDown,
  Plus,
  Store,
  ExternalLink,
  Mail,
  Fingerprint,
  IdCard,
  X
} from 'lucide-react';

export default function CloudSidebar({
  activeNav = 'dashboard',
  setActiveNav,
  userStores = [],
  onOpenCreateStore,
  onOpenCreateDroplet,
  onNavigateTab,
  mobileOpen = false,
  setMobileOpen
}) {
  const [dropletsOpen, setDropletsOpen] = useState(false);

  const handleNavSelect = (navId) => {
    if (['my-droplets', 'images', 'snapshots', 'backups', 'volumes', 'kubernetes'].includes(navId)) {
      setDropletsOpen(true);
    }
    setActiveNav?.(navId);
    setMobileOpen?.(false);
  };

  const handleProductSelect = (tabId) => {
    setMobileOpen?.(false);
    onNavigateTab?.(tabId);
  };

  const renderNavItem = ({ id, label, icon: Icon, external = false, navigateTab = false }) => {
    const isActive = activeNav === id || activeNav.startsWith(`${id}/`);

    return (
      <button
        key={id}
        type="button"
        onClick={() => (navigateTab ? handleProductSelect(id) : handleNavSelect(id))}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
          isActive
            ? 'bg-[#E8F0FE] text-[#0B57D0] font-semibold dark:bg-blue-950/40 dark:text-blue-300'
            : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0B57D0] dark:text-blue-300' : 'text-[#747775] dark:text-slate-500'}`} />
          <span className="truncate">{label}</span>
        </span>
        {external && <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#747775] dark:text-slate-500" aria-hidden="true" />}
      </button>
    );
  };

  const dropletSubItems = [
    { id: 'create-droplet', label: 'Create Droplet', action: () => { setMobileOpen?.(false); onOpenCreateDroplet?.(); } },
    { id: 'my-droplets', label: 'My Droplets' },
    { id: 'tpanel-login', label: 'TPanel Control Panel', action: () => { window.open('/tpanel', '_blank'); }, badge: 'Pro' },
    { id: 'images', label: 'Images' },
    { id: 'snapshots', label: 'Snapshots' },
    { id: 'backups', label: 'Backups' },
    { id: 'volumes', label: 'Volumes' },
    { id: 'kubernetes', label: 'Kubernetes', badge: 'New' }
  ];

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
        w-[260px] sm:w-[270px] lg:w-[250px] h-screen overflow-y-auto bg-white border-r border-[#E0E2EC] flex flex-col p-4 select-none transition-all duration-300 ease-in-out shrink-0 font-sans
        fixed inset-y-0 left-0 z-50
        lg:static lg:translate-x-0 lg:z-20 lg:sticky lg:top-0
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          {/* Brand Header using Official Tiwlo Logo & Mobile Close Button */}
          <div className="flex items-center justify-between mb-5 px-2">
            <div
              onClick={() => handleNavSelect('dashboard')}
              className="h-9 flex items-center shrink-0 cursor-pointer"
            >
              <img
                src="/tiwlologo.png"
                alt="Tiwlo"
                className="h-8 w-auto object-contain"
              />
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden p-1.5 rounded-full text-[#444746] hover:bg-[#F0F4F9] transition"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        <nav aria-label="Main navigation" className="space-y-5">
          <section className="space-y-1">
            <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-slate-500">
              Overview
            </p>
            {renderNavItem({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard })}
            {renderNavItem({ id: 'workspace', label: 'Workspace hub', icon: BriefcaseBusiness })}
          </section>

          <section className="space-y-1">
            <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-slate-500">
              Products
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleNavSelect('my-online-store')}
                aria-current={activeNav === 'my-online-store' ? 'page' : undefined}
                className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  activeNav === 'my-online-store'
                    ? 'bg-[#E8F0FE] text-[#0B57D0] font-semibold dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Store className="w-4 h-4 shrink-0 text-[#747775] dark:text-slate-500" />
                  <span className="truncate">Online store</span>
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F0F4F9] text-[#5F6368] dark:bg-gray-700 dark:text-slate-300">
                  {userStores.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen?.(false);
                  onOpenCreateStore?.();
                }}
                title="Create a store"
                aria-label="Create a store"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5F6368] hover:bg-[#F0F4F9] hover:text-[#0B57D0] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-blue-300 transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {renderNavItem({ id: 'marketplace', label: 'Marketplace', icon: ShoppingBag })}
            {renderNavItem({ id: 'email', label: 'Email (Tiwi Mail)', icon: Mail, external: true, navigateTab: true })}
            {renderNavItem({ id: 'oneprofile', label: 'OneProfile', icon: Fingerprint, external: true, navigateTab: true })}
          </section>

          <section className="space-y-1">
            <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-slate-500">
              Cloud
            </p>
            {renderNavItem({ id: 'domains', label: 'Domains', icon: Globe2 })}

            <div>
              <button
                type="button"
                onClick={() => setDropletsOpen((open) => !open)}
                aria-expanded={dropletsOpen}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  activeNav === 'my-droplets' || ['images', 'snapshots', 'backups', 'volumes', 'kubernetes', 'create-droplet'].includes(activeNav)
                    ? 'bg-[#E8F0FE] text-[#0B57D0] font-semibold dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F] dark:text-slate-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-[#747775] dark:text-slate-500" />
                  <span>Infrastructure</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropletsOpen ? '' : '-rotate-90'}`} />
              </button>

              {dropletsOpen && (
                <div className="ml-5 mt-1 pl-3 border-l border-[#DADCE0] dark:border-gray-700 space-y-0.5">
                  {dropletSubItems.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        if (sub.action) {
                          sub.action();
                        } else {
                          handleNavSelect(sub.id);
                        }
                        setMobileOpen?.(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                        activeNav === sub.id
                          ? 'text-[#0B57D0] dark:text-blue-300 font-semibold bg-[#E8F0FE] dark:bg-blue-950/40'
                          : 'text-[#5F6368] dark:text-slate-400 hover:text-[#1F1F1F] dark:hover:text-white hover:bg-[#F0F4F9] dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{sub.label}</span>
                      {sub.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-1">
            <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-slate-500">
              Account
            </p>
            {renderNavItem({ id: 'verification', label: 'Identity', icon: IdCard, external: true, navigateTab: true })}
            {renderNavItem({ id: 'help-support', label: 'Help & support', icon: HelpCircle })}
            {renderNavItem({ id: 'billing', label: 'Billing', icon: CreditCard })}
            {renderNavItem({ id: 'settings', label: 'Settings', icon: Settings, navigateTab: true })}
          </section>
        </nav>
      </div>

    </aside>
  </>
);
}
