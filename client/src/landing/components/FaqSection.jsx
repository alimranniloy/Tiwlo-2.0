import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FaqSection({ onNavigate }) {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'How quickly can I set up and launch an online store with Tiwlo?',
      a: 'You can launch a fully functional, mobile-optimized online store in less than 5 minutes. Select your account type, pick a modern theme, add your first products, and start accepting payments immediately.'
    },
    {
      q: 'Can I connect my own custom domain with automated SSL?',
      a: 'Growth, Pro, and Enterprise accounts can connect a custom domain through the authenticated domain API. Add the requested TXT ownership record and point its A record to the Tiwlo server; after verification, the system can provision SSL. DNS records must be added at your domain provider.'
    },
    {
      q: 'How does Tiwlo’s isolated multi-tenant database protect my business data?',
      a: 'Unlike legacy platforms where all merchant records share unified tables, Tiwlo provisions isolated multi-tenant databases for each store. Your customer records, transactions, inventory, and analytics are stored separately and encrypted with dedicated AES-256 keys.'
    },
    {
      q: 'Can I use the Omnichannel POS register without an internet connection?',
      a: 'Yes. The Tiwlo POS terminal features offline caching via IndexedDB. Your cashiers can continue scanning barcodes, adding items, and recording cash sales. Once reconnected, transactions synchronize automatically with the cloud.'
    },
    {
      q: 'How does Tiwlo Cloud Compute droplets work?',
      a: 'Tiwlo Cloud droplets are high-availability virtual compute instances deployed across our global edge datacenters (Frankfurt, Singapore, New York, London, Mumbai). You can provision, scale, and monitor your cloud resources directly from the unified Tiwlo console.'
    },
    {
      q: 'Are there any hidden transaction fees or setup charges?',
      a: 'No. Tiwlo has transparent, predictable pricing. External payment gateway processing is not enabled in the current deployment.'
    }
  ];

  return (
    <section className="py-12 sm:py-16 bg-[#f8f9fa]">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-10 space-y-2.5">
          <span className="text-[12px] font-semibold tracking-wider text-[#0b57d0] uppercase">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[#1f1f1f]">
            Frequently asked questions
          </h2>
          <p className="text-[15px] sm:text-[16px] text-[#5f6368]">
            Everything you need to know about getting started with the Tiwlo platform.
          </p>
        </div>

        {/* Minimal Accordion with Hairline Dividers */}
        <div className="divide-y divide-[#dadce0]/60 border-t border-b border-[#dadce0]/60">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-5">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="w-full flex items-center justify-between text-left gap-4 cursor-pointer group"
                >
                  <span className={`text-[16px] font-medium transition-colors ${
                    isOpen ? 'text-[#0b57d0]' : 'text-[#1f1f1f] group-hover:text-[#0b57d0]'
                  }`}>
                    {faq.q}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-[#e8f0fe] text-[#0b57d0]' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 pr-10 text-[14px] text-[#5f6368] leading-relaxed animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support Help Center Link */}
        <div className="mt-10 text-center text-[14px] text-[#5f6368]">
          Have more questions?{' '}
          <button
            onClick={() => onNavigate('help-support')}
            className="text-[#0b57d0] font-medium hover:underline cursor-pointer"
          >
            Visit our 24/7 Support Center
          </button>
        </div>

      </div>
    </section>
  );
}
