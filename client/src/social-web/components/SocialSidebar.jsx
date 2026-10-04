import React, { useState } from 'react';
import {
  Home,
  Compass,
  Bell,
  Mail,
  Sparkles,
  Bookmark,
  Users,
  Award,
  User,
  Plus,
  Settings,
  Radio,
  Vote,
  Cloud,
  ChevronDown
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialSidebar() {
  const { activeTab, navigateTo, currentUser, unreadNotifications, unreadMessages } = useSocial();
  const [showMore, setShowMore] = useState(false);

  const primaryItems = [
    { id: 'feed', label: 'Stream', icon: Home },
    { id: 'search', label: 'Explore', icon: Compass },
    { id: 'communities', label: 'Spaces & Circles', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Chat & Direct', icon: Mail, badge: unreadMessages },
    { id: 'ai-studio', label: 'Tiwi AI Assistant', icon: Sparkles },
    { id: 'bookmarks', label: 'Saved collections', icon: Bookmark },
    { id: 'creator', label: 'Creator Studio', icon: Award },
    { id: 'profile', label: 'Your Profile', icon: User },
  ];

  const secondaryItems = [
    { id: 'audio-spaces', label: 'Live Broadcasts', icon: Radio },
    { id: 'polls', label: 'Live Polls', icon: Vote },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[68px] xl:w-[256px] h-full flex flex-col justify-between py-3 select-none flex-shrink-0">
      <div className="flex flex-col gap-3 w-full">
        {/* 1. Google "+ Create" Floating Action Button */}
        <div className="px-2 xl:px-4 mb-2">
          {/* Tablet/Mobile Icon Only */}
          <button
            type="button"
            onClick={() => navigateTo('create-post')}
            className="xl:hidden w-12 h-12 rounded-full bg-white dark:bg-[#303134] hover:bg-[#f8f9fa] dark:hover:bg-[#3c4043] border border-[#dadce0] dark:border-[#5f6368] text-[#3c4043] dark:text-[#e8eaed] flex items-center justify-center shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer mx-auto"
            title="Create Post"
          >
            <Plus className="w-6 h-6 text-[#1a73e8]" />
          </button>

          {/* Desktop Google Workspace Compose Pill Button */}
          <button
            type="button"
            onClick={() => navigateTo('create-post')}
            className="hidden xl:flex items-center gap-3 bg-white dark:bg-[#303134] hover:bg-[#f8f9fa] dark:hover:bg-[#3c4043] border border-[#dadce0] dark:border-[#5f6368] text-[#3c4043] dark:text-[#e8eaed] font-medium text-[14px] px-5 py-3 rounded-full shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            {/* Google 4-Color Styled Plus */}
            <div className="w-5 h-5 flex items-center justify-center font-bold text-lg leading-none text-[#1a73e8]">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span>New post</span>
          </button>
        </div>

        {/* 2. Google Workspace Drawer Navigation Items */}
        <nav className="flex flex-col gap-0.5 w-full">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'profile') {
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  } else {
                    navigateTo(item.id);
                  }
                }}
                className={`flex items-center justify-center xl:justify-start gap-4 py-2.5 px-3 xl:pl-6 xl:pr-4 xl:rounded-r-full rounded-lg transition-colors cursor-pointer text-left relative ${
                  isActive
                    ? 'bg-[#e8f0fe] dark:bg-[#183153] text-[#1967d2] dark:text-[#8ab4f8] font-semibold'
                    : 'text-[#3c4043] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] font-normal'
                }`}
              >
                <div className="relative flex items-center justify-center flex-shrink-0">
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'text-[#1a73e8] dark:text-[#8ab4f8] stroke-[2.2]' : 'stroke-[1.8]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span className="xl:hidden absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#d93025] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                <span className="hidden xl:inline text-[14px] truncate flex-1">
                  {item.label}
                </span>

                {item.badge > 0 && (
                  <span className="hidden xl:flex min-w-5 h-5 px-1.5 bg-[#d93025] text-white text-[11px] font-bold rounded-full items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* More expandable section */}
          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            className="hidden xl:flex items-center gap-4 py-2.5 pl-6 pr-4 rounded-r-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[14px] transition cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            <span>{showMore ? 'Less' : 'More'}</span>
          </button>

          {showMore && (
            <div className="hidden xl:flex flex-col gap-0.5 pt-1">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`flex items-center gap-4 py-2.5 pl-6 pr-4 rounded-r-full transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#e8f0fe] dark:bg-[#183153] text-[#1967d2] dark:text-[#8ab4f8] font-semibold'
                        : 'text-[#3c4043] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] font-normal'
                    }`}
                  >
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                    <span className="text-[14px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* 3. Google Workspace / Google One Storage Meter */}
      <div className="hidden xl:flex flex-col gap-2 px-4 py-3 border-t border-[#dadce0] dark:border-[#3c4043]">
        <div className="flex items-center justify-between text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-[#1a73e8]" />
            <span>Tiwi Cloud</span>
          </div>
          <span className="font-medium text-[#202124] dark:text-[#e8eaed]">15% used</span>
        </div>
        <div className="w-full h-1 bg-[#e8eaed] dark:bg-[#3c4043] rounded-full overflow-hidden">
          <div className="w-[15%] h-full bg-[#1a73e8] rounded-full" />
        </div>
        <div className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] flex justify-between">
          <span>2.3 GB of 15 GB</span>
          <button
            type="button"
            onClick={() => navigateTo('creator')}
            className="text-[#1a73e8] dark:text-[#8ab4f8] font-medium hover:underline cursor-pointer"
          >
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}
