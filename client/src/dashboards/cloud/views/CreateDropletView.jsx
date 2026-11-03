import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Zap,
} from 'lucide-react';

const REGIONS = [
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flag: '🇩🇪', code: 'FRA1' },
  { id: 'nyc1', name: 'New York', country: 'United States', flag: '🇺🇸', code: 'NYC1' },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', code: 'SGP1' },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flag: '🇬🇧', code: 'LON1' },
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', code: 'DHK1' },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', code: 'TYO1' },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flag: '🇨🇦', code: 'TOR1' }
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
  { id: 'standard-basic', name: 'Basic Standard', category: 'Standard', vcpus: 1, memory: '1 GB', storage: '25 GB NVMe', bandwidth: '1 TB Transfer', monthlyPrice: 6, hourlyPrice: 0.009 },
  { id: 'standard-pro', name: 'Standard Pro', category: 'Standard', vcpus: 2, memory: '4 GB', storage: '80 GB NVMe', bandwidth: '3 TB Transfer', monthlyPrice: 18, hourlyPrice: 0.027, popular: true },
  { id: 'general-purpose', name: 'General Purpose', category: 'Performance', vcpus: 4, memory: '8 GB', storage: '160 GB NVMe', bandwidth: '5 TB Transfer', monthlyPrice: 36, hourlyPrice: 0.054 },
  { id: 'cpu-optimized', name: 'CPU Optimized', category: 'Performance', vcpus: 8, memory: '16 GB', storage: '320 GB NVMe', bandwidth: '7 TB Transfer', monthlyPrice: 72, hourlyPrice: 0.107 },
  { id: 'memory-optimized', name: 'High Memory', category: 'Enterprise', vcpus: 16, memory: '32 GB', storage: '640 GB NVMe', bandwidth: '10 TB Transfer', monthlyPrice: 144, hourlyPrice: 0.214 }
];

function Choice({ title, sub, active, onClick, badge }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex min-w-0 flex-col items-start gap-1 rounded-2xl p-4 text-left ring-1 transition ${
        active
          ? 'bg-black text-white ring-black'
          : 'bg-white text-neutral-950 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800 dark:hover:bg-neutral-800'
      }`}
    >
      {active && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#1ed760] text-black">
          <Check className="size-3" aria-hidden="true" />
        </span>
      )}
      {badge && (
        <span className={`mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          active ? 'bg-white/10 text-[#1ed760]' : 'bg-[#1ed760]/15 text-[#0f7a37]'
        }`}>
          {badge}
        </span>
      )}
      <span className="pr-6 text-sm font-bold">{title}</span>
      {sub && <span className={`text-xs ${active ? 'text-white/60' : 'text-neutral-500 dark:text-neutral-400'}`}>{sub}</span>}
    </button>
  );
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-3xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 sm:p-6 ${className}`}>
      {title && <h2 className="mb-5 text-lg font-bold tracking-tight text-neutral-950 dark:text-white">{title}</h2>}
      {children}
    </section>
  );
}

export default function CreateDropletView({ onBack, initialImage = 'Ubuntu 24.04 LTS' }) {
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [selectedImage, setSelectedImage] = useState(() => (
    OS_IMAGES.find((image) => image.name === initialImage || image.id === initialImage) || OS_IMAGES[0]
  ));
  const [activeImageTab, setActiveImageTab] = useState('os');
  const [selectedTier, setSelectedTier] = useState(DROPLET_TIERS[1]);
  const [hostname, setHostname] = useState(() => `tiwlo-${REGIONS[0].code.toLowerCase()}-${Math.floor(100 + Math.random() * 900)}`);
  const [tags, setTags] = useState('production, web');
  const [enableBackups, setEnableBackups] = useState(true);
  const [enableIpv6, setEnableIpv6] = useState(true);
  const [enableMonitoring, setEnableMonitoring] = useState(true);

  const totalMonthly = selectedTier.monthlyPrice + (enableBackups ? 3 : 0);

  const selectRegion = (region) => {
    setSelectedRegion(region);
    setHostname((previous) => {
      const suffix = previous.split('-').at(-1);
      return `tiwlo-${region.code.toLowerCase()}-${suffix || Math.floor(100 + Math.random() * 900)}`;
    });
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Infrastructure</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">Create Droplet</h1>
            <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
              Pick an image, region and hardware plan, then name your server.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-neutral-100 px-5 text-sm font-bold text-neutral-900 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            My Droplets
          </button>
        </div>
      </header>

      <div role="status" className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        Cloud provisioning is not connected yet. Configuration is available to review, but this page cannot create a server.
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="1. Choose an image">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Select an operating system or preconfigured stack.</p>
              <div className="flex rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
                {[
                  { id: 'os', label: 'OS Distributions' },
                  { id: 'app', label: '1-Click Applications' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveImageTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeImageTab === tab.id
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {OS_IMAGES.filter((image) => image.type === activeImageTab).map((image) => (
                <Choice
                  key={image.id}
                  title={image.name}
                  sub={image.version}
                  badge={image.badge}
                  active={selectedImage.id === image.id}
                  onClick={() => setSelectedImage(image)}
                />
              ))}
            </div>
          </Panel>

          <Panel title="2. Choose a region">
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Choose where this droplet will be hosted.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {REGIONS.slice(0, 5).map((region) => (
                <Choice
                  key={region.id}
                  title={`${region.flag} ${region.name}`}
                  sub={region.code}
                  active={selectedRegion.id === region.id}
                  onClick={() => selectRegion(region)}
                />
              ))}
            </div>
            {REGIONS.length > 5 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {REGIONS.slice(5).map((region) => (
                  <Choice
                    key={region.id}
                    title={`${region.flag} ${region.name}`}
                    sub={region.code}
                    active={selectedRegion.id === region.id}
                    onClick={() => selectRegion(region)}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="3. Hardware plan">
            <div className="grid gap-3 sm:grid-cols-2">
              {DROPLET_TIERS.map((tier) => (
                <Choice
                  key={tier.id}
                  title={tier.name}
                  sub={`${tier.vcpus} vCPU · ${tier.memory} · ${tier.storage} · $${tier.monthlyPrice}/mo`}
                  badge={tier.popular ? 'Popular' : undefined}
                  active={selectedTier.id === tier.id}
                  onClick={() => setSelectedTier(tier)}
                />
              ))}
            </div>
          </Panel>

          <Panel title="4. Resource details">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="droplet-hostname">
                Hostname
                <input
                  id="droplet-hostname"
                  type="text"
                  value={hostname}
                  onChange={(event) => setHostname(event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl bg-neutral-100 px-3 text-sm font-normal text-neutral-950 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-950"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="droplet-tags">
                Tags
                <input
                  id="droplet-tags"
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="production, web"
                  className="mt-2 h-10 w-full rounded-xl bg-neutral-100 px-3 text-sm font-normal text-neutral-950 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-950"
                />
              </label>
            </div>
            <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
              <label className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Enable automated backups</span>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">Weekly backups, retained for 4 weeks</span>
                </span>
                <input type="checkbox" checked={enableBackups} onChange={(event) => setEnableBackups(event.target.checked)} className="size-4 accent-[#1ed760]" />
              </label>
              <label className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Enable IPv6</span>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">Dual-stack public routing</span>
                </span>
                <input type="checkbox" checked={enableIpv6} onChange={(event) => setEnableIpv6(event.target.checked)} className="size-4 accent-[#1ed760]" />
              </label>
              <label className="flex items-center justify-between gap-4 py-4">
                <span>
                  <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Enable monitoring</span>
                  <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">Collect CPU, memory and disk metrics</span>
                </span>
                <input type="checkbox" checked={enableMonitoring} onChange={(event) => setEnableMonitoring(event.target.checked)} className="size-4 accent-[#1ed760]" />
              </label>
            </div>
          </Panel>
        </div>

        <Panel title="Summary" className="h-fit lg:sticky lg:top-24">
          <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {[
              ['Image', selectedImage.name],
              ['Region', `${selectedRegion.flag} ${selectedRegion.name}`],
              ['Plan', selectedTier.name],
              ['CPU', `${selectedTier.vcpus} vCPU`],
              ['Memory', selectedTier.memory],
              ['Storage', selectedTier.storage],
              ['Backups', enableBackups ? '+$3.00/mo' : 'Off'],
              ['IPv6', enableIpv6 ? 'Enabled' : 'Off'],
              ['Monitoring', enableMonitoring ? 'Enabled' : 'Off'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                <dd className="text-right font-semibold text-neutral-950 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Illustrative monthly estimate</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              ${totalMonthly}<span className="ml-1 text-sm font-medium text-neutral-500">/mo</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              ~${(totalMonthly / 720).toFixed(3)}/hr
            </p>
          </div>
          <button
            type="button"
            disabled
            className="mt-6 inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-neutral-300 px-5 text-sm font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
          >
            <Zap className="size-4" aria-hidden="true" />
            Provisioning unavailable
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            No server is created and no cloud-provider charge is initiated from this page.
          </p>
        </Panel>
      </div>
    </div>
  );
}
