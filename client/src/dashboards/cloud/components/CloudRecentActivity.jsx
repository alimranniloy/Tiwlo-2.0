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

  const defaultActivities = [
    { id: '1', action: 'Droplet created', target: 'web-server-01', time: '10:24 AM', type: 'droplet' },
    { id: '2', action: 'Droplet deleted', target: 'old-app-server', time: 'Yesterday', type: 'delete' },
    { id: '3', action: 'Backup completed', target: 'db-backup', time: 'Sep 24, 2025', type: 'backup' },
    { id: '4', action: 'Snapshot created', target: 'app-snapshot', time: 'Sep 22, 2025', type: 'snapshot' },
    { id: '5', action: 'Firewall updated', target: 'web-01', time: 'Sep 20, 2025', type: 'firewall' }
  ];

  const displayList = activities.length > 0 ? activities : defaultActivities;

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Recent Activity
        </h3>
        <button className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer">
          View all
        </button>
      </div>

      <div className="space-y-4">
        {displayList.slice(0, 5).map((item) => (
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
