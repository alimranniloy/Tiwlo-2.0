import React from 'react';
import {
  ShoppingBag,
  UserPlus,
  Cloud,
  Tag,
  Globe,
  RotateCcw
} from 'lucide-react';

export default function RecentActivities({ activities, onViewAll }) {
  const iconMap = {
    'shopping-bag': { icon: ShoppingBag, bg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    'user-plus': { icon: UserPlus, bg: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' },
    'server': { icon: Cloud, bg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    'tag': { icon: Tag, bg: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    'globe': { icon: Globe, bg: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' },
    'refresh-cw': { icon: RotateCcw, bg: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' }
  };

  const items = activities || [
    { id: '1', title: 'New order received', target: 'Order #TWL-1042', timeAgo: '2m ago', icon: 'shopping-bag' },
    { id: '2', title: 'New customer registered', target: 'user@example.com', timeAgo: '12m ago', icon: 'user-plus' },
    { id: '3', title: 'Server deployed', target: 'web-2 (Ubuntu 22.04)', timeAgo: '18m ago', icon: 'server' },
    { id: '4', title: 'Coupon created', target: 'SAVE20 - 20% off', timeAgo: '32m ago', icon: 'tag' },
    { id: '5', title: 'Domain registered', target: 'tiwlo.com', timeAgo: '1h ago', icon: 'globe' },
    { id: '6', title: 'Refund processed', target: 'Order #TWL-1037', timeAgo: '2h ago', icon: 'refresh-cw' }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Activities</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          View All
        </button>
      </div>

      <div className="space-y-3.5">
        {items.map((item) => {
          const config = iconMap[item.icon] || iconMap['shopping-bag'];
          const IconComponent = config.icon;

          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 p-1.5 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {item.target}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                {item.timeAgo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
