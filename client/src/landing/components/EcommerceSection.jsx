import React from 'react';
import {
  ArrowRight,
  Store,
  CreditCard,
  Package,
  Monitor,
  CheckCircle2
} from 'lucide-react';

export default function EcommerceSection({ onNavigate }) {
  const capabilities = [
    {
      title: 'Omnichannel Retail POS',
      desc: 'Ring up sales in seconds with hardware-ready barcode scanning, thermal receipt printing, and offline IndexedDB resilience.',
      icon: Monitor,
      badgeColor: 'bg-[#fef7e0] text-[#b06000]',
      features: ['Laser barcode & QR code recognition', 'ESC/POS 80mm printer integration', 'Offline sales sync upon reconnect']
    },
    {
      title: 'High-Converting Storefront Studio',
      desc: 'Launch custom-branded online storefronts with responsive themes optimized for top mobile performance and speed scores.',
      icon: Store,
      badgeColor: 'bg-[#e8f0fe] text-[#0b57d0]',
      features: ['Zero-code theme customizer', 'Instant search & faceted product filters', '100% responsive mobile layout']
    },
    {
      title: 'Global Multi-Currency Checkout',
      desc: 'Accept payments from customers worldwide with localized currencies, international credit cards, and digital wallets.',
      icon: CreditCard,
      badgeColor: 'bg-[#e6f4ea] text-[#137333]',
      features: ['Native USD, EUR, GBP, and BDT support', 'Direct bKash, Nagad & card integrations', 'Sub-second checkout verification']
    },
    {
      title: 'Automated Multi-Warehouse Inventory',
      desc: 'Maintain unified stock counts across online storefronts, physical retail branches, and supplier warehouses.',
      icon: Package,
      badgeColor: 'bg-[#fce8e6] text-[#c5221f]',
      features: ['Real-time stock depletion alerts', 'Multi-location batch adjustments', 'Automated supplier reorder notices']
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block */}
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
          <span className="text-[12px] font-semibold tracking-wider text-[#0b57d0] uppercase">
            COMMERCE & RETAIL FABRIC
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-normal tracking-[-0.02em] text-[#1f1f1f] leading-tight">
            Complete commerce infrastructure from storefront to counter
          </h2>
          <p className="text-[16px] sm:text-[18px] text-[#5f6368] font-normal leading-relaxed">
            Eliminate disconnected software tools. Tiwlo synchronizes your physical retail counters, online storefronts, and warehouse stock into one unified platform.
          </p>
        </div>

        {/* 4 Clean Google Cloud Bento Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {capabilities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-[24px] bg-[#f8f9fa] hover:bg-white shadow-xs hover:shadow-[0_8px_30px_rgba(60,64,67,0.08)] transition-all space-y-5 group"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-[14px] ${item.badgeColor} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => onNavigate(idx === 0 ? 'pos' : 'store')}
                    className="text-[13px] font-medium text-[#0b57d0] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                <div>
                  <h3 className="text-[20px] font-medium text-[#1f1f1f] tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-[14px] text-[#5f6368] leading-relaxed mt-2">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#e0e2ec] space-y-2 text-[13px] text-[#444746]">
                  {item.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
