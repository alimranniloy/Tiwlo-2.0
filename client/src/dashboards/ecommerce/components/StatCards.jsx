import React from 'react';
import { AlertTriangle, Boxes, DollarSign, Package } from 'lucide-react';

export default function StatCards({ stats }) {
  const cards = [
    { id: 'products', label: 'Total Products', value: stats?.totalProducts ?? '—', hint: 'Current total', icon: Package, tone: 'ink' },
    { id: 'stock', label: 'Total Stock (Units)', value: stats?.totalStock ?? '—', hint: 'Across your inventory', icon: Boxes, tone: 'default' },
    { id: 'sales', label: 'Total Sales', value: stats?.totalSales ?? '—', hint: 'Recorded sales', icon: DollarSign, tone: 'primary' },
    { id: 'low-stock', label: 'Low Stock Items', value: stats?.lowStockItems ?? '—', hint: 'Needs reorder', icon: AlertTriangle, tone: 'default' },
  ];

  return (
    <section aria-label="Store statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ id, label, value, hint, icon: Icon, tone }) => (
        <article
          key={id}
          className={`flex min-h-36 flex-col justify-between gap-5 rounded-3xl p-4 ring-1 sm:p-5 ${
            tone === 'ink'
              ? 'bg-[#121212] text-white ring-[#121212]'
              : tone === 'primary'
                ? 'bg-[#1ed760] text-black ring-[#1ed760]'
                : 'bg-white text-neutral-950 ring-neutral-200 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-medium sm:text-sm ${tone === 'default' ? 'text-neutral-500' : 'opacity-75'}`}>
              {label}
            </span>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              tone === 'ink' ? 'bg-white/10' : tone === 'primary' ? 'bg-black/10' : 'bg-[#f1f1f1]'
            }`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
            <p className={`mt-1 text-xs ${tone === 'default' ? 'text-neutral-500' : 'opacity-60'}`}>{hint}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
