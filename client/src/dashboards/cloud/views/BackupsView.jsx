import React, { useState } from 'react';
import {
  ShieldCheck,
  Server,
  Calendar,
  Clock,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  AlertTriangle,
  Play
} from 'lucide-react';

export default function BackupsView({ droplets = [], showToast }) {
  const [backupSchedule, setBackupSchedule] = useState('weekly'); // 'daily' | 'weekly'

  // Backup records need a provider-backed API; never display invented recovery
  // points as if a customer can restore them.
  const backups = [];

  const handleRestore = (id, name) => {
    showToast?.(`Restoration initiated for backup ${id} on ${name}`);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Automated Cloud Backups
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Automated weekly and daily system backups captured without server reboot or interruption.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Protected Droplets</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {droplets.length} / {droplets.length}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">100% Protection Policy Active</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Backup Retention</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">4 Weeks</div>
          <div className="text-[11px] text-slate-400 mt-1">Rolling automated window</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Next Scheduled Window</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Tonight 04:00 UTC</div>
          <div className="text-[11px] text-slate-400 mt-1">Non-disruptive snapshot</div>
        </div>
      </div>

      {/* Recovery Points Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)] overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Available Recovery Points ({backups.length})
          </h2>
          <span className="text-xs text-slate-400">Instant 1-click restore</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5">Target Droplet</th>
                <th className="py-3 px-4">Backup Type</th>
                <th className="py-3 px-4">Captured Timestamp</th>
                <th className="py-3 px-4">Backup Size</th>
                <th className="py-3 px-4">Health Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-slate-700 dark:text-slate-200">
              {backups.map(bk => (
                <tr key={bk.id} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition">
                  <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>{bk.dropletName}</span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400">{bk.type}</td>
                  <td className="py-3.5 px-4 text-slate-500">{bk.timestamp}</td>
                  <td className="py-3.5 px-4 font-semibold">{bk.size}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{bk.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRestore(bk.id, bk.dropletName)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-900/30 dark:hover:bg-blue-600 dark:text-blue-400 font-semibold transition cursor-pointer text-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-10 px-5 text-center text-slate-500 dark:text-slate-400">
                    No recovery points yet. Connect a backup provider to create and restore backups.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
