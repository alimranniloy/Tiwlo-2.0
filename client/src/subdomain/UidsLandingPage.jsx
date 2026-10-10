import React, { useState, useRef } from 'react';
import UidsNavbar from './components/UidsNavbar';
import UidsHero from './components/UidsHero';
import UidsSearchBox from './components/UidsSearchBox';
import UidsPopularChips from './components/UidsPopularChips';
import UidsClaimConsole from './components/UidsClaimConsole';
import UidsFeaturesRow from './components/UidsFeaturesRow';
import UidsPricingCards from './components/UidsPricingCards';
import UidsFooter from './components/UidsFooter';

/**
 * uids.app Main Landing Page Component
 * Recreates the exact design from the user's provided screenshot:
 * - Back button & uids.app brand navbar
 * - Hero with "A small name for big ideas.|" + handwritten annotations
 * - Search input with suffix dropdown (.uids.app) and black arrow button
 * - POPULAR EXAMPLES chips with colored dots
 * - 4 Feature cards (Free Hosting, Node.js Support, More Storage, Your Brand)
 * - 2 Pricing cards (Free Plan: 20MB Hosting, Paid Plan: More Power)
 * - Google-inspired clean aesthetics, soft elevation, and background.png
 * - Fully mobile-responsive layout (mobile-ui-rule.md)
 * - Zero popups/modals (page-nopopup-role.md)
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
  const pricingRef = useRef(null);

  const handleBack = () => {
    if (onNavigateTab) {
      onNavigateTab('dashboard');
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  };

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
    } else if (sectionId === 'pricing') {
      const el = document.getElementById('pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'about' || sectionId === 'contact') {
      const el = document.getElementById('pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className="min-h-screen relative flex flex-col font-sans text-slate-800 bg-[#FBFDFB] selection:bg-emerald-500 selection:text-white"
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Light subtle clean overlay to guarantee Google-inspired contrast and pristine readability */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] pointer-events-none -z-10" />

      {/* Top Navbar */}
      <UidsNavbar
        onBack={handleBack}
        onNavigateTab={onNavigateTab}
        onScrollTo={handleScrollTo}
        activeSection={activeSection}
      />

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-start pb-12 sm:pb-20">
        {/* Hero Section */}
        <UidsHero />

        {/* Subdomain Discovery Search Box */}
        <div ref={searchRef} className="w-full">
          <UidsSearchBox
            subdomain={subdomain}
            setSubdomain={setSubdomain}
            selectedSuffix={selectedSuffix}
            setSelectedSuffix={setSelectedSuffix}
            onSearch={handleSearch}
          />
        </div>

        {/* Popular Example Chips */}
        <UidsPopularChips onSelectExample={handleSelectExample} />

        {/* In-Page Dedicated Claim Console (Reveals smoothly on search, zero popups) */}
        {showClaimConsole && (
          <UidsClaimConsole
            subdomain={subdomain}
            suffix={selectedSuffix}
            onClose={() => setShowClaimConsole(false)}
            onNavigateAuth={onNavigateAuth}
          />
        )}

        {/* 4 Feature Value Cards Row */}
        <UidsFeaturesRow />

        {/* 2 Comparison Pricing Cards (Free Plan & Paid Plan) */}
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
      </main>

      {/* Clean Google-Inspired Footer */}
      <UidsFooter onScrollTo={handleScrollTo} />
    </div>
  );
}
