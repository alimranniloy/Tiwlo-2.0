import React, { useState, useRef } from 'react';
import UidsNavbar from './components/UidsNavbar';
import UidsHero from './components/UidsHero';
import UidsSearchBox from './components/UidsSearchBox';
import UidsPopularChips from './components/UidsPopularChips';
import UidsClaimConsole from './components/UidsClaimConsole';
import UidsPricingCards from './components/UidsPricingCards';
import UidsHowItWorks from './components/UidsHowItWorks';
import UidsEdgeSpecs from './components/UidsEdgeSpecs';
import UidsFaq from './components/UidsFaq';
import UidsFooter from './components/UidsFooter';

/**
 * uids.app Main Landing Page Component
 * Minimized, compact and refined per user feedback:
 * 1. Community Ecosystem section REMOVED completely.
 * 2. Mobile navbar has ONLY Login button to avoid overlap with centered uids.app logo.
 * 3. Search box has dynamic animated typing placeholder for system types.
 * 4. Hero headline has animated system typewriter cycling through startup MVPs, dev tools, AI apps, etc.
 * 5. Background image (91KB background.jpg) is applied ONLY to the hero section.
 * 6. All section sizes, paddings and cards are minimized and made compact, clean and Google-inspired.
 * 7. In-page dedicated Claim wizard (Zero Popups/Modals).
 */
export default function UidsLandingPage({
  onNavigateTab,
  onNavigateAuth
}) {
  const [subdomain, setSubdomain] = useState('');
  const [selectedSuffix, setSelectedSuffix] = useState('.uids.app');
  const [showClaimConsole, setShowClaimConsole] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const searchRef = useRef(null);

  const handleSearch = (name) => {
    if (!name || name.trim() === '') {
      setSubdomain('myproject');
    }
    setShowClaimConsole(true);
  };

  const handleSelectExample = (name, suffix) => {
    setSubdomain(name);
    setSelectedSuffix(suffix || '.uids.app');
    setShowClaimConsole(true);
    if (searchRef.current) {
      searchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleScrollTo = (sectionId) => {
    setActiveSection(sectionId);
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-white selection:bg-emerald-500 selection:text-white">
      {/* 
        ========================================================================
        HERO SECTION: background.jpg is APPLIED ONLY HERE
        91KB optimized asset loads instantly with zero lag or frame drops.
        ========================================================================
      */}
      <div
        className="relative w-full overflow-hidden border-b border-slate-100 bg-[#FCFDFC]"
        style={{
          backgroundImage: "url('/background.jpg'), url('/background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Subtle light overlay for perfect readability and crisp contrast */}
        <div className="absolute inset-0 bg-white/70 backdrop-blur-[0.5px] pointer-events-none -z-10" />

        {/* Navigation Bar (Mobile shows ONLY Login; uids.app centered on all screens) */}
        <UidsNavbar
          onNavigateAuth={onNavigateAuth}
          onScrollTo={handleScrollTo}
          activeSection={activeSection}
        />

        {/* Hero Headline & System Typewriter Animation */}
        <div className="max-w-6xl mx-auto pb-8 sm:pb-12">
          <UidsHero />

          {/* Subdomain Discovery Search Box with Animated Placeholder */}
          <div ref={searchRef} className="w-full">
            <UidsSearchBox
              subdomain={subdomain}
              setSubdomain={setSubdomain}
              selectedSuffix={selectedSuffix}
              setSelectedSuffix={setSelectedSuffix}
              onSearch={handleSearch}
            />
          </div>

          {/* Popular Examples (ai.uids.app, dev.uids.app, etc.) */}
          <UidsPopularChips onSelectExample={handleSelectExample} />

          {/* In-Page Dedicated Claim Console (Expands on Search, NO Popups) */}
          {showClaimConsole && (
            <UidsClaimConsole
              subdomain={subdomain}
              suffix={selectedSuffix}
              onClose={() => setShowClaimConsole(false)}
              onNavigateAuth={onNavigateAuth}
            />
          )}
        </div>
      </div>

      {/* 
        ========================================================================
        BODY CONTENT SECTIONS (Compact, Sleek, Clean Google UI)
        ========================================================================
      */}
      <main className="flex-1 w-full bg-white">
        {/* 1. Comparison Pricing Cards (Free Plan 20MB & Paid Plan More Power) */}
        <UidsPricingCards
          onSelectPlan={(plan) => {
            if (plan === 'free') {
              setShowClaimConsole(true);
              if (searchRef.current) {
                searchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            } else {
              if (onNavigateAuth) {
                onNavigateAuth('signup');
              } else if (onNavigateTab) {
                onNavigateTab('pricing');
              }
            }
          }}
        />

        {/* 2. How It Works (Compact 3-Step Setup) */}
        <div className="bg-[#F8FAFC]/80 border-y border-slate-100 py-6 sm:py-8 mt-8 sm:mt-10">
          <UidsHowItWorks
            onGetStarted={() => {
              if (searchRef.current) {
                searchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          />
        </div>

        {/* 3. Global Edge Infrastructure & Features (Compact 6-Card Grid) */}
        <div className="py-6 sm:py-8">
          <UidsEdgeSpecs />
        </div>

        {/* 4. Frequently Asked Questions (Compact Accordion Vault) */}
        <div className="bg-[#F8FAFC]/80 border-t border-slate-100 py-6 sm:py-8">
          <UidsFaq />
        </div>
      </main>

      {/* Clean Google-Inspired Minimal Footer */}
      <UidsFooter onScrollTo={handleScrollTo} />
    </div>
  );
}
