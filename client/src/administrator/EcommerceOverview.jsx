import React from 'react';
import { ShoppingCart, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';

export default function EcommerceOverview({ data, onViewDetails }) {
  const stats = [
    {
      label: 'Total Orders',
      value: data?.totalOrders?.toLocaleString('en-US') || '1,248',
      trend: '8.2%',
      positive: true
    },
    {
      label: 'Pending Orders',
      value: data?.pendingOrders?.toLocaleString('en-US') || '86',
      trend: '3.1%',
      positive: false
    },
    {
      label: 'Completed Orders',
      value: data?.completedOrders?.toLocaleString('en-US') || '1,102',
      trend: '11.4%',
      positive: true
    },
    {
      label: 'Total Sales',
      value: data?.totalSales ? `$${Number(data.totalSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$18,642.00',
      trend: '14.8%',
      positive: true
    }
  ];

  const topProducts = data?.topProducts || [
    {
      rank: 1,
      name: 'Wireless Headphones',
      orders: 234,
      revenue: 5856.00,
      image: '/default-product.svg'
    },
    {
      rank: 2,
      name: 'Smart Watch',
      orders: 189,
      revenue: 4725.00,
      image: '/default-product.svg'
    },
    {
      rank: 3,
      name: 'Laptop Bag',
      orders: 142,
      revenue: 3552.00,
      image: '/default-product.svg'
    },
    {
      rank: 4,
      name: 'Bluetooth Speaker',
      orders: 120,
      revenue: 2880.00,
      image: '/default-product.svg'
    },
    {
      rank: 5,
      name: 'Gaming Mouse',
      orders: 98,
      revenue: 2328.00,
      image: '/default-product.svg'
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">E-commerce Overview</h3>
        </div>

        <button
          onClick={onViewDetails}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          View Details <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Mini Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
          >
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 block truncate">
              {s.label}
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {s.value}
            </div>
            <div className="flex items-center gap-1 text-[11px] mt-1">
              <span
                className={`flex items-center font-semibold ${
                  s.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {s.positive ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {s.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Selling Products Table */}
      <div className="mt-2">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
          Top Selling Products
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                <th className="py-2 pl-1 w-8">#</th>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Orders</th>
                <th className="py-2 pr-1 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {topProducts.map((p) => (
                <tr key={p.rank} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pl-1 text-slate-400 font-medium">{p.rank}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-6 h-6 rounded-md object-cover border border-slate-200/80 dark:border-slate-700"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px] sm:max-w-[180px]">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 text-right font-medium text-slate-600 dark:text-slate-300">
                    {p.orders}
                  </td>
                  <td className="py-2 pr-1 text-right font-bold text-slate-900 dark:text-white">
                    ${Number(p.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
