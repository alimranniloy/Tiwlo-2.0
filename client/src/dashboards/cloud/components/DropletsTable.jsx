import React, { useState } from 'react';
import {
  Droplet,
  MoreVertical,
  Play,
  Pause,
  RotateCw,
  Trash2,
  Terminal,
  ExternalLink,
  Plus
} from 'lucide-react';

export default function DropletsTable({
  droplets = [],
  onUpdateStatus,
  onDeleteDroplet,
  onOpenCreateDroplet
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);

  const toggleMenu = (id) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-blue-600 dark:fill-blue-400 stroke-none" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Your Droplets
          </h2>
          <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400">
            {droplets.length}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenCreateDroplet}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Add Droplet</span>
          </button>
          <button
            onClick={onOpenCreateDroplet}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition cursor-pointer"
          >
            View all
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[580px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-gray-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              <th className="py-3 px-3 sm:px-6 font-semibold">Name</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">IP Address</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Region</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Status</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Created</th>
              <th className="py-3 px-3 sm:px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80 text-xs font-medium">
            {droplets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto text-center space-y-3">
                    <Droplet className="w-8 h-8 mx-auto text-slate-300 dark:text-gray-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      No droplets provisioned yet
                    </p>
                    <p className="text-xs text-slate-400">
                      Deploy your first high-performance cloud droplet in seconds.
                    </p>
                    <button
                      onClick={onOpenCreateDroplet}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                    >
                      Create First Droplet
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              droplets.map((item) => {
                const isRunning = (item.status || 'Running').toLowerCase() === 'running';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition group"
                  >
                    {/* Name + Specs */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-blue-600 dark:fill-blue-400 stroke-none" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                              {item.name}
                            </p>
                            {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                TPanel
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400">
                            {item.specs || `${item.vcpus || 2} vCPU • ${item.memory || '4 GB'} • ${item.storage || '80 GB'}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 font-mono text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      {item.ip}
                    </td>

                    {/* Region */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">{item.regionFlag || '🌐'}</span>
                        <span className="font-medium text-xs">{item.region}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRunning
                              ? 'bg-emerald-500 shadow-2xs shadow-emerald-500/50 animate-pulse'
                              : 'bg-amber-500'
                          }`}
                        ></span>
                        <span className={isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {item.status || 'Running'}
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {item.created || 'Sep 25, 2025 10:24 AM'}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-right relative whitespace-nowrap">
                      {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                        <a
                          href="/tpanel"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
                          title="Open TPanel Control Hub"
                        >
                          <span className="font-extrabold text-[11px]">TPanel</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === item.id && (
                        <div className="absolute right-6 top-12 w-48 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 shadow-xl py-1.5 z-40 text-left animate-in fade-in">
                          {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                            <a
                              href="/tpanel"
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setActiveMenuId(null)}
                              className="w-full px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-2 cursor-pointer border-b border-slate-100 dark:border-gray-800"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Login to TPanel</span>
                            </a>
                          )}
                          {isRunning ? (
                            <button
                              onClick={() => {
                                onUpdateStatus?.(item.id, 'Paused');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 cursor-pointer"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause Droplet</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                onUpdateStatus?.(item.id, 'Running');
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Start Droplet</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              onUpdateStatus?.(item.id, 'Running');
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-blue-500" />
                            <span>Reboot Server</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 flex items-center gap-2 cursor-pointer"
                          >
                            <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Web Console</span>
                          </button>

                          <div className="pt-1 border-t border-slate-100 dark:border-gray-800">
                            <button
                              onClick={() => {
                                onDeleteDroplet?.(item.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Destroy Droplet</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
