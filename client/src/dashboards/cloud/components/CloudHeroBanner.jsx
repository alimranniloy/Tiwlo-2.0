import React from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';

export default function CloudHeroBanner({ currentUser, onCreateDroplet, onOpenStore }) {
  // Compute dynamic greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const name = currentUser?.name?.split(' ')[0] || currentUser?.storeName?.split(' ')[0] || 'User';

  return (
    <section className="relative overflow-hidden rounded-3xl bg-black p-6 text-white sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full bg-[#1ed760]/20 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold text-white/60">{getGreeting()}, {name}</p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
          Build something great in the cloud
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
            Deploy, manage and scale your infrastructure with ease. Choose from our powerful droplets, compute, and more.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCreateDroplet}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1ed760] px-4 text-sm font-bold text-black transition hover:bg-[#16c653]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create droplet
          </button>
          <button
            type="button"
            onClick={onOpenStore}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Open store
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
