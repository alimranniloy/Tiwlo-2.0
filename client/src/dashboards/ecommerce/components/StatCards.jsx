import React from 'react';
import { AlertTriangle, Box, Package, ShoppingCart } from 'lucide-react';

export default function StatCards({ stats }) {
  const cards = [
    {
      id: 'products',
      title: 'Total Products',
      value: stats?.totalProducts ?? '—',
      color: 'blue',
      icon: Box,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40'
    },
    {
      id: 'stock',
      title: 'Total Stock (Units)',
      value: stats?.totalStock ?? '—',
      color: 'emerald',
      icon: Package,
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40'
    },
    {
      id: 'sales',
      title: 'Total Sales',
      value: stats?.totalSales ?? '—',
      color: 'purple',
      icon: ShoppingCart,
      iconBg: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40'
    },
    {
      id: 'low_stock',
      title: 'Low Stock Items',
      value: stats?.lowStockItems ?? '—',
      color: 'amber',
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40'
    }
  ];

  const borderGlowClass = {
    blue: 'hover:border-blue-400/60 dark:hover:border-blue-500/60',
    emerald: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/60',
    purple: 'hover:border-purple-400/60 dark:hover:border-purple-500/60',
    amber: 'hover:border-amber-400/60 dark:hover:border-amber-500/60'
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-3.5 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between overflow-hidden transition-all duration-200 ${borderGlowClass[card.color]}`}
          >
            <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {card.title}
              </span>
            </div>
            <div className="text-xl sm:text-[28px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
              {card.value}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              {stats ? 'Current total' : 'Data unavailable'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
