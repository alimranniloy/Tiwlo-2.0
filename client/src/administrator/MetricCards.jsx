import React from 'react';
import { DollarSign, ShoppingCart, Users, Cloud, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function MetricCards({ metrics }) {
  const cards = [
    {
      id: 'revenue',
      title: 'Total Revenue',
      value: metrics?.totalRevenue?.value || '$24,582.00',
      trend: metrics?.totalRevenue?.trend || '12.5%',
      period: metrics?.totalRevenue?.period || 'vs. last 7 days',
      positive: metrics?.totalRevenue?.positive !== false,
      icon: DollarSign,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'orders',
      title: 'Total Orders',
      value: metrics?.totalOrders?.value || '1,248',
      trend: metrics?.totalOrders?.trend || '8.2%',
      period: metrics?.totalOrders?.period || 'vs. last 7 days',
      positive: metrics?.totalOrders?.positive !== false,
      icon: ShoppingCart,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'customers',
      title: 'Total Customers',
      value: metrics?.totalCustomers?.value || '892',
      trend: metrics?.totalCustomers?.trend || '15.6%',
      period: metrics?.totalCustomers?.period || 'vs. last 7 days',
      positive: metrics?.totalCustomers?.positive !== false,
      icon: Users,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'servers',
      title: 'Active Cloud Servers',
      value: metrics?.activeCloudServers?.value || '24',
      trend: metrics?.activeCloudServers?.trend || '4.3%',
      period: metrics?.activeCloudServers?.period || 'vs. last 7 days',
      positive: metrics?.activeCloudServers?.positive !== false,
      icon: Cloud,
      iconBg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
      {cards.map((c) => {
        const IconComponent = c.icon;
        return (
          <div
            key={c.id}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {c.title}
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {c.value}
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`flex items-center font-semibold ${
                  c.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {c.positive ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {c.trend}
              </span>
              <span className="text-slate-400 dark:text-slate-500">{c.period}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
