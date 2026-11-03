import React from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';

export default function CloudHeroBanner({ currentUser, onCreateDroplet, onOpenTPanel }) {
  // Compute dynamic greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const name = currentUser?.name?.split(' ')[0] || currentUser?.storeName?.split(' ')[0] || 'User';

  return (
    <section className="relative overflow-hidden rounded-3xl bg-black p-6 text-white sm:p-10">
      <div className="relative z-10 max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#1ed760]">{getGreeting()}</p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
          Welcome back, {name}
        </h1>
        <p className="mt-3 text-pretty text-white/70">
          Deploy scalable virtual droplets across Frankfurt, Singapore, New York, London and Mumbai — all from one
          console.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateDroplet}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-bold text-black transition hover:bg-[#16c653]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create Droplet
          </button>
          <button
            type="button"
            onClick={onOpenTPanel}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            Open TPanel
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full border-[48px] border-[#1ed760]/90"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 right-48 size-40 rounded-full bg-[#1ed760]/20"
      />
    </section>
  );
}
