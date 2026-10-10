import React from 'react';
import './pixelArt.css';
import PixelHeader from './components/PixelHeader';
import PixelHero from './components/PixelHero';
import PixelShowcase from './components/PixelShowcase';
import PixelFeatures from './components/PixelFeatures';
import PixelHowItWorks from './components/PixelHowItWorks';
import PixelFaq from './components/PixelFaq';
import PixelFooter from './components/PixelFooter';
import { PixelAudio } from './components/PixelSoundFx';

export default function PixelArtLandingPage({ onNavigateAuth, onNavigateTab }) {
  const handleOpenAuth = (mode) => {
    if (onNavigateAuth) {
      onNavigateAuth(mode);
    } else {
      window.location.href = mode === 'signup' ? '/create-account' : '/login';
    }
  };

  const handleScrollToHero = () => {
    const el = document.getElementById('hero');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pixel-grid-canvas text-[#181425] font-sans antialiased flex flex-col selection:bg-[#FFD214] selection:text-[#181425]">
      
      {/* 1. Retro Pixel Art Navigation Header */}
      <PixelHeader
        onOpenAuth={handleOpenAuth}
        onNavigateSection={(id) => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        
        {/* 2. Hero with Subdomain Suffix Picker & Availability Radar */}
        <PixelHero
          onStartClaim={undefined}
        />

        {/* 3. Verified Subdomain Showcase */}
        <PixelShowcase
          onSelectDomain={(sub) => {
            handleScrollToHero();
          }}
        />

        {/* 5. Pixel Features & Specifications */}
        <PixelFeatures />

        {/* 6. 3-Step Quest: How It Works */}
        <PixelHowItWorks
          onScrollToHero={handleScrollToHero}
        />

        {/* 7. Knowledge Vault / FAQ Accordion */}
        <PixelFaq />
      </main>

      {/* 8. Retro Dark 8-bit Footer */}
      <PixelFooter />
    </div>
  );
}
