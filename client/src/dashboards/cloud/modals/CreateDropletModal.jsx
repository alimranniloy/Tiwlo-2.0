import React, { useState } from 'react';
import { X, Server, Globe, Cpu, Check, Zap, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function CreateDropletModal({ isOpen, onClose, onCreateDroplet, initialImage = 'Ubuntu 24.04 LTS' }) {
  const regions = [
    { name: 'Dhaka (DHK1)', code: 'DHK1', flag: '🇧🇩', available: true },
    { name: 'Singapore (SGP1)', code: 'SGP1', flag: '🇸🇬', available: false },
    { name: 'Frankfurt (FRA1)', code: 'FRA1', flag: '🇩🇪', available: false },
    { name: 'New York (NYC1)', code: 'NYC1', flag: '🇺🇸', available: false },
    { name: 'London (LON1)', code: 'LON1', flag: '🇬🇧', available: false },
    { name: 'Tokyo (TYO1)', code: 'TYO1', flag: '🇯🇵', available: false },
    { name: 'Toronto (TOR1)', code: 'TOR1', flag: '🇨🇦', available: false }
  ];

  const images = [
    { id: 'ubuntu-24', name: 'Ubuntu 24.04 LTS', os: 'Ubuntu', desc: 'Connected server shared Ubuntu runtime (tiwlo-ubuntu-shared-runtime:24.04)', badge: 'Connected', available: true },
    { id: 'ubuntu-22', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', desc: '22.04 Jammy Jellyfish', available: false },
    { id: 'debian-12', name: 'Debian 12', os: 'Debian', desc: 'Bookworm stable enterprise release', available: false },
    { id: 'almalinux-9', name: 'AlmaLinux 9', os: 'AlmaLinux', desc: 'RHEL-compatible 1:1 binary distribution', available: false },
    { id: 'fedora-40', name: 'Fedora 40', os: 'Fedora', desc: 'Cloud Base Edition', available: false },
    { id: 'app-tpanel', name: 'TPanel 1.0 (Tiwlo Control Panel)', os: 'TPanel', desc: 'Deprecated / Disabled', available: false }
  ];

  const plans = [
    { vcpus: 1, memory: '2 GB', storage: '40 GB NVMe', price: '$12/mo', label: 'Basic' },
    { vcpus: 2, memory: '4 GB', storage: '80 GB NVMe', price: '$24/mo', label: 'Standard Pro', popular: true },
    { vcpus: 4, memory: '8 GB', storage: '160 GB NVMe', price: '$48/mo', label: 'Advanced' },
    { vcpus: 8, memory: '16 GB', storage: '320 GB NVMe', price: '$96/mo', label: 'Ultra High-Compute' }
  ];

  const [name, setName] = useState(`tiwlo-dhk1-${Math.floor(Math.random() * 900 + 100)}`);
  const [username, setUsername] = useState('tiwlo_user');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [region, setRegion] = useState(() => regions.find((r) => r.available) || regions[0]);
  const [image, setImage] = useState(() => (
    images.find((img) => img.available && img.name === initialImage)?.name ||
    images.find((img) => img.available)?.name ||
    'Ubuntu 24.04 LTS'
  ));
  const [plan, setPlan] = useState(plans[1]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const canSubmit = Boolean(name.trim() && username.trim().length >= 3 && password.length >= 8 && !loading);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      await onCreateDroplet({
        hostname: name.trim().toLowerCase(),
        name: name.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        password,
        region: region.name,
        regionCode: region.code,
        regionFlag: region.flag,
        image,
        vcpus: plan.vcpus,
        memory: plan.memory,
        storage: plan.storage
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#181818] rounded-3xl border border-neutral-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <Server className="w-5 h-5 text-[#1ED760]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Create New Droplet
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Connected Ubuntu runtime, active server region, and custom login credentials.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hostname & Server Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Hostname
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="tiwlo-dhk1-01"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-gray-700 bg-neutral-50/50 dark:bg-gray-800/50 text-neutral-900 dark:text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-[#1ED760]" /> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="tiwlo_user"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-gray-700 bg-neutral-50/50 dark:bg-gray-800/50 text-neutral-900 dark:text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 chars"
                  className="w-full pl-3 pr-8 py-2 rounded-xl border border-neutral-200 dark:border-gray-700 bg-neutral-50/50 dark:bg-gray-800/50 text-neutral-900 dark:text-white text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Choose Region */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-neutral-500" />
              Choose Datacenter Region
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {regions.map((r) => {
                const isSelected = region.code === r.code && r.available;
                return (
                  <button
                    type="button"
                    key={r.code}
                    disabled={!r.available}
                    onClick={() => r.available && setRegion(r)}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition ${
                      !r.available
                        ? 'opacity-60 cursor-not-allowed border-neutral-200/70 dark:border-gray-800/70 bg-neutral-100/70 dark:bg-gray-900/40 text-neutral-400'
                        : isSelected
                          ? 'border-[#1ED760] bg-[#1ED760]/10 text-neutral-900 dark:text-white ring-1 ring-[#1ED760] font-semibold cursor-pointer'
                          : 'border-neutral-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{r.flag}</span>
                      <p className="text-xs font-medium truncate">{r.name}</p>
                    </div>
                    {!r.available && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-gray-800 text-neutral-500 shrink-0">
                        Unavailable
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OS Distribution */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Choose OS Distribution Image
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {images.map((img) => {
                const isSelected = image === img.name && img.available;
                return (
                  <button
                    type="button"
                    key={img.id}
                    disabled={!img.available}
                    onClick={() => img.available && setImage(img.name)}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      !img.available
                        ? 'opacity-60 cursor-not-allowed border-neutral-200/70 dark:border-gray-800/70 bg-neutral-100/70 dark:bg-gray-900/40 text-neutral-400'
                        : isSelected
                          ? 'border-[#1ED760] bg-[#1ED760]/10 ring-1 ring-[#1ED760] cursor-pointer'
                          : 'border-neutral-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white">{img.name}</p>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md ${
                            img.available
                              ? 'bg-[#1ED760] text-black'
                              : 'bg-neutral-200 dark:bg-gray-800 text-neutral-500'
                          }`}
                        >
                          {img.available ? (img.badge || 'Available') : 'Unavailable'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{img.desc}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#1ED760] shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan & Specs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              Choose Droplet Size &amp; Compute Specs
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {plans.map((p) => {
                const isSelected = plan.vcpus === p.vcpus && plan.memory === p.memory;
                return (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => setPlan(p)}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer relative ${
                      isSelected
                        ? 'border-neutral-900 dark:border-[#1ED760] bg-neutral-50/60 dark:bg-neutral-900/20 ring-1 ring-neutral-900 dark:ring-[#1ED760]'
                        : 'border-neutral-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-neutral-700 dark:text-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1ED760]/15 text-[#0f7a37] dark:text-[#1ED760] uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">{p.label}</span>
                      <span className="text-xs font-extrabold text-neutral-600 dark:text-neutral-400">{p.price}</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      {p.vcpus} vCPU • {p.memory} RAM • {p.storage}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Selected: <span className="font-semibold text-neutral-900 dark:text-white">{plan.vcpus} vCPU, {plan.memory}</span> in <span className="font-semibold text-neutral-900 dark:text-white">{region.code}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  canSubmit
                    ? 'bg-[#1ED760] hover:bg-[#19c354] text-black cursor-pointer'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500'
                }`}
              >
                {loading ? 'Provisioning...' : 'Deploy Droplet Now'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
