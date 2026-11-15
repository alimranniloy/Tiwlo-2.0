import React from 'react';
import { Activity, Wallet, ArrowUpCircle, ShieldAlert, UserPlus } from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';
import { isSuperAdminSensitiveItem } from './AdminHeader';

const ICONS = {
  topup: Wallet,
  wallet: Wallet,
  upgrade: ArrowUpCircle,
  security: ShieldAlert,
  'user-plus': UserPlus,
  activity: Activity
};

export default function RecentActivities({ activities, isSuperAdmin = false }) {
  const { formatMoney } = useAdminCurrency();

  const rawItems = Array.isArray(activities) ? activities : [];
  const items = isSuperAdmin
    ? rawItems
    : rawItems.filter((item) => !isSuperAdminSensitiveItem(item));

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between h-full">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Recent Platform Activity
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Top-ups, plan upgrades &amp; security events
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2.5 flex-1">
          {items.map((item, idx) => {
            const Icon = ICONS[item.icon] || ICONS[item.type] || Activity;
            const isSecurity = item.icon === 'security' || item.type === 'security';
            return (
              <div
                key={item.id || idx}
                className="flex items-start justify-between gap-2.5 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSecurity
                        ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400'
                        : 'bg-[#1ED760]/12 text-[#159f46] dark:text-[#1ED760]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      {item.target}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.amountUsd != null && (
                    <p className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-white">
                      {formatMoney(item.amountUsd)}
                    </p>
                  )}
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                    {item.timeAgo || ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500 my-auto">
          {activities ? 'No recent platform activity recorded.' : 'Activity data is unavailable.'}
        </p>
      )}
    </div>
  );
}
