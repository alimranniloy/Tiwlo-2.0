import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Server,
  Shield,
  Layers,
  Store,
  ChevronRight,
  X
} from 'lucide-react';

export default function GuidesView({ onBack }) {
  const [selectedGuide, setSelectedGuide] = useState(null);

  const guides = [
    {
      id: 'g1',
      title: 'How to Provision & Configure an Ubuntu 22.04 LTS Droplet in 60s',
      subtitle: 'Complete walkthrough on launching compute resources with NVMe storage and firewall rules.',
      category: 'Cloud Infrastructure',
      difficulty: 'Beginner',
      readTime: '3 min read',
      icon: Server,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      steps: [
        {
          num: 1,
          title: 'Open the Cloud Dashboard',
          desc: 'Log in to your Tiwlo account and head to the Main Control Center. Click the "+ Create Droplet" button at the top right or inside the Droplets table.'
        },
        {
          num: 2,
          title: 'Select Operating System & CPU Tier',
          desc: 'Select Ubuntu 22.04 LTS (recommended for Node.js, Python, and Docker). Choose your memory configuration starting from 1 vCPU / 2GB RAM up to 32 vCPU clusters.'
        },
        {
          num: 3,
          title: 'Assign Data Center Region',
          desc: 'Choose the closest geographic region (e.g. Frankfurt, New York, Singapore) to ensure under 35ms latency for your customer base.'
        },
        {
          num: 4,
          title: 'Instant Initialization',
          desc: 'Click "Provision Droplet". In less than 15 seconds, your droplet will be allocated a static IPv4 address and automated monitoring hooks.'
        }
      ]
    },
    {
      id: 'g2',
      title: 'Configuring Multi-Tenant Store Databases with Zero Cross-Leakage',
      subtitle: 'Architectural breakdown of how Tiwlo partitions data schemas for multiple stores per account.',
      category: 'Database Architecture',
      difficulty: 'Intermediate',
      readTime: '4 min read',
      icon: Layers,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      steps: [
        {
          num: 1,
          title: 'Tenant Identification Token',
          desc: 'Each store is assigned a unique immutable identifier (TIW-XXXXX) upon creation that tags every item, order, invoice, and customer record.'
        },
        {
          num: 2,
          title: 'Row-Level Security Enforcement',
          desc: 'All GraphQL and REST handlers filter query execution by matching authenticated user context and active store token.'
        },
        {
          num: 3,
          title: 'Switching Active Stores',
          desc: 'From the "My Online Store" menu, switch seamlessly between multiple business branches without logging out or mixing inventory ledgers.'
        }
      ]
    },
    {
      id: 'g3',
      title: 'Setting Up Custom Domains with Free Automated Wildcard SSL',
      subtitle: 'Map your company domain (e.g. store.mybrand.com) with automatic HTTPS encryption.',
      category: 'Domains & Networking',
      difficulty: 'Beginner',
      readTime: '3 min read',
      icon: Shield,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      steps: [
        {
          num: 1,
          title: 'Access Store Settings',
          desc: 'Navigate to "Store Settings" in your store dashboard and enter your domain name in the Custom Domain field.'
        },
        {
          num: 2,
          title: 'Add DNS CNAME or A Record',
          desc: 'In your domain registrar (GoDaddy, Cloudflare, Namecheap), add an A record pointing your custom domain to your VPS IP.'
        },
        {
          num: 3,
          title: 'Automated SSL Provisioning',
          desc: 'Tiwlo verifies DNS propagation within 60 seconds and automatically generates a Let\'s Encrypt certificate with auto-renewal.'
        }
      ]
    },
    {
      id: 'g4',
      title: 'Connecting USB & Bluetooth Barcode Hardware to Tiwlo POS',
      subtitle: 'Set up physical retail hardware for high-speed barcode checkout and label generation.',
      category: 'Retail & POS',
      difficulty: 'Intermediate',
      readTime: '5 min read',
      icon: Store,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      steps: [
        {
          num: 1,
          title: 'Hardware Connection',
          desc: 'Plug any USB barcode scanner gun or pair your Bluetooth wireless scanner to your device. No additional drivers are required.'
        },
        {
          num: 2,
          title: 'Live Scanner Mode',
          desc: 'Navigate to "POS System" in the sidebar. Scan any item SKU or barcode tag—the system will play an audio chime and immediately increment cart quantities.'
        },
        {
          num: 3,
          title: 'Printing Barcode Sheets',
          desc: 'Use the Barcode Studio to print bulk label stickers with Code128 format compatible with thermal receipt printers.'
        }
      ]
    }
  ];

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Navigation Bar (Full Width) */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200/80 dark:border-gray-700 shadow-2xs cursor-pointer group"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Guides
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Step-by-step guides for common tasks
          </p>
        </div>
      </div>

      {/* Guides Grid (Full Width) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <div
              key={guide.id}
              onClick={() => setSelectedGuide(guide)}
              className="p-6 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${guide.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300">
                      {guide.difficulty}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {guide.readTime}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {guide.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pt-0.5">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {guide.subtitle}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 mt-4">
                <span>Read Step-by-Step Guide</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Guide Detail Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#161f30] rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-2xl w-full border border-slate-100 dark:border-gray-800 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selectedGuide.category} &bull; {selectedGuide.readTime}
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {selectedGuide.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedGuide(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {selectedGuide.subtitle}
            </p>

            {/* Steps */}
            <div className="space-y-4 pt-2">
              {selectedGuide.steps.map((s) => (
                <div key={s.num} className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {s.num}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {s.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pl-7 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
