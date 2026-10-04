import React from 'react';
import {
  LayoutGrid,
  Users,
  Calendar,
  PlaySquare,
  Image as ImageIcon,
  FileText,
  ShoppingBag
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialSidebar() {
  const { activeTab, navigateTo, currentUser } = useSocial();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: LayoutGrid, route: 'feed' },
    { id: 'friends', label: 'Friends', icon: Users, route: 'friends' },
    { id: 'events', label: 'Event', icon: Calendar, route: 'events' },
    { id: 'videos', label: 'Watch Videos', icon: PlaySquare, route: 'videos' },
    { id: 'photos', label: 'Photos', icon: ImageIcon, route: 'photos' },
    { id: 'files', label: 'Files', icon: FileText, route: 'files' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, route: 'marketplace' },
  ];

  const pagesYouLike = [
    {
      id: 'p1',
      name: 'Football FC',
      abbr: 'FF',
      bgColor: 'bg-[#40C057]',
      badge: '120',
      badgeColor: 'bg-[#FF3B30]'
    },
    {
      id: 'p2',
      name: 'Badminton Club',
      abbr: 'BC',
      bgColor: 'bg-[#9333EA]',
    },
    {
      id: 'p3',
      name: 'UI/UX Community',
      abbr: 'UI',
      bgColor: 'bg-[#00B4D8]',
    },
    {
      id: 'p4',
      name: 'Web Designer',
      abbr: 'WD',
      bgColor: 'bg-[#F43F5E]',
    },
  ];

  return (
    <aside className="w-[230px] xl:w-[240px] flex flex-col py-5 select-none flex-shrink-0">
      {/* 1. User Profile Widget matching screenshot */}
      <div
        onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
        className="bg-white dark:bg-[#161822] rounded-2xl p-3 border border-[#EAECF0] dark:border-[#1E232F] flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)] mb-5 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition"
      >
        <img
          src={
            currentUser?.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
          }
          alt={currentUser?.name || 'Ahmad Nur Fawaid'}
          className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5"
        />
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[13.5px] text-[#111827] dark:text-white truncate">
            {currentUser?.name || 'Ahmad Nur Fawaid'}
          </span>
          <span className="text-[11.5px] text-[#9CA3AF] truncate">
            @{currentUser?.handle || 'fawait'}
          </span>
        </div>
      </div>

      {/* 2. Main Navigation Items */}
      <nav className="flex flex-col gap-1 w-full mb-7">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'feed' && activeTab === 'feed') ||
            (item.route && activeTab === item.route);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.route) navigateTo(item.route);
                else navigateTo(item.id);
              }}
              className={`relative flex items-center gap-3.5 py-2.5 px-3 rounded-xl font-medium text-[13.5px] transition-all cursor-pointer text-left ${
                isActive
                  ? 'text-[#1E75FF] font-bold'
                  : 'text-[#4B5563] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
              }`}
            >
              {/* Left blue active vertical pill indicator bar */}
              {isActive && (
                <span className="absolute -left-2 w-1.5 h-6 bg-[#1E75FF] rounded-r-full shadow-sm" />
              )}

              <Icon
                className={`w-[19px] h-[19px] transition-colors ${
                  isActive
                    ? 'text-[#1E75FF] stroke-[2.2]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] stroke-[1.8]'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. PAGES YOU LIKE Section matching screenshot */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider px-3 mb-3">
          Pages You Like
        </span>

        <div className="flex flex-col gap-2">
          {pagesYouLike.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => navigateTo('communities')}
              className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-all cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg ${page.bgColor} text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 shadow-xs`}
                >
                  {page.abbr}
                </div>
                <span className="text-[13px] font-medium text-[#374151] dark:text-[#D1D5DB] group-hover:text-[#111827] dark:group-hover:text-white truncate">
                  {page.name}
                </span>
              </div>

              {page.badge && (
                <span
                  className={`${page.badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 shadow-xs`}
                >
                  {page.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
