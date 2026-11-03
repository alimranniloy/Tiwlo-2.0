import React, { useState } from 'react';
import {
  Droplet,
  MoreVertical,
  ExternalLink,
  Plus
} from 'lucide-react';

export default function DropletsTable({
  droplets = [],
  onOpenCreateDroplet
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);

  const toggleMenu = (id) => {
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-neutral-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
            <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-neutral-600 dark:fill-neutral-400 stroke-none" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
            Your Droplets
          </h2>
          <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-gray-800 text-neutral-600 dark:text-neutral-400">
            {droplets.length}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenCreateDroplet}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900/40 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Add Droplet</span>
          </button>
          <button
            onClick={onOpenCreateDroplet}
            className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
          >
            View all
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[580px]">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-gray-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-400">
              <th className="py-3 px-3 sm:px-6 font-semibold">Name</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">IP Address</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Region</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Status</th>
              <th className="py-3 px-3 sm:px-6 font-semibold">Created</th>
              <th className="py-3 px-3 sm:px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-gray-800/80 text-xs font-medium">
            {droplets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  <div className="max-w-xs mx-auto text-center space-y-3">
                    <Droplet className="w-8 h-8 mx-auto text-neutral-300 dark:text-gray-600" />
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                      No droplets provisioned yet
                    </p>
                    <p className="text-xs text-neutral-400">
                      Deploy your first high-performance cloud droplet in seconds.
                    </p>
                    <button
                      onClick={onOpenCreateDroplet}
                      className="px-4 py-2 rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white font-bold text-xs shadow-xs"
                    >
                      Create First Droplet
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              droplets.map((item) => {
                const status = item.status || 'Unknown';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-gray-800/40 transition group"
                  >
                    {/* Name + Specs */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
                          <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-neutral-600 dark:fill-neutral-400 stroke-none" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-neutral-900 dark:text-white group-hover:text-neutral-600 transition">
                              {item.name}
                            </p>
                            {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded-md bg-neutral-100 dark:bg-neutral-900/40 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                                TPanel
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-400">
                            {item.specs || [item.vcpus && `${item.vcpus} vCPU`, item.memory, item.storage].filter(Boolean).join(' • ') || 'Specifications unavailable'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 font-medium">
                      {item.ip || '—'}
                    </td>

                    {/* Region */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-neutral-700 dark:text-neutral-200">
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">{item.regionFlag || '🌐'}</span>
                        <span className="font-medium text-xs">{item.region || '—'}</span>
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
                        <span className={status.toLowerCase() === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {status}
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                      {item.created || (item.createdAt ? new Date(item.createdAt).toLocaleString() : '—')}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 sm:py-4 px-3 sm:px-6 text-right relative whitespace-nowrap">
                      {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                        <a
                          href="/tpanel"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
                          title="Open TPanel Control Hub"
                        >
                          <span className="font-extrabold text-[11px]">TPanel</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-gray-800 transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === item.id && (
                        <div className="absolute right-6 top-12 w-48 rounded-2xl bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 shadow-xl py-1.5 z-40 text-left animate-in fade-in">
                          {(item.hasTPanel || item.image?.includes('TPanel') || item.name?.includes('tpanel')) && (
                            <a
                              href="/tpanel"
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setActiveMenuId(null)}
                              className="w-full px-3.5 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-950/30 flex items-center gap-2 cursor-pointer border-b border-neutral-100 dark:border-gray-800"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                              <span>Login to TPanel</span>
                            </a>
                          )}
                          <p className="px-3.5 py-2 text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
                            Droplet controls are unavailable until a cloud provider is connected.
                          </p>
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
