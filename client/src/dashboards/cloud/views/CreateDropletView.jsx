import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const DEFAULT_REGIONS = [
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', code: 'DHK1', available: true },
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flag: '🇩🇪', code: 'FRA1', available: false },
  { id: 'nyc1', name: 'New York', country: 'United States', flag: '🇺🇸', code: 'NYC1', available: false },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', code: 'SGP1', available: false },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flag: '🇬🇧', code: 'LON1', available: false },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', code: 'TYO1', available: false },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flag: '🇨🇦', code: 'TOR1', available: false }
];

const DEFAULT_IMAGES = [
  {
    id: 'ubuntu-24',
    name: 'Ubuntu 24.04 LTS',
    os: 'Ubuntu',
    version: '24.04 LTS · Shared Runtime Linked',
    type: 'os',
    badge: 'Connected',
    runtimeImage: 'tiwlo-ubuntu-shared-runtime:24.04',
    available: true
  },
  { id: 'ubuntu-22', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', version: '22.04 Jammy Jellyfish', type: 'os', available: false },
  { id: 'debian-12', name: 'Debian 12', os: 'Debian', version: 'Bookworm Stable', type: 'os', available: false },
  { id: 'almalinux-9', name: 'AlmaLinux 9', os: 'AlmaLinux', version: 'RHEL 9 Binary Compatible', type: 'os', available: false },
  { id: 'fedora-40', name: 'Fedora 40', os: 'Fedora', version: 'Cloud Base Edition', type: 'os', available: false },
  { id: 'app-docker', name: 'Docker on Ubuntu', os: 'Docker', version: 'Docker CE + Compose Ready', type: 'app', available: false },
  { id: 'app-lemp', name: 'LEMP High-Performance', os: 'LEMP', version: 'Nginx + PostgreSQL + PHP 8.3', type: 'app', available: false },
  { id: 'app-tpanel', name: 'TPanel 1.0 Web Host', os: 'TPanel', version: 'Deprecated / Disabled', type: 'app', available: false }
];

const DROPLET_TIERS = [
  { id: 'standard-basic', name: 'Basic Standard', category: 'Standard', vcpus: 1, memory: '1 GB', storage: '25 GB NVMe', bandwidth: '1 TB Transfer', monthlyPrice: 6, hourlyPrice: 0.009 },
  { id: 'standard-pro', name: 'Standard Pro', category: 'Standard', vcpus: 2, memory: '4 GB', storage: '80 GB NVMe', bandwidth: '3 TB Transfer', monthlyPrice: 18, hourlyPrice: 0.027, popular: true },
  { id: 'general-purpose', name: 'General Purpose', category: 'Performance', vcpus: 4, memory: '8 GB', storage: '160 GB NVMe', bandwidth: '5 TB Transfer', monthlyPrice: 36, hourlyPrice: 0.054 },
  { id: 'cpu-optimized', name: 'CPU Optimized', category: 'Performance', vcpus: 8, memory: '16 GB', storage: '320 GB NVMe', bandwidth: '7 TB Transfer', monthlyPrice: 72, hourlyPrice: 0.107 },
  { id: 'memory-optimized', name: 'High Memory', category: 'Enterprise', vcpus: 16, memory: '32 GB', storage: '640 GB NVMe', bandwidth: '10 TB Transfer', monthlyPrice: 144, hourlyPrice: 0.214 }
];

function generateStrongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function Choice({ title, sub, active, disabled = false, onClick, badge }) {
  const resolvedBadge = disabled ? 'Unavailable' : badge;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      aria-pressed={active && !disabled}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
      className={`relative flex min-w-0 flex-col items-start gap-1 rounded-2xl p-4 text-left ring-1 transition ${
        disabled
          ? 'cursor-not-allowed bg-neutral-100/70 text-neutral-400 ring-neutral-200/70 opacity-65 dark:bg-neutral-900/40 dark:text-neutral-500 dark:ring-neutral-800/70'
          : active
            ? 'bg-black text-white ring-black dark:bg-neutral-950 dark:ring-[#1ed760]'
            : 'bg-white text-neutral-950 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800 dark:hover:bg-neutral-800'
      }`}
    >
      {active && !disabled && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#1ed760] text-black">
          <Check className="size-3" aria-hidden="true" />
        </span>
      )}
      {resolvedBadge && (
        <span
          className={`mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            disabled
              ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              : active
                ? 'bg-white/10 text-[#1ed760]'
                : 'bg-[#1ed760]/15 text-[#0f7a37] dark:text-[#1ed760]'
          }`}
        >
          {resolvedBadge}
        </span>
      )}
      <span className="pr-6 text-sm font-bold">{title}</span>
      {sub && (
        <span
          className={`text-xs ${
            disabled
              ? 'text-neutral-400 dark:text-neutral-500'
              : active
                ? 'text-white/65'
                : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {sub}
        </span>
      )}
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

export default function CreateDropletView({
  onBack,
  onDropletCreated,
  showToast,
  initialImage = 'Ubuntu 24.04 LTS'
}) {
  const [regions, setRegions] = useState(DEFAULT_REGIONS);
  const [images, setImages] = useState(DEFAULT_IMAGES);
  const [connectedServer, setConnectedServer] = useState({
    nodeId: 'primary-ubuntu-node',
    regionCode: 'DHK1',
    regionName: 'Dhaka',
    sharedImage: 'tiwlo-ubuntu-shared-runtime:24.04'
  });

  const [selectedRegion, setSelectedRegion] = useState(() => DEFAULT_REGIONS.find((r) => r.available) || DEFAULT_REGIONS[0]);
  const [selectedImage, setSelectedImage] = useState(() => (
    DEFAULT_IMAGES.find((img) => img.available && (img.name === initialImage || img.id === initialImage)) ||
    DEFAULT_IMAGES.find((img) => img.available) ||
    DEFAULT_IMAGES[0]
  ));
  const [activeImageTab, setActiveImageTab] = useState('os');
  const [selectedTier, setSelectedTier] = useState(DROPLET_TIERS[1]);
  const [hostname, setHostname] = useState(() => `tiwlo-dhk1-${Math.floor(100 + Math.random() * 900)}`);
  const [serverUsername, setServerUsername] = useState('tiwlo_user');
  const [serverPassword, setServerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tags, setTags] = useState('production, web');
  const [enableBackups, setEnableBackups] = useState(true);
  const [enableIpv6, setEnableIpv6] = useState(true);
  const [enableMonitoring, setEnableMonitoring] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
    fetch(`${API_BASE}/cloud/droplets/catalog`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success) return;
        if (Array.isArray(data.regions) && data.regions.length > 0) {
          setRegions(data.regions);
          setSelectedRegion((prev) => {
            const matching = data.regions.find((r) => r.id === prev.id && r.available);
            return matching || data.regions.find((r) => r.available) || data.regions[0];
          });
        }
        if (Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          setSelectedImage((prev) => {
            const matching = data.images.find((img) => img.id === prev.id && img.available);
            return matching || data.images.find((img) => img.available) || data.images[0];
          });
        }
        if (data.connectedServer) {
          setConnectedServer(data.connectedServer);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const totalMonthly = selectedTier.monthlyPrice + (enableBackups ? 3 : 0);
  const validHostname = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(hostname.trim().toLowerCase());
  const validUsername = /^[a-z_][a-z0-9_-]{2,31}$/.test(serverUsername.trim().toLowerCase());
  const validPassword = serverPassword.length >= 8;
  const canCreate = Boolean(
    selectedImage?.available &&
      selectedRegion?.available &&
      validHostname &&
      validUsername &&
      validPassword &&
      !submitting
  );

  const selectRegion = (region) => {
    if (!region.available) return;
    setSelectedRegion(region);
    setHostname((previous) => {
      const suffix = previous.split('-').at(-1);
      return `tiwlo-${region.code.toLowerCase()}-${suffix || Math.floor(100 + Math.random() * 900)}`;
    });
  };

  const handleCreateDroplet = async () => {
    setSubmitError('');
    if (!selectedImage?.available) {
      setSubmitError('Please select the available Ubuntu server image.');
      return;
    }
    if (!selectedRegion?.available) {
      setSubmitError('Please select an available region.');
      return;
    }
    if (!validHostname) {
      setSubmitError('Hostname must be 3–63 characters (lowercase letters, numbers, or hyphens).');
      return;
    }
    if (!validUsername) {
      setSubmitError('Server username must be 3–32 characters (lowercase letters, numbers, underscore, or hyphen).');
      return;
    }
    if (!validPassword) {
      setSubmitError('Server login password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
      const res = await fetch(`${API_BASE}/cloud/droplets`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          imageId: selectedImage.id,
          image: selectedImage.name,
          regionId: selectedRegion.id,
          regionCode: selectedRegion.code,
          region: selectedRegion.name,
          hostname: hostname.trim().toLowerCase(),
          username: serverUsername.trim().toLowerCase(),
          password: serverPassword,
          tags: tags.trim(),
          vcpus: selectedTier.vcpus,
          memory: selectedTier.memory,
          storage: selectedTier.storage,
          enableBackups,
          enableIpv6,
          enableMonitoring
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Provisioning failed (${res.status}).`);
      }
      showToast?.(`Droplet ${json.droplet?.name || hostname} provisioned with ${selectedImage.name}.`, 'success');
      onDropletCreated?.(json);
    } catch (err) {
      const message = err.message || 'Could not create droplet.';
      setSubmitError(message);
      showToast?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Infrastructure</p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">Create Droplet</h1>
            <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
              Select the connected server&apos;s Ubuntu image, available region, hardware plan, and server login credentials.
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

      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1ed760]/30 bg-[#1ed760]/10 px-4 py-3 text-sm text-neutral-800 dark:text-neutral-200"
      >
        <div className="flex items-center gap-2.5">
          <Server className="size-4 text-[#0f7a37] dark:text-[#1ed760] shrink-0" />
          <span>
            Connected Ubuntu Server Linked: <strong className="font-mono text-xs">{connectedServer.sharedImage}</strong> · Active Region:{' '}
            <strong>{connectedServer.regionName} ({connectedServer.regionCode})</strong>
          </span>
        </div>
        <span className="rounded-full bg-[#1ed760]/20 px-2.5 py-0.5 text-xs font-bold text-[#0f7a37] dark:text-[#1ed760]">
          Shared Runtime Ready
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="1. Choose an image">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Only images linked to your connected server are selectable; unconfigured images stay disabled.
              </p>
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
              {images.filter((image) => image.type === activeImageTab).map((image) => (
                <Choice
                  key={image.id}
                  title={image.name}
                  sub={image.version}
                  badge={image.badge}
                  disabled={!image.available}
                  active={selectedImage?.id === image.id && image.available}
                  onClick={() => setSelectedImage(image)}
                />
              ))}
            </div>
          </Panel>

          <Panel title="2. Choose a region">
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Currently available server regions can be selected; unlinked regions appear as unavailable.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {regions.slice(0, 5).map((region) => (
                <Choice
                  key={region.id}
                  title={`${region.flag} ${region.name}`}
                  sub={region.code}
                  badge={region.available ? 'Available' : undefined}
                  disabled={!region.available}
                  active={selectedRegion?.id === region.id && region.available}
                  onClick={() => selectRegion(region)}
                />
              ))}
            </div>
            {regions.length > 5 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {regions.slice(5).map((region) => (
                  <Choice
                    key={region.id}
                    title={`${region.flag} ${region.name}`}
                    sub={region.code}
                    badge={region.available ? 'Available' : undefined}
                    disabled={!region.available}
                    active={selectedRegion?.id === region.id && region.available}
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
                {!validHostname && (
                  <span className="mt-1 block text-xs text-rose-500">Use 3–63 lowercase letters, numbers, or hyphens.</span>
                )}
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

              {/* Server Access Credentials */}
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="droplet-username">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-[#1ed760]" />
                  Server Username
                </span>
                <input
                  id="droplet-username"
                  type="text"
                  value={serverUsername}
                  onChange={(event) => setServerUsername(event.target.value)}
                  placeholder="e.g. tiwlo_user"
                  autoComplete="username"
                  className="mt-2 h-10 w-full rounded-xl bg-neutral-100 px-3 font-mono text-sm font-normal text-neutral-950 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-950"
                />
                {!validUsername && (
                  <span className="mt-1 block text-xs text-rose-500">3–32 lowercase chars starting with letter or underscore.</span>
                )}
              </label>

              <div className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="droplet-password">Server Login Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setServerPassword(generateStrongPassword());
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f7a37] hover:underline dark:text-[#1ed760]"
                  >
                    <RefreshCw className="size-3" />
                    Generate
                  </button>
                </div>
                <div className="relative mt-2">
                  <input
                    id="droplet-password"
                    type={showPassword ? 'text' : 'password'}
                    value={serverPassword}
                    onChange={(event) => setServerPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="h-10 w-full rounded-xl bg-neutral-100 pl-3 pr-10 font-mono text-sm font-normal text-neutral-950 outline-none ring-neutral-900/10 transition focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {serverPassword && !validPassword && (
                  <span className="mt-1 block text-xs text-rose-500">Password must be at least 8 characters.</span>
                )}
              </div>
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
              ['Image', selectedImage?.name || '—'],
              ['Runtime Link', selectedImage?.runtimeImage || connectedServer.sharedImage],
              ['Region', selectedRegion ? `${selectedRegion.flag} ${selectedRegion.name} (${selectedRegion.code})` : '—'],
              ['Plan', selectedTier.name],
              ['CPU', `${selectedTier.vcpus} vCPU`],
              ['Memory', selectedTier.memory],
              ['Storage', selectedTier.storage],
              ['Server User', serverUsername.trim() || '—'],
              ['Login Auth', validPassword ? 'Password Configured' : 'Password Required'],
              ['Backups', enableBackups ? '+$3.00/mo' : 'Off'],
              ['IPv6', enableIpv6 ? 'Enabled' : 'Off'],
              ['Monitoring', enableMonitoring ? 'Enabled' : 'Off'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                <dd className="text-right font-semibold text-neutral-950 dark:text-white break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Monthly plan estimate</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              ${totalMonthly}<span className="ml-1 text-sm font-medium text-neutral-500">/mo</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              ~${(totalMonthly / 720).toFixed(3)}/hr
            </p>
          </div>
          {submitError && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {submitError}
            </p>
          )}
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreateDroplet}
            className={`mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition ${
              canCreate
                ? 'bg-[#1ed760] text-black hover:bg-[#19c354] cursor-pointer'
                : 'cursor-not-allowed bg-neutral-300 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Zap className="size-4" aria-hidden="true" />
            {submitting
              ? 'Provisioning Droplet...'
              : validPassword
                ? 'Create Droplet'
                : 'Enter Server Password to Create'}
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Provisions an isolated tenant container on your connected Ubuntu server with hashed server access credentials.
          </p>
        </Panel>
      </div>
    </div>
  );
}
