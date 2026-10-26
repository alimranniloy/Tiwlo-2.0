import React, { useEffect } from 'react';
import StudioNavbar from './components/StudioNavbar';
import StudioHero from './components/StudioHero';
import StudioServices from './components/StudioServices';
import StudioForArtists from './components/StudioForArtists';
import StudioPricingSection from './components/StudioPricingSection';
import StudioFaqSection from './components/StudioFaqSection';
import StudioFooter from './components/StudioFooter';
import { updateSeoMetadata } from '../../utils/seo';

export default function TiwloStudioLanding({ onNavigateAuth, onNavigateTab }) {
  useEffect(() => {
    // Update Document Title and Social Meta Tags
    updateSeoMetadata(window.location.hostname, '/studio');
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFCFF] text-slate-900 selection:bg-blue-600 selection:text-white relative overflow-x-hidden antialiased font-sans">
      {/* Background Soft Global Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden">
        {/* Top Right Cyan Glow */}
        <div className="absolute -top-32 right-0 w-[600px] h-[600px] bg-gradient-to-br from-sky-100/50 via-blue-50/40 to-transparent blur-3xl rounded-full" />
        {/* Center Lavender Glow */}
        <div className="absolute top-[35%] left-[-150px] w-[650px] h-[650px] bg-gradient-to-tr from-indigo-100/30 via-purple-50/20 to-transparent blur-3xl rounded-full" />
        {/* Bottom Soft Glow */}
        <div className="absolute bottom-10 right-[-100px] w-[500px] h-[500px] bg-gradient-to-t from-blue-100/30 via-slate-100/40 to-transparent blur-3xl rounded-full" />
      </div>

      {/* Navigation Header */}
      <StudioNavbar
        onNavigateAuth={onNavigateAuth}
        onNavigateTab={onNavigateTab}
      />

      {/* Main Content Sections */}
      <main>
        {/* Hero Section */}
        <StudioHero
          onNavigateAuth={onNavigateAuth}
          onNavigateTab={onNavigateTab}
        />

        {/* Two Powerful Services Section */}
        <StudioServices
          onNavigateAuth={onNavigateAuth}
          onNavigateTab={onNavigateTab}
        />

        {/* For Artists Section */}
        <StudioForArtists
          onNavigateAuth={onNavigateAuth}
          onNavigateTab={onNavigateTab}
        />

        {/* Transparent Pricing Section */}
        <StudioPricingSection
          onNavigateAuth={onNavigateAuth}
          onNavigateTab={onNavigateTab}
        />

        {/* FAQ Section */}
        <StudioFaqSection />
      </main>

      {/* Footer Section */}
      <StudioFooter
        onNavigateAuth={onNavigateAuth}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
}
