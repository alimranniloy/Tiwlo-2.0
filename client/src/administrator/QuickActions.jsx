import React from 'react';
import {
  Package,
  ShoppingBag,
  Users,
  UserCheck
} from 'lucide-react';

export default function QuickActions({ onAction }) {
  const actions = [
    { id: 'products', label: 'View Products', icon: Package },
    { id: 'orders', label: 'View Orders', icon: ShoppingBag },
    { id: 'customers', label: 'View Customers', icon: Users },
    { id: 'users', label: 'Manage Users', icon: UserCheck }
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200/70 dark:border-neutral-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
        Admin Shortcuts
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => onAction(act.id)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/60 hover:bg-neutral-50/80 dark:hover:bg-neutral-900/30 border border-neutral-200/70 dark:border-neutral-700/60 hover:border-neutral-200 dark:hover:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-700 dark:hover:text-neutral-400 font-semibold text-xs transition-all group shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-700 flex items-center justify-center text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 shadow-2xs shrink-0 transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
