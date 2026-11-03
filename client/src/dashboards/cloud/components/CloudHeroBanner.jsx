import React from 'react';

export default function CloudHeroBanner({ currentUser }) {
  // Compute dynamic greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const name = currentUser?.name?.split(' ')[0] || currentUser?.storeName?.split(' ')[0] || 'User';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-gray-800 p-5 sm:p-7 bg-white dark:bg-[#181818] shadow-[0_1px_3px_rgba(60,64,67,0.08)] flex items-center justify-between transition-all">
      <div className="relative z-10 max-w-xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 text-xs font-semibold mb-2">
          <span>{getGreeting()}, {name}</span>
          <span>👋</span>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight leading-snug mb-1.5">
          Build something great in the cloud
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed max-w-lg">
          Deploy, manage and scale your infrastructure with ease. Choose from our powerful droplets, compute, and more.
        </p>
      </div>
    </div>
  );
}
