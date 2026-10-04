import React from 'react';
import { ArrowRight, ArrowUp, Layers, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';

export default function BottomBanners({ onExploreFeatures, onViewReport, onUpgrade }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
      {/* Banner 1: Manage Your Stock Smarter & Faster (5 cols) */}
      <div className="lg:col-span-5 aura-section-border aura-border-cyan bg-gradient-to-br from-white via-cyan-50/20 to-blue-50/20 dark:from-gray-800 dark:via-gray-800 dark:to-cyan-950/20 p-5 flex items-center space-x-4 relative overflow-hidden group">
        {/* 3D Geometric Blocks Graphic */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-md shadow-cyan-500/20 flex items-center justify-center shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-white/20 to-transparent"></div>
          <Layers className="w-10 h-10 text-white drop-shadow-md transform group-hover:scale-110 transition-transform duration-300" />
        </div>

        <div className="flex-1 relative z-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
            Manage Your Stock Smarter & Faster
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Real-time tracking, powerful analytics, and complete control — all in one place.
          </p>
          <button
            onClick={onExploreFeatures}
            className="mt-3 inline-flex items-center text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 group/btn"
          >
            <span>Explore Features</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Banner 2: Total Value (4 cols) */}
      <div className="lg:col-span-4 aura-section-border aura-border-purple bg-gradient-to-br from-[#FDF8FF] via-white to-[#F4F7FF] dark:from-gray-800 dark:via-gray-800 dark:to-purple-950/20 p-5 flex flex-col justify-between relative overflow-hidden group">
        {/* Decorative holographic prism / ribbon */}
        <div className="absolute -right-4 -bottom-6 w-32 h-32 opacity-15 dark:opacity-10 pointer-events-none transform rotate-12 group-hover:scale-110 transition-transform duration-300">
          <svg viewBox="0 0 100 100" className="w-full h-full text-purple-600 fill-current">
            <path d="M10 50 Q 25 10, 50 50 T 90 50 Q 75 90, 50 50 T 10 50 Z" />
          </svg>
        </div>

        <div className="relative z-3">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
            Total Value
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              $248,650
            </span>
          </div>
          <div className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            <ArrowUp className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
            <span>14%</span>
          </div>
        </div>

        <div className="pt-3 relative z-3">
          <button
            onClick={onViewReport}
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 inline-flex items-center space-x-1 group/btn"
          >
            <span>View Report</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Banner 3: Upgrade to Pro (3 cols) */}
      <div className="lg:col-span-3 aura-section-border aura-border-amber bg-gradient-to-r from-[#172033] via-[#1E293B] to-[#0F172A] text-white p-5 shadow-md relative overflow-hidden flex flex-col justify-between">
        {/* Abstract phone mockup graphic background */}
        <div className="absolute right-2 top-2 bottom-2 w-16 opacity-30 pointer-events-none flex items-center justify-center">
          <div className="w-12 h-20 rounded-xl border border-blue-400/40 bg-gradient-to-b from-blue-500/20 to-purple-500/20 backdrop-blur-xs flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-blue-300" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">
            Upgrade to Pro
          </h4>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed pr-8">
            Get advanced features, multi-warehouse support and priority support.
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={onUpgrade}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white inline-flex items-center space-x-1.5 transition-all duration-150 backdrop-blur-sm cursor-pointer shadow-sm"
          >
            <span>Upgrade Now</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
