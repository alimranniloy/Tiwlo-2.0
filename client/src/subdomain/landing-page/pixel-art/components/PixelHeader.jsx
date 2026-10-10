import React, { useState } from 'react';
import { PixelAudio } from './PixelSoundFx';
import { Menu, X, Volume2, VolumeX, Sparkles, Globe, Terminal, Shield, ArrowRight } from 'lucide-react';

export default function PixelHeader({ onOpenAuth, onNavigateSection }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  const handleToggleSound = () => {
    const isMuted = PixelAudio.toggleMute();
    setSoundMuted(isMuted);
    if (!isMuted) PixelAudio.playCoin();
  };

  const navLinks = [
    { id: 'features', label: 'FEATURES', icon: Sparkles },
    { id: 'how-it-works', label: 'HOW IT WORKS', icon: Terminal },
    { id: 'showcase', label: 'EXPLORE', icon: Globe },
    { id: 'faq', label: 'FAQ', icon: Shield },
  ];

  const handleLinkClick = (id) => {
    PixelAudio.playBlip();
    setMobileMenuOpen(false);
    if (onNavigateSection) {
      onNavigateSection(id);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FAF7F2]/95 backdrop-blur-md border-b-[3px] border-[#181425] font-pixel-sub select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('hero');
            }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            {/* 8-bit Pixel Logo Icon */}
            <div className="w-10 h-10 bg-[#FFD214] border-[3px] border-[#181425] pixel-shadow-sm flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform">
              {/* Inner pixel square art */}
              <div className="w-5 h-5 bg-[#181425] flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-[#29D8FF] animate-pixel-blink" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-[8px] font-pixel text-[#181425] opacity-50">8b</span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-pixel text-[15px] sm:text-[17px] tracking-tight text-[#181425] font-black">
                  uids<span className="text-[#FF3864]">.</span>app
                </span>
                <span className="hidden sm:inline-block bg-[#2CE8A2] border-[2px] border-[#181425] text-[#181425] text-[9px] font-pixel px-1.5 py-0.5 rounded-none shadow-[1px_1px_0px_#181425]">
                  FREE
                </span>
              </div>
              <span className="text-[10px] text-[#5A5766] font-pixel-mono tracking-wider -mt-1 hidden xs:block">
                PIXEL SUBDOMAIN ENGINE
              </span>
            </div>
          </a>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLinkClick(item.id)}
              className="px-3 py-1.5 text-[12px] font-pixel text-[#181425] hover:bg-[#FFEEC2] hover:text-[#181425] border-2 border-transparent hover:border-[#181425] transition-all cursor-pointer rounded-none"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right Actions: Sound Toggle + Login & Sign Up */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundMuted ? 'Turn Sound ON' : 'Turn Sound OFF'}
            className="w-9 h-9 flex items-center justify-center bg-white border-[2.5px] border-[#181425] pixel-shadow-sm hover:bg-[#F3EFF8] transition-colors cursor-pointer text-[#181425]"
            aria-label="Toggle retro sounds"
          >
            {soundMuted ? (
              <VolumeX className="w-4 h-4 text-[#FF3864]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#181425]" />
            )}
          </button>

          {/* Login Button */}
          <button
            onClick={() => {
              PixelAudio.playBlip();
              if (onOpenAuth) onOpenAuth('login');
              else window.location.href = '/login';
            }}
            className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-[11px] font-pixel bg-white hover:bg-[#EFECE6] text-[#181425] pixel-btn cursor-pointer"
          >
            LOGIN
          </button>

          {/* Sign Up Button */}
          <button
            onClick={() => {
              PixelAudio.playCoin();
              if (onOpenAuth) onOpenAuth('signup');
              else window.location.href = '/create-account';
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-[11px] font-pixel bg-[#FFD214] hover:bg-[#FFC000] text-[#181425] pixel-btn cursor-pointer"
          >
            <span>SIGN UP</span>
            <span className="ml-1 text-[9px]">★</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => {
              PixelAudio.playBlip();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="md:hidden w-9 h-9 flex items-center justify-center bg-white border-[2.5px] border-[#181425] pixel-shadow-sm text-[#181425] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t-[3px] border-[#181425] bg-[#FAF7F2] p-4 space-y-3 font-pixel">
          <div className="grid grid-cols-1 gap-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.id)}
                  className="w-full text-left px-4 py-3 bg-white border-[2.5px] border-[#181425] pixel-shadow-sm text-[11px] text-[#181425] flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#FF3864]" />
                    <span>{item.label}</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#5A5766]" />
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t-2 border-dashed border-[#181425]/30 flex flex-col gap-2">
            <button
              onClick={() => {
                PixelAudio.playBlip();
                setMobileMenuOpen(false);
                if (onOpenAuth) onOpenAuth('login');
                else window.location.href = '/login';
              }}
              className="w-full py-2.5 text-[11px] font-pixel bg-white text-[#181425] border-[2.5px] border-[#181425] pixel-shadow-sm text-center"
            >
              LOGIN TO ACCOUNT
            </button>
            <button
              onClick={() => {
                PixelAudio.playCoin();
                setMobileMenuOpen(false);
                if (onOpenAuth) onOpenAuth('signup');
                else window.location.href = '/create-account';
              }}
              className="w-full py-2.5 text-[11px] font-pixel bg-[#FFD214] text-[#181425] border-[2.5px] border-[#181425] pixel-shadow-sm text-center"
            >
              CREATE FREE ACCOUNT ★
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
