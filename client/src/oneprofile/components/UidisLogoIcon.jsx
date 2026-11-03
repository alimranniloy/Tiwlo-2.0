import React from 'react';

/**
 * Stylized UIDis Ribbon Logo Icon
 * Matches screenshot purple/blue gradient 'U' ribbon icon
 */
export function UidisLogoIcon({ className = "w-8 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="uidis-grad-1" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6f6f6f" />
          <stop offset="0.5" stopColor="#7b7b7b" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id="uidis-grad-2" x1="10" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#717171" />
          <stop offset="1" stopColor="#7b7b7b" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="#f2f2f2" />
      <path
        d="M11 10V20C11 23.866 14.134 27 18 27C21.866 27 25 23.866 25 20V10"
        stroke="url(#uidis-grad-1)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="25" cy="11" r="2.5" fill="#000000" />
    </svg>
  );
}

export const UidsLogoIcon = UidisLogoIcon;
export default UidisLogoIcon;
