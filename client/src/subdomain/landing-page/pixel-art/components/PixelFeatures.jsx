import React from 'react';
import { PixelAudio } from './PixelSoundFx';
import { Zap, Shield, Key, Globe, Terminal, Smartphone, Lock, Cloud, Sparkles } from 'lucide-react';

export default function PixelFeatures() {
  const features = [
    {
      title: '100% FREE FOREVER',
      desc: 'No credit card required. No hidden fees or bait-and-switch expiration traps. Up to 5 active subdomains for every builder.',
      icon: '★',
      color: '#FFD214',
      tag: '0 COINS'
    },
    {
      title: 'GLOBAL ANYCAST EDGE',
      desc: 'Sub-20ms latency routed across 280+ worldwide edge nodes. Instant DNS propagation in under 5 seconds.',
      icon: '⚡',
      color: '#29D8FF',
      tag: '<5s SYNC'
    },
    {
      title: 'AUTO-RENEWING SSL',
      desc: 'Full TLS 1.3 wildcard certificates provisioned automatically. Keep your web apps secure with green-padlock encryption.',
      icon: '🔒',
      color: '#2CE8A2',
      tag: 'HTTPS READY'
    },
    {
      title: 'FULL DNS RECORD SUITE',
      desc: 'Complete control over A, AAAA, CNAME, TXT, and MX records. Point to Vercel, GitHub Pages, Netlify, or custom VPS nodes.',
      icon: '🛠',
      color: '#FF3864',
      tag: 'CNAME & A'
    },
    {
      title: 'DDOS & FLOOD SHIELD',
      desc: 'Layer 7 automated mitigation shields your subdomain against spikes, scraper bots, and malicious requests.',
      icon: '🛡',
      color: '#8B5CF6',
      tag: 'HARDENED'
    },
    {
      title: 'MOBILE READY CONTROL',
      desc: 'Engineered with responsive pixel precision. Claim subdomains and update DNS configurations seamlessly from your phone.',
      icon: '📱',
      color: '#FF7B00',
      tag: 'TOUCH FRIENDLY'
    }
  ];

  return (
    <section id="features" className="py-16 sm:py-24 border-b-[3px] border-[#181425] bg-white select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-block bg-[#2CE8A2] border-2 border-[#181425] px-3 py-1 text-[9px] font-pixel text-[#181425] mb-3">
            ★ SYSTEM SPECIFICATIONS
          </div>
          <h2 className="font-pixel text-xl sm:text-3xl text-[#181425] tracking-tight mb-3">
            BUILT FOR <span className="text-[#29D8FF]">SPEED</span> & <span className="text-[#FF3864]">FREEDOM</span>
          </h2>
          <p className="font-pixel-sub text-xs sm:text-sm text-[#5A5766]">
            Every planned <span className="text-[#181425] font-bold">uids.app</span> subdomain will use configuration-driven DNS and SSL once the Domain Service is live.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              onMouseEnter={() => PixelAudio.playBlip()}
              className="p-6 bg-[#FAF7F2] border-[3px] border-[#181425] pixel-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#181425] transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header with icon and tag */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 border-[2.5px] border-[#181425] pixel-shadow-sm flex items-center justify-center font-pixel text-base text-[#181425]"
                    style={{ backgroundColor: feat.color }}
                  >
                    {feat.icon}
                  </div>
                  <span className="font-pixel text-[8px] bg-white border border-[#181425] px-2 py-0.5 text-[#181425]">
                    {feat.tag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-pixel text-xs sm:text-sm text-[#181425] mb-2">
                  {feat.title}
                </h3>

                {/* Description */}
                <p className="font-pixel-sub text-[11px] text-[#5A5766] leading-relaxed">
                  {feat.desc}
                </p>
              </div>

              {/* Pixel Accent Corner */}
              <div className="mt-5 pt-3 border-t-2 border-dashed border-[#181425]/20 flex items-center justify-between font-pixel text-[8px] text-[#5A5766]">
                <span>MODULE_0{idx + 1}</span>
                <span className="text-[#2CE8A2]">ACTIVE ●</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
