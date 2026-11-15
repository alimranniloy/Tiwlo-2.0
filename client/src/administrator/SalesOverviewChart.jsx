import React, { useMemo, useState } from 'react';
import { useAdminCurrency } from './AdminCurrencyContext';

function buildSmoothPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function SalesOverviewChart({
  chartSeries,
  salesData,
  currentRange = '7days',
  onRangeChange
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const { currency, convertUsd, formatMoney } = useAdminCurrency();

  const rangeOptions = [
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '3months', label: '3 Months' }
  ];

  const rawPoints = Array.isArray(chartSeries)
    ? chartSeries
    : Array.isArray(salesData)
      ? salesData
      : null;

  const { plotted, maxDisplayVal } = useMemo(() => {
    if (!rawPoints || rawPoints.length === 0) {
      return { plotted: [], maxDisplayVal: 1 };
    }
    const items = rawPoints.map((pt, idx) => {
      const cashTopupsUsd = Number(pt.cashTopupsUsd ?? pt.topupsUsd ?? pt.sales ?? 0) || 0;
      const cashUsedUsd = Number(pt.cashUsedUsd ?? pt.subscriptionUsedUsd ?? 0) || 0;
      const promoUsedUsd = Number(pt.promoUsedUsd ?? pt.freeCreditsUsedUsd ?? 0) || 0;

      const toActiveValue = (usdVal) => {
        const converted = convertUsd(usdVal);
        return converted !== null ? converted : usdVal;
      };

      const topupsVal = toActiveValue(cashTopupsUsd);
      const cashUsedVal = toActiveValue(cashUsedUsd);
      const promoVal = toActiveValue(promoUsedUsd);

      return {
        idx,
        label: pt.label || pt.date || `#${idx + 1}`,
        cashTopupsUsd,
        cashUsedUsd,
        promoUsedUsd,
        topupsVal,
        cashUsedVal,
        promoVal
      };
    });

    const highest = Math.max(
      1,
      ...items.flatMap((d) => [d.topupsVal, d.cashUsedVal, d.promoVal])
    );

    const chartLeft = 56;
    const chartRight = 568;
    const chartTop = 28;
    const chartBottom = 200;
    const width = chartRight - chartLeft;
    const height = chartBottom - chartTop;

    const withCoords = items.map((item, i) => {
      const x =
        items.length === 1
          ? chartLeft + width / 2
          : chartLeft + (i * width) / (items.length - 1);
      const toY = (val) => chartBottom - Math.min(1, Math.max(0, val / highest)) * height;
      return {
        ...item,
        x,
        yTopups: toY(item.topupsVal),
        yCashUsed: toY(item.cashUsedVal),
        yPromo: toY(item.promoVal)
      };
    });

    return { plotted: withCoords, maxDisplayVal: highest };
  }, [rawPoints, convertUsd]);

  const topupsPts = plotted.map((p) => ({ x: p.x, y: p.yTopups }));
  const cashUsedPts = plotted.map((p) => ({ x: p.x, y: p.yCashUsed }));
  const promoPts = plotted.map((p) => ({ x: p.x, y: p.yPromo }));

  const topupsLine = buildSmoothPath(topupsPts);
  const topupsArea =
    topupsPts.length > 1
      ? `${topupsLine} L ${topupsPts[topupsPts.length - 1].x} 200 L ${topupsPts[0].x} 200 Z`
      : '';
  const cashUsedLine = buildSmoothPath(cashUsedPts);
  const promoLine = buildSmoothPath(promoPts);

  const activePoint = hoveredIndex != null ? plotted[hoveredIndex] || null : null;

  const formatAxisLabel = (val) => {
    if (val === 0) return '0';
    const prefix = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : '';
    return `${prefix}${new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(val)}`;
  };

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between h-full">
      {/* Header with Title, Subtitle & Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Platform Cash vs Free Credit Flow
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Paid cash deposits &amp; subscription usage vs subsidized promo credits
          </p>
        </div>

        <div className="flex items-center self-start p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200/70 dark:border-neutral-800 shrink-0">
          {rangeOptions.map((opt) => {
            const active = currentRange === opt.id;
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => {
                  setHoveredIndex(null);
                  onRangeChange?.(opt.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-200/80 dark:border-neutral-800'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1ED760]" />
          <span className="text-neutral-600 dark:text-neutral-300 font-medium">Cash Top-ups</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a] dark:bg-slate-200" />
          <span className="text-neutral-600 dark:text-neutral-300 font-medium">Cash Used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
          <span className="text-neutral-600 dark:text-neutral-300 font-medium">Free / Promo Credits</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[220px]">
        <svg viewBox="0 0 600 230" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tiwloCashTopupArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1ED760" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1ED760" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[
            { y: 28, val: maxDisplayVal },
            { y: 71, val: maxDisplayVal * 0.75 },
            { y: 114, val: maxDisplayVal * 0.5 },
            { y: 157, val: maxDisplayVal * 0.25 },
            { y: 200, val: 0 }
          ].map((grid, idx) => (
            <g key={idx}>
              <line
                x1="52"
                y1={grid.y}
                x2="574"
                y2={grid.y}
                stroke="currentColor"
                className="text-neutral-200/80 dark:text-neutral-800"
                strokeDasharray={idx === 4 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x="46"
                y={grid.y + 4}
                textAnchor="end"
                className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-medium tabular-nums"
              >
                {formatAxisLabel(grid.val)}
              </text>
            </g>
          ))}

          {topupsPts.length > 1 && <path d={topupsArea} fill="url(#tiwloCashTopupArea)" />}

          {topupsPts.length > 1 && (
            <path
              d={topupsLine}
              fill="none"
              stroke="#1ED760"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {cashUsedPts.length > 1 && (
            <path
              d={cashUsedLine}
              fill="none"
              className="stroke-[#0f172a] dark:stroke-slate-200"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {promoPts.length > 1 && (
            <path
              d={promoLine}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {plotted.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            const showXLabel =
              plotted.length <= 8 || idx === 0 || idx === plotted.length - 1 || idx % Math.ceil(plotted.length / 6) === 0;
            return (
              <g
                key={pt.label + idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(isHovered ? null : idx)}
              >
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1="24"
                    x2={pt.x}
                    y2="200"
                    stroke="currentColor"
                    className="text-neutral-300 dark:text-neutral-700"
                    strokeWidth="1"
                  />
                )}
                <rect x={pt.x - 14} y="20" width="28" height="190" fill="transparent" />

                <circle
                  cx={pt.x}
                  cy={pt.yTopups}
                  r={isHovered ? 5 : 3.5}
                  fill="#1ED760"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={pt.x}
                  cy={pt.yCashUsed}
                  r={isHovered ? 4.5 : 3}
                  className="fill-[#0f172a] dark:fill-slate-200"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={pt.x}
                  cy={pt.yPromo}
                  r={isHovered ? 4.5 : 3}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {showXLabel && (
                  <text
                    x={pt.x}
                    y="220"
                    textAnchor="middle"
                    className="fill-neutral-400 dark:fill-neutral-500 text-[10px] font-medium"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {activePoint && (
          <div
            className="absolute pointer-events-none z-20 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${Math.min(82, Math.max(18, (activePoint.x / 600) * 100))}%`,
              top: `${Math.max(18, (Math.min(activePoint.yTopups, activePoint.yCashUsed, activePoint.yPromo) / 230) * 100)}%`
            }}
          >
            <div className="bg-neutral-950 text-white border border-neutral-800 px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap space-y-1">
              <p className="text-[11px] font-semibold text-neutral-300 border-b border-neutral-800 pb-1">
                {activePoint.label}
              </p>
              <div className="flex items-center justify-between gap-4 tabular-nums">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-[#1ED760]" /> Cash Top-ups
                </span>
                <span className="font-semibold text-white">
                  {formatMoney(activePoint.cashTopupsUsd, { includeUsdFallback: true })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 tabular-nums">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-slate-200" /> Cash Used
                </span>
                <span className="font-semibold text-white">
                  {formatMoney(activePoint.cashUsedUsd, { includeUsdFallback: true })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 tabular-nums">
                <span className="flex items-center gap-1.5 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Free/Promo
                </span>
                <span className="font-semibold text-amber-300">
                  {formatMoney(activePoint.promoUsedUsd, { includeUsdFallback: true })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!rawPoints ? (
        <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-2">
          Cash flow telemetry is loading or unavailable.
        </p>
      ) : rawPoints.length === 0 ? (
        <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 mt-2">
          No cash or promo credit activity recorded in this period.
        </p>
      ) : null}
    </div>
  );
}
