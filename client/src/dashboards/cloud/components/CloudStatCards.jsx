import React from 'react';
import { Droplet, Layers, HardDrive, Globe } from 'lucide-react';

export default function CloudStatCards({ metrics, loading = false }) {
  const cards = [
    {
      id: 'droplets',
      title: 'Total Droplets',
      value: loading ? 'Loading…' : (metrics?.totalDroplets ?? '—'),
      change: metrics?.dropletsGrowth || 'Historical trend unavailable',
      icon: Droplet,
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'vcpus',
      title: 'Total vCPUs',
      value: loading ? 'Loading…' : (metrics?.totalVcpus ?? '—'),
      change: metrics?.vcpusGrowth || 'Historical trend unavailable',
      icon: Layers,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
    },
    {
      id: 'storage',
      title: 'Total Storage',
      value: loading ? 'Loading…' : (metrics?.totalStorage ?? '—'),
      change: metrics?.storageGrowth || 'Historical trend unavailable',
      icon: HardDrive,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400'
    },
    {
      id: 'bandwidth',
      title: 'Total Bandwidth',
      value: loading ? 'Loading…' : (metrics?.totalBandwidth ?? '—'),
      change: metrics?.bandwidthGrowth || 'Historical trend unavailable',
      icon: Globe,
      iconBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>

            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate">
              {card.title}
            </p>

            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1 sm:mb-2">
              {card.value}
            </h3>

            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
              {card.change}
            </p>
          </div>
        );
      })}
    </div>
  );
}
