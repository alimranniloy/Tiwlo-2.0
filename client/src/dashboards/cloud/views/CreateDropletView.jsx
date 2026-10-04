import React, { useState } from 'react';
import {
  ArrowLeft,
  Server,
  Cpu,
  HardDrive,
  Globe,
  Shield,
  Key,
  Lock,
  Check,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Zap,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

const REGIONS = [
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flag: '🇩🇪', ping: '24ms', code: 'FRA1' },
  { id: 'nyc1', name: 'New York', country: 'United States', flag: '🇺🇸', ping: '86ms', code: 'NYC1' },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', ping: '42ms', code: 'SGP1' },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flag: '🇬🇧', ping: '31ms', code: 'LON1' },
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', ping: '8ms', code: 'DHK1' },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', ping: '68ms', code: 'TYO1' },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flag: '🇨🇦', ping: '92ms', code: 'TOR1' }
];

const OS_IMAGES = [
  { id: 'ubuntu-24', name: 'Ubuntu 24.04 LTS', os: 'Ubuntu', version: '24.04 Noble Numbat', type: 'os', badge: 'Recommended' },
  { id: 'ubuntu-22', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', version: '22.04 Jammy Jellyfish', type: 'os' },
  { id: 'debian-12', name: 'Debian 12', os: 'Debian', version: 'Bookworm Stable', type: 'os' },
  { id: 'almalinux-9', name: 'AlmaLinux 9', os: 'AlmaLinux', version: 'RHEL 9 Binary Compatible', type: 'os' },
  { id: 'fedora-40', name: 'Fedora 40', os: 'Fedora', version: 'Cloud Base Edition', type: 'os' },
  { id: 'app-tpanel', name: 'TPanel 1.0 Web Host', os: 'TPanel', version: 'Node.js + MySQL + PHP + Nginx', type: 'app', badge: '1-Click App' },
  { id: 'app-docker', name: 'Docker on Ubuntu', os: 'Docker', version: 'Docker CE + Compose Ready', type: 'app', badge: '1-Click App' },
  { id: 'app-lemp', name: 'LEMP High-Performance', os: 'LEMP', version: 'Nginx + MySQL 8 + PHP 8.3', type: 'app', badge: '1-Click App' }
];

const DROPLET_TIERS = [
  {
    id: 'standard-basic',
    name: 'Basic Standard',
    category: 'Standard',
    vcpus: 1,
    memory: '1 GB',
    storage: '25 GB NVMe',
    bandwidth: '1 TB Transfer',
    monthlyPrice: 6,
    hourlyPrice: 0.009
  },
  {
    id: 'standard-pro',
    name: 'Standard Pro',
    category: 'Standard',
    vcpus: 2,
    memory: '4 GB',
    storage: '80 GB NVMe',
    bandwidth: '3 TB Transfer',
    monthlyPrice: 18,
    hourlyPrice: 0.027,
    popular: true
  },
  {
    id: 'general-purpose',
    name: 'General Purpose',
    category: 'Performance',
    vcpus: 4,
    memory: '8 GB',
    storage: '160 GB NVMe',
    bandwidth: '5 TB Transfer',
    monthlyPrice: 36,
    hourlyPrice: 0.054
  },
  {
    id: 'cpu-optimized',
    name: 'CPU Optimized',
    category: 'Performance',
    vcpus: 8,
    memory: '16 GB',
    storage: '320 GB NVMe',
    bandwidth: '7 TB Transfer',
    monthlyPrice: 72,
    hourlyPrice: 0.107
  },
  {
    id: 'memory-optimized',
    name: 'High Memory',
    category: 'Enterprise',
    vcpus: 16,
    memory: '32 GB',
    storage: '640 GB NVMe',
    bandwidth: '10 TB Transfer',
    monthlyPrice: 144,
    hourlyPrice: 0.214
  }
];

export default function CreateDropletView({ onBack, onCreateDroplet, initialImage = 'Ubuntu 24.04 LTS' }) {
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [selectedImage, setSelectedImage] = useState(() => {
    const found = OS_IMAGES.find(img => img.name === initialImage || img.id === initialImage);
    return found || OS_IMAGES[0];
  });
  const [activeImageTab, setActiveImageTab] = useState('os'); // 'os' | 'app'
  const [selectedTier, setSelectedTier] = useState(DROPLET_TIERS[1]); // Standard Pro
  const [authMethod, setAuthMethod] = useState('password'); // 'password' | 'ssh'
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [hostname, setHostname] = useState(() => `tiwlo-${selectedRegion.code.toLowerCase()}-${Math.floor(100 + Math.random() * 900)}`);
  const [tags, setTags] = useState('production, web');
  const [enableBackups, setEnableBackups] = useState(true);
  const [enableIpv6, setEnableIpv6] = useState(true);
  const [enableMonitoring, setEnableMonitoring] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const calculateTotalMonthly = () => {
    let total = selectedTier.monthlyPrice;
    if (enableBackups) total += 3;
    return total;
  };

  const handleRegionChange = (reg) => {
    setSelectedRegion(reg);
    setHostname(prev => {
      const parts = prev.split('-');
      if (parts.length >= 2) {
        return `tiwlo-${reg.code.toLowerCase()}-${parts[parts.length - 1]}`;
      }
      return `tiwlo-${reg.code.toLowerCase()}-${Math.floor(100 + Math.random() * 900)}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!hostname.trim()) {
      setErrorMsg('Please enter a valid droplet hostname.');
      return;
    }

    if (authMethod === 'password') {
      if (!password || password.length < 8) {
        setErrorMsg('Root password must be at least 8 characters long.');
        return;
      }
    } else {
      if (!sshKey.trim()) {
        setErrorMsg('Please paste a valid public SSH key.');
        return;
      }
    }

    try {
      setSubmitting(true);
      await onCreateDroplet({
        name: hostname.trim(),
        region: `${selectedRegion.name} (${selectedRegion.code})`,
        regionCode: selectedRegion.code,
        regionFlag: selectedRegion.flag,
        image: selectedImage.name,
        vcpus: selectedTier.vcpus,
        memory: selectedTier.memory,
        storage: selectedTier.storage,
        monthlyPrice: calculateTotalMonthly(),
        enableBackups,
        enableIpv6,
        enableMonitoring,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      });
      onBack?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to provision droplet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-16 space-y-8 animate-in fade-in duration-200">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800 transition shadow-xs cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Droplets</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Cloud Infrastructure</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-blue-600 dark:text-blue-400">Create Droplet</span>
        </div>
      </div>

      {/* Main Title Banner (Google-Style) */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create New Cloud Droplet
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Deploy high-performance NVMe virtual machines with global low-latency data centers and 1-click stacks.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2-Column Responsive Layout: Wizard Steps on Left (8 cols) & Pricing Summary on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Sections */}
        <div className="lg:col-span-8 space-y-8">
          {/* STEP 1: Choose Datacenter Region */}
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Choose Datacenter Region
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Selected: <strong className="text-slate-800 dark:text-slate-200">{selectedRegion.name} ({selectedRegion.code})</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {REGIONS.map(reg => {
                const isSelected = selectedRegion.id === reg.id;
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleRegionChange(reg)}
                    className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 shadow-xs'
                        : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-white dark:bg-[#111827]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{reg.flag}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                        {reg.ping}
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {reg.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {reg.code}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 2: Choose an Image */}
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Choose Operating System / Stack
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-gray-800/80 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setActiveImageTab('os')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeImageTab === 'os'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  OS Distributions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageTab('app')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeImageTab === 'app'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  1-Click Applications
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OS_IMAGES.filter(img => img.type === activeImageTab).map(img => {
                const isSelected = selectedImage.id === img.id;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`p-4 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 shadow-xs'
                        : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-white dark:bg-[#111827]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {img.name}
                        </span>
                        {img.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {img.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {img.version}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 3: Choose Size & Plan */}
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Choose Hardware & Plan
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                100% NVMe SSD Storage Included
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {DROPLET_TIERS.map(tier => {
                const isSelected = selectedTier.id === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer relative ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 shadow-xs'
                        : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700 bg-white dark:bg-[#111827]'
                    }`}
                  >
                    {tier.popular && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                        Popular
                      </span>
                    )}

                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                        {tier.name}
                      </div>
                      <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        ${tier.monthlyPrice}<span className="text-xs font-normal text-slate-500">/mo</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mb-3">
                        ${tier.hourlyPrice}/hr
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-gray-800">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.vcpus} vCPU Core{tier.vcpus > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.memory} RAM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.storage}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tier.bandwidth}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 4: Authentication Method */}
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Authentication & Server Security
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  authMethod === 'password'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 bg-white dark:bg-[#111827]'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">Root Password</div>
                  <div className="text-[11px] text-slate-500">Quick sign-in via password</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAuthMethod('ssh')}
                className={`p-4 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  authMethod === 'ssh'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-gray-800 hover:border-slate-300 bg-white dark:bg-[#111827]'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">SSH Key (Recommended)</div>
                  <div className="text-[11px] text-slate-500">Industry-standard cryptographic key</div>
                </div>
              </button>
            </div>

            {authMethod === 'password' ? (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Set Root Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password (minimum 8 characters)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
                <p className="text-[11px] text-slate-400">
                  Password must contain at least 8 characters, one number, and one uppercase letter.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Paste SSH Public Key
                </label>
                <textarea
                  rows={3}
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  placeholder="ssh-rsa AAAAB3NzaC1yc2EAA..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            )}
          </section>

          {/* STEP 5: Add-ons & Hostname */}
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                5
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Finalize & Additional Options
              </h2>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enableBackups}
                    onChange={(e) => setEnableBackups(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Enable Automated Weekly Backups</div>
                    <div className="text-[11px] text-slate-500">20% of droplet price, retained for 4 weeks</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">+$3.00/mo</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enableIpv6}
                    onChange={(e) => setEnableIpv6(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Enable IPv6 Address</div>
                    <div className="text-[11px] text-slate-500">Next-generation dual-stack public routing</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-gray-800/40 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enableMonitoring}
                    onChange={(e) => setEnableMonitoring(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Tiwlo Health & CPU Monitoring Agent</div>
                    <div className="text-[11px] text-slate-500">Real-time alerts, memory metrics & automated diagnostics</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Free</span>
              </label>
            </div>

            {/* Hostname & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Droplet Hostname
                </label>
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="e.g. ubuntu-s-2vcpu-4gb-fra1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="production, web, api"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Google-Style Order Summary */}
        <div className="lg:col-span-4 sticky top-6 space-y-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Droplet Summary</span>
            </h3>

            <div className="space-y-3 text-xs border-b border-slate-100 dark:border-gray-800 pb-4">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Region</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{selectedRegion.flag}</span>
                  <span>{selectedRegion.name}</span>
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Operating System</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedImage.name}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Configuration</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedTier.vcpus} vCPU • {selectedTier.memory} RAM
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>NVMe Storage</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedTier.storage}</span>
              </div>

              {enableBackups && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Automated Backups</span>
                  <span className="font-semibold text-slate-900 dark:text-white">$3.00/mo</span>
                </div>
              )}
            </div>

            {/* Total Price */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Total Monthly Cost</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  ${calculateTotalMonthly()}
                </span>
                <span className="text-xs font-semibold text-slate-500">/ month</span>
                <span className="text-[11px] text-slate-400 ml-auto">
                  ~${((calculateTotalMonthly() / 720)).toFixed(3)}/hr
                </span>
              </div>
            </div>

            {/* Deploy Action Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Provisioning Droplet...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Create & Launch Droplet</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
              Zero upfront commitment. Destroy droplet anytime to stop billing immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
