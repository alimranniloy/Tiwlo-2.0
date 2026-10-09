import React, { useState } from 'react';
import {
  LayoutDashboard,
  LayoutGrid,
  ShoppingBag,
  Server,
  Network,
  Shield,
  HelpCircle,
  Activity,
  Code2,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Store,
  ExternalLink,
  MessageSquare,
  X
} from 'lucide-react';

export default function CloudSidebar({
  activeNav = 'dashboard',
  setActiveNav,
  userStores = [],
  currentStore,
  onSelectStore,
  onOpenStoreDashboard,
  onOpenCreateStore,
  onOpenCreateDroplet,
  mobileOpen = false,
  setMobileOpen
}) {
  const [dropletsOpen, setDropletsOpen] = useState(true);
  const [storesDropdownOpen, setStoresDropdownOpen] = useState(false);
  const [activeSubItem, setActiveSubItem] = useState('My Droplets');

  const handleNavSelect = (navId) => {
    setActiveNav?.(navId);
    setMobileOpen?.(false);
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
        w-[260px] sm:w-[270px] lg:w-[250px] h-screen overflow-y-auto bg-white border-r border-[#E0E2EC] flex flex-col justify-between p-4 select-none transition-all duration-300 ease-in-out shrink-0 font-sans
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

        {/* Navigation Items (Modern Google Material 3 Pill Styling) */}
        <nav className="space-y-1 text-[13px] font-medium">
          {/* 1. Dedicated Category: "Workspace" (At the top of the menu) */}
          <button
            onClick={() => handleNavSelect('workspace')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full transition cursor-pointer group ${
              activeNav === 'workspace' || activeNav.startsWith('workspace')
                ? 'bg-[#C2E7FF] text-[#001D35] font-semibold'
                : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
              activeNav === 'workspace' || activeNav.startsWith('workspace')
                ? 'text-[#001D35]'
                : 'text-[#444746] group-hover:text-[#0B57D0]'
            }`}>
              <LayoutGrid className="w-4 h-4" />
            </div>
            <span className="truncate">Workspace</span>
          </button>

          {/* 2. Dashboard item */}
          <button
            onClick={() => handleNavSelect('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full transition cursor-pointer group ${
              activeNav === 'dashboard'
                ? 'bg-[#C2E7FF] text-[#001D35] font-semibold'
                : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              activeNav === 'dashboard' ? 'text-[#001D35]' : 'text-[#444746] group-hover:text-[#0B57D0]'
            }`}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span>Dashboard</span>
          </button>

          {/* 3. Marketplace item */}
          <button
            onClick={() => handleNavSelect('marketplace')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full transition cursor-pointer group ${
              activeNav === 'marketplace' || activeNav.startsWith('marketplace')
                ? 'bg-[#C2E7FF] text-[#001D35] font-semibold'
                : 'text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
              activeNav === 'marketplace' || activeNav.startsWith('marketplace')
                ? 'text-[#001D35]'
                : 'text-[#444746] group-hover:text-[#0B57D0]'
            }`}>
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="truncate">Marketplace</span>
          </button>

          {/* Dedicated Category: "My Online Store" (Opens separate full page with Apple iOS aesthetic) */}
          <div
            onClick={() => handleNavSelect('my-online-store')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer group ${
              activeNav === 'my-online-store'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                activeNav === 'my-online-store' ? 'bg-blue-600 text-white' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
              }`}>
                <Store className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">My Online Store</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeNav === 'my-online-store'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400'
              }`}>
                {userStores.length || 1}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileOpen?.(false);
                  onOpenCreateStore?.();
                }}
                title="Create New Store"
                className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Dedicated Category: "WhatsApp Automation" */}
          <button
            onClick={() => handleNavSelect('whatsapp-automation')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition cursor-pointer group ${
              activeNav === 'whatsapp-automation' || activeNav.startsWith('whatsapp-automation')
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
              activeNav === 'whatsapp-automation' || activeNav.startsWith('whatsapp-automation')
                ? 'bg-[#25D366] text-white shadow-xs'
                : 'text-slate-400 group-hover:text-[#25D366]'
            }`}>
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span className="truncate">WhatsApp Automation</span>
          </button>

          {/* Droplets item: expandable dropdown */}
          <div>
            <button
              onClick={() => setDropletsOpen(!dropletsOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
                  <Server className="w-4 h-4" />
                </div>
                <span>Droplets</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropletsOpen ? '' : '-rotate-90'}`} />
            </button>

            {dropletsOpen && (
              <div className="pl-9 pr-2 py-1 space-y-1">
                {dropletSubItems.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setActiveSubItem(sub.label);
                      if (sub.action) {
                        sub.action();
                      } else {
                        handleNavSelect(sub.id);
                      }
                      setMobileOpen?.(false);
                    }}
                    className={`w-full text-left py-1.5 px-2 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      activeNav === sub.id || (sub.id === 'dashboard' && activeNav === 'dashboard' && activeSubItem === 'My Droplets')
                        ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{sub.label}</span>
                    {sub.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                        {sub.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Networking */}
          <button
            onClick={() => handleNavSelect('networking')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
                <Network className="w-4 h-4" />
              </div>
              <span>Networking</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Security */}
          <button
            onClick={() => handleNavSelect('security')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
                <Shield className="w-4 h-4" />
              </div>
              <span>Security</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Help & Support (Category right below Security) */}
          <button
            onClick={() => {
              handleNavSelect('help-support');
              window.dispatchEvent(new CustomEvent('tiwlo:open-support'));
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer ${
              activeNav === 'help-support'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                activeNav === 'help-support' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
              }`}>
                <HelpCircle className="w-4 h-4" />
              </div>
              <span>Help & Support</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Monitoring */}
          <button
            onClick={() => handleNavSelect('monitoring')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
                <Activity className="w-4 h-4" />
              </div>
              <span>Monitoring</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* API & Tools */}
          <button
            onClick={() => handleNavSelect('api-tools')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
              <Code2 className="w-4 h-4" />
            </div>
            <span>API & Tools</span>
          </button>

          {/* Billing */}
          <button
            onClick={() => handleNavSelect('billing')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <span>Billing</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Settings */}
          <button
            onClick={() => handleNavSelect('settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400">
              <Settings className="w-4 h-4" />
            </div>
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Bottom Sidebar Promo Card ("Scale Faster") using Tiwlo Official Icon */}
      <div className="pt-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-white dark:from-blue-950/20 dark:via-gray-800/50 dark:to-gray-800/80 border border-blue-100 dark:border-blue-900/30 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 flex items-center justify-center p-1.5 shadow-2xs mb-2.5">
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
          <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
            Scale Faster
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            Deploy your next project with high-performance servers.
          </p>
          <button
            onClick={onOpenCreateDroplet}
            className="w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs hover:shadow-sm transition cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Upgrade Now</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  </>
);
}
