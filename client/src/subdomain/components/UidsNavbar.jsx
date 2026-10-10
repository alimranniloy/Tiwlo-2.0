import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';

/**
 * Clean Google-inspired Navigation Header for uids.app
 * Matches screenshot layout:
 * - Left: Back button (pill shaped)
 * - Center: uids.app logo
 * - Center-right: Home, Pricing, About, Contact links
 * - Right: Browse Subdomains -> action button
 */
export default function UidsNavbar({
  onBack,
  onNavigateTab,
  onScrollTo,
  activeSection = 'home'
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' }
  ];

  const handleLinkClick = (id) => {
    setMobileMenuOpen(false);
    if (onScrollTo) {
      onScrollTo(id);
    }
  };

  return (
    <header className="relative w-full z-40 px-4 sm:px-8 lg:px-12 pt-5 pb-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Back Button */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white/95 hover:bg-white border border-slate-200/90 rounded-full shadow-sm hover:shadow transition-all duration-150 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-semibold text-slate-800">Back</span>
          </button>
        </div>

        {/* Center: Brand Logo */}
        <div className="flex items-center cursor-pointer select-none" onClick={() => handleLinkClick('home')}>
          <div className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 flex items-center">
            <span>uids</span>
            <span className="text-[#00C261]">.app</span>
          </div>
        </div>

        {/* Desktop Navigation Links & Action Button */}
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-7 text-sm font-medium text-slate-600">
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

          {/* Right: Browse Subdomains Action */}
          <button
            type="button"
            onClick={() => handleLinkClick('pricing')}
            className="group inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-full shadow-sm hover:shadow-md transition-all duration-150 active:scale-95"
          >
            <span>Browse Subdomains</span>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full bg-white/90 border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-sm"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (No Popup, cleanly inlined under header) */}
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
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleLinkClick('pricing')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-sm transition"
              >
                <span>Browse Subdomains</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
