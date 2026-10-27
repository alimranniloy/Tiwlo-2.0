import React from 'react';

/**
 * Mobile bottom home indicator bar
 */
export default function HomeIndicator({ dark = false, className = "" }) {
  return (
    <div className={`w-full flex items-center justify-center pt-3 pb-2 select-none pointer-events-none ${className}`}>
      <div className={`w-32 h-1 rounded-full ${dark ? 'bg-white/60' : 'bg-slate-900/80'}`} />
    </div>
  );
}
