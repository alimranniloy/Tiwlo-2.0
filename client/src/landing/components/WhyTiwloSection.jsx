import React from 'react';
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Database,
  Lock,
  Headphones,
  Check,
  X
} from 'lucide-react';

export default function WhyTiwloSection({ onNavigate }) {
  const pillars = [
    {
      title: 'Anycast Global Edge Network',
      desc: 'Edge routing across 20+ global regions ensures your storefront loads in under 30ms anywhere in the world.',
      icon: Globe,
      badgeColor: 'bg-[#e8f0fe] text-[#0b57d0]'
    },
    {
      title: 'Dedicated Tenant Isolation',
      desc: 'Each store runs on an isolated data partition with encrypted storage, eliminating cross-tenant vulnerability.',
      icon: Database,
      badgeColor: 'bg-[#e6f4ea] text-[#137333]'
    },
    {
      title: 'Automated SSL & DNS Engine',
      desc: 'Instant TLS 1.3 wildcard certificate provisioning and automatic DNS propagation for custom domain names.',
      icon: Lock,
      badgeColor: 'bg-[#fef7e0] text-[#b06000]'
    },
    {
      title: 'Zero-Interruption Rolling Updates',
      desc: 'Deploy code updates, database migrations, and schema changes without a single millisecond of customer downtime.',
      icon: Zap,
      badgeColor: 'bg-[#fce8e6] text-[#c5221f]'
    },
    {
      title: 'High-Availability 99.99% SLA',
      desc: 'Automated health monitoring, self-healing containers, and multi-cloud failover backed by enterprise guarantee.',
      icon: Shield,
      badgeColor: 'bg-[#f3e8fd] text-[#7c3aed]'
    },
    {
      title: '24/7 Expert Technical Support',
      desc: 'Direct access to cloud and e-commerce engineers via live chat, ticket system, and dedicated phone channels.',
      icon: Headphones,
      badgeColor: 'bg-[#e8f0fe] text-[#0b57d0]'
    }
  ];

  return (
    <section className="py-14 sm:py-20 bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12 space-y-2.5">
          <span className="text-[12px] font-semibold tracking-wider text-[#0b57d0] uppercase">
            WHY MODERN MERCHANTS CHOOSE TIWLO
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-[-0.02em] text-[#1f1f1f] leading-tight">
            Engineered for enterprise scale, built for speed
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#5f6368] font-normal leading-relaxed">
            Eliminate server maintenance headaches and fragmented software stacks. Tiwlo delivers all your commerce and cloud infrastructure under one unified platform.
          </p>
        </div>

        {/* 6 Feature Cards (Borderless with Soft Elevation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 sm:mb-14">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-7 rounded-[22px] bg-[#f8f9fa] hover:bg-white border border-[#dadce0]/40 hover:border-transparent shadow-xs hover:shadow-[0_6px_24px_rgba(60,64,67,0.09)] transition-all space-y-3 group"
              >
                <div className={`w-12 h-12 rounded-[14px] ${item.badgeColor} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-[17px] font-medium text-[#1f1f1f] group-hover:text-[#0b57d0] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[14px] text-[#5f6368] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Architecture Comparison Card (Borderless, Google Cloud Style) */}
        <div className="max-w-4xl mx-auto rounded-[24px] bg-white border border-[#dadce0]/60 shadow-[0_2px_16px_rgba(60,64,67,0.06)] overflow-hidden">
          <div className="p-6 sm:p-7 bg-[#f1f3f4] flex items-center justify-between">
            <div>
              <span className="text-[15px] font-medium text-[#1f1f1f] block">Platform Comparison</span>
              <span className="text-[13px] text-[#5f6368]">Traditional Fragmented Stack vs. Tiwlo Unified Cloud</span>
            </div>
            <span className="text-[12px] font-medium text-[#0b57d0] bg-white px-3 py-1 rounded-full shadow-xs">
              All-in-One Architecture
            </span>
          </div>

          <div className="divide-y divide-[#f1f3f4] text-[13px]">
            <div className="grid grid-cols-12 p-4 text-[12px] font-medium text-[#5f6368] uppercase tracking-wider bg-[#fafafa]">
              <div className="col-span-6 sm:col-span-5">Feature</div>
              <div className="col-span-3 sm:col-span-3 text-center">Traditional Hosting</div>
              <div className="col-span-3 sm:col-span-4 text-center text-[#0b57d0]">Tiwlo Platform</div>
            </div>

            {[
              { name: 'Storefront & Omnichannel POS Integration', trad: false, tiwlo: 'Unified Native' },
              { name: 'Multi-Tenant Database Isolation', trad: false, tiwlo: 'Hardware Isolated' },
              { name: 'Automated Global SSL & Anycast DNS', trad: 'Manual setup', tiwlo: 'Zero-touch Automated' },
              { name: 'Dedicated Cloud Compute Instances', trad: 'Separate vendors', tiwlo: 'One Single Console' },
              { name: 'Deployment Time to First Sale', trad: 'Days / Weeks', tiwlo: '< 5 Minutes' }
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-12 p-4 items-center hover:bg-[#f8f9fa] transition-colors">
                <div className="col-span-6 sm:col-span-5 font-medium text-[#1f1f1f]">{row.name}</div>
                <div className="col-span-3 sm:col-span-3 text-center text-[#747775]">
                  {row.trad === false ? (
                    <X className="w-4 h-4 text-[#d93025] mx-auto" />
                  ) : (
                    <span>{row.trad}</span>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-4 text-center font-medium text-[#137333] flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4 text-[#137333] shrink-0" />
                  <span>{row.tiwlo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
