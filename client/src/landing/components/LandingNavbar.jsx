import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  ShoppingCart,
  Cloud,
  Monitor,
  Database,
  Globe,
  Sparkles,
  Layers,
  Cpu,
  Headphones,
  Store,
  CreditCard
} from 'lucide-react';

import { getAuthUrl } from '../../utils/navigation';

export default function LandingNavbar({ onNavigate, currentUser }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDropdown = (menu) => {
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md border-[#dadce0] shadow-[0_1px_4px_0_rgba(60,64,67,0.08)]'
            : 'bg-white/95 backdrop-blur-xs border-[#dadce0]/60'
        }`}
      >
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          
          {/* Left: Tiwlo Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                onNavigate('landing');
              }}
              className="flex items-center gap-2 cursor-pointer group"
            >
              {!logoError ? (
                <img
                  src="/tiwlologo.png"
                  alt="Tiwlo"
                  onError={() => setLogoError(true)}
                  className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <span className="text-[20px] font-semibold text-[#1f1f1f] tracking-tight">
                  Tiwlo
                </span>
              )}
              <span className="hidden sm:inline-block text-[13px] font-medium text-[#5f6368] pl-2.5 border-l border-[#dadce0] tracking-normal">
                Cloud
              </span>
            </div>
          </div>

          {/* Center: Desktop Navigation Bar (Google Cloud Style) */}
          <nav className="hidden lg:flex items-center gap-1 text-[14px] font-medium text-[#444746]">
            
            {/* Overview */}
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                onNavigate('landing');
              }}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer text-[#1f1f1f]"
            >
              Overview
            </button>

            {/* Storefront */}
            <button
              onClick={() => onNavigate('store')}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer"
            >
              Storefront
            </button>

            {/* Retail & POS */}
            <button
              onClick={() => onNavigate('pos')}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer"
            >
              Retail & POS
            </button>

            {/* Cloud Compute */}
            <button
              onClick={() => onNavigate(currentUser ? 'dashboard' : 'login')}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer"
            >
              Cloud Compute
            </button>

            {/* Solutions Dropdown */}
            <div className="relative" onMouseLeave={() => setActiveDropdown(null)}>
              <button
                onClick={() => handleDropdown('solutions')}
                onMouseEnter={() => setActiveDropdown('solutions')}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] transition-colors cursor-pointer ${
                  activeDropdown === 'solutions' ? 'bg-[#f1f3f4] text-[#0b57d0]' : 'hover:text-[#1f1f1f]'
                }`}
              >
                <span>Solutions</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeDropdown === 'solutions' ? 'rotate-180 text-[#0b57d0]' : 'text-[#747775]'
                }`} />
              </button>

              {activeDropdown === 'solutions' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-80 p-3 rounded-[20px] bg-white border border-[#dadce0] shadow-[0_8px_28px_rgba(60,64,67,0.15)] animate-in fade-in slide-in-from-top-1 duration-150 space-y-1 z-50">
                  <div
                    onClick={() => {
                      setActiveDropdown(null);
                      onNavigate('create-account');
                    }}
                    className="p-2.5 rounded-[10px] hover:bg-[#f8f9fa] transition-colors cursor-pointer group"
                  >
                    <div className="text-[13px] font-medium text-[#1f1f1f] group-hover:text-[#0b57d0]">
                      Startups & Online Brands
                    </div>
                    <div className="text-[12px] text-[#5f6368]">
                      Launch high-speed storefronts in minutes.
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setActiveDropdown(null);
                      onNavigate('pos');
                    }}
                    className="p-2.5 rounded-[10px] hover:bg-[#f8f9fa] transition-colors cursor-pointer group"
                  >
                    <div className="text-[13px] font-medium text-[#1f1f1f] group-hover:text-[#0b57d0]">
                      Multi-Branch Retail Chains
                    </div>
                    <div className="text-[12px] text-[#5f6368]">
                      Omnichannel POS registers, barcodes & stock sync.
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setActiveDropdown(null);
                      onNavigate('dashboard');
                    }}
                    className="p-2.5 rounded-[10px] hover:bg-[#f8f9fa] transition-colors cursor-pointer group"
                  >
                    <div className="text-[13px] font-medium text-[#1f1f1f] group-hover:text-[#0b57d0]">
                      Enterprise Virtual Compute
                    </div>
                    <div className="text-[12px] text-[#5f6368]">
                      Dedicated droplets, isolated DBs & Anycast DNS.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing */}
            <button
              onClick={() => onNavigate('pricing')}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer"
            >
              Pricing
            </button>

            {/* Support */}
            <button
              onClick={() => onNavigate('help-support')}
              className="px-3.5 py-1.5 rounded-full hover:bg-[#f1f3f4] hover:text-[#1f1f1f] transition-colors cursor-pointer"
            >
              Support
            </button>
          </nav>

          {/* Right Header Actions: Clean Google Cloud Login & Free Trial */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* Sign in Button (Always available, cleanly styled) */}
            {!currentUser && (
              <button
                onClick={() => {
                  if (typeof onNavigate === 'function') {
                    onNavigate('login');
                  } else {
                    window.location.href = getAuthUrl('/login');
                  }
                }}
                className="text-[#0b57d0] hover:bg-[#f0f4f9] px-3 sm:px-3.5 py-1.5 rounded-full font-medium text-[13px] sm:text-[14px] transition-colors cursor-pointer"
              >
                Sign in
              </button>
            )}

            {/* Google Primary Blue Pill Button */}
            <button
              onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
              className="hidden sm:inline-flex bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-medium text-[13px] sm:text-[14px] shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer items-center gap-1.5 shrink-0"
            >
              <span>{currentUser ? 'Console' : 'Start free trial'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-[#f1f3f4] text-[#444746] transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Clean Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#f1f3f4] bg-white px-5 py-5 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-150">
            <div className="space-y-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('landing');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa]"
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('store');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa] flex items-center justify-between"
              >
                <span>Storefront Engine</span>
                <span className="text-xs text-[#0b57d0] font-normal">Commerce</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('pos');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa] flex items-center justify-between"
              >
                <span>Retail POS</span>
                <span className="text-xs text-[#b06000] font-normal">Register</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate(currentUser ? 'dashboard' : 'login');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa] flex items-center justify-between"
              >
                <span>Cloud Compute</span>
                <span className="text-xs text-[#137333] font-normal">Droplets</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('pricing');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa]"
              >
                Pricing & Plans
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('help-support');
                }}
                className="w-full text-left px-3 py-2.5 rounded-[8px] font-medium text-[15px] text-[#1f1f1f] hover:bg-[#f8f9fa]"
              >
                Support & Documentation
              </button>
            </div>

            {/* Mobile Actions: Clean Full-Width Buttons */}
            <div className="pt-3 border-t border-[#f1f3f4] flex flex-col gap-2.5">
              {!currentUser && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (typeof onNavigate === 'function') {
                      onNavigate('login');
                    } else {
                      window.location.href = getAuthUrl('/login');
                    }
                  }}
                  className="w-full py-3 text-center font-medium text-[14px] text-[#0b57d0] rounded-full border border-[#dadce0] hover:bg-[#f8f9fa] transition-colors"
                >
                  Sign in
                </button>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate(currentUser ? 'dashboard' : 'create-account');
                }}
                className="w-full py-3 text-center font-medium text-[14px] bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full transition-colors flex items-center justify-center gap-2"
              >
                <span>{currentUser ? 'Open Console' : 'Start free trial'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
