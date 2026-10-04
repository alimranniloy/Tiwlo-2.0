import React from 'react';
import { ArrowRight, Check } from 'lucide-react';

export default function HeroSection({ onNavigate, currentUser }) {
  return (
    <section className="relative pt-20 pb-6 sm:pt-24 sm:pb-8 bg-white overflow-hidden">
      
      {/* Subtle Ambient Glows (Gentle Google-Style Atmosphere) */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 right-10 w-[550px] h-[550px] rounded-full bg-[#e8f0fe] blur-[140px] opacity-60" />
        <div className="absolute top-48 -left-20 w-[450px] h-[450px] rounded-full bg-[#e6f4ea] blur-[130px] opacity-40" />
      </div>

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        {/* Google Cloud Style Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-[62px] font-normal tracking-[-0.03em] text-[#1f1f1f] leading-[1.12] mb-5 max-w-4xl mx-auto">
          Accelerate your business with{' '}
          <span className="text-[#0b57d0] font-medium">Tiwlo Cloud</span>
        </h1>

        {/* Clean, High-Clarity Subheadline */}
        <p className="text-[17px] sm:text-[20px] text-[#444746] leading-relaxed max-w-2xl mx-auto font-normal mb-8">
          The unified cloud computing and commerce platform. Deploy scalable virtual droplets, build modern online storefronts with omnichannel POS, and scale on a global network.
        </p>

        {/* Google Cloud Dual Pill Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-8 sm:mb-10">
          <button
            onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
            className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white rounded-full px-7 sm:px-8 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-medium shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>{currentUser ? 'Go to Console' : 'Start free trial'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('store')}
            className="border border-[#747775] text-[#0b57d0] hover:bg-[#f8f9fa] rounded-full px-7 sm:px-8 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <span>Explore solutions</span>
          </button>
        </div>

        {/* Clean Google Cloud Trust Line (No $300 credit line) */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-[13px] text-[#5f6368] font-normal">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-[#137333]" />
            <span>Enterprise 99.99% SLA guarantee</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-[#137333]" />
            <span>No credit card required to start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-[#137333]" />
            <span>24/7 dedicated engineering support</span>
          </div>
        </div>

      </div>
    </section>
  );
}
