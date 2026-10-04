import React from 'react';
import { Home, Compass, Sparkles, Bell, Mail, Plus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function BottomNav() {
  const { activeTab, navigateTo, unreadNotifications, unreadMessages } = useSocial();

  const navItems = [
    { id: 'feed', icon: Home, label: 'Home' },
    { id: 'search', icon: Compass, label: 'Explore' },
    { id: 'ai-studio', icon: Sparkles, label: 'AI' },
    { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifications },
    { id: 'messages', icon: Mail, label: 'Messages', badge: unreadMessages },
  ];

  return (
    <>
      {/* Google Material Floating Action Button (FAB) on Mobile */}
      <button
        onClick={() => navigateTo('create-post')}
        className="fixed right-4 bottom-20 w-14 h-14 rounded-2xl bg-[#C2E7FF] dark:bg-[#004A77] text-[#001D35] dark:text-[#C2E7FF] flex items-center justify-center shadow-lg transition-transform active:scale-95 sm:hidden z-30 cursor-pointer"
        title="Create Post"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* Google Material 3 Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#F8FAFD]/95 dark:bg-[#131314]/95 backdrop-blur-md border-t border-[#E0E2EC] dark:border-[#313335] sm:hidden h-[60px] px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className="flex flex-col items-center justify-center relative cursor-pointer py-1"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all ${
                  isActive
                    ? 'bg-[#D3E3FD] dark:bg-[#004A77] text-[#041E49] dark:text-[#C2E7FF]'
                    : 'text-[#444746] dark:text-[#C4C7C5]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && (
                  <span className="absolute top-0.5 right-2 min-w-3.5 h-3.5 px-0.5 bg-[#B3261E] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-0.5 ${isActive ? 'font-bold text-[#041E49] dark:text-[#C2E7FF]' : 'text-[#747775] dark:text-[#8E918F]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
