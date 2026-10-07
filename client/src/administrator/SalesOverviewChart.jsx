import React, { useState } from 'react';

export default function SalesOverviewChart({ salesData, currentRange, currency, onRangeChange }) {
  const [activeRange, setActiveRange] = useState(currentRange || '7days');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const rangeOptions = [
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '3months', label: '3 Months' }
  ];

  const handleRangeSelect = (id) => {
    setActiveRange(id);
    setHoveredPoint(null);
    onRangeChange?.(id);
  };

  const hasMixedCurrencies = salesData?.some(point => point.sales === null);
  const maxVal = Math.max(1, ...(salesData || []).map(point => Number(point.sales) || 0));
  const points = !hasMixedCurrencies && salesData
    ? salesData.map((d, i) => {
        const x = 50 + (i * (475 / Math.max(1, salesData.length - 1)));
        const normalized = Math.min(1, Math.max(0, Number(d.sales) / maxVal));
        const y = 210 - (normalized * 175);
        return { label: d.label, sales: Number(d.sales), x, y };
      })
    : [];

  const activeHoveredPoint = points.find(point => point.label === hoveredPoint?.label) || null;

  const selectedRangeLabel = rangeOptions.find(option => option.id === activeRange)?.label || '7 Days';

  // Build smooth cubic bezier SVG path
  const buildSmoothPath = (pts) => {
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} 210 L ${points[0].x} 210 Z`
    : '';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      {/* Header with Title and Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Sales Overview</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {`Paid sales from e-commerce (last ${selectedRangeLabel.toLowerCase()})`}
          </p>
        </div>

        {/* Pill Range Switcher */}
        <div className="flex items-center self-start sm:self-auto p-1 bg-slate-100/80 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
          {rangeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleRangeSelect(opt.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeRange === opt.id
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[220px]">
        <svg
          viewBox="0 0 600 240"
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Soft Blue Gradient Area Fill */}
            <linearGradient id="blueSalesArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[
            { y: 35, label: (maxVal * 1).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
            { y: 78, label: (maxVal * 0.75).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
            { y: 122, label: (maxVal * 0.5).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
            { y: 166, label: (maxVal * 0.25).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
            { y: 210, label: '0' }
          ].map((grid, idx) => (
            <g key={idx}>
              <line
                x1="45"
                y1={grid.y}
                x2="560"
                y2={grid.y}
                stroke="#f1f5f9"
                className="dark:stroke-slate-800"
                strokeDasharray={idx === 4 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x="35"
                y={grid.y + 4}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-medium"
              >
                {grid.label}
              </text>
            </g>
          ))}

          {/* Gradient Area Fill */}
          {points.length > 1 && <path d={areaPath} fill="url(#blueSalesArea)" />}

          {/* Smooth Blue Trend Line */}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Dots on Points */}
          {points.map((pt, idx) => {
            const isHovered = activeHoveredPoint?.label === pt.label;
            return (
              <g
                key={idx}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredPoint(pt)}
                onClick={() => setHoveredPoint(pt)}
              >
                {/* Invisible hover target */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Point ring */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="7"
                    fill="#3b82f6"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 4}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  className="transition-all duration-200"
                />

                {/* X-axis date labels */}
                <text
                  x={pt.x}
                  y="230"
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500 text-[11px] font-medium"
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip matching screenshot (e.g. Sep 29 / $6,842.00) */}
        {activeHoveredPoint && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-150 z-20"
            style={{
              left: `${(activeHoveredPoint.x / 600) * 100}%`,
              top: `${Math.max(10, (activeHoveredPoint.y / 240) * 100 - 6)}%`
            }}
          >
            <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-center text-xs whitespace-nowrap">
              <p className="text-[10px] text-slate-300 font-medium">{activeHoveredPoint.label}</p>
              <p className="font-bold text-xs text-white">
                {currency && currency !== 'Mixed currencies' ? `${currency} ` : ''}{Number(activeHoveredPoint.sales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </div>
        )}
      </div>
      {!salesData ? (
        <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">Sales data is unavailable.</p>
      ) : hasMixedCurrencies ? (
        <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-2">
          Sales from different currencies are not combined in this chart.
        </p>
      ) : salesData.length === 0 ? (
        <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">No sales recorded in this period.</p>
      ) : null}
    </div>
  );
}
