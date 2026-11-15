import React from 'react';
import { PLATFORM_DOMAIN } from '../config/platformConfig';

export default function FreeStoreAttribution({ isFreeStore = false }) {
  if (!isFreeStore) return null;

  const platformHref = PLATFORM_DOMAIN ? `https://${PLATFORM_DOMAIN}` : 'https://tiwlo.com';

  return (
    <a
      href={platformHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Free store · Created by Tiwlo"
      className="fixed right-3 bottom-[68px] lg:bottom-4 lg:right-4 z-50 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[11px] font-medium text-neutral-700/90 hover:text-neutral-950 transition-colors drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] select-none"
    >
      <img
        src="/tiwlo-icon.png"
        alt=""
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 object-contain"
      />
      <span>Free store · Created by Tiwlo</span>
    </a>
  );
}
