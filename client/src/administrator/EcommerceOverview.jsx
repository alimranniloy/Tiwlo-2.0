import React from 'react';
import { ShoppingCart, ArrowRight } from 'lucide-react';

export default function EcommerceOverview({ data, onViewDetails }) {
  const stats = [
    {
      label: 'Total Orders',
      value: data?.totalOrders?.toLocaleString('en-US') ?? '—'
    },
    {
      label: 'Pending Orders',
      value: data?.pendingOrders?.toLocaleString('en-US') ?? '—'
    },
    {
      label: 'Completed Orders',
      value: data?.completedOrders?.toLocaleString('en-US') ?? '—'
    },
    {
      label: 'Total Sales',
      value: data?.totalSales == null
        ? (data?.currency === 'Mixed currencies' ? 'Mixed currencies' : '—')
        : `${data.currency || ''} ${Number(data.totalSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    }
  ];

  const topProducts = data?.topProducts || [];

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
              {data && s.label === 'Total Sales' && data.currency === 'Mixed currencies' && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">Values kept separate by store currency</span>
              )}
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
              {topProducts.length ? topProducts.map((p) => (
                <tr key={p.rank} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 pl-1 text-slate-400 font-medium">{p.rank}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={p.image || '/default-product.svg'}
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
                    {p.revenue == null
                      ? 'Mixed'
                      : `${data?.currency || ''} ${Number(p.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-400">
                    {data ? 'No paid product sales in this period.' : 'Sales data is unavailable.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
