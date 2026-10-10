import React, { useState } from 'react';
import './pixelArt.css';
import PixelHeader from './components/PixelHeader';
import PixelHero from './components/PixelHero';
import PixelClaimWizard from './components/PixelClaimWizard';
import PixelShowcase from './components/PixelShowcase';
import PixelFeatures from './components/PixelFeatures';
import PixelHowItWorks from './components/PixelHowItWorks';
import PixelFaq from './components/PixelFaq';
import PixelFooter from './components/PixelFooter';
import { PixelAudio } from './components/PixelSoundFx';

export default function PixelArtLandingPage({ onNavigateAuth, onNavigateTab }) {
  const [activeClaimData, setActiveClaimData] = useState(null);

  const handleStartClaim = (claimPayload) => {
    setActiveClaimData(claimPayload);
    // Smooth scroll to wizard
    setTimeout(() => {
      const el = document.getElementById('claim-wizard');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCancelClaim = () => {
    setActiveClaimData(null);
    const el = document.getElementById('hero');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

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
          onStartClaim={handleStartClaim}
        />

        {/* 3. In-page Dedicated Claim Wizard (Rendered when claiming, NO POPUPS!) */}
        {activeClaimData && (
          <div className="px-4 sm:px-6 lg:px-8 py-4 bg-[#FFEEC2]/60 border-y-[3px] border-[#181425]">
            <PixelClaimWizard
              claimData={activeClaimData}
              onCancel={handleCancelClaim}
              onComplete={() => {
                // Completed
              }}
            />
          </div>
        )}

        {/* 4. Live Subdomain Ticker & Showcase */}
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
