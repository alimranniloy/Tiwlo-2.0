import React from 'react';
import { 
  Home, 
  Globe, 
  Box, 
  LayoutGrid, 
  CreditCard, 
  Cloud, 
  BarChart2, 
  Receipt, 
  Settings, 
  HelpCircle, 
  Crown, 
  Check, 
  ArrowRight,
  X
} from 'lucide-react';
import UidisLogoIcon from './UidisLogoIcon';

/**
 * OneProfileSidebar Component
 * Exact match to screenshot:
 * - Brand: UIDis.app with stylized U ribbon icon
 * - Nav Group 1: Home, My Website, Subdomains, Templates, NFC Card, Cloud Hosting, Analytics
 * - Nav Group 2: Billing, Settings, Support
 * - Upgrade to Pro Card with Crown, 4 checkmarks and "Upgrade Now ->" button
 * - Mobile responsive drawer support
 */
export default function OneProfileSidebar({
  activeView = 'home',
  onSelectView,
  mobileOpen = false,
  onCloseMobile
}) {
  const primaryNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'website', label: 'My Website', icon: Globe },
    { id: 'subdomains', label: 'Subdomains', icon: Box },
    { id: 'templates', label: 'Templates', icon: LayoutGrid },
    { id: 'nfc', label: 'NFC Card', icon: CreditCard },
    { id: 'hosting', label: 'Cloud Hosting', icon: Cloud },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  const secondaryNav = [
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  const handleNavClick = (id) => {
    if (onSelectView) {
      onSelectView(id);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4 bg-white border-r border-slate-100 overflow-y-auto select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => handleNavClick('home')}>
            <UidisLogoIcon className="w-8 h-8" />
            <div className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center">
              <span>UIDis</span>
              <span className="text-slate-800 font-semibold">.app</span>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Navigation List */}
        <nav className="space-y-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="my-5 border-t border-slate-100" />

        {/* Secondary Navigation List */}
        <nav className="space-y-1">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Upgrade to Pro Card (Bottom) matching screenshot */}
      <div className="mt-6 pt-2">
        <div className="relative rounded-2xl p-4 bg-gradient-to-br from-amber-50/60 via-purple-50/50 to-blue-50/60 border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Crown Icon */}
          <div className="w-8 h-8 rounded-xl bg-amber-100/90 text-amber-700 flex items-center justify-center mb-2.5 shadow-2xs">
            <Crown className="w-4 h-4 fill-amber-500 text-amber-600" />
          </div>

          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mb-2">
            Upgrade to Pro
          </h4>

          {/* Checklist */}
          <ul className="space-y-1.5 mb-3.5 text-[11px] text-slate-600 font-medium">
            <li className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
              <span>More storage</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
              <span>Node.js support</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
              <span>Custom domain</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
              <span>Premium templates</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => handleNavClick('billing')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-95"
          >
            <span>Upgrade Now</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
