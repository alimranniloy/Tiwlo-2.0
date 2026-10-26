import React, { useState } from 'react';
import { ArrowRight, Menu, X, Disc3 } from 'lucide-react';

export default function StudioNavbar({ onNavigateAuth, onNavigateTab }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');

  const navLinks = [
    { id: 'home', label: 'Home', href: '#home' },
    { id: 'distribution', label: 'Distribution', href: '#distribution' },
    { id: 'music-level', label: 'Music Level', href: '#music-level' },
    { id: 'for-artists', label: 'For Artists', href: '#for-artists' },
    { id: 'pricing', label: 'Pricing', href: '#pricing' },
    { id: 'faq', label: 'FAQ', href: '#faq' }
  ];

  const handleNavClick = (link) => {
    setActiveNav(link.id);
    setMobileMenuOpen(false);

    if (link.id === 'pricing') {
      if (onNavigateTab) {
        onNavigateTab('pricing');
        return;
      }
    }

    const targetEl = document.querySelector(link.href);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    if (onNavigateAuth) {
      onNavigateAuth('signup');
    } else if (onNavigateTab) {
      onNavigateTab('create-account');
    } else {
      window.location.href = '/create-account';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <a
          href="/studio"
          className="flex items-center gap-3 group focus:outline-none"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {/* Stylized Tiwlo Studio glyph matching the design */}
          <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">
              Tiwlo <span className="font-medium text-slate-600">Studio</span>
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = activeNav === link.id;
            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link)}
                className={`relative py-1 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-slate-950 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop CTA Action */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 transition-all cursor-pointer group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200/70 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link)}
                className={`text-left px-3 py-2.5 rounded-xl text-base font-medium transition-colors ${
                  activeNav === link.id
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={handleGetStarted}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-slate-950 text-white text-base font-semibold shadow-md active:scale-98 transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
