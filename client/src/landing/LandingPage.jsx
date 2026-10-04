import React, { useEffect } from 'react';
import LandingNavbar from './components/LandingNavbar';
import HeroSection from './components/HeroSection';
import ProductsShowcaseSection from './components/ProductsShowcaseSection';
import WhyTiwloSection from './components/WhyTiwloSection';
import FaqSection from './components/FaqSection';
import CtaSection from './components/CtaSection';
import LandingFooter from './components/LandingFooter';

export default function LandingPage({ onNavigate, currentUser }) {
  // Smooth scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1f1f1f] font-sans selection:bg-[#0b57d0] selection:text-white relative overflow-x-hidden antialiased">
      
      {/* Google Cloud Style Navigation Header */}
      <LandingNavbar
        onNavigate={onNavigate}
        currentUser={currentUser}
      />

      {/* Main Landing Content Sections */}
      <main>
        {/* Google Cloud Flagship Hero */}
        <HeroSection
          onNavigate={onNavigate}
          currentUser={currentUser}
        />

        {/* Google Cloud Signature Products & Solutions Tabbed Showcase */}
        <ProductsShowcaseSection
          onNavigate={onNavigate}
          currentUser={currentUser}
        />

        {/* Global Architecture & Why Tiwlo Enterprise Pillars */}
        <WhyTiwloSection
          onNavigate={onNavigate}
        />

        {/* Clean Material FAQ Section */}
        <FaqSection
          onNavigate={onNavigate}
        />

        {/* Call to Action Banner (Google Cloud Style) */}
        <CtaSection
          onNavigate={onNavigate}
          currentUser={currentUser}
        />
      </main>

      {/* Google Cloud Global Footer */}
      <LandingFooter
        onNavigate={onNavigate}
      />
    </div>
  );
}
