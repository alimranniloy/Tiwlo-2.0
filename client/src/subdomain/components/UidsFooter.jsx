import React from 'react';

/**
 * UidsFooter Component
 * Minimized, clean Google-inspired footer
 */
export default function UidsFooter({ onScrollTo }) {
  return (
    <footer className="w-full border-t border-slate-200/90 bg-white py-6 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-2.5">
          <div className="text-lg font-extrabold text-slate-900 flex items-center">
            <span>uids</span>
            <span className="text-[#00C261]">.app</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-semibold text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C261]" />
            <span>Anycast Cluster Active</span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex items-center gap-5 font-medium text-slate-600 text-xs">
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('home')}
            className="hover:text-slate-900 transition"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('pricing')}
            className="hover:text-slate-900 transition"
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('how-it-works')}
            className="hover:text-slate-900 transition"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('features')}
            className="hover:text-slate-900 transition"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('faq')}
            className="hover:text-slate-900 transition"
          >
            FAQ
          </button>
        </div>

        {/* Right: Copyright */}
        <div className="text-slate-400 text-[11px]">
          &copy; {new Date().getFullYear()} uids.app &bull; Powered by Tiwlo Cloud
        </div>
      </div>
    </footer>
  );
}
