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
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
        Admin Shortcuts
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => onAction(act.id)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 hover:bg-blue-50/80 dark:hover:bg-blue-900/30 border border-slate-200/70 dark:border-slate-700/60 hover:border-blue-200 dark:hover:border-blue-800 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 font-semibold text-xs transition-all group shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 shadow-2xs shrink-0 transition-colors">
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
