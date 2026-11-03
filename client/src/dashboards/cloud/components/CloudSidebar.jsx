import React from 'react';
import {
  Archive,
  Bot,
  Boxes,
  Camera,
  ChevronsUpDown,
  Container,
  CreditCard,
  Fingerprint,
  Globe,
  HardDrive,
  HelpCircle,
  Image,
  LayoutGrid,
  Mail,
  MessageCircle,
  PanelsTopLeft,
  Plus,
  Server,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  X,
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
  const closeMobile = () => setMobileOpen?.(false);

  const selectNav = (id) => {
    closeMobile();
    setActiveNav?.(id);
  };

  const selectTab = (tab) => {
    closeMobile();
    onNavigateTab?.(tab);
  };

  const openTPanel = () => {
    closeMobile();
    window.open('/tpanel', '_blank', 'noopener,noreferrer');
  };

  const groups = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { id: 'workspace', label: 'Workspace hub', icon: Boxes },
      ],
    },
    {
      label: 'Products',
      items: [
        { id: 'my-online-store', label: 'Online store', icon: Store, badge: userStores.length || null },
        { id: 'create-store', label: 'Create store', icon: Plus, action: onOpenCreateStore },
        { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
        { id: 'email', label: 'tMail', icon: Mail, navigateTab: true },
        { id: 'oneprofile', label: 'OneProfile', icon: UserRound, navigateTab: true },
        { id: 'whatsapp-automation', label: 'WhatsApp Automation', icon: MessageCircle },
        { id: 'discord', label: 'Discord Console', icon: Bot, navigateTab: true },
      ],
    },
    {
      label: 'Cloud',
      items: [
        { id: 'domains', label: 'Domains', icon: Globe },
        { id: 'create-droplet', label: 'Create Droplet', icon: Plus, action: onOpenCreateDroplet },
        { id: 'my-droplets', label: 'My Droplets', icon: Server },
        { id: 'tpanel-login', label: 'TPanel Control Panel', icon: PanelsTopLeft, badge: 'Pro', action: openTPanel },
        { id: 'images', label: 'Images', icon: Image },
        { id: 'snapshots', label: 'Snapshots', icon: Camera },
        { id: 'backups', label: 'Backups', icon: Archive },
        { id: 'volumes', label: 'Volumes', icon: HardDrive },
        { id: 'kubernetes', label: 'Kubernetes', icon: Container, badge: 'New' },
      ],
    },
    {
      label: 'Account',
      items: [
        { id: 'identity', label: 'Identity', icon: Fingerprint },
        { id: 'help-support', label: 'Help & support', icon: HelpCircle },
        { id: 'billing', label: 'Billing', icon: CreditCard },
        { id: 'settings', label: 'Settings', icon: Settings2, navigateTab: true },
      ],
    },
  ];

  const renderItem = (item) => {
    const Icon = item.icon;
    const active = activeNav === item.id || activeNav.startsWith(`${item.id}/`);

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => {
            if (item.action) {
              closeMobile();
              item.action();
            } else if (item.navigateTab) {
              selectTab(item.id);
            } else {
              selectNav(item.id);
            }
          }}
          aria-current={active ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
            active ? 'bg-white text-black' : 'text-white/65 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              active ? 'bg-black text-white' : item.badge === 'New' ? 'bg-[#1ed760] text-black' : 'bg-white/10 text-white/70'
            }`}>
              {item.badge}
            </span>
          )}
        </button>
      </li>
    );
  };

  const storeName = currentStore?.storeName || userStores[0]?.storeName || 'Tiwlo Workspace';

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation"
        />
      )}

      <aside className={`tiwi-v3-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col gap-6 overflow-hidden bg-black p-4 font-sans text-white transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            type="button"
            onClick={() => selectNav('dashboard')}
            className="flex h-8 items-center"
            aria-label="Tiwlo Cloud dashboard"
          >
            <img src="/tiwlo-dark-bg-logo.png" alt="Tiwlo Cloud" className="h-7 w-auto max-w-[150px] object-contain" />
          </button>
          <button
            type="button"
            onClick={closeMobile}
            className="flex size-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => selectNav('my-online-store')}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] text-sm font-bold text-black">
            {storeName.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-white">{storeName}</span>
            <span className="truncate text-xs text-white/50">
              Cloud · {currentStore?.planName || currentStore?.planId || 'Workspace'}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-white/50" aria-hidden="true" />
        </button>

        <nav
          aria-label="Main navigation"
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group) => (
            <section key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">{group.items.map(renderItem)}</ul>
            </section>
          ))}
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
              closeMobile();
              onOpenCreateStore?.();
            }}
            className="mt-3 inline-flex h-8 items-center rounded-full bg-black px-4 text-xs font-bold text-white transition hover:bg-black/80"
          >
            Open store
          </button>
        </div>
      </aside>
    </>
  );
}
