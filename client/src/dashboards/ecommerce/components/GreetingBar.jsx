import React from 'react';
import { ExternalLink, Plus } from 'lucide-react';

export default function GreetingBar({ currentUser, onVisitSite, onAddProduct }) {
  const displayName = currentUser?.name || currentUser?.storeName || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {today}
        </p>
        <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
          {greeting}, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 sm:text-base">
          Here’s what’s happening with your store today — inventory, sales and setup.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onVisitSite && (
          <button
            type="button"
            onClick={onVisitSite}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-neutral-900 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Visit Site
          </button>
        )}
        {onAddProduct && (
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-bold text-black transition hover:bg-[#18c755]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Product
          </button>
        )}
      </div>
    </header>
  );
}
