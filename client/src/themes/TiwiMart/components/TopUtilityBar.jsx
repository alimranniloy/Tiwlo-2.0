import React from 'react';
import { Package, HelpCircle } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function TopUtilityBar({ onTrackOrder }) {
  const { storeSettings } = useStoreSettings();

  return (
    <header className="bg-[#0b1329] text-[#94a3b8] text-[11px] font-medium border-b border-slate-800/80 px-4 lg:px-8 py-2">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        {/* Left tagline */}
        <div className="flex items-center space-x-3">
          <span className="text-slate-300 font-normal tracking-wide">Storefront</span>
        </div>

        {/* Right utility links */}
        <div className="flex items-center space-x-5">
          <button
            onClick={onTrackOrder}
            className="hidden md:flex items-center space-x-1.5 hover:text-white transition"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Track Order</span>
          </button>

          {storeSettings?.contactEmail && (
            <a href={`mailto:${storeSettings.contactEmail}`} className="hidden sm:flex items-center space-x-1.5 hover:text-white transition">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Contact</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
