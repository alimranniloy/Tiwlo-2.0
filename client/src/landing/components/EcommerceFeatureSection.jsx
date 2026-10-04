import React from 'react';
import { ArrowRight, ShoppingBag, Star } from 'lucide-react';

export default function EcommerceFeatureSection({ onNavigate }) {
  return (
    <section className="relative py-24 overflow-hidden border-t border-white/[0.04]">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[550px] h-[400px] bg-pink-900/10 rounded-full blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: E-commerce Narrative */}
          <div className="lg:col-span-5 space-y-5 text-left">
            <span className="text-xs font-bold tracking-widest text-pink-400 uppercase">
              E-COMMERCE
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Your Store, Your Brand.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-normal">
              Create a stunning online store with powerful tools, flexible customization, and seamless payment options. Turn your ideas into a profitable business.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('store')}
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/20 hover:border-white/35 text-white font-medium text-sm transition-all duration-200 cursor-pointer shadow-lg shadow-black/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Explore E-commerce</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Column: Mac Browser Window Mockup */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-[#0e1320] shadow-2xl shadow-purple-950/40 group">
              {/* Browser Window Header Chrome */}
              <div className="px-4 py-3 bg-[#090d16] border-b border-white/10 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[11px] text-slate-400 font-mono tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>tiwlo.com/store</span>
                  </div>
                </div>
              </div>

              {/* Browser Window Body with Store Screenshot */}
              <div className="relative overflow-hidden bg-white">
                <img
                  src="/landing/store-preview.jpg"
                  alt="Tiwlo Storefront Showcase"
                  className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
