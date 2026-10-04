import React from 'react';
import {
  Clock,
  ArrowRight,
  ShoppingCart,
  Box,
  FileCheck,
  PlusCircle,
  AlertTriangle,
  Trash2
} from 'lucide-react';

export default function RecentActivity({ activities, onDeleteActivity, onViewAll }) {
  const getIconAndStyle = (type) => {
    switch (type) {
      case 'sale':
        return {
          icon: ShoppingCart,
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40'
        };
      case 'stock':
        return {
          icon: Box,
          bg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40'
        };
      case 'purchase':
        return {
          icon: FileCheck,
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40'
        };
      case 'product':
        return {
          icon: PlusCircle,
          bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800/40'
        };
      case 'alert':
      default:
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40'
        };
    }
  };

  const defaultActivities = [
    {
      id: 'act-1',
      type: 'sale',
      title: 'New sale completed',
      subtitle: '#INV-10024 • $245.00',
      time: '2h ago'
    },
    {
      id: 'act-2',
      type: 'stock',
      title: 'Stock updated',
      subtitle: 'Nike T-Shirt • +10 units',
      time: '3h ago'
    },
    {
      id: 'act-3',
      type: 'purchase',
      title: 'Purchase order received',
      subtitle: 'PO-0042 • 500 units',
      time: '5h ago'
    },
    {
      id: 'act-4',
      type: 'product',
      title: 'New product added',
      subtitle: 'Adidas Hoodie',
      time: '6h ago'
    },
    {
      id: 'act-5',
      type: 'alert',
      title: 'Low stock alert',
      subtitle: 'iPhone 15 Case • 5 units',
      time: '7h ago'
    }
  ];

  const items = activities && activities.length > 0 ? activities.slice(0, 6) : defaultActivities;

  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Activity
          </h3>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center space-x-1 group"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3.5">
        {items.map((act) => {
          const { icon: Icon, bg } = getIconAndStyle(act.type);
          return (
            <div
              key={act.id}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/30 transition group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}
                >
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate leading-tight">
                    {act.title}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                    {act.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 ml-2">
                <span className="text-[11px] font-medium text-slate-400">
                  {act.time}
                </span>
                {onDeleteActivity && (
                  <button
                    onClick={() => onDeleteActivity(act.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 transition"
                    title="Delete activity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
