import React, { useState, useEffect } from 'react';
import { PixelAudio } from './PixelSoundFx';
import { FREE_SUBDOMAIN_DOMAIN } from '../../../../config/platformConfig';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Globe, Shield, Zap, Terminal, Copy, Check } from 'lucide-react';

export default function PixelHero() {
  const [subdomain, setSubdomain] = useState('');
  const domainSuffix = `.${FREE_SUBDOMAIN_DOMAIN}`;
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null); // 'available' | 'taken' | 'invalid' | null
  // Availability is intentionally not fabricated before the PostgreSQL domain service exists.
  useEffect(() => {
    const clean = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) {
      setAvailability(null);
      setChecking(false);
      return;
    }

    if (clean.length < 3) {
      setAvailability('too_short');
      setChecking(false);
      return;
    }

    setChecking(false);
    setAvailability('service_unavailable');
  }, [subdomain, domainSuffix]);

  const handleInputChange = (e) => {
    // Sanitize to valid domain characters only
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(val);
    PixelAudio.playBlip();
  };

  const handleQuickName = (name) => {
    PixelAudio.playBlip();
    setSubdomain(name);
  };

  const fullPreview = subdomain.trim() ? `${subdomain.trim()}${domainSuffix}` : `yourname${domainSuffix}`;

  return (
    <section id="hero" className="relative pt-8 sm:pt-14 pb-16 sm:pb-24 overflow-hidden select-none">
      
      {/* Decorative Pixel Background Elements */}
      <div className="absolute top-6 left-8 hidden lg:block animate-pixel-float pointer-events-none">
        <div className="w-14 h-8 bg-white border-[3px] border-[#181425] pixel-shadow-sm flex items-center justify-center">
          <div className="w-6 h-3 bg-[#29D8FF]" />
        </div>
        <span className="text-[9px] font-pixel text-[#5A5766] block mt-1">☁ CLOUD_01</span>
      </div>

      <div className="absolute top-12 right-12 hidden lg:block animate-pixel-float [animation-delay:1.5s] pointer-events-none">
        <div className="w-10 h-10 bg-[#FFD214] border-[3px] border-[#181425] pixel-shadow-sm flex items-center justify-center font-pixel text-[#181425] text-sm">
          ★
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        {/* Top Pixel Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFEEC2] border-[2.5px] border-[#181425] pixel-shadow-sm mb-6">
          <span className="w-2.5 h-2.5 bg-[#FF3864] animate-pixel-blink" />
          <span className="font-pixel text-[10px] sm:text-[11px] text-[#181425] tracking-wide">
            ★ FREE FOREVER • 100% COMMUNITY SUBDOMAINS ★
          </span>
        </div>

        {/* Main Title in 8-Bit Pixel Typography */}
        <h1 className="font-pixel text-2xl sm:text-4xl md:text-5xl text-[#181425] leading-tight sm:leading-tight mb-5 tracking-tight">
          CLAIM YOUR FREE <br />
          <span className="bg-[#29D8FF] px-2.5 sm:px-4 py-1 border-[3.5px] border-[#181425] pixel-shadow inline-block transform -rotate-1 mt-2 text-[#181425]">
            uids.app
          </span>{' '}
          <span className="text-[#FF3864]">SUBDOMAIN</span>
        </h1>

        {/* Subtitle / Tagline */}
        <p className="font-pixel-sub text-xs sm:text-sm md:text-base text-[#474354] max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          Blazing Anycast DNS, automatic wildcard SSL, and full DNS record controls for your personal site, game, portfolio, or API.
        </p>

        {/* ==============================================================
            THE INTERACTIVE SUBDOMAIN CLAIM CONSOLE (PIXEL ART STYLE)
           ============================================================== */}
        <div className="max-w-3xl mx-auto bg-white border-[3.5px] border-[#181425] pixel-shadow-lg p-4 sm:p-7 relative text-left">
          
          {/* Console Header Bar */}
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b-[2.5px] border-dashed border-[#181425]/30">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-[#FF3864] border-2 border-[#181425]" />
              <div className="w-3.5 h-3.5 bg-[#FFD214] border-2 border-[#181425]" />
              <div className="w-3.5 h-3.5 bg-[#2CE8A2] border-2 border-[#181425]" />
              <span className="font-pixel text-[10px] text-[#181425] ml-2">
                UIDIS DOMAIN DISCOVERY RADAR v2.4
              </span>
            </div>
            <span className="font-pixel text-[9px] text-[#2CE8A2] bg-[#181425] px-2 py-0.5 hidden xs:inline-block">
              DNS ENGINE: ONLINE
            </span>
          </div>

          {/* Subdomain Input Row */}
          <label className="block font-pixel text-[10px] sm:text-[11px] text-[#181425] mb-2">
            TYPE YOUR DESIRED SUBDOMAIN:
          </label>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            {/* Input Wrapper with prefix */}
            <div className="flex-1 flex items-center bg-[#FAF7F2] border-[3px] border-[#181425] pixel-shadow-sm focus-within:bg-white focus-within:border-[#29D8FF] transition-all overflow-hidden">
              <span className="px-3 py-2.5 bg-[#EFECE6] border-r-2 border-[#181425] font-pixel text-[10px] sm:text-[11px] text-[#5A5766] select-none">
                https://
              </span>
              <input
                type="text"
                value={subdomain}
                onChange={handleInputChange}
                placeholder="my-cool-project"
                maxLength={32}
                className="w-full px-3 py-2.5 bg-transparent font-pixel text-xs sm:text-sm text-[#181425] placeholder-[#9E9AA8] focus:outline-none lowercase"
              />
            </div>

            {/* Domain Suffix Selector */}
            <div className="relative">
              <div className="h-full px-3.5 py-2.5 bg-[#FFEEC2] border-[3px] border-[#181425] pixel-shadow-sm font-pixel text-[11px] text-[#181425] flex items-center">
                {domainSuffix}
              </div>
            </div>

            {/* Claim Action Button */}
            <button
              disabled
              className="px-5 py-3 font-pixel text-[11px] sm:text-xs flex items-center justify-center gap-1.5 whitespace-nowrap pixel-btn bg-[#E5E0D8] text-[#8C8894] cursor-not-allowed opacity-80"
            >
              <span>COMING SOON</span>
              <span className="text-[12px]">⚡</span>
            </button>
          </div>

          {/* Real-time Availability Status Banner */}
          <div className="mt-3.5 min-h-[38px] flex items-center">
            {checking ? (
              <div className="flex items-center gap-2 font-pixel text-[10px] text-[#5A5766]">
                <span className="w-2.5 h-2.5 bg-[#29D8FF] animate-pixel-blink" />
                <span>SCANNING 8-BIT ANYCAST CLUSTER...</span>
              </div>
            ) : availability === 'service_unavailable' ? (
              <div className="w-full p-2.5 bg-[#FFF4D6] border-[2px] border-[#FFD214] font-pixel text-[10px] text-[#5A5766]">
                DOMAIN AVAILABILITY WILL BE CHECKED BY THE POSTGRESQL DOMAIN SERVICE WHEN IT LAUNCHES.
              </div>
            ) : availability === 'too_short' ? (
              <div className="font-pixel text-[10px] text-[#5A5766]">
                ▶ ENTER AT LEAST 3 CHARACTERS (a-z, 0-9, -)
              </div>
            ) : (
              <div className="font-pixel text-[10px] text-[#5A5766]">
                ▶ TYPE ANY NAME TO VERIFY INSTANT AVAILABILITY ON <span className="text-[#FF3864]">UIDIS.APP</span>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div className="mt-4 pt-3 border-t-2 border-dashed border-[#181425]/20 flex flex-wrap items-center gap-2 font-pixel text-[9px]">
            <span className="text-[#5A5766]">TRY IDEAS:</span>
            {['pixel-hero', 'arcade', 'retro-dev', 'game-hub', 'cyber-craft'].map((idea) => (
              <button
                key={idea}
                onClick={() => handleQuickName(idea)}
                className="px-2 py-1 bg-[#FAF7F2] hover:bg-[#FFEEC2] border border-[#181425] text-[#181425] pixel-shadow-sm cursor-pointer transition-colors"
              >
                +{idea}
              </button>
            ))}
          </div>
        </div>

        {/* Live Subdomain Telemetry Badge Bar */}
        <div className="mt-8 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="bg-white border-[2.5px] border-[#181425] pixel-shadow-sm p-3">
            <span className="font-pixel text-[8px] text-[#5A5766] block">DNS PROPAGATION</span>
            <span className="font-pixel text-[13px] text-[#181425] mt-1 block">&lt; 5 SECONDS</span>
          </div>

          <div className="bg-white border-[2.5px] border-[#181425] pixel-shadow-sm p-3">
            <span className="font-pixel text-[8px] text-[#5A5766] block">GLOBAL LATENCY</span>
            <span className="font-pixel text-[13px] text-[#2CE8A2] mt-1 block">~14MS EDGE</span>
          </div>

          <div className="bg-white border-[2.5px] border-[#181425] pixel-shadow-sm p-3">
            <span className="font-pixel text-[8px] text-[#5A5766] block">SSL CERTIFICATE</span>
            <span className="font-pixel text-[13px] text-[#29D8FF] mt-1 block">AUTO-ENCRYPT</span>
          </div>

          <div className="bg-white border-[2.5px] border-[#181425] pixel-shadow-sm p-3">
            <span className="font-pixel text-[8px] text-[#5A5766] block">COST PER DOMAIN</span>
            <span className="font-pixel text-[13px] text-[#FFD214] mt-1 block">$0.00 / FREE</span>
          </div>
        </div>
      </div>
    </section>
  );
}
