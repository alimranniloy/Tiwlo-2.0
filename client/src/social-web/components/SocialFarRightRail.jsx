import React from 'react';
import { useSocial } from '../context/SocialContext';

export default function SocialFarRightRail() {
  const { navigateTo, showToast } = useSocial();

  const yourPages = [
    {
      id: 'yp1',
      name: 'Cynthia Design',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop'
    },
    {
      id: 'yp2',
      name: 'Danny Club',
      badge: 'HS',
      badgeColor: 'bg-[#8B5CF6]'
    }
  ];

  const friends = [
    {
      id: 'f1',
      name: 'Morgan Maxwell',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'
    },
    {
      id: 'f2',
      name: 'Stanley Hudson',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=60&h=60&fit=crop'
    },
    {
      id: 'f3',
      name: 'Allen Ambrose',
      badge: 'HS',
      badgeColor: 'bg-[#EC4899]'
    },
    {
      id: 'f4',
      name: 'Lucas Wright',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=60&h=60&fit=crop'
    },
    {
      id: 'f5',
      name: 'Danny Morales',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop'
    },
    {
      id: 'f6',
      name: 'Jason Gonzalez',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop'
    },
    {
      id: 'f7',
      name: 'Jesus Cooper',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop'
    },
    {
      id: 'f8',
      name: 'Joshua Harris',
      badge: 'JH',
      badgeColor: 'bg-[#00B4D8]'
    },
    {
      id: 'f9',
      name: 'Jimmy Miller',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop'
    }
  ];

  const groups = [
    {
      id: 'g1',
      name: 'Web Designer Hub',
      badge: 'WD',
      badgeColor: 'bg-[#EC4899]'
    },
    {
      id: 'g2',
      name: 'Topcoder Studio',
      badge: 'TI',
      badgeColor: 'bg-[#8B5CF6]'
    },
    {
      id: 'g3',
      name: 'Creative Network',
      badge: 'C',
      badgeColor: 'bg-[#F97316]'
    }
  ];

  return (
    <aside className="w-[180px] xl:w-[200px] flex flex-col py-5 pl-2 select-none flex-shrink-0">
      {/* 1. YOUR PAGES */}
      <div className="mb-6">
        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider block mb-2 px-1">
          Your Pages
        </span>
        <div className="flex flex-col gap-1.5">
          {yourPages.map((p) => (
            <div
              key={p.id}
              onClick={() => showToast(`Opening ${p.name}`, 'info')}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer group"
            >
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full ${p.badgeColor} text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 shadow-xs`}
                >
                  {p.badge}
                </div>
              )}
              <span className="text-[12.5px] font-medium text-[#374151] dark:text-[#D1D5DB] group-hover:text-[#111827] dark:group-hover:text-white truncate">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. FRIENDS */}
      <div className="mb-6">
        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider block mb-2 px-1">
          Friends
        </span>
        <div className="flex flex-col gap-1.5">
          {friends.map((f) => (
            <div
              key={f.id}
              onClick={() => navigateTo('messages')}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer group"
            >
              {f.avatar ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={f.avatar}
                    alt={f.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-[#161822]" />
                </div>
              ) : (
                <div
                  className={`w-7 h-7 rounded-full ${f.badgeColor} text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 shadow-xs`}
                >
                  {f.badge}
                </div>
              )}
              <span className="text-[12.5px] font-medium text-[#374151] dark:text-[#D1D5DB] group-hover:text-[#111827] dark:group-hover:text-white truncate">
                {f.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. GROUPS */}
      <div>
        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider block mb-2 px-1">
          Groups
        </span>
        <div className="flex flex-col gap-1.5">
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => navigateTo('communities')}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer group"
            >
              <div
                className={`w-7 h-7 rounded-full ${g.badgeColor} text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 shadow-xs`}
              >
                {g.badge}
              </div>
              <span className="text-[12.5px] font-medium text-[#374151] dark:text-[#D1D5DB] group-hover:text-[#111827] dark:group-hover:text-white truncate">
                {g.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
