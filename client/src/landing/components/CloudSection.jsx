import React, { useState } from 'react';
import {
  ArrowRight,
  Server,
  Cpu,
  HardDrive,
  Shield,
  Activity,
  Globe,
  CheckCircle2,
  Zap
} from 'lucide-react';

export default function CloudSection({ onNavigate, currentUser }) {
  const [selectedTier, setSelectedTier] = useState('standard');

  const tiers = [
    {
      id: 'standard',
      name: 'Tiwlo Standard Droplet',
      type: 'General Purpose & Web Applications',
      tag: 'Most Popular for Stores',
      specs: '2 – 16 vCPU · 4 – 32 GB RAM · Ultra-Fast NVMe SSD',
      bandwidth: 'Up to 5 Gbps Network Bandwidth',
      locations: 'Frankfurt, Singapore, New York, London, Mumbai',
      description: 'Ideal for e-commerce storefronts, point-of-sale backends, and customer-facing web services with automated scaling.'
    },
    {
      id: 'memory',
      name: 'Tiwlo Memory-Optimized Droplet',
      type: 'High-Throughput In-Memory Workloads',
      tag: 'Real-Time Caching',
      specs: '8 – 64 vCPU · 32 – 256 GB RAM · High-IOPS Storage',
      bandwidth: 'Up to 10 Gbps Private VPC Networking',
      locations: 'Frankfurt, Tokyo, Mumbai, Toronto, Sydney',
      description: 'Engineered for high-volume inventory ledgers, fast Redis caching, and instantaneous order processing under heavy flash sales.'
    },
    {
      id: 'enterprise',
      name: 'Tiwlo Isolated Enterprise Cluster',
      type: 'Dedicated Hardware Isolation & Multi-Node VPC',
      tag: 'Mission-Critical Scale',
      specs: 'Dedicated Bare-Metal Nodes · Custom RAM/Storage Ratios',
      bandwidth: 'Dedicated Multi-Region Virtual Private Cloud',
      locations: 'Global Availability across 20+ Data Center Zones',
      description: 'Maximum security and performance with physical data partitioning, custom firewall governance, and strict compliance isolation.'
    }
  ];

  const currentTier = tiers.find(t => t.id === selectedTier) || tiers[0];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block - Borderless, Google Cloud Typographic Style */}
        <div className="max-w-3xl mx-auto text-center mb-14 space-y-3">
          <span className="text-[12px] font-semibold tracking-wider text-[#0b57d0] uppercase">
            TIWLO CLOUD INFRASTRUCTURE
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-normal tracking-[-0.02em] text-[#1f1f1f] leading-tight">
            High-availability virtual compute, provisioned in seconds
          </h2>
          <p className="text-[16px] sm:text-[18px] text-[#5f6368] font-normal leading-relaxed">
            Run your online storefronts, API workloads, and real-time registers on Tiwlo’s carrier-grade virtual compute fabric. Zero setup fees and predictable pricing.
          </p>
        </div>

        {/* Cloud Tier Selection Tabs (Google Style Pill Switcher) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {tiers.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTier(t.id)}
              className={`px-5 py-2.5 rounded-full text-[14px] font-medium transition-all cursor-pointer ${
                selectedTier === t.id
                  ? 'bg-[#0b57d0] text-white shadow-xs'
                  : 'bg-[#f1f3f4] text-[#444746] hover:bg-[#e8eaed] hover:text-[#1f1f1f]'
              }`}
            >
              <span>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Selected Tier Showcase Surface (Soft Elevation, No Harsh Gray Borders) */}
        <div className="max-w-4xl mx-auto rounded-[24px] bg-[#f8f9fa] p-6 sm:p-10 shadow-[0_4px_24px_rgba(60,64,67,0.06)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#e0e2ec]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-[14px] bg-[#0b57d0] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[20px] font-medium text-[#1f1f1f]">
                  {currentTier.name}
                </h3>
                <span className="text-[13px] text-[#5f6368]">
                  {currentTier.type}
                </span>
              </div>
            </div>
            <span className="px-3.5 py-1 rounded-full text-[12px] font-medium bg-[#e6f4ea] text-[#137333]">
              {currentTier.tag}
            </span>
          </div>

          <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
            <div className="space-y-4">
              <div>
                <span className="text-[12px] font-medium text-[#747775] uppercase block">Hardware & Storage Specifications</span>
                <span className="text-[15px] font-medium text-[#1f1f1f]">{currentTier.specs}</span>
              </div>
              <div>
                <span className="text-[12px] font-medium text-[#747775] uppercase block">Global Data Center Availability</span>
                <span className="text-[14px] text-[#444746]">{currentTier.locations}</span>
              </div>
              <div>
                <span className="text-[12px] font-medium text-[#747775] uppercase block">Networking Throughput</span>
                <span className="text-[14px] text-[#444746]">{currentTier.bandwidth}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[12px] font-medium text-[#747775] uppercase block">Workload Performance Overview</span>
                <p className="text-[14px] text-[#444746] leading-relaxed">
                  {currentTier.description}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-[#137333] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0" />
                <span>Automated daily backups & live TLS 1.3 encryption</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#e0e2ec] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 text-xs text-[#5f6368]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#137333]" /> 99.99% Uptime SLA
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0b57d0]" /> Instant Cloud Deployment
              </span>
            </div>

            <button
              onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
              className="px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>Deploy Tiwlo Droplet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
