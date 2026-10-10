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
      q: 'Can I manage DNS records?',
      a: 'Yes. After registration, open Domains in your Tiwlo dashboard to manage A, CNAME, and TXT records.'
    },
    {
      q: 'Does every subdomain get an automatic SSL certificate?',
      a: 'The uids.app service manages the platform domain and renews its certificates. User records are managed from the dashboard.'
    },
    {
      q: 'Can I point custom A or TXT records to a custom VPS or server?',
      a: 'Yes. A, CNAME, and TXT records can be added from the Domains page after you register a name.'
    },
    {
      q: 'Does a free subdomain expire?',
      a: 'No. Registered free subdomains do not have an expiry date. Platform safety and abuse policies still apply.'
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
