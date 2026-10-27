import React from 'react';

/**
 * Mobile status bar matching iOS 9:41 status bar in reference screenshot
 */
export default function MobileStatusBar({ time = "9:41", dark = false }) {
  return (
    <div className={`w-full flex items-center justify-between px-7 pt-3.5 pb-2 select-none text-[13px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
      {/* Time */}
      <span className="font-semibold tracking-tight">{time}</span>

      {/* Dynamic Island / Speaker notch placeholder if needed, or clean space */}
      <div className="w-16 h-3 pointer-events-none" />

      {/* Cellular, WiFi, Battery icons */}
      <div className="flex items-center space-x-1.5">
        {/* Cellular 4 bars */}
        <svg className="w-4 h-3" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="9" width="2.5" height="3" rx="0.5" />
          <rect x="4.5" y="6" width="2.5" height="6" rx="0.5" />
          <rect x="9" y="3" width="2.5" height="9" rx="0.5" />
          <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" />
        </svg>

        {/* WiFi */}
        <svg className="w-4 h-3" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.5C10.8 2.5 13.3 3.6 15.2 5.4L16 4.6C13.9 2.5 11.1 1.3 8 1.3C4.9 1.3 2.1 2.5 0 4.6L0.8 5.4C2.7 3.6 5.2 2.5 8 2.5ZM8 6C9.9 6 11.6 6.8 12.8 8.1L13.6 7.3C12.2 5.7 10.2 4.8 8 4.8C5.8 4.8 3.8 5.7 2.4 7.3L3.2 8.1C4.4 6.8 6.1 6 8 6ZM8 9.5C6.9 9.5 6 10.4 6 11.5C6 11.8 6.2 12 6.5 12H9.5C9.8 12 10 11.8 10 11.5C10 10.4 9.1 9.5 8 9.5Z" />
        </svg>

        {/* Battery */}
        <div className="flex items-center">
          <div className={`w-5 h-2.5 rounded-[3px] border ${dark ? 'border-white' : 'border-slate-900'} p-0.5 flex items-center`}>
            <div className={`h-full w-full rounded-[1px] ${dark ? 'bg-white' : 'bg-slate-900'}`} />
          </div>
          <div className={`w-0.5 h-1 rounded-r-[1px] ${dark ? 'bg-white' : 'bg-slate-900'} ml-[1px]`} />
        </div>
      </div>
    </div>
  );
}
