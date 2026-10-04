import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function CtaSection({ onNavigate, currentUser }) {
  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Google Cloud Style CTA Card */}
        <div className="relative rounded-[28px] bg-[#f8f9fa] p-8 sm:p-12 overflow-hidden text-center border border-[#dadce0]/50 shadow-[0_2px_16px_rgba(60,64,67,0.06)]">
          
          {/* Subtle Accent Strip at the top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0b57d0]" />

          <div className="max-w-3xl mx-auto space-y-4">
            
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-[-0.02em] text-[#1f1f1f] leading-tight">
              Ready to grow your business with Tiwlo?
            </h2>

            <p className="text-[16px] sm:text-[18px] text-[#5f6368] max-w-2xl mx-auto leading-relaxed">
              Launch your online storefront, set up smart point-of-sale registers, and provision high-speed cloud droplets in just minutes.
            </p>

            {/* Dual Pill Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3.5">
              <button
                onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
                className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white rounded-full px-8 py-3.5 text-[15px] font-medium shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span>{currentUser ? 'Go to Console' : 'Start free trial'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('pricing')}
                className="border border-[#747775] text-[#0b57d0] hover:bg-white rounded-full px-7 py-3.5 text-[15px] font-medium transition-colors cursor-pointer"
              >
                <span>View plans & pricing</span>
              </button>
            </div>

            {/* Benefits Row */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#5f6368] font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                <span>Instant automated SSL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                <span>24/7 technical support</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
