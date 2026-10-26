import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function StudioFaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: 'How does distribution to 200+ platforms work?',
      answer:
        'Once you upload your audio file (lossless WAV/FLAC) and cover artwork, Tiwlo Studio validates metadata according to global DSP specifications. We automatically encode, package, and deliver your release to Spotify, Apple Music, YouTube Music, Amazon, Deezer, TikTok, Tidal, and over 200 global streaming and download platforms.'
    },
    {
      question: 'Do I keep 100% of my rights and royalties?',
      answer:
        'Yes, absolutely. You retain 100% ownership of your sound recording copyrights, publishing rights, and creative direction. Tiwlo Studio never claims master ownership, and earnings from streams and downloads are passed directly to your account with complete transparency.'
    },
    {
      question: 'How fast will my release appear on streaming stores?',
      answer:
        'Standard releases typically ingest across major platforms within 3 to 7 business days. With Pro accounts, expedited distribution delivers tracks in less than 48 hours. We recommend scheduling releases at least 2 weeks in advance to pitch Spotify and Apple editorial playlists.'
    },
    {
      question: 'What is Music Level and how does it help artists?',
      answer:
        'Music Level is Tiwlo Studio’s integrated artist development suite. It provides real-time streaming analytics, audience demographic insights, smart link generators for social media, pre-save campaigns, and automated royalty splits between collaborators.'
    },
    {
      question: 'Can I release covers or remixes?',
      answer:
        'Yes. You can distribute covers provided mechanical licenses are acquired for relevant territories (which Tiwlo Studio can help automate). For remixes, you must have explicit written authorization from the original copyright holder.'
    }
  ];

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <section id="faq" className="py-20 md:py-32 relative bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 shadow-2xs mb-4 text-blue-700 text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
            Everything You Need To Know
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Have questions about music distribution or rights management? We've got answers.
          </p>
        </div>

        {/* Accordion FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-all overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-slate-900 pr-4">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 animate-in fade-in duration-200">
                    {faq.answer}
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
