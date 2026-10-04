import React, { useState } from 'react';
import {
  Camera,
  Server,
  HardDrive,
  Calendar,
  RotateCcw,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';

export default function SnapshotsView({ droplets = [], showToast }) {
  const [snapshots, setSnapshots] = useState([
    {
      id: 'snap-101',
      name: 'pre-deployment-stable-v1',
      dropletName: 'tiwlo-fra1-production',
      size: '14.2 GB',
      created: 'Oct 01, 2026 14:22',
      region: 'Frankfurt (FRA1)',
      status: 'Available'
    },
    {
      id: 'snap-102',
      name: 'mysql-database-backup-auto',
      dropletName: 'tiwlo-nyc1-db-master',
      size: '22.8 GB',
      created: 'Sep 29, 2026 03:00',
      region: 'New York (NYC1)',
      status: 'Available'
    }
  ]);
  const [selectedDroplet, setSelectedDroplet] = useState(droplets[0]?.id || '');
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCreateSnapshot = (e) => {
    e.preventDefault();
    if (!newSnapshotName.trim()) {
      showToast?.('Please enter a snapshot name', 'error');
      return;
    }

    setTakingSnapshot(true);
    setTimeout(() => {
      const dropObj = droplets.find(d => d.id === selectedDroplet) || { name: 'tiwlo-cloud-droplet', region: 'Frankfurt (FRA1)' };
      const newSnap = {
        id: `snap-${Date.now()}`,
        name: newSnapshotName.trim(),
        dropletName: dropObj.name,
        size: '16.5 GB',
        created: 'Just now',
        region: dropObj.region || 'Frankfurt (FRA1)',
        status: 'Available'
      };
      setSnapshots(prev => [newSnap, ...prev]);
      setNewSnapshotName('');
      setTakingSnapshot(false);
      showToast?.(`Snapshot "${newSnap.name}" created successfully!`);
    }, 1200);
  };

  const handleDeleteSnapshot = (id, name) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    showToast?.(`Snapshot "${name}" removed`);
  };

  const handleRestore = (name) => {
    showToast?.(`Snapshot restoration initiated for "${name}"`);
  };

  const filteredSnapshots = snapshots.filter(s =>
    !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.dropletName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Droplet Snapshots
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Create full on-demand point-in-time disk images of your droplets for disaster recovery and cloning.
            </p>
          </div>
        </div>
      </div>

      {/* Snapshot Action Section (Google Style Card) */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" />
          <span>Take a New Snapshot</span>
        </h2>

        <form onSubmit={handleCreateSnapshot} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Select Target Droplet
            </label>
            <select
              value={selectedDroplet}
              onChange={(e) => setSelectedDroplet(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {droplets.length > 0 ? (
                droplets.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.ip || 'Pending IP'})
                  </option>
                ))
              ) : (
                <option value="">tiwlo-primary-droplet</option>
              )}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Snapshot Name
            </label>
            <input
              type="text"
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              placeholder="e.g. pre-upgrade-backup"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={takingSnapshot}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {takingSnapshot ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Capturing...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Take Snapshot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Snapshots Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Stored Snapshots ({snapshots.length})
            </h2>
            <p className="text-xs text-slate-500">Billed at $0.05/GB/month for block storage</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search snapshots..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5">Snapshot Name</th>
                <th className="py-3 px-4">Source Droplet</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Disk Size</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-slate-700 dark:text-slate-200">
              {filteredSnapshots.map(snap => (
                <tr key={snap.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition">
                  <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{snap.name}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {snap.dropletName}
                  </td>
                  <td className="py-3.5 px-4">{snap.region}</td>
                  <td className="py-3.5 px-4 font-semibold">{snap.size}</td>
                  <td className="py-3.5 px-4 text-slate-500">{snap.created}</td>
                  <td className="py-3.5 px-5 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(snap.name)}
                      className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold transition cursor-pointer"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snap.id, snap.name)}
                      className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer inline-flex items-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
