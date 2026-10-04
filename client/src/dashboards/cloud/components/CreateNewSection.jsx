import React from 'react';
import { Plus, ChevronRight, HardDrive, Layers, Database, Globe } from 'lucide-react';

export default function CreateNewSection({ onOpenCreateDroplet }) {
  const quickTiles = [
    {
      id: 'volumes',
      title: 'Volumes',
      desc: 'Add block storage',
      icon: HardDrive,
      badge: null
    },
    {
      id: 'kubernetes',
      title: 'Kubernetes',
      desc: 'Managed clusters',
      icon: Layers,
      badge: 'New'
    },
    {
      id: 'object-storage',
      title: 'Object Storage',
      desc: 'S3 compatible',
      icon: Database,
      badge: null
    },
    {
      id: 'spaces',
      title: 'Spaces',
      desc: 'Static websites',
      icon: Globe,
      badge: null
    }
  ];

  return (
    <div className="space-y-3.5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
        Create New
      </h3>

      {/* Main Solid Blue Action Card */}
      <div
        onClick={onOpenCreateDroplet}
        className="p-4 sm:p-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-[0_1px_3px_rgba(37,99,235,0.25)] cursor-pointer transition flex items-center justify-between group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">
              Create New Droplet
            </h4>
            <p className="text-xs text-blue-100">
              Launch a new server in seconds.
            </p>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition shrink-0" />
      </div>

      {/* 2x2 Grid of Sub-Services */}
      <div className="grid grid-cols-2 gap-3">
        {quickTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.id}
              onClick={onOpenCreateDroplet}
              className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_2px_rgba(60,64,67,0.06)] hover:border-blue-500/50 transition cursor-pointer flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {tile.title}
                  </p>
                  {tile.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">
                      {tile.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  {tile.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
