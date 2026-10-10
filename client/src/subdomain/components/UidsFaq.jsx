import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * UidsFaq Component
 * Minimized, compact and sleek accordion FAQ vault
 */
export default function UidsFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'Is uids.app really 100% free for subdomains?',
      a: 'Yes! You can claim, configure, and route your personal or project subdomain completely free forever with zero credit card required. Includes 20MB of high-speed static hosting and automated wildcard SSL.'
    },
    {
      q: 'Can I connect my GitHub Pages or Vercel projects?',
      a: 'Yes. In our in-page DNS console, choose GitHub Pages or Vercel, and we will automatically map the appropriate CNAME records so your deployments point directly to your clean uids.app domain.'
    },
    {
      q: 'Does every subdomain get an automatic SSL certificate?',
      a: 'Yes. Our global Anycast edge automatically provisions and auto-renews TLS/SSL certificates for all registered subdomains, ensuring your site is always loaded securely via HTTPS.'
    },
    {
      q: 'Can I point custom A or TXT records to a custom VPS or server?',
      a: 'Yes. You can specify any IPv4 address for an A record or add custom TXT verification records to prove ownership of external services.'
    },
    {
      q: 'What is included in the Paid / Pro Plan?',
      a: 'The Paid Plan unlocks Node.js backend execution, higher storage space, priority Anycast routing, custom root domain mapping, and 24/7 priority support.'
    }
  ];

  return (
    <section id="faq" className="w-full max-w-3xl mx-auto px-4 pb-8 sm:pb-12">
      <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          FAQ
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-2 mb-1">
          Frequently Asked Questions
        </h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Clear answers about domains, DNS routing, and hosting on uids.app.
        </p>
      </div>

      <div className="space-y-2.5">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-150 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left text-xs sm:text-sm font-bold text-slate-900 select-none"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 shrink-0 ml-3 ${
                    isOpen ? 'rotate-180 text-emerald-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-3.5 sm:px-4 pb-3.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100/80">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
