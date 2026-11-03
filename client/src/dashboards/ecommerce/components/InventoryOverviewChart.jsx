import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const chartWidth = 640;
const chartHeight = 220;
const chartLeft = 42;
const chartRight = 628;
const chartTop = 14;
const chartBottom = 174;

export default function InventoryOverviewChart({ totalStock = '—', categories = [], onCategorySelect }) {
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const chartData = useMemo(() => {
    const data = (Array.isArray(categories) ? categories : [])
      .filter(category => typeof category?.name === 'string')
      .map(category => ({ name: category.name, units: Math.max(0, Number(category.units) || 0) }));
    return selectedCategory === 'All Categories'
      ? data
      : data.filter(category => category.name === selectedCategory);
  }, [categories, selectedCategory]);

  const maxValue = Math.max(1, ...chartData.map(category => category.units));
  const points = chartData.map((category, index) => {
    const x = chartData.length < 2
      ? (chartLeft + chartRight) / 2
      : chartLeft + (index / (chartData.length - 1)) * (chartRight - chartLeft);
    const y = chartBottom - (category.units / maxValue) * (chartBottom - chartTop);
    return { ...category, x, y };
  });
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = points.length
    ? `${chartLeft},${chartBottom} ${line} ${chartRight},${chartBottom}`
    : '';

  const handleCategoryChange = event => {
    const category = event.target.value;
    setSelectedCategory(category);
    onCategorySelect?.(category);
  };

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-950">Inventory Overview</h2>
          <p className="mt-1 text-xs text-neutral-500">Current stock units by category</p>
        </div>
        <label className="relative">
          <span className="sr-only">Filter inventory chart by category</span>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="h-9 appearance-none rounded-full bg-[#f1f1f1] pl-3 pr-9 text-xs font-semibold text-neutral-700 outline-none ring-1 ring-transparent transition focus:ring-neutral-300"
          >
            <option>All Categories</option>
            {categories.map(category => (
              <option key={category.name} value={category.name}>{category.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        </label>
      </div>

      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight text-neutral-950">{totalStock}</p>
          <p className="text-xs text-neutral-500">Total units in stock</p>
        </div>
        <span className="rounded-full bg-[#e8faef] px-3 py-1 text-xs font-semibold text-[#137a39]">
          {chartData.length} {chartData.length === 1 ? 'category' : 'categories'}
        </span>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-2xl bg-[#f7f7f7] px-5 text-center">
          <p className="text-sm text-neutral-500">Category stock data will appear here.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`Current inventory by category; total ${totalStock} units`}
            className="h-[220px] min-w-[440px] w-full overflow-visible"
          >
            <defs>
              <linearGradient id="tiwlo-inventory-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1ed760" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#1ed760" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
              const y = chartBottom - fraction * (chartBottom - chartTop);
              return (
                <g key={fraction}>
                  <line x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="#e5e5e5" strokeDasharray="3 5" />
                  <text x="0" y={y - 5} fill="#737373" fontSize="10">
                    {Math.round(maxValue * fraction).toLocaleString()}
                  </text>
                </g>
              );
            })}
            {points.length > 1 && (
              <>
                <polygon points={area} fill="url(#tiwlo-inventory-area)" />
                <polyline points={line} fill="none" stroke="#1ed760" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {points.map(point => (
              <g key={point.name}>
                <circle cx={point.x} cy={point.y} r="5" fill="#1ed760" stroke="white" strokeWidth="2" />
                <text x={point.x} y="205" textAnchor="middle" fill="#737373" fontSize="10">
                  {point.name.length > 12 ? `${point.name.slice(0, 11)}…` : point.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}
