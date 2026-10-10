import React from 'react';

/**
 * UidsFooter Component
 * Clean Google-inspired minimal footer
 */
export default function UidsFooter({ onScrollTo }) {
  return (
    <footer className="w-full border-t border-slate-200/80 bg-white/70 backdrop-blur-sm py-10 px-4 sm:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
        {/* Left: Brand & Status */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="text-lg font-bold text-slate-900 flex items-center">
            <span>uids</span>
            <span className="text-[#00C261]">.app</span>
          </div>
          <span className="hidden sm:inline text-slate-300">|</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C261]" />
            <span>All Systems Operational</span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <div className="flex items-center gap-6 font-medium text-slate-600">
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
            onClick={() => onScrollTo && onScrollTo('about')}
            className="hover:text-slate-900 transition"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => onScrollTo && onScrollTo('contact')}
            className="hover:text-slate-900 transition"
          >
            Contact
          </button>
        </div>

        {/* Right: Copyright */}
        <div className="text-slate-400">
          &copy; {new Date().getFullYear()} uids.app &bull; Powered by Tiwlo Cloud
        </div>
      </div>
    </footer>
  );
}
