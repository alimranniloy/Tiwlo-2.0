import React from 'react';
import { Menu, ChevronDown, Flame, Sparkles } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function NavigationBar({ onSelectCategory, onFilterSpecial, activeFilter }) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';

  const navLinks = [
    { id: 'hot-deals', label: 'Hot Deals', icon: '🔥', hasBadge: true, badgeText: 'New' },
    { id: 'best-sellers', label: 'Best Sellers' },
    { id: 'global-brands', label: 'Global Brands' },
    { id: 'dropshipping', label: 'Dropshipping' },
    { id: 'wholesale', label: 'Wholesale' },
    { id: 'digital-products', label: 'Digital Products' },
    { id: 'services', label: 'Services' },
    { id: 'more', label: 'More', hasArrow: true }
  ];

  return (
    <nav className="bg-white border-b border-slate-200/80 px-4 lg:px-8 py-2.5">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        {/* Left 'All Categories' Button matching screenshot */}
        <div className="w-[260px] shrink-0 hidden lg:flex items-center justify-between pr-4">
          <div className="flex items-center space-x-2.5 font-bold text-slate-900 text-[13.5px]">
            <Menu className="w-4 h-4 text-slate-700" />
            <span>All Categories</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {/* Middle Nav Links */}
        <div className="flex-1 flex items-center space-x-1 sm:space-x-6 overflow-x-auto no-scrollbar py-0.5 text-xs font-semibold text-slate-700">
          {navLinks.map((link) => {
            const isActive = activeFilter === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onFilterSpecial?.(link.id)}
                className="flex items-center space-x-1.5 shrink-0 px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                style={isActive ? { color: primaryColor, backgroundColor: `${primaryColor}18`, fontWeight: '700' } : {}}
              >
              {link.icon && <span>{link.icon}</span>}
              <span>{link.label}</span>
              {link.hasBadge && (
                <span className="bg-[#ef4444] text-white text-[9.5px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  {link.badgeText}
                </span>
              )}
              {link.hasArrow && (
                <ChevronDown className="w-3 h-3 text-slate-400 -ml-0.5" />
              )}
            </button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
