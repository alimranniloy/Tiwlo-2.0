import React from 'react';
import { Key, Shield, Globe, Terminal, ChevronRight } from 'lucide-react';

export default function QuickAccessCard({ onSelectAction }) {
  const items = [
    {
      id: 'ssh',
      title: 'SSH Keys',
      desc: 'Manage your keys',
      available: false,
      icon: Key,
      color: 'text-neutral-500 bg-neutral-50 dark:bg-neutral-900/20'
    },
    {
      id: 'firewall',
      title: 'Firewall',
      desc: 'Control your traffic',
      available: false,
      icon: Shield,
      color: 'text-neutral-500 bg-neutral-50 dark:bg-neutral-900/20'
    },
    {
      id: 'domains',
      title: 'Domains',
      desc: 'Manage your domains',
      available: true,
      icon: Globe,
      color: 'text-neutral-500 bg-neutral-50 dark:bg-neutral-900/20'
    },
    {
      id: 'api-tokens',
      title: 'API Tokens',
      desc: 'Access the API',
      available: false,
      icon: Terminal,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs flex flex-col justify-between">
      <div>
        <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider mb-4">
          Quick Access
        </h3>

        <div className="space-y-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!item.available}
                onClick={() => onSelectAction?.(item.title)}
                className="flex w-full items-center justify-between p-1.5 rounded-xl text-left transition group enabled:hover:bg-neutral-50 enabled:dark:hover:bg-gray-800/60 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-600 transition">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      {item.available ? item.desc : 'Not available yet'}
                    </p>
                  </div>
                </div>

                {item.available && <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-gray-600 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 group-hover:translate-x-0.5 transition" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
