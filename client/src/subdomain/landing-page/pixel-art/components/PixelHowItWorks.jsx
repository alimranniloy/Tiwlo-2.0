import React from 'react';
import { PixelAudio } from './PixelSoundFx';
import { ArrowRight, Sparkles, Terminal, CheckCircle2, Rocket } from 'lucide-react';

export default function PixelHowItWorks({ onScrollToHero }) {
  const quests = [
    {
      step: '01',
      title: 'QUEST 1: CHOOSE YOUR HANDLE',
      desc: 'Choose a future uids.app prefix after the PostgreSQL-backed Domain Service opens registration.',
      color: '#FFD214',
      badge: 'NAME DISCOVERY'
    },
    {
      step: '02',
      title: 'QUEST 2: POINT YOUR DESTINATION',
      desc: 'Connect your GitHub Pages username.github.io, Vercel deployment CNAME, or VPS public IPv4 address in one click.',
      color: '#29D8FF',
      badge: 'DNS MAPPING'
    },
    {
      step: '03',
      title: 'QUEST 3: BROADCAST WORLDWIDE',
      desc: 'Our distributed Anycast nameservers broadcast your routes globally within 5 seconds with automatic Let’s Encrypt wildcard SSL.',
      color: '#2CE8A2',
      badge: 'LEVEL UP LIVE'
    }
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 border-b-[3px] border-[#181425] bg-[#FAF7F2] select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-xl mx-auto mb-14">
          <div className="inline-block bg-[#FF3864] text-white border-2 border-[#181425] px-3 py-1 text-[9px] font-pixel mb-3 pixel-shadow-sm">
            ★ 3-STEP GAMEPLAN
          </div>
          <h2 className="font-pixel text-xl sm:text-3xl text-[#181425] tracking-tight mb-2">
            HOW IT <span className="text-[#FFD214] bg-[#181425] px-2 py-0.5">WORKS</span>
          </h2>
          <p className="font-pixel-sub text-xs sm:text-sm text-[#5A5766]">
            No complex registrar portals or confusing TXT records. Pure simplicity.
          </p>
        </div>

        {/* Quests Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {quests.map((q, idx) => (
            <div
              key={idx}
              className="bg-white border-[3px] border-[#181425] pixel-shadow p-6 flex flex-col justify-between relative group hover:translate-y-[-2px] transition-transform"
            >
              {/* Step Number Top Badge */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className="font-pixel text-xs px-2.5 py-1 border-2 border-[#181425] pixel-shadow-sm text-[#181425]"
                  style={{ backgroundColor: q.color }}
                >
                  STAGE {q.step}
                </span>
                <span className="font-pixel text-[8px] text-[#5A5766]">
                  {q.badge}
                </span>
              </div>

              <div>
                <h3 className="font-pixel text-xs sm:text-sm text-[#181425] mb-2.5 leading-snug">
                  {q.title}
                </h3>
                <p className="font-pixel-sub text-[11px] text-[#5A5766] leading-relaxed">
                  {q.desc}
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="mt-6 pt-3 border-t-2 border-dashed border-[#181425]/20 flex items-center justify-between font-pixel text-[8px]">
                <span className="text-[#5A5766]">PROGRESS</span>
                <span className="text-[#2CE8A2]">READY TO START</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quest CTA Button */}
        <div className="mt-12 text-center">
          <button
            onClick={() => {
              PixelAudio.playCoin();
              if (onScrollToHero) onScrollToHero();
              else {
                const el = document.getElementById('hero');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-7 py-3.5 bg-[#FFD214] hover:bg-[#FFC000] text-[#181425] pixel-btn font-pixel text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <span>START QUEST 1: CLAIM YOUR SUBDOMAIN</span>
            <span className="text-sm">★</span>
          </button>
        </div>
      </div>
    </section>
  );
}
