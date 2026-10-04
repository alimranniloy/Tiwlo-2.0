import React, { useState } from 'react';
import { Package, HelpCircle, Globe, ChevronDown, User, ShieldCheck, ArrowLeft, ExternalLink } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function TopUtilityBar({ onOpenAdmin, onTrackOrder, onOpenAuth }) {
  const [lang, setLang] = useState('English');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';

  return (
    <header className="bg-[#0b1329] text-[#94a3b8] text-[11px] font-medium border-b border-slate-800/80 px-4 lg:px-8 py-2">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        {/* Left tagline */}
        <div className="flex items-center space-x-3">
          <span className="text-slate-300 font-normal tracking-wide">
            Global Trade, Better Together
          </span>
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

          <button
            onClick={() => alert(`Customer Help Desk: ${storeSettings?.contactEmail || 'support@tiwlomart.com'} | 24/7 Live Assistance`)}
            className="hidden sm:flex items-center space-x-1.5 hover:text-white transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help Center</span>
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center space-x-1.5 hover:text-white transition"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{lang}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-[#111c38] border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-slate-200">
                {['English', 'Bengali', 'Spanish', 'French', 'Arabic'].map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLang(l);
                      setIsLangOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600/30 text-xs transition"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth links */}
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-700/80">
            <button
              onClick={() => onOpenAuth?.('signin')}
              className="hover:text-white transition font-medium"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth?.('register')}
              className="px-3.5 py-1 rounded-full text-white font-semibold transition shadow-xs hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
