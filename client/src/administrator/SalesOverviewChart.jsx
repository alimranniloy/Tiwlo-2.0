import React, { useState } from 'react';

export default function SalesOverviewChart({ salesData, currentRange, onRangeChange }) {
  const [activeRange, setActiveRange] = useState(currentRange || '7days');
  const [hoveredPoint, setHoveredPoint] = useState({
    label: 'Sep 29',
    sales: 6842,
    x: 520,
    y: 40
  });

  const rangeOptions = [
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '3months', label: '3 Months' }
  ];

  const handleRangeSelect = (id) => {
    setActiveRange(id);
    onRangeChange?.(id);
  };

  // 7-day default points mapped to SVG viewBox 0 0 600 240
  // Values: $2100 (Sep 23), $3850 (Sep 24), $4200 (Sep 25), $4050 (Sep 26), $4950 (Sep 27), $5120 (Sep 28), $6842 (Sep 29)
  // Max scale is $8000 -> Y=30 (top), $0 -> Y=210 (bottom)
  const defaultPoints = [
    { label: 'Sep 23', sales: 2100, x: 50, y: 165 },
    { label: 'Sep 24', sales: 3850, x: 130, y: 125 },
    { label: 'Sep 25', sales: 4200, x: 210, y: 118 },
    { label: 'Sep 26', sales: 4050, x: 285, y: 122 },
    { label: 'Sep 27', sales: 4950, x: 365, y: 102 },
    { label: 'Sep 28', sales: 5120, x: 445, y: 98 },
    { label: 'Sep 29', sales: 6842, x: 525, y: 55 }
  ];

  const points = (salesData && salesData.length > 0)
    ? salesData.map((d, i) => {
        const x = 50 + (i * (475 / Math.max(1, salesData.length - 1)));
        const maxVal = 8000;
        const normalized = Math.min(1, Math.max(0, d.sales / maxVal));
        const y = 210 - (normalized * 175);
        return { label: d.label, sales: d.sales, x, y };
      })
    : defaultPoints;

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
            Total sales from e-commerce (last 7 days)
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

          {/* Grid lines ($8K, $6K, $4K, $2K, $0) */}
          {[
            { y: 35, label: '$8K' },
            { y: 78, label: '$6K' },
            { y: 122, label: '$4K' },
            { y: 166, label: '$2K' },
            { y: 210, label: '$0' }
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
          <path d={areaPath} fill="url(#blueSalesArea)" />

          {/* Smooth Blue Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Dots on Points */}
          {points.map((pt, idx) => {
            const isHovered = hoveredPoint?.label === pt.label;
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
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-150 z-20"
            style={{
              left: `${(hoveredPoint.x / 600) * 100}%`,
              top: `${Math.max(10, (hoveredPoint.y / 240) * 100 - 6)}%`
            }}
          >
            <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-lg text-center text-xs whitespace-nowrap">
              <p className="text-[10px] text-slate-300 font-medium">{hoveredPoint.label}</p>
              <p className="font-bold text-xs text-white">
                ${Number(hoveredPoint.sales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
