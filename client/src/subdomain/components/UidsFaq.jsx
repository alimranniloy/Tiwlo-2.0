import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * UidsFaq Component
 * Clean Google-inspired accordion FAQ vault
 */
export default function UidsFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'Is uids.app really 100% free for subdomains?',
      a: 'Yes! You can claim, configure, and route your personal or project subdomain completely free forever. There are no credit cards required, and every subdomain includes 20MB of high-speed static hosting with automated wildcard SSL.'
    },
    {
      q: 'Can I connect my GitHub Pages or Vercel projects?',
      a: 'Absolutely. In our in-page DNS console, simply choose GitHub Pages or Vercel, and we will automatically map the appropriate CNAME records so your deployments point directly to your clean uids.app domain.'
    },
    {
      q: 'Does every subdomain get an automatic SSL certificate?',
      a: 'Yes. Our global Anycast edge infrastructure automatically provisions and auto-renews TLS/SSL certificates for all registered subdomains, ensuring your site is always loaded securely via HTTPS.'
    },
    {
      q: 'Can I point custom A or TXT records to a custom VPS or server?',
      a: 'Yes. You can specify any IPv4 address for an A record or add custom TXT verification records to prove ownership of services like Google Search Console, Resend, or Cloudflare.'
    },
    {
      q: 'What is included in the Paid / Pro Plan?',
      a: 'The Paid Plan allows Node.js backend execution, higher storage space, priority Anycast routing, custom root domain mapping, and 24/7 priority developer support.'
    }
  ];

  return (
    <section id="faq" className="w-full max-w-4xl mx-auto px-4 mt-20 sm:mt-24 pb-16 sm:pb-24">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">
          Frequently Asked Questions
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 mb-2">
          Everything You Need to Know
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          Clear answers about domains, DNS routing, and hosting on uids.app.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl transition-all duration-150 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 select-none"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ml-4 ${
                    isOpen ? 'rotate-180 text-emerald-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
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
