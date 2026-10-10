import React, { useState } from 'react';
import { PixelAudio } from './PixelSoundFx';
import { Plus, Minus, HelpCircle } from 'lucide-react';

export default function PixelFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'IS UIDIS.APP TRULY 100% FREE FOREVER?',
      a: 'Yes, completely! uidis.app is a community-first free subdomain registry built for developers, students, gamers, and indie makers. There are zero subscription costs, no renewal fees, and no credit card required.'
    },
    {
      q: 'HOW MANY SUBDOMAINS CAN I CLAIM?',
      a: 'Every user account can register and manage up to 5 free active subdomains simultaneously. If you need more for high-volume hackathons or community organizations, you can request an increase in one click.'
    },
    {
      q: 'HOW DO I CONNECT GITHUB PAGES OR VERCEL?',
      a: 'Simply select Vercel or GitHub Pages during the claim wizard or in your DNS management panel. Enter your deployment target (e.g., username.github.io or cname.vercel-dns.com), and our Anycast nameservers will route traffic instantly.'
    },
    {
      q: 'ARE AUTOMATED SSL CERTIFICATES PROVIDED?',
      a: 'Yes! Automated wildcard Let’s Encrypt TLS/SSL certificates are pre-provisioned on all uidis.app subdomains. All your traffic routes through HTTPS with zero manual certificate renewals.'
    },
    {
      q: 'CAN I CONFIGURE CUSTOM A AND CNAME RECORDS?',
      a: 'Absolutely. You have full granular DNS record control, including A records (IPv4), AAAA records (IPv6), CNAME aliases, and TXT verification records for Google Search Console, verification, or Bluesky handles.'
    },
    {
      q: 'CAN I USE UIDIS.APP SUBDOMAINS FOR COMMERCIAL PROJECTS?',
      a: 'Yes! You are completely free to run commercial software, SaaS backends, Discord bot webhooks, client demos, and online stores on any claimed subdomain.'
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
