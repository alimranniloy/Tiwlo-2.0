import React from 'react';

export default function GreetingBar({ currentUser }) {
  const displayName = currentUser?.name || currentUser?.storeName || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
        {greeting}, {displayName}
      </h1>
      <p className="text-sm text-neutral-500">
        Here’s what’s happening with your store today.
      </p>
    </div>
  );
}
