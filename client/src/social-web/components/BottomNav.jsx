import React from 'react';
import { Home, Compass, Sparkles, Bell, Mail, Plus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function BottomNav() {
  const { activeTab, navigateTo, unreadNotifications, unreadMessages } = useSocial();

  const navItems = [
    { id: 'feed', icon: Home, label: 'Stream' },
    { id: 'search', icon: Compass, label: 'Explore' },
    { id: 'ai-studio', icon: Sparkles, label: 'Assistant' },
    { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifications },
    { id: 'messages', icon: Mail, label: 'Chat', badge: unreadMessages },
  ];

  return (
    <>
      {/* Google Floating Action Button (FAB) on Mobile */}
      <button
        type="button"
        onClick={() => navigateTo('create-post')}
        className="fixed right-4 bottom-20 w-14 h-14 rounded-full bg-white dark:bg-[#303134] text-[#1a73e8] dark:text-[#8ab4f8] border border-[#dadce0] dark:border-[#5f6368] flex items-center justify-center shadow-lg transition-transform active:scale-95 sm:hidden z-30 cursor-pointer"
        title="Create Post"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Google Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#202124]/95 backdrop-blur-md border-t border-[#dadce0] dark:border-[#3c4043] sm:hidden h-[56px] px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className="flex flex-col items-center justify-center relative cursor-pointer py-1 flex-1"
            >
              <div
                className={`flex items-center justify-center px-3 py-0.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-[#e8f0fe] dark:bg-[#183153] text-[#1a73e8] dark:text-[#8ab4f8]'
                    : 'text-[#5f6368] dark:text-[#9aa0a6]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && (
                  <span className="absolute top-0 right-4 min-w-3.5 h-3.5 px-0.5 bg-[#d93025] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold text-[#1a73e8] dark:text-[#8ab4f8]' : 'text-[#5f6368] dark:text-[#9aa0a6]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
