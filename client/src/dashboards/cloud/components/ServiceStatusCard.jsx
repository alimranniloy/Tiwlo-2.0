import React from 'react';
import { CheckCircle2, ChevronRight, Server } from 'lucide-react';

export default function ServiceStatusCard() {
  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs relative overflow-hidden flex flex-col justify-between">
      <div>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">
          Service Status
        </p>

        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            All systems operational
          </h3>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Our infrastructure is running smoothly.
        </p>
      </div>

      <div className="flex items-end justify-between">
        <a
          href="#status"
          onClick={(e) => e.preventDefault()}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
        >
          <span>View status</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </a>

        {/* Mini 3D server cluster graphic matching screenshot */}
        <div className="relative">
          <div className="w-16 h-12 bg-gradient-to-tr from-blue-100 to-sky-50 dark:from-gray-800 dark:to-blue-950/40 rounded-xl border border-blue-200/60 dark:border-blue-800/40 flex flex-col justify-center items-center gap-1 p-1.5 shadow-xs">
            <div className="w-full h-2 rounded-sm bg-blue-500/20 flex items-center justify-between px-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="w-4 h-0.5 rounded-full bg-blue-500/40"></span>
            </div>
            <div className="w-full h-2 rounded-sm bg-blue-500/20 flex items-center justify-between px-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="w-4 h-0.5 rounded-full bg-blue-500/40"></span>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
