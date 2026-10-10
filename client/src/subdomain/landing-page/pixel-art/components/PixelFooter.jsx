import React from 'react';
import { PixelAudio } from './PixelSoundFx';
import { ArrowUp, Heart, Terminal, Globe, Shield, Sparkles } from 'lucide-react';

export default function PixelFooter() {
  const scrollToTop = () => {
    PixelAudio.playCoin();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#181425] text-white border-t-[4px] border-[#181425] pt-14 pb-10 font-pixel select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Footer Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b-2 border-dashed border-[#5A5766]/40">
          
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#FFD214] border-2 border-white flex items-center justify-center font-pixel text-xs text-[#181425]">
                ★
              </div>
              <span className="font-pixel text-lg text-white">
                uidis<span className="text-[#FF3864]">.</span>app
              </span>
            </div>
            <p className="font-pixel-sub text-xs text-[#9E9AA8] max-w-sm leading-relaxed">
              The community-first free pixel subdomain provider. Empowering indie hackers, gamers, and students with zero-cost Anycast edge DNS.
            </p>
            <div className="pt-2 flex items-center gap-2 font-pixel text-[9px] text-[#2CE8A2]">
              <span className="w-2 h-2 rounded-none bg-[#2CE8A2] animate-pixel-blink" />
              <span>EDGE DNS STATUS: 100% ONLINE</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[11px] text-[#FFD214] mb-3">
              NAVIGATION
            </h4>
            <ul className="space-y-2 font-pixel-sub text-xs text-[#9E9AA8]">
              <li>
                <a href="#hero" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Claim Subdomain
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Specifications
                </a>
              </li>
              <li>
                <a href="#showcase" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Community Sites
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Knowledge Vault
                </a>
              </li>
            </ul>
          </div>

          {/* Ecosystem Links */}
          <div>
            <h4 className="text-[11px] text-[#29D8FF] mb-3">
              ECOSYSTEM
            </h4>
            <ul className="space-y-2 font-pixel-sub text-xs text-[#9E9AA8]">
              <li>
                <a href="/" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Tiwlo Cloud
                </a>
              </li>
              <li>
                <a href="/discord" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Discord Manager
                </a>
              </li>
              <li>
                <a href="/workspace" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Cloud Workspace
                </a>
              </li>
              <li>
                <a href="/marketplace" className="hover:text-white transition-colors cursor-pointer">
                  ▶ Marketplace
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer Row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] text-[#9E9AA8]">
          <div className="flex items-center gap-1.5 font-pixel-sub">
            <span>© 2026 UIDIS.APP • POWERED BY TIWLO ENGINE • CRAFTED WITH</span>
            <span className="text-[#FF3864]">♥</span>
            <span>PIXELS</span>
          </div>

          <button
            onClick={scrollToTop}
            className="px-3 py-1.5 bg-[#FAF7F2] text-[#181425] border-2 border-white hover:bg-[#FFD214] transition-colors cursor-pointer flex items-center gap-1 font-pixel text-[9px]"
          >
            <span>TOP OF PAGE</span>
            <ArrowUp className="w-3 h-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}
