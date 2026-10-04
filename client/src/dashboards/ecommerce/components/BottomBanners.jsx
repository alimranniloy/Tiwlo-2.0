import React from 'react';
import { ArrowRight, ArrowUp, Layers } from 'lucide-react';

export default function BottomBanners({ onExploreFeatures, onViewReport, onUpgrade }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
      {/* Banner 1: Manage Your Stock Smarter & Faster (5 cols) */}
      <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 p-5 sm:p-6 flex items-center space-x-4 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Layers className="w-6 h-6" />
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
            Manage Your Stock Smarter & Faster
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Real-time tracking, powerful analytics, and complete control — all in one place.
          </p>
          <button
            onClick={onExploreFeatures}
            className="mt-2.5 inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/btn cursor-pointer"
          >
            <span>Explore Features</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Banner 2: Total Value (4 cols) */}
      <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 p-5 sm:p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Inventory Value
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              $248,650
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <ArrowUp className="w-3 h-3 mr-0.5" />
              14%
            </span>
          </div>
        </div>

        <div className="pt-3">
          <button
            onClick={onViewReport}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center space-x-1 group/btn cursor-pointer"
          >
            <span>View Full Report</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Banner 3: Upgrade to Pro (3 cols) */}
      <div className="lg:col-span-3 rounded-2xl bg-slate-900 dark:bg-gray-900 text-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-white tracking-tight">
              Upgrade to Pro
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Pro
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Advanced analytics, multi-warehouse support, and 24/7 dedicated support.
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={onUpgrade}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span>Upgrade Now</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
