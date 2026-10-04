import React, { useState } from 'react';
import {
  ArrowRight,
  Server,
  ShoppingCart,
  Monitor,
  Database,
  Globe,
  CheckCircle2,
  Cpu,
  Shield,
  Zap,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function ProductsShowcaseSection({ onNavigate, currentUser }) {
  const [activeTab, setActiveTab] = useState('compute');

  const tabs = [
    { id: 'compute', label: 'Cloud Compute', icon: Cpu },
    { id: 'commerce', label: 'Commerce Storefront', icon: ShoppingCart },
    { id: 'pos', label: 'Retail & POS', icon: Monitor },
    { id: 'database', label: 'Cloud Database', icon: Database },
    { id: 'networking', label: 'Anycast DNS & SSL', icon: Globe }
  ];

  return (
    <section className="pt-10 pb-16 sm:pt-12 sm:pb-20 bg-[#f8f9fa]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Google Cloud Header */}
        <div className="max-w-3xl mx-auto text-center mb-8 space-y-2.5">
          <span className="text-[12px] font-semibold tracking-wider text-[#0b57d0] uppercase">
            PRODUCTS & SOLUTIONS
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-[-0.02em] text-[#1f1f1f] leading-tight">
            Explore products and solutions on Tiwlo Cloud
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#5f6368] font-normal leading-relaxed">
            Scalable infrastructure and modern commerce tools built to work seamlessly together.
          </p>
        </div>

        {/* Google Cloud Navigation Tabs (Pill Switcher) */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0b57d0] text-white shadow-xs'
                    : 'bg-white text-[#444746] hover:bg-[#e8eaed] hover:text-[#1f1f1f]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#5f6368]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Showcase Cards (Borderless, Soft Elevation) */}
        <div className="max-w-5xl mx-auto rounded-[24px] bg-white p-6 sm:p-10 shadow-[0_2px_16px_rgba(60,64,67,0.06)] border border-[#dadce0]/40">
          
          {/* TAB 1: CLOUD COMPUTE */}
          {activeTab === 'compute' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-6 space-y-5">
                <div className="w-12 h-12 rounded-[14px] bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-medium text-[#1f1f1f] tracking-tight">
                    Tiwlo Virtual Compute Droplets
                  </h3>
                  <p className="text-[15px] text-[#5f6368] leading-relaxed mt-2">
                    High-performance virtual machines with dedicated vCPU, lightning-fast NVMe storage, and automated horizontal scaling.
                  </p>
                </div>
                <div className="space-y-3 pt-2 text-[14px] text-[#444746]">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Cost-optimized instance families for web workloads, caching, and databases</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Sub-millisecond local NVMe storage with high-throughput IOPS</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Global deployment across Frankfurt, Singapore, New York, and London zones</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Deploy Compute Droplet</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Spec Matrix Card */}
              <div className="lg:col-span-6 space-y-3 bg-[#f8f9fa] p-6 rounded-[20px]">
                <div className="text-xs font-semibold uppercase text-[#747775] tracking-wider mb-2">
                  Compute Instance Configurations
                </div>
                {[
                  { name: 'Standard Droplet', specs: '2 vCPU · 4 GB RAM · 80 GB NVMe', use: 'Web stores & API gateways', price: '$12/mo' },
                  { name: 'Performance Droplet', specs: '4 vCPU · 8 GB RAM · 160 GB NVMe', use: 'High-traffic retail & POS backend', price: '$24/mo' },
                  { name: 'Memory-Optimized', specs: '8 vCPU · 32 GB RAM · 320 GB NVMe', use: 'In-memory cache & heavy databases', price: '$64/mo' }
                ].map((plan, i) => (
                  <div key={i} className="p-4 rounded-[14px] bg-white shadow-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#1f1f1f] text-[14px]">{plan.name}</div>
                      <div className="text-[12px] text-[#5f6368]">{plan.specs}</div>
                      <div className="text-[11px] text-[#747775] mt-0.5">{plan.use}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[15px] font-semibold text-[#1f1f1f]">{plan.price}</span>
                      <span className="text-[10px] text-[#137333] block font-medium">Instant setup</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: COMMERCE STOREFRONT */}
          {activeTab === 'commerce' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-6 space-y-5">
                <div className="w-12 h-12 rounded-[14px] bg-[#e6f4ea] text-[#137333] flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-medium text-[#1f1f1f] tracking-tight">
                    Tiwlo Commerce Studio
                  </h3>
                  <p className="text-[15px] text-[#5f6368] leading-relaxed mt-2">
                    Build blazing-fast, mobile-first online storefronts with integrated themes, multi-currency checkout, and real-time inventory ledger.
                  </p>
                </div>
                <div className="space-y-3 pt-2 text-[14px] text-[#444746]">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Responsive theme engine optimized for 100% Core Web Vitals performance</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Global checkout accepting cards, digital wallets, bKash, and local gateways</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Multi-location stock tracking with automated low-inventory alerts</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigate('store')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Explore Commerce Store</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Feature Highlights */}
              <div className="lg:col-span-6 space-y-3 bg-[#f8f9fa] p-6 rounded-[20px]">
                <div className="text-xs font-semibold uppercase text-[#747775] tracking-wider mb-2">
                  Storefront Capabilities
                </div>
                {[
                  { title: 'Sub-Second Checkout Engine', desc: 'Pre-computed checkout pipelines designed to eliminate customer drop-off.' },
                  { title: 'Multi-Currency Architecture', desc: 'Native support for USD, EUR, GBP, and BDT with automatic FX conversions.' },
                  { title: 'Unified Catalog & Collections', desc: 'Unlimited product variants, SKU management, and digital asset hosting.' }
                ].map((feat, i) => (
                  <div key={i} className="p-4 rounded-[14px] bg-white shadow-xs">
                    <div className="font-medium text-[#1f1f1f] text-[14px]">{feat.title}</div>
                    <div className="text-[12px] text-[#5f6368] mt-1">{feat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: RETAIL & POS */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-6 space-y-5">
                <div className="w-12 h-12 rounded-[14px] bg-[#fef7e0] text-[#b06000] flex items-center justify-center">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-medium text-[#1f1f1f] tracking-tight">
                    Tiwlo Smart Omnichannel POS
                  </h3>
                  <p className="text-[15px] text-[#5f6368] leading-relaxed mt-2">
                    Turn any tablet, desktop, or mobile device into a full retail cash register with laser barcode scanning and instant thermal printing.
                  </p>
                </div>
                <div className="space-y-3 pt-2 text-[14px] text-[#444746]">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Hardware support for ESC/POS 80mm printers, barcode scanners, and cash drawers</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Offline resilience with automatic IndexedDB caching and cloud synchronization</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Multi-counter shift management, split tenders, and real-time cash reconciliations</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigate('pos')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Open POS Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: POS Highlights */}
              <div className="lg:col-span-6 space-y-3 bg-[#f8f9fa] p-6 rounded-[20px]">
                <div className="text-xs font-semibold uppercase text-[#747775] tracking-wider mb-2">
                  Counter Hardware Ready
                </div>
                {[
                  { title: 'Barcode Laser & Camera Engine', desc: 'Instant scanning of EAN-13, UPC, Code 128, and custom product QR codes.' },
                  { title: 'Thermal Receipt Formatting', desc: 'Direct browser printing to standard 80mm/58mm thermal receipt printers.' },
                  { title: 'Offline Cash Register Mode', desc: 'Keep ringing sales even during internet outages; auto-syncs when online.' }
                ].map((feat, i) => (
                  <div key={i} className="p-4 rounded-[14px] bg-white shadow-xs">
                    <div className="font-medium text-[#1f1f1f] text-[14px]">{feat.title}</div>
                    <div className="text-[12px] text-[#5f6368] mt-1">{feat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CLOUD DATABASE */}
          {activeTab === 'database' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-6 space-y-5">
                <div className="w-12 h-12 rounded-[14px] bg-[#fce8e6] text-[#c5221f] flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-medium text-[#1f1f1f] tracking-tight">
                    Isolated Multi-Tenant Databases
                  </h3>
                  <p className="text-[15px] text-[#5f6368] leading-relaxed mt-2">
                    Every store is provisioned with a physically isolated data partition, eliminating cross-tenant leakage and ensuring enterprise privacy.
                  </p>
                </div>
                <div className="space-y-3 pt-2 text-[14px] text-[#444746]">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Dedicated AES-256 encryption at rest and TLS 1.3 in transit</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Automated daily snapshots and point-in-time database restoration</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Instant rollback safeguards protecting critical sales ledgers</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    <span>View Database Specs</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: DB Security Specs */}
              <div className="lg:col-span-6 space-y-3 bg-[#f8f9fa] p-6 rounded-[20px]">
                <div className="text-xs font-semibold uppercase text-[#747775] tracking-wider mb-2">
                  Data Protection Guarantees
                </div>
                {[
                  { title: 'Physical Tenant Partitioning', desc: 'Zero shared data tables. Your customer records and orders remain private.' },
                  { title: 'Continuous Health Probes', desc: 'Automatic self-healing containers restore services instantly in event of failure.' },
                  { title: 'Zero-Downtime Schema Migrations', desc: 'Update database schemas and tables without interrupting live transactions.' }
                ].map((feat, i) => (
                  <div key={i} className="p-4 rounded-[14px] bg-white shadow-xs">
                    <div className="font-medium text-[#1f1f1f] text-[14px]">{feat.title}</div>
                    <div className="text-[12px] text-[#5f6368] mt-1">{feat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ANYCAST DNS & SSL */}
          {activeTab === 'networking' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-6 space-y-5">
                <div className="w-12 h-12 rounded-[14px] bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-medium text-[#1f1f1f] tracking-tight">
                    Anycast Edge DNS & Automated SSL
                  </h3>
                  <p className="text-[15px] text-[#5f6368] leading-relaxed mt-2">
                    Point your custom domain and our Anycast routing network handles global propagation, DDoS shielding, and automated TLS 1.3 certificates.
                  </p>
                </div>
                <div className="space-y-3 pt-2 text-[14px] text-[#444746]">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Global Anycast DNS resolving custom domains in under 25 milliseconds</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Zero-touch automated Let’s Encrypt wildcard certificate renewals</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
                    <span>Edge caching and HTTP/3 QUIC protocol support out of the box</span>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => onNavigate('domains')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Configure Custom Domain</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Networking Specs */}
              <div className="lg:col-span-6 space-y-3 bg-[#f8f9fa] p-6 rounded-[20px]">
                <div className="text-xs font-semibold uppercase text-[#747775] tracking-wider mb-2">
                  Edge Network Metrics
                </div>
                {[
                  { title: '< 25ms Global DNS Resolution', desc: 'Anycast nameservers globally distributed across 20+ Tier-4 data centers.' },
                  { title: 'Automatic TLS 1.3 SSL Provisioning', desc: 'Trusted HTTPS encryption activated automatically upon domain pointer verification.' },
                  { title: 'Integrated DDoS Mitigation', desc: 'Layer 3, 4, and 7 traffic filtering protecting your checkout from malicious bursts.' }
                ].map((feat, i) => (
                  <div key={i} className="p-4 rounded-[14px] bg-white shadow-xs">
                    <div className="font-medium text-[#1f1f1f] text-[14px]">{feat.title}</div>
                    <div className="text-[12px] text-[#5f6368] mt-1">{feat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}
