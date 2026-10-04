import React, { useState } from 'react';
import {
  HardDrive,
  Plus,
  Server,
  Trash2,
  Sliders,
  CheckCircle2,
  Search,
  ExternalLink,
  Shield,
  Zap
} from 'lucide-react';

export default function VolumesView({ droplets = [], showToast }) {
  const [volumes, setVolumes] = useState([
    {
      id: 'vol-301',
      name: 'production-assets-nvme',
      size: 100,
      attachedTo: 'tiwlo-fra1-production',
      mountPoint: '/mnt/assets',
      fsType: 'ext4',
      region: 'Frankfurt (FRA1)',
      monthlyPrice: 10
    },
    {
      id: 'vol-302',
      name: 'postgres-data-storage',
      size: 250,
      attachedTo: 'tiwlo-nyc1-db-master',
      mountPoint: '/var/lib/postgresql/data',
      fsType: 'xfs',
      region: 'New York (NYC1)',
      monthlyPrice: 25
    }
  ]);

  const [newVolName, setNewVolName] = useState('');
  const [newVolSize, setNewVolSize] = useState(50);
  const [selectedDroplet, setSelectedDroplet] = useState(droplets[0]?.id || '');
  const [creating, setCreating] = useState(false);

  const handleCreateVolume = (e) => {
    e.preventDefault();
    if (!newVolName.trim()) {
      showToast?.('Please enter a volume name', 'error');
      return;
    }

    setCreating(true);
    setTimeout(() => {
      const drop = droplets.find(d => d.id === selectedDroplet) || { name: 'Unattached', region: 'Frankfurt (FRA1)' };
      const newVol = {
        id: `vol-${Date.now()}`,
        name: newVolName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        size: Number(newVolSize),
        attachedTo: drop.name,
        mountPoint: `/mnt/${newVolName.trim()}`,
        fsType: 'ext4',
        region: drop.region || 'Frankfurt (FRA1)',
        monthlyPrice: Math.round(newVolSize * 0.1)
      };
      setVolumes(prev => [newVol, ...prev]);
      setNewVolName('');
      setCreating(false);
      showToast?.(`NVMe Volume "${newVol.name}" attached successfully!`);
    }, 1000);
  };

  const handleDeleteVolume = (id, name) => {
    setVolumes(prev => prev.filter(v => v.id !== id));
    showToast?.(`Volume "${name}" destroyed`);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              NVMe Block Storage Volumes
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Expand droplet storage up to 16 TB with ultra-fast NVMe block storage. Expand size on the fly without rebooting.
            </p>
          </div>
        </div>
      </div>

      {/* Create Volume Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          <span>Create & Attach Volume</span>
        </h2>

        <form onSubmit={handleCreateVolume} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Volume Name
            </label>
            <input
              type="text"
              value={newVolName}
              onChange={(e) => setNewVolName(e.target.value)}
              placeholder="e.g. data-volume-01"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Size (GB): <strong className="text-blue-600 font-bold">{newVolSize} GB</strong> (${(newVolSize * 0.1).toFixed(2)}/mo)
            </label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={newVolSize}
              onChange={(e) => setNewVolSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Attach to Droplet
            </label>
            <select
              value={selectedDroplet}
              onChange={(e) => setSelectedDroplet(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {droplets.length > 0 ? (
                droplets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              ) : (
                <option value="">tiwlo-primary-droplet</option>
              )}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {creating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Attaching...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Attach Volume</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Volumes Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Active Volumes ({volumes.length})
          </h2>
          <span className="text-xs text-slate-400">$0.10/GB/month</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5">Volume Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Attached Droplet</th>
                <th className="py-3 px-4">Mount Point</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-slate-700 dark:text-slate-200">
              {volumes.map(vol => (
                <tr key={vol.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition">
                  <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{vol.name}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">{vol.size} GB</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    <span>{vol.attachedTo}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{vol.mountPoint}</td>
                  <td className="py-3.5 px-4">{vol.region}</td>
                  <td className="py-3.5 px-4 font-semibold text-blue-600">${vol.monthlyPrice}/mo</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteVolume(vol.id, vol.name)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
