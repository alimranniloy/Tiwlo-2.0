import React from 'react';
import {
  BadgePercent,
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
  Globe,
  Gem,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MonitorSmartphone,
  Package,
  PanelTop,
  Receipt,
  Settings2,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const navigation = [
  {
    section: 'Workspace',
    items: [
      { id: 'subscription', label: 'Upgrade & Plans', icon: Gem, badge: 'PRO' },
      { id: 'ecommerce-dashboard', label: 'Store Dashboard', icon: LayoutGrid },
      { id: 'workspace', label: 'Workspace', icon: Boxes },
    ],
  },
  {
    section: 'Store management',
    items: [
      { id: 'email', label: 'Tiwi Mail', icon: Mail },
      { id: 'pos', label: 'POS System', icon: MonitorSmartphone, badge: 'POS' },
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories & Subs', icon: Boxes },
      { id: 'inventory', label: 'Inventory Control', icon: Boxes },
      { id: 'purchases', label: 'Purchases (PO)', icon: ShoppingCart },
      { id: 'sales', label: 'Sales & Orders', icon: Receipt },
      { id: 'store-reviews', label: 'Product Reviews', icon: Star },
      { id: 'courier', label: 'Courier', icon: Truck, badge: 'Ship' },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    section: 'People & payroll',
    items: [
      { id: 'staff-management', label: 'Staff Management', icon: UserCog },
      { id: 'hr-management', label: 'HR & Company Finance', icon: Wallet },
    ],
  },
  {
    section: 'Insights',
    items: [
      { id: 'reports', label: 'Reports Ledger', icon: FileText },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Settings & support',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings2 },
      { id: 'store-settings', label: 'Storefront & Theme', icon: Store },
      { id: 'help-support', label: 'Help & Support', icon: LifeBuoy },
    ],
  },
  {
    section: 'Store settings',
    items: [
      { id: 'store-pages', label: 'Pages & Menus', icon: PanelTop },
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'shipping', label: 'Shipping', icon: Truck },
    ],
  },
  {
    section: 'Marketing',
    items: [{ id: 'promotions', label: 'Promo Codes', icon: BadgePercent }],
  },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  onVisitSite,
  onBackToCloud,
  currentStore,
  mobileOpen = false,
  setMobileOpen
}) {
  const closeMenu = () => setMobileOpen?.(false);
  const storeName = String(currentStore?.storeName || currentStore?.name || 'Tiwlo Store');

  const handleNavClick = (tabId) => {
    closeMenu();
    if (tabId === 'workspace') {
      onBackToCloud?.();
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation"
        />
      )}

      <aside className={`tiwi-v3-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col gap-6 overflow-hidden bg-black p-4 text-white transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            type="button"
            onClick={() => handleNavClick('ecommerce-dashboard')}
            className="flex h-8 items-center"
            aria-label="Tiwlo Store dashboard"
          >
            <img src="/tiwlo-dark-bg-logo.png" alt="Tiwlo" className="h-7 w-auto max-w-[150px] object-contain" />
            <span className="ml-1.5 text-sm font-medium text-white/50">Store</span>
          </button>
          <button
            type="button"
            onClick={closeMenu}
            className="flex size-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleNavClick('ecommerce-dashboard')}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] text-sm font-bold text-black">
            {storeName.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-white">
              {storeName}
            </span>
            <span className="truncate text-xs text-white/50">Online store · Workspace</span>
          </span>
          <span className="text-sm text-white/50" aria-hidden="true">⌄</span>
        </button>

        <nav
          aria-label="Store navigation"
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navigation.map((group) => (
            <section key={group.section}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {group.section}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ id, label, icon: Icon, badge }) => {
                  const active = activeTab === id ||
                    (id === 'subscription' && ['pricing', 'upgrade'].includes(activeTab)) ||
                    (id === 'products' && activeTab === 'add-product') ||
                    (id === 'store-settings' && ['store-identity', 'store-banners'].includes(activeTab));
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => handleNavClick(id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                          active ? 'bg-white text-black' : 'text-white/65 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {badge && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            badge === 'PRO'
                              ? 'bg-[#1ed760] text-black'
                              : active
                                ? 'bg-black text-white'
                                : 'bg-white/10 text-white/70'
                          }`}>
                            {badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="rounded-2xl bg-[#1ed760] p-4 text-black">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4" aria-hidden="true" />
            Upgrade & Plans
          </div>
          <p className="mt-1 text-xs leading-relaxed text-black/70">
            Find the plan that fits your store and explore available features.
          </p>
          <button
            type="button"
            onClick={() => handleNavClick('subscription')}
            className="mt-3 inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-bold text-white transition hover:bg-black/80"
          >
            Upgrade now
          </button>
        </div>

        {onVisitSite && (
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onVisitSite();
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-white/10 text-xs font-semibold text-white/80 transition hover:bg-white/15"
          >
            <Globe className="size-4" aria-hidden="true" />
            Visit Site
          </button>
        )}
      </aside>
    </>
  );
}
