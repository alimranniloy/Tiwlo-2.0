import React from 'react';
import { Box, Package, ShoppingCart, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

export default function StatCards({ stats }) {
  const cards = [
    {
      id: 'products',
      title: 'Total Products',
      value: stats?.totalProducts || '1,248',
      trend: stats?.totalProductsGrowth || '↑ 12% vs last month',
      isUp: true,
      color: 'blue',
      icon: Box,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40',
      sparklineColor: '#3B82F6',
      sparklinePoints: 'M0 24 C 20 20, 35 32, 55 18 C 75 8, 90 22, 110 14 C 130 6, 145 20, 165 10'
    },
    {
      id: 'stock',
      title: 'Total Stock (Units)',
      value: stats?.totalStock || '36,482',
      trend: stats?.totalStockGrowth || '↑ 8% vs last month',
      isUp: true,
      color: 'emerald',
      icon: Package,
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40',
      sparklineColor: '#10B981',
      sparklinePoints: 'M0 26 C 25 28, 45 12, 70 20 C 95 28, 115 10, 140 16 C 150 18, 160 8, 165 6'
    },
    {
      id: 'sales',
      title: 'Total Sales',
      value: stats?.totalSales || '$12,540',
      trend: stats?.totalSalesGrowth || '↑ 24% vs last month',
      isUp: true,
      color: 'purple',
      icon: ShoppingCart,
      iconBg: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40',
      sparklineColor: '#A855F7',
      sparklinePoints: 'M0 28 C 30 25, 45 30, 75 16 C 100 6, 120 22, 140 12 C 155 4, 160 8, 165 2'
    },
    {
      id: 'low_stock',
      title: 'Low Stock Items',
      value: stats?.lowStockItems !== undefined ? stats.lowStockItems.toString() : '18',
      trend: stats?.lowStockGrowth || '↓ 5% vs last month',
      isUp: false,
      color: 'amber',
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40',
      sparklineColor: '#F59E0B',
      sparklinePoints: 'M0 8 C 25 10, 45 26, 75 16 C 100 8, 125 24, 145 18 C 155 16, 160 22, 165 24'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
      {cards.map((card) => {
        const Icon = card.icon;
        const trendParts = card.trend.split('vs last month');
        const percentageText = trendParts[0].trim();

        const borderGlowClass = {
          blue: 'hover:border-blue-400/60 dark:hover:border-blue-500/60 hover:shadow-blue-500/5',
          emerald: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/60 hover:shadow-emerald-500/5',
          purple: 'hover:border-purple-400/60 dark:hover:border-purple-500/60 hover:shadow-purple-500/5',
          amber: 'hover:border-amber-400/60 dark:hover:border-amber-500/60 hover:shadow-amber-500/5'
        }[card.color] || '';

        return (
          <div
            key={card.id}
            className={`bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative flex flex-col justify-between overflow-hidden group hover:shadow-md transition-all duration-200 ${borderGlowClass}`}
          >
            <div>
              {/* Header with Icon and Title */}
              <div className="flex items-center space-x-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
              </div>

              {/* Stat Value */}
              <div className="text-[28px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-3">
                {card.value}
              </div>

              {/* Trend Info */}
              <div className="flex items-center text-xs">
                {card.isUp ? (
                  <span className="inline-flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                    <ArrowUp className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
                    {percentageText.replace('↑', '').trim()}
                  </span>
                ) : (
                  <span className="inline-flex items-center font-semibold text-rose-500 dark:text-rose-400">
                    <ArrowDown className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
                    {percentageText.replace('↓', '').trim()}
                  </span>
                )}
                <span className="text-slate-400 dark:text-slate-400 ml-1.5 font-normal">
                  vs last month
                </span>
              </div>
            </div>

            {/* Sparkline Wave Chart at Bottom Right */}
            <div className="w-full h-9 mt-2 pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
              <svg
                viewBox="0 0 165 34"
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id={`grad-${card.id}`}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={card.sparklineColor} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={card.sparklineColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={`${card.sparklinePoints} L 165 34 L 0 34 Z`}
                  fill={`url(#grad-${card.id})`}
                />
                {/* Line stroke */}
                <path
                  d={card.sparklinePoints}
                  fill="none"
                  stroke={card.sparklineColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
