import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

/**
 * Clean Shadcn-style pagination bar for tables with 10/25/50/100 page sizes.
 */
export default function PaginationBar({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className = '',
  itemLabel = 'results',
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeSize = Math.max(1, Number(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const startItem = safeTotal === 0 ? 0 : (safePage - 1) * safeSize + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(safeTotal, safePage * safeSize);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 dark:border-neutral-800 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums font-medium text-neutral-700 dark:text-neutral-300">
          Showing {startItem}–{endItem} of {safeTotal.toLocaleString()} {itemLabel}
        </span>
        {typeof onPageSizeChange === 'function' && (
          <label className="inline-flex items-center gap-1.5">
            <span className="text-neutral-500 dark:text-neutral-400">Rows:</span>
            <select
              value={safeSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 10;
                onPageSizeChange(next);
              }}
              aria-label="Rows per page"
              className="h-7 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#1ED760]/40"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="mr-1.5 tabular-nums text-neutral-500 dark:text-neutral-400">
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange?.(safePage - 1)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange?.(safePage + 1)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
