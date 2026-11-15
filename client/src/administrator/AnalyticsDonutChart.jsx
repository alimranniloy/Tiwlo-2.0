import React, { useMemo, useState } from 'react';

const DEFAULT_PALETTE = [
  '#1ED760',
  '#0EA5E9',
  '#8B5CF6',
  '#14B8A6',
  '#6366F1',
  '#EC4899',
  '#64748B',
];

/**
 * Clean circular SVG Donut / Pie chart with interactive hover state and legend.
 */
export default function AnalyticsDonutChart({
  title,
  subtitle,
  segments = [],
  centerLabel = 'Total',
  centerValue,
  formatValue = (v) => Number(v || 0).toLocaleString(),
  size = 164,
  strokeWidth = 22,
  emptyLabel = 'No recorded data in this period',
  headerRight = null,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const normalized = useMemo(() => {
    const filtered = (segments || [])
      .map((item, idx) => ({
        key: item.key || item.label || `seg-${idx}`,
        label: item.label || 'Other',
        value: Math.max(0, Number(item.value) || 0),
        sublabel: item.sublabel || '',
        color: item.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
      }))
      .filter((item) => item.value > 0);

    const total = filtered.reduce((acc, item) => acc + item.value, 0);
    return { items: filtered, total };
  }, [segments]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const arcs = useMemo(() => {
    if (normalized.total <= 0) return [];
    let cumulative = 0;
    return normalized.items.map((item, idx) => {
      const fraction = item.value / normalized.total;
      const dashLength = fraction * circumference;
      const offset = -cumulative * circumference;
      cumulative += fraction;
      return {
        ...item,
        idx,
        pct: Math.round(fraction * 1000) / 10,
        dashArray: `${Math.max(dashLength - (normalized.items.length > 1 ? 2 : 0), 1)} ${circumference}`,
        dashOffset: offset,
      };
    });
  }, [normalized, circumference]);

  const activeArc = hoveredIdx != null ? arcs[hoveredIdx] : null;
  const displayedCenterValue = activeArc
    ? formatValue(activeArc.value)
    : centerValue !== undefined
      ? centerValue
      : formatValue(normalized.total);
  const displayedCenterLabel = activeArc ? activeArc.label : centerLabel;

  return (
    <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>

      {normalized.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="opacity-35">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-neutral-200 dark:text-neutral-800"
            />
          </svg>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{emptyLabel}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90 overflow-visible"
            >
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-neutral-100 dark:text-neutral-800"
              />
              {arcs.map((arc) => {
                const isHovered = hoveredIdx === arc.idx;
                return (
                  <circle
                    key={arc.key}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={arc.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={arc.dashArray}
                    strokeDashoffset={arc.dashOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-200 cursor-pointer"
                    style={{
                      opacity: hoveredIdx == null || isHovered ? 1 : 0.45,
                    }}
                    onMouseEnter={() => setHoveredIdx(arc.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
              <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums leading-tight">
                {displayedCenterValue}
              </span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[96px] mt-0.5">
                {displayedCenterLabel}
              </span>
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 space-y-2">
            {arcs.map((arc) => {
              const isHovered = hoveredIdx === arc.idx;
              return (
                <div
                  key={arc.key}
                  onMouseEnter={() => setHoveredIdx(arc.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                    isHovered
                      ? 'bg-neutral-100 dark:bg-neutral-800/80'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: arc.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                        {arc.label}
                      </div>
                      {arc.sublabel && (
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {arc.sublabel}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatValue(arc.value)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      ({arc.pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
