import React, { useState } from 'react';
import { ChevronDown, CheckSquare } from 'lucide-react';

export default function InventoryOverviewChart({ totalStock = '36,482', onCategorySelect }) {
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showDropdown, setShowDropdown] = useState(false);

  const categories = [
    { name: 'Electronics', percent: 28, units: '10,213', color: '#3B82F6' },
    { name: 'Clothing', percent: 24, units: '8,756', color: '#10B981' },
    { name: 'Home & Living', percent: 16, units: '5,838', color: '#F59E0B' },
    { name: 'Beauty & Health', percent: 12, units: '4,377', color: '#FB7185' },
    { name: 'Sports', percent: 8, units: '2,918', color: '#8B5CF6' },
    { name: 'Others', percent: 12, units: '4,380', color: '#60A5FA' }
  ];

  // SVG Donut calculation
  const radius = 62;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-start space-x-2">
          <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Inventory Overview
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              Stock level across all categories
            </p>
          </div>
        </div>

        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-gray-700/50 hover:bg-slate-100 border border-slate-200 dark:border-gray-600 rounded-lg transition"
          >
            <span>{selectedCategory}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-30">
              <button
                onClick={() => {
                  setSelectedCategory('All Categories');
                  setShowDropdown(false);
                  if (onCategorySelect) onCategorySelect('All Categories');
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setSelectedCategory(c.name);
                    setShowDropdown(false);
                    if (onCategorySelect) onCategorySelect(c.name);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Donut Chart & Category Details */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 py-2">
        {/* SVG Donut Chart */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
            {/* Background circle track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              className="stroke-slate-100 dark:stroke-gray-700/50"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Category Slices */}
            {categories.map((cat) => {
              const strokeDasharray = `${(cat.percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += cat.percent;

              return (
                <circle
                  key={cat.name}
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke={cat.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
              {totalStock}
            </span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Total Units
            </span>
          </div>
        </div>

        {/* Categories Breakdown Table */}
        <div className="w-full space-y-2.5">
          {categories.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-gray-700/30 px-2 py-1 rounded-lg transition"
            >
              <div className="flex items-center space-x-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                ></span>
                <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-slate-400 font-medium text-[11px] w-7 text-right">
                  {item.percent}%
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs w-14 text-right">
                  {item.units}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
