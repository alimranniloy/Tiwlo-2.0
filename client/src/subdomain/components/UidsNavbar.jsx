import React, { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

/**
 * Clean Google-inspired Navigation Header for uids.app
 * Updated based on user feedback:
 * - Back button REMOVED.
 * - uids.app logo is perfectly CENTERED on both Desktop and Mobile.
 * - Left: Navigation links (Features, Pricing, How It Works, FAQ).
 * - Right: Login and Sign Up buttons (replaces Browse Subdomains).
 * - Mobile responsive drawer.
 */
export default function UidsNavbar({
  onNavigateAuth,
  onScrollTo,
  activeSection = 'home'
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'pricing', label: 'Pricing' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'features', label: 'Features' },
    { id: 'faq', label: 'FAQ' }
  ];

  const handleLinkClick = (id) => {
    setMobileMenuOpen(false);
    if (onScrollTo) {
      onScrollTo(id);
    }
  };

  return (
    <header className="relative w-full z-40 px-4 sm:px-8 lg:px-12 pt-5 pb-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between relative">
        {/* Left: Desktop Nav Links / Mobile Menu Button */}
        <div className="flex items-center">
          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-white/95 border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Desktop Left Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link.id)}
                  className={`relative py-1 transition-colors hover:text-slate-900 ${
                    isActive ? 'text-slate-950 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00C261]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Brand Logo (Centered on Desktop & Mobile) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center cursor-pointer select-none"
          onClick={() => handleLinkClick('home')}
        >
          <div className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 flex items-center">
            <span>uids</span>
            <span className="text-[#00C261]">.app</span>
          </div>
        </div>

        {/* Right: Login & Sign Up Actions (replaces Browse Subdomains) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onNavigateAuth && onNavigateAuth('login')}
            className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 rounded-full hover:bg-slate-100/80 transition-colors"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => onNavigateAuth && onNavigateAuth('signup')}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-black rounded-full shadow-xs hover:shadow transition-all duration-150 active:scale-95"
          >
            <span>Sign Up</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm font-medium transition ${
                    isActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-[#00C261]" />}
                </button>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateAuth && onNavigateAuth('login');
                }}
                className="flex-1 py-2 text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-full"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateAuth && onNavigateAuth('signup');
                }}
                className="flex-1 py-2 text-center text-sm font-semibold text-white bg-slate-900 rounded-full"
              >
                Sign Up
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
