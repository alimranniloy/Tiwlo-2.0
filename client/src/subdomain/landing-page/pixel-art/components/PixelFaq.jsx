import React, { useState } from 'react';
import { PixelAudio } from './PixelSoundFx';
import { Plus, Minus, HelpCircle } from 'lucide-react';

export default function PixelFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'WHAT IS UIDS.APP?',
      a: 'uids.app is the planned standalone Domain Service for free user subdomains. Registration and entitlement rules will be published when its PostgreSQL-backed service is launched.'
    },
    {
      q: 'WHEN CAN I REGISTER A SUBDOMAIN?',
      a: 'The registration workflow is not active yet. The landing page does not claim availability or create DNS records until the backend Domain Service is ready.'
    },
    {
      q: 'WILL DNS RECORDS BE STORED IN POSTGRESQL?',
      a: 'Yes. The planned Domain Service will keep ownership, subdomain allocation, DNS configuration, and audit state in the main PostgreSQL database.'
    },
    {
      q: 'WILL AUTOMATED SSL BE PROVIDED?',
      a: 'The platform configuration includes uids.app for future DNS and SSL coverage. Certificates are not claimed as active until registrar delegation and production certificate issuance are verified.'
    },
    {
      q: 'CAN I ADD MY OWN DOMAIN?',
      a: 'A separate authenticated custom-domain workflow already exists for eligible accounts. The free uids.app service will have its own rules and will not reuse store-domain routing.'
    },
    {
      q: 'IS THE SERVICE LIVE NOW?',
      a: 'No. This page is informational until the PostgreSQL-backed Domain Service, registrar delegation, DNS records, and production SSL are operational.'
    }
  ];

  const handleToggle = (idx) => {
    PixelAudio.playBlip();
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 border-b-[3px] border-[#181425] bg-white select-none">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center mb-12">
          <div className="inline-block bg-[#8B5CF6] text-white border-2 border-[#181425] px-3 py-1 text-[9px] font-pixel mb-3 pixel-shadow-sm">
            ★ KNOWLEDGE VAULT
          </div>
          <h2 className="font-pixel text-xl sm:text-3xl text-[#181425] tracking-tight mb-2">
            FREQUENTLY ASKED <span className="text-[#29D8FF]">QUESTIONS</span>
          </h2>
          <p className="font-pixel-sub text-xs sm:text-sm text-[#5A5766]">
            Everything you need to know about registering and running free subdomains.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border-[3px] border-[#181425] pixel-shadow-sm bg-[#FAF7F2] overflow-hidden transition-all"
              >
                <button
                  onClick={() => handleToggle(idx)}
                  className="w-full p-4 sm:p-5 text-left font-pixel text-xs sm:text-[13px] text-[#181425] flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FFEEC2] transition-colors"
                >
                  <span className="leading-snug">{faq.q}</span>
                  <div className="w-6 h-6 border-2 border-[#181425] bg-white flex items-center justify-center shrink-0">
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t-2 border-dashed border-[#181425]/20 font-pixel-sub text-xs sm:text-[13px] text-[#474354] leading-relaxed animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
