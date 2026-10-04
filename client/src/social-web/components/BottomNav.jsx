import React from 'react';
import { LayoutGrid, Compass, Sparkles, Bell, Mail, Plus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function BottomNav() {
  const { activeTab, navigateTo, unreadNotifications, unreadMessages } = useSocial();

  const navItems = [
    { id: 'feed', icon: LayoutGrid, label: 'Feed' },
    { id: 'search', icon: Compass, label: 'Explore' },
    { id: 'ai-studio', icon: Sparkles, label: 'AI' },
    { id: 'notifications', icon: Bell, label: 'Alerts', badge: unreadNotifications },
    { id: 'messages', icon: Mail, label: 'Chat', badge: unreadMessages },
  ];

  return (
    <>
      {/* Floating Create Button */}
      <button
        type="button"
        onClick={() => navigateTo('create-post')}
        className="fixed right-4 bottom-[72px] w-12 h-12 rounded-2xl bg-[#1E75FF] hover:bg-[#1864DB] text-white flex items-center justify-center shadow-lg shadow-[#1E75FF]/30 hover:scale-105 active:scale-95 transition-all sm:hidden z-30 cursor-pointer"
        title="Create Post"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111319]/95 backdrop-blur-xl border-t border-[#EAECF0] dark:border-[#1E232F] sm:hidden h-[60px] px-2 flex items-center justify-around safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className="flex flex-col items-center justify-center relative cursor-pointer py-1 flex-1 group"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-[#1E75FF]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] group-hover:text-[#111827] dark:group-hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && (
                  <span className="absolute top-0.5 right-1/4 min-w-4 h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive ? 'text-[#1E75FF] font-bold' : 'text-[#9CA3AF]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
