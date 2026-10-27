import React from 'react';
import HomeIndicator from './HomeIndicator';

/**
 * Mobile device container frame.
 * Renders the pure mobile viewport without any artificial top status bar / navbar.
 */
export default function MobileFrame({
  children,
  showHomeIndicator = true,
  className = "",
  containerClassName = ""
}) {
  return (
    <div className={`w-full flex flex-col items-center justify-center p-0 ${containerClassName}`}>
      {/* Mobile Screen Container */}
      <div
        className={`w-full max-w-[390px] min-h-[780px] bg-white dark:bg-slate-900 rounded-[36px] shadow-xl border border-slate-200/90 dark:border-slate-800 flex flex-col relative overflow-hidden text-slate-900 dark:text-slate-100 transition-all ${className}`}
      >
        {/* Screen Content Body - Starts cleanly from the top without mock navbar */}
        <div className="flex-1 flex flex-col w-full relative overflow-y-auto overscroll-contain">
          {children}
        </div>

        {/* Mobile Bottom Home Indicator Bar */}
        {showHomeIndicator && (
          <HomeIndicator className="bg-transparent pb-3 pt-1" />
        )}
      </div>
    </div>
  );
}
