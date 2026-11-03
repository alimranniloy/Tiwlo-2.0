import React from 'react';
import { AlertTriangle, Box, Clock, FileCheck, PlusCircle, ShoppingCart, Trash2 } from 'lucide-react';

const icons = {
  sale: ShoppingCart,
  stock: Box,
  purchase: FileCheck,
  product: PlusCircle,
  alert: AlertTriangle,
};

export default function RecentActivity({ activities = [], onDeleteActivity }) {
  const items = Array.isArray(activities) ? activities.slice(0, 6) : [];

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight text-neutral-950">Recent Activity</h2>
        <p className="mt-1 text-xs text-neutral-500">The latest updates from your store</p>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl bg-[#f7f7f7] px-4 text-center text-sm text-neutral-500">
          No recent store activity.
        </div>
      ) : (
        <ol className="relative ml-1 flex flex-col gap-5 border-l-2 border-neutral-200 pl-5">
          {items.map((activity, index) => {
            const Icon = icons[activity.type] || AlertTriangle;
            return (
              <li key={activity.id || `${activity.title}-${index}`} className="group relative">
                <span className="absolute -left-[27px] top-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#1ed760] ring-4 ring-white" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{activity.title}</p>
                      {activity.subtitle && <p className="mt-0.5 text-xs text-neutral-500">{activity.subtitle}</p>}
                      {activity.time && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-400">
                          <Clock className="size-3" aria-hidden="true" /> {activity.time}
                        </p>
                      )}
                    </div>
                  </div>
                  {onDeleteActivity && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(activity.id)}
                      className="rounded-full p-1 text-neutral-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                      title="Delete activity"
                      aria-label="Delete activity"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
