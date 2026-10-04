import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
  Search,
  CheckCircle2,
  Sparkles,
  Server,
  Terminal,
  UploadCloud,
  FileCode,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';

const CATALOG = [
  {
    category: 'Featured OS',
    items: [
      { id: 'ubuntu-24', name: 'Ubuntu 24.04 LTS', os: 'Ubuntu', desc: 'Canonical LTS release with modern kernel and cloud-init.', version: 'Noble Numbat', badge: 'Recommended', logo: '🐧' },
      { id: 'ubuntu-22', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', desc: 'Industry-standard stable LTS for node and docker microservices.', version: 'Jammy Jellyfish', logo: '🐧' },
      { id: 'debian-12', name: 'Debian 12', os: 'Debian', desc: 'Known for rock-solid stability and zero bloatware.', version: 'Bookworm Stable', logo: '🌀' },
      { id: 'almalinux-9', name: 'AlmaLinux 9', os: 'AlmaLinux', desc: '1:1 binary compatible alternative to Red Hat Enterprise Linux.', version: 'RHEL 9 Compatible', logo: '💼' },
      { id: 'fedora-40', name: 'Fedora 40', os: 'Fedora', desc: 'Bleeding-edge upstream development packages and tooling.', version: 'Cloud Base Edition', logo: '⚡' }
    ]
  },
  {
    category: '1-Click Application Stacks',
    items: [
      { id: 'app-tpanel', name: 'TPanel 1.0 Control Panel', os: 'TPanel', desc: 'Tiwlo automated web hosting panel with MySQL, Node.js & PHP.', version: 'Production Host Ready', badge: '1-Click Panel', logo: '🚀' },
      { id: 'app-docker', name: 'Docker on Ubuntu', os: 'Docker', desc: 'Pre-configured Docker Engine with Docker Compose and TLS ready.', version: 'Docker 27.x CE', badge: 'Container Ready', logo: '🐳' },
      { id: 'app-lemp', name: 'LEMP High-Performance', os: 'LEMP', desc: 'Nginx web server, MySQL 8 database, PHP 8.3-FPM stack.', version: 'Enterprise Web Stack', badge: 'High Traffic', logo: '⚡' },
      { id: 'app-nodejs', name: 'Node.js & PM2 Stack', os: 'NodeJS', desc: 'Full Node LTS runtime, PM2 process supervisor, and Git hooks.', version: 'Node.js 22 LTS', badge: 'Backend Ready', logo: '🟢' }
    ]
  }
];

export default function ImagesView({ onDeployImage, onBack }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'os' | 'apps' | 'custom'

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Image Library & Distribution Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Cloud Images & 1-Click Stacks
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Choose curated Linux distributions, pre-configured database environments, or deploy directly with 1-click installation.
          </p>
        </div>

        {/* Search */}
        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search OS images..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Catalog Grid */}
      {CATALOG.map((cat, idx) => {
        const filteredItems = cat.items.filter(item =>
          !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.desc.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (filteredItems.length === 0) return null;

        return (
          <div key={idx} className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              {cat.category}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)] hover:border-blue-500/50 dark:hover:border-blue-500/50 transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-100 dark:border-gray-700/60 flex items-center justify-center text-xl shrink-0">
                        {item.logo}
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {item.name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5 mb-2">
                      {item.version}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-gray-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">NVMe Optimized</span>
                    <button
                      type="button"
                      onClick={() => onDeployImage?.(item.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <span>Deploy Droplet</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
