import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

const chartWidth = 640;
const chartHeight = 220;
const chartTop = 12;
const chartBottom = 178;

export default function StockMovementChart({ data = [] }) {
  const rows = Array.isArray(data) ? data : [];
  const values = rows.map(item => ({
    label: item.day || item.label || item.month || '',
    incoming: Number(item.inStock ?? item.in ?? 0),
    outgoing: Number(item.outStock ?? item.out ?? 0),
  }));
  const maxValue = Math.max(1, ...values.flatMap(item => [item.incoming, item.outgoing]));
  const y = value => chartBottom - (value / maxValue) * (chartBottom - chartTop);
  const groupWidth = values.length ? chartWidth / values.length : chartWidth;
  const barWidth = Math.min(20, groupWidth * 0.22);

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-950">Stock Movement</h2>
          <p className="mt-1 text-xs text-neutral-500">Stock received and sold over time</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <ArrowDownToLine className="size-3.5 text-[#1ed760]" aria-hidden="true" />
            Stock in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ArrowUpFromLine className="size-3.5 text-[#121212]" aria-hidden="true" />
            Stock out
          </span>
        </div>
      </div>

      {values.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-2xl bg-[#f7f7f7] px-5 text-center">
          <div>
            <p className="text-sm font-semibold text-neutral-700">No stock movement data yet</p>
            <p className="mt-1 text-xs text-neutral-500">Recorded receiving and sales activity will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Stock received and sold over time"
            className="h-[220px] min-w-[440px] w-full overflow-visible"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((fraction, index) => {
              const lineY = chartBottom - fraction * (chartBottom - chartTop);
              return (
                <g key={fraction}>
                  <line x1="0" x2={chartWidth} y1={lineY} y2={lineY} stroke="#e5e5e5" strokeDasharray={index === 0 ? undefined : '3 5'} />
                  <text x="0" y={lineY - 5} fill="#737373" fontSize="10">
                    {Math.round(maxValue * fraction).toLocaleString()}
                  </text>
                </g>
              );
            })}
            {values.map((item, index) => {
              const center = groupWidth * index + groupWidth / 2;
              const inHeight = (item.incoming / maxValue) * (chartBottom - chartTop);
              const outHeight = (item.outgoing / maxValue) * (chartBottom - chartTop);
              return (
                <g key={`${item.label}-${index}`}>
                  <rect
                    x={center - barWidth - 2}
                    y={y(item.incoming)}
                    width={barWidth}
                    height={Math.max(item.incoming ? 2 : 0, inHeight)}
                    rx="5"
                    fill="#1ed760"
                  />
                  <rect
                    x={center + 2}
                    y={y(item.outgoing)}
                    width={barWidth}
                    height={Math.max(item.outgoing ? 2 : 0, outHeight)}
                    rx="5"
                    fill="#121212"
                  />
                  <text x={center} y="207" textAnchor="middle" fill="#737373" fontSize="11">
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
