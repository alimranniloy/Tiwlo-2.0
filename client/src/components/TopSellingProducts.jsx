import React from 'react';
import { ArrowUp, ArrowRight } from 'lucide-react';

export default function TopSellingProducts({ products, onViewAll }) {
  const defaultList = [
    {
      id: '1',
      name: 'Premium T-Shirt',
      sold: '324 sold',
      revenue: '$2,460',
      growth: '↑ 12%',
      image: '/default-product.svg'
    },
    {
      id: '2',
      name: 'Running Shoes',
      sold: '280 sold',
      revenue: '$1,980',
      growth: '↑ 8%',
      image: '/default-product.svg'
    },
    {
      id: '3',
      name: 'Wireless Headphones',
      sold: '198 sold',
      revenue: '$1,560',
      growth: '↑ 15%',
      image: '/default-product.svg'
    },
    {
      id: '4',
      name: 'Backpack',
      sold: '142 sold',
      revenue: '$1,200',
      growth: '↑ 6%',
      image: '/default-product.svg'
    },
    {
      id: '5',
      name: 'Face Cream',
      sold: '120 sold',
      revenue: '$860',
      growth: '↑ 10%',
      image: '/default-product.svg'
    }
  ];

  const items = products && products.length > 0 ? products : defaultList;

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Top Selling Products
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">
            Based on total sales
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center space-x-1 group"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/40 transition group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-gray-700 overflow-hidden shrink-0 border border-slate-200/60 dark:border-gray-600 flex items-center justify-center">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    e.target.src = '/default-product.svg';
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                  {item.name}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {item.sold}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-white">
                {item.revenue}
              </p>
              <div className="flex items-center justify-end text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowUp className="w-3 h-3 stroke-[2.5]" />
                <span>{item.growth?.replace('↑', '').trim()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
