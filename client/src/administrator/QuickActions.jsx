import React from 'react';
import { Activity, FileCheck2, Receipt, Store, ShieldAlert, Settings } from 'lucide-react';
import { isAdminViewPermitted } from './AdminSidebar';

export default function QuickActions({ onAction, staffAccess }) {
  const actions = [
    { id: 'orders', label: 'System Orders', icon: Receipt },
    { id: 'customers', label: 'Merchants & Stores', icon: Store },
    { id: 'users', label: 'Risk Monitor', icon: ShieldAlert },
    { id: 'live-visitors', label: 'Live Visitors', icon: Activity },
    { id: 'compliance-audit', label: 'Compliance & Audit', icon: FileCheck2 },
    { id: 'system-settings', label: 'Currency & Settings', icon: Settings }
  ].filter((act) => isAdminViewPermitted(act.id, staffAccess));

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
        Quick Actions
      </h3>

      {actions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                type="button"
                key={act.id}
                onClick={() => onAction(act.id)}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#fafafa] dark:bg-neutral-900/70 hover:bg-[#1ED760]/10 dark:hover:bg-[#1ED760]/15 border border-neutral-200/80 dark:border-neutral-800 hover:border-[#1ED760]/50 text-neutral-800 dark:text-neutral-200 font-medium text-xs transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-[#159f46] dark:group-hover:text-[#1ED760] shrink-0 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{act.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No shortcuts available for your role.
        </p>
      )}
    </div>
  );
}
