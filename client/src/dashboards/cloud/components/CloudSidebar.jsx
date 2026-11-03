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
  ChevronsUpDown,
  Plus,
  Store,
  ExternalLink,
  Mail,
  Fingerprint,
  IdCard,
  X,
  Sparkles
} from 'lucide-react';

export default function CloudSidebar({
  activeNav = 'dashboard',
  setActiveNav,
  userStores = [],
  currentStore,
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
            ? 'bg-white text-[#121212] font-semibold'
            : 'text-white/65 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#000000] dark:text-neutral-300' : 'text-[#747775] dark:text-neutral-500'}`} />
          <span className="truncate">{label}</span>
        </span>
        {external && <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#747775] dark:text-neutral-500" aria-hidden="true" />}
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
          className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside className={`
        tiwi-v3-sidebar w-64 h-dvh overflow-y-auto bg-black flex flex-col gap-6 p-4 select-none transition-all duration-300 ease-in-out shrink-0 font-sans
        fixed inset-y-0 left-0 z-50
        lg:static lg:translate-x-0 lg:z-20 lg:sticky lg:top-0
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          {/* Brand Header using Official Tiwlo Logo & Mobile Close Button */}
          <div className="flex items-center justify-between px-2 pt-2">
            <div
              onClick={() => handleNavSelect('dashboard')}
              className="flex h-8 items-center shrink-0 cursor-pointer"
            >
              <img
                src="/tiwlo-dark-bg-logo.png"
                alt="Tiwlo Cloud"
                className="h-7 w-auto max-w-[150px] object-contain"
              />
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen?.(false)}
              className="lg:hidden p-1.5 rounded-full text-[#444746] hover:bg-[#f4f4f4] transition"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleNavSelect('my-online-store')}
            className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] text-sm font-bold text-black">
              {(currentStore?.storeName || userStores[0]?.storeName || 'TW').slice(0, 2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-white">
                {currentStore?.storeName || userStores[0]?.storeName || 'Tiwlo Workspace'}
              </span>
              <span className="truncate text-xs text-white/50">
                Cloud · {currentStore?.planName || currentStore?.planId || 'Workspace'}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden="true" />
          </button>

        <nav aria-label="Main navigation" className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-1">
          <section className="space-y-1">
            <p className="tiwi-v3-nav-label px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-neutral-500">
              Overview
            </p>
            {renderNavItem({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard })}
            {renderNavItem({ id: 'workspace', label: 'Workspace hub', icon: BriefcaseBusiness })}
          </section>

          <section className="space-y-1">
            <p className="tiwi-v3-nav-label px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-neutral-500">
              Products
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleNavSelect('my-online-store')}
                aria-current={activeNav === 'my-online-store' ? 'page' : undefined}
                className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  activeNav === 'my-online-store'
                    ? 'bg-white text-[#121212] font-semibold'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Store className="w-4 h-4 shrink-0 text-[#747775] dark:text-neutral-500" />
                  <span className="truncate">Online store</span>
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f4f4f4] text-[#636363] dark:bg-gray-700 dark:text-neutral-300">
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
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#636363] hover:bg-[#f4f4f4] hover:text-[#000000] dark:text-neutral-400 dark:hover:bg-gray-800 dark:hover:text-neutral-300 transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {renderNavItem({ id: 'marketplace', label: 'Marketplace', icon: ShoppingBag })}
            {renderNavItem({ id: 'email', label: 'Email (Tiwi Mail)', icon: Mail, external: true, navigateTab: true })}
            {renderNavItem({ id: 'oneprofile', label: 'OneProfile', icon: Fingerprint, external: true, navigateTab: true })}
          </section>

          <section className="space-y-1">
            <p className="tiwi-v3-nav-label px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-neutral-500">
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
                    ? 'bg-white text-[#121212] font-semibold'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-[#747775] dark:text-neutral-500" />
                  <span>Infrastructure</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropletsOpen ? '' : '-rotate-90'}`} />
              </button>

              {dropletsOpen && (
                <div className="ml-5 mt-1 pl-3 border-l border-[#dcdcdc] dark:border-gray-700 space-y-0.5">
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
                          ? 'text-white font-semibold bg-white/10'
                          : 'text-white/55 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{sub.label}</span>
                      {sub.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-900/40 dark:text-neutral-400">
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
            <p className="tiwi-v3-nav-label px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#747775] dark:text-neutral-500">
              Account
            </p>
            {renderNavItem({ id: 'identity', label: 'Identity', icon: IdCard })}
            {renderNavItem({ id: 'help-support', label: 'Help & support', icon: HelpCircle })}
            {renderNavItem({ id: 'billing', label: 'Billing', icon: CreditCard })}
            {renderNavItem({ id: 'settings', label: 'Settings', icon: Settings, navigateTab: true })}
          </section>
        </nav>
        <div className="rounded-2xl bg-[#1ed760] p-4 text-black">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4" aria-hidden="true" />
            Create a store
          </div>
          <p className="mt-1 text-xs leading-relaxed text-black/70">
            Launch a storefront with your Tiwlo workspace.
          </p>
          <button
            type="button"
            onClick={() => {
              setMobileOpen?.(false);
              onOpenCreateStore?.();
            }}
            className="mt-3 inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-bold text-white transition hover:bg-black/80"
          >
            Open store
          </button>
        </div>
      </div>

    </aside>
  </>
);
}
