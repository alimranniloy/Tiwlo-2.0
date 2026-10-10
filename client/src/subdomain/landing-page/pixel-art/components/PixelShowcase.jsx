import React from 'react';
import { PixelAudio } from './PixelSoundFx';
import { Globe, ArrowUpRight, Zap, Heart, Eye } from 'lucide-react';

export default function PixelShowcase({ onSelectDomain }) {
  const showcaseItems = [];
  const tickerList = [];

  return (
    <section id="showcase" className="py-14 sm:py-20 border-b-[3px] border-[#181425] bg-[#FAF7F2] select-none">
      
      {/* Ticker Marquee Bar */}
      <div className="border-y-[3px] border-[#181425] bg-[#FFEEC2] py-2.5 overflow-hidden mb-12 sm:mb-16">
        <div className="font-pixel text-[10px] text-[#5A5766] text-center">
          COMMUNITY SHOWCASE WILL APPEAR AFTER VERIFIED SUBDOMAINS ARE REGISTERED.
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-block bg-[#FFD214] border-2 border-[#181425] px-2.5 py-0.5 text-[9px] font-pixel text-[#181425] mb-2">
              ★ COMMUNITY SHOWCASE
            </div>
            <h2 className="font-pixel text-xl sm:text-3xl text-[#181425] tracking-tight">
              BUILT ON <span className="text-[#FF3864]">UIDIS.APP</span>
            </h2>
            <p className="font-pixel-sub text-xs sm:text-sm text-[#5A5766] mt-1 max-w-xl">
              Verified projects will appear here after the Domain Service is connected to PostgreSQL.
            </p>
          </div>

          <div className="font-pixel text-[10px] text-[#181425] bg-white border-2 border-[#181425] px-3 py-1.5 pixel-shadow-sm self-start sm:self-auto">
            LIVE PINGS: &lt;20MS GLOBAL
          </div>
        </div>

        {/* Showcase Grid */}
        <div className="grid grid-cols-1 gap-5">
          {showcaseItems.length === 0 && (
            <div className="bg-white border-[3px] border-[#181425] pixel-shadow p-6 text-center font-pixel text-[10px] text-[#5A5766]">
              NO VERIFIED SUBDOMAINS YET.
            </div>
          )}
          {showcaseItems.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                PixelAudio.playBlip();
                if (onSelectDomain) onSelectDomain(item.subdomain);
              }}
              className="bg-white border-[3px] border-[#181425] pixel-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#181425] transition-all p-5 flex flex-col justify-between cursor-pointer group"
            >
              <div>
                {/* Header row with badge & ping */}
                <div className="flex items-center justify-between mb-3.5">
                  <span
                    className="font-pixel text-[8px] px-2 py-0.5 border border-[#181425] text-[#181425]"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.category}
                  </span>
                  <div className="flex items-center gap-1.5 font-pixel text-[9px] text-[#2CE8A2]">
                    <span className="w-2 h-2 rounded-none bg-[#2CE8A2] animate-pixel-blink" />
                    <span>{item.ping}</span>
                  </div>
                </div>

                {/* Subdomain Name */}
                <h3 className="font-pixel text-xs sm:text-sm text-[#181425] group-hover:text-[#FF3864] transition-colors break-all mb-2 flex items-center justify-between">
                  <span>{item.fullDomain}</span>
                  <ArrowUpRight className="w-4 h-4 text-[#5A5766] group-hover:text-[#FF3864] shrink-0" />
                </h3>

                {/* Description */}
                <p className="font-pixel-sub text-[11px] text-[#5A5766] leading-relaxed">
                  {item.desc}
                </p>
              </div>

              {/* Bottom stats footer */}
              <div className="mt-4 pt-3 border-t-2 border-dashed border-[#181425]/20 flex items-center justify-between font-pixel text-[9px] text-[#5A5766]">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-[#181425]" />
                  <span>{item.views} hits</span>
                </span>
                <span className="text-[#2CE8A2] font-bold">100% UPTIME</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
