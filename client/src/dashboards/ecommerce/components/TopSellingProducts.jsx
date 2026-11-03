import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function TopSellingProducts({ products = [], onViewAll }) {
  const items = Array.isArray(products) ? products : [];

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-950">Top Selling Products</h2>
          <p className="mt-1 text-xs text-neutral-500">Ranked by recorded units sold</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-bold text-neutral-800 transition hover:text-neutral-500"
        >
          View All <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl bg-[#f7f7f7] px-4 text-center text-sm text-neutral-500">
          No product sales have been recorded yet.
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li
              key={item.id || item.name}
              className="flex items-center gap-3 rounded-2xl bg-[#f5f5f5] p-3 transition hover:bg-[#efefef]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#121212] text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-950">{item.name}</p>
                <p className="text-xs text-neutral-500">{item.sold}</p>
              </div>
              <span className="shrink-0 text-right text-sm font-bold text-neutral-950">{item.revenue}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
