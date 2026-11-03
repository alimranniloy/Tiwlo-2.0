import React from 'react';
import { ChevronRight, CircleHelp, Server } from 'lucide-react';

export default function ServiceStatusCard() {
  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs relative overflow-hidden flex flex-col justify-between">
      <div>
        <p className="text-xs font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider mb-3">
          Service Status
        </p>

        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <CircleHelp className="size-4" />
          </div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            Status unavailable
          </h3>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
          Live service health reporting is not available yet.
        </p>
      </div>

      <div className="flex items-end justify-between">
        <a
          href="#status"
          onClick={(e) => e.preventDefault()}
          className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
        >
          <span>Service status</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </a>

        {/* Mini 3D server cluster graphic matching screenshot */}
        <div className="relative">
          <div className="w-16 h-12 bg-gradient-to-tr from-neutral-100 to-neutral-50 dark:from-gray-800 dark:to-neutral-950/40 rounded-xl border border-neutral-200/60 dark:border-neutral-800/40 flex flex-col justify-center items-center gap-1 p-1.5 shadow-xs">
            <div className="w-full h-2 rounded-sm bg-neutral-500/20 flex items-center justify-between px-1">
              <span className="w-1 h-1 rounded-full bg-neutral-400"></span>
              <span className="w-4 h-0.5 rounded-full bg-neutral-500/40"></span>
            </div>
            <div className="w-full h-2 rounded-sm bg-neutral-500/20 flex items-center justify-between px-1">
              <span className="w-1 h-1 rounded-full bg-neutral-400"></span>
              <span className="w-4 h-0.5 rounded-full bg-neutral-500/40"></span>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-neutral-500 text-white shadow-xs">
            <Server className="size-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
