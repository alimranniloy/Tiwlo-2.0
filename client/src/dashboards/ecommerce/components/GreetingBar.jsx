import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export default function GreetingBar({ currentUser }) {
  const [currentDateTime, setCurrentDateTime] = useState({
    date: 'Mon, Sep 22, 2025',
    time: '10:24 AM'
  });

  // Dynamic User Display Name
  const user = currentUser || (() => {
    try {
      const saved = localStorage.getItem('tiwlo_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  })();
  const displayName = user?.name || user?.storeName || 'Admin';

  // Optional: display live time formatted nicely or fallback to screenshot exact representation
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      setCurrentDateTime({ date: dateStr, time: timeStr });
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-7">
      <div>
        <h2 className="text-xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight flex items-center">
          Good Morning, {displayName}{' '}
          <span className="ml-2 inline-block text-xl sm:text-2xl">☀️</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 font-normal">
          Here's what's happening with your inventory today.
        </p>
      </div>

      {/* Date & Time Badge */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700/80 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-[0_2px_4px_rgba(0,0,0,0.02)] shrink-0 self-start sm:self-auto">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-50 dark:bg-gray-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
            {currentDateTime.date}
          </p>
          <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-400">
            {currentDateTime.time}
          </p>
        </div>
      </div>
    </div>
  );
}
