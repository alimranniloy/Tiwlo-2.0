import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

export default function StockMovementChart({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const chartData = data || [];
  const maxVal = Math.max(1, ...chartData.flatMap(item => [item.inStock || 0, item.outStock || 0]));

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-start space-x-2">
          <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Stock Movement
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              In & Out flow (last 7 days)
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              In Stock
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Out Stock
            </span>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-44 items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400">
          No stock movement data available yet.
        </div>
      ) : (
        <div className="relative pt-4 pb-2">
        {/* Y Axis Grid Lines */}
        <div className="absolute inset-x-8 top-4 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-slate-200 dark:border-gray-700 w-full"></div>
          <div className="border-b border-dashed border-slate-200 dark:border-gray-700 w-full"></div>
          <div className="border-b border-dashed border-slate-200 dark:border-gray-700 w-full"></div>
          <div className="border-b border-dashed border-slate-200 dark:border-gray-700 w-full"></div>
          <div className="border-b border-slate-200 dark:border-gray-700 w-full"></div>
        </div>
        <div className="flex items-end justify-between h-44 pl-8 pr-2 relative">
          {/* Y-axis Labels on Left */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 font-medium">
            <span>{maxVal.toLocaleString()}</span>
            <span>{Math.round(maxVal * 0.75).toLocaleString()}</span>
            <span>{Math.round(maxVal * 0.5).toLocaleString()}</span>
            <span>{Math.round(maxVal * 0.25).toLocaleString()}</span>
            <span>0</span>
          </div>

          {/* Bars for each day */}
          {chartData.map((d, idx) => {
            const inHeight = ((d.inStock || 0) / maxVal) * 100;
            const outHeight = ((d.outStock || 0) / maxVal) * 100;

            return (
              <div
                key={d.day}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end pb-7"
              >
                {/* Tooltip */}
                {hoveredIdx === idx && (
                  <div className="absolute -top-7 z-20 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md shadow-md whitespace-nowrap pointer-events-none">
                    In: {d.inStock} | Out: {d.outStock}
                  </div>
                )}

                <div className="flex items-end space-x-1.5 h-full">
                  {/* In Stock Bar */}
                  <div
                    className="w-2.5 sm:w-3 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(0, inHeight))}%` }}
                  ></div>

                  {/* Out Stock Bar */}
                  <div
                    className="w-2.5 sm:w-3 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(0, outHeight))}%` }}
                  ></div>
                </div>

                {/* Day Label */}
                <span className="absolute bottom-1 text-[11px] font-medium text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition">
                  {d.day}
                </span>
              </div>
            );
          })}
      </div>
      </div>
      )}
    </div>
  );
}
