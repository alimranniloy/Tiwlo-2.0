import React from 'react';
import { Package, HelpCircle, ArrowLeft } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function TopUtilityBar({ onOpenAdmin, onTrackOrder }) {
  const { storeSettings } = useStoreSettings();

  return (
    <header className="bg-[#0b1329] text-[#94a3b8] text-[11px] font-medium border-b border-slate-800/80 px-4 lg:px-8 py-2">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        {/* Left tagline */}
        <div className="flex items-center space-x-3">
          <span className="text-slate-300 font-normal tracking-wide">Storefront</span>
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition text-[10px] font-semibold"
              title="Return to Tiwlo Management Dashboard"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Tiwlo Admin</span>
            </button>
          )}
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
