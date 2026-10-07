import React from 'react';
import { Activity, ShoppingBag, UserPlus } from 'lucide-react';

const icons = {
  'shopping-bag': ShoppingBag,
  'user-plus': UserPlus,
  activity: Activity
};

export default function RecentActivities({ activities }) {
  const items = activities || [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Recent Activities</h3>
      {items.length ? (
        <div className="space-y-3.5">
          {items.map(item => {
            const Icon = icons[item.icon] || Activity;
            return (
              <div key={item.id} className="flex items-start justify-between gap-3 p-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{item.target}</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                  {item.timeAgo}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          {activities ? 'No recorded store activity.' : 'Activity data is unavailable.'}
        </p>
      )}
    </div>
  );
}
