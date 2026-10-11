import React from 'react';
import { Droplet, Trash2, HardDrive, Camera, Shield } from 'lucide-react';

export default function CloudRecentActivity({ activities = [] }) {
  const getActivityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'droplet':
        return <Droplet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'delete':
        return <Trash2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'backup':
        return <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'snapshot':
        return <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'firewall':
        return <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      default:
        return <Droplet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Recent Activity
        </h3>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
            No recent activity.
          </p>
        ) : activities.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                {getActivityIcon(item.type)}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {item.action}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {item.target}
                </p>
              </div>
            </div>

            <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-2">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
