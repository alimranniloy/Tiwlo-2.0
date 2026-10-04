import React from 'react';
import { Key, Shield, Globe, Terminal, ChevronRight } from 'lucide-react';

export default function QuickAccessCard({ onSelectAction }) {
  const items = [
    {
      id: 'ssh',
      title: 'SSH Keys',
      desc: 'Manage your keys',
      icon: Key,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
    },
    {
      id: 'firewall',
      title: 'Firewall',
      desc: 'Control your traffic',
      icon: Shield,
      color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      id: 'domains',
      title: 'Domains',
      desc: 'Manage your domains',
      icon: Globe,
      color: 'text-sky-500 bg-sky-50 dark:bg-sky-900/20'
    },
    {
      id: 'api-tokens',
      title: 'API Tokens',
      desc: 'Access the API',
      icon: Terminal,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-4">
          Quick Access
        </h3>

        <div className="space-y-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => onSelectAction?.(item.title)}
                className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800/60 transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
