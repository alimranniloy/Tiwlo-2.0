import React, { useState } from 'react';
import { X, Server, Globe, Cpu, Check, Shield, Zap } from 'lucide-react';

export default function CreateDropletModal({ isOpen, onClose, onCreateDroplet, initialImage = 'Ubuntu 22.04 LTS' }) {
  const [name, setName] = useState(`server-${Math.floor(Math.random() * 900 + 100)}`);
  const [region, setRegion] = useState({ name: 'New York (NYC1)', code: 'NYC1', flag: '🇺🇸' });
  const [image, setImage] = useState(initialImage);
  const [plan, setPlan] = useState({
    vcpus: 2,
    memory: '4 GB',
    storage: '80 GB',
    price: '$24/mo',
    label: 'Standard Pro'
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const regions = [
    { name: 'New York (NYC1)', code: 'NYC1', flag: '🇺🇸' },
    { name: 'Singapore (SGP1)', code: 'SGP1', flag: '🇸🇬' },
    { name: 'London (LON1)', code: 'LON1', flag: '🇬🇧' },
    { name: 'Frankfurt (FRA1)', code: 'FRA1', flag: '🇩🇪' },
    { name: 'Toronto (TOR1)', code: 'TOR1', flag: '🇨🇦' },
    { name: 'Tokyo (TYO1)', code: 'TYO1', flag: '🇯🇵' }
  ];

  const images = [
    { name: 'TPanel 1.0 (Tiwlo Control Panel)', os: 'TPanel', desc: 'Pre-configured web host panel with MySQL, Node.js & PHP', badge: 'Recommended' },
    { name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', desc: 'Latest LTS, optimized for Docker & Node' },
    { name: 'Debian 12', os: 'Debian', desc: 'Bookworm stable enterprise release' },
    { name: 'CentOS 8', os: 'CentOS', desc: 'Enterprise stream architecture' },
    { name: 'AlmaLinux 9', os: 'AlmaLinux', desc: 'RHEL-compatible 1:1 binary distribution' }
  ];

  const plans = [
    { vcpus: 1, memory: '2 GB', storage: '40 GB', price: '$12/mo', label: 'Basic' },
    { vcpus: 2, memory: '4 GB', storage: '80 GB', price: '$24/mo', label: 'Standard Pro', popular: true },
    { vcpus: 4, memory: '8 GB', storage: '160 GB', price: '$48/mo', label: 'Advanced' },
    { vcpus: 8, memory: '16 GB', storage: '320 GB', price: '$96/mo', label: 'Ultra High-Compute' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreateDroplet({
        name: name.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create New Droplet
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure specs, choose region, and launch cloud server in seconds.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Server Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Droplet Hostname / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. web-server-02"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Choose Region */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              Choose Datacenter Region
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {regions.map((r) => {
                const isSelected = region.code === r.code;
                return (
                  <button
                    type="button"
                    key={r.code}
                    onClick={() => setRegion(r)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                        : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl shrink-0">{r.flag}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{r.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OS Distribution */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Choose OS Distribution Image
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {images.map((img) => {
                const isSelected = image === img.name;
                return (
                  <button
                    type="button"
                    key={img.name}
                    onClick={() => setImage(img.name)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600'
                        : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{img.name}</p>
                        {img.badge && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-blue-600 text-white shadow-2xs">
                            {img.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{img.desc}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan & Specs */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              Choose Droplet Size & Compute Specs
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
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600'
                        : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{p.label}</span>
                      <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">{p.price}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {p.vcpus} vCPU • {p.memory} RAM • {p.storage} NVMe SSD
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Selected: <span className="font-semibold text-slate-900 dark:text-white">{plan.vcpus} vCPU, {plan.memory}</span> in <span className="font-semibold text-slate-900 dark:text-white">{region.code}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-2"
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
