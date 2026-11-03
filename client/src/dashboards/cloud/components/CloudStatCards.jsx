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
      surface: 'bg-black text-white border-black',
      iconBg: 'bg-white/10 text-[#1ed760]',
      secondary: 'text-white/60'
    },
    {
      id: 'vcpus',
      title: 'Total vCPUs',
      value: loading ? 'Loading…' : (metrics?.totalVcpus ?? '—'),
      change: metrics?.vcpusGrowth || 'Historical trend unavailable',
      icon: Layers,
      surface: 'bg-white text-neutral-950 border-neutral-200 dark:bg-neutral-900 dark:text-white dark:border-neutral-800',
      iconBg: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
      secondary: 'text-neutral-500 dark:text-neutral-400'
    },
    {
      id: 'storage',
      title: 'Total Storage',
      value: loading ? 'Loading…' : (metrics?.totalStorage ?? '—'),
      change: metrics?.storageGrowth || 'Historical trend unavailable',
      icon: HardDrive,
      surface: 'bg-white text-neutral-950 border-neutral-200 dark:bg-neutral-900 dark:text-white dark:border-neutral-800',
      iconBg: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
      secondary: 'text-neutral-500 dark:text-neutral-400'
    },
    {
      id: 'bandwidth',
      title: 'Total Bandwidth',
      value: loading ? 'Loading…' : (metrics?.totalBandwidth ?? '—'),
      change: metrics?.bandwidthGrowth || 'Historical trend unavailable',
      icon: Globe,
      surface: 'bg-[#1ed760] text-black border-[#1ed760]',
      iconBg: 'bg-black/10 text-black',
      secondary: 'text-black/65'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${card.surface}`}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>

            <p className={`mb-1 truncate text-xs font-semibold ${card.secondary}`}>
              {card.title}
            </p>

            <h3 className="mb-1 text-xl font-black tracking-tight sm:text-2xl">
              {card.value}
            </h3>

            <p className={`flex items-center gap-1 truncate text-[11px] font-medium ${card.secondary}`}>
              {card.change}
            </p>
          </div>
        );
      })}
    </div>
  );
}
