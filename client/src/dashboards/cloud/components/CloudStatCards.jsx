import React from 'react';
import { ChevronRight, Droplet, Layers, HardDrive, Globe } from 'lucide-react';

export default function CloudStatCards({ metrics }) {
  const cards = [
    {
      id: 'droplets',
      title: 'Total Droplets',
      value: metrics?.totalDroplets ?? 5,
      change: metrics?.dropletsGrowth || '↑ 1 from last 7 days',
      icon: Droplet,
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'vcpus',
      title: 'Total vCPUs',
      value: metrics?.totalVcpus ?? 8,
      change: metrics?.vcpusGrowth || '↑ 2 from last 7 days',
      icon: Layers,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
    },
    {
      id: 'storage',
      title: 'Total Storage',
      value: metrics?.totalStorage || '80 GB',
      change: metrics?.storageGrowth || '↑ 20 GB from last 7 days',
      icon: HardDrive,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400'
    },
    {
      id: 'bandwidth',
      title: 'Total Bandwidth',
      value: metrics?.totalBandwidth || '2.4 TB',
      change: metrics?.bandwidthGrowth || '↑ 0.6 TB from last 7 days',
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
            className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-gray-700 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${card.iconBg} transition group-hover:scale-105`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-slate-500 transition group-hover:translate-x-0.5" />
            </div>

            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 truncate">
              {card.title}
            </p>

            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1 sm:mb-2">
              {card.value}
            </h3>

            <p className="text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate">
              {card.change}
            </p>
          </div>
        );
      })}
    </div>
  );
}
