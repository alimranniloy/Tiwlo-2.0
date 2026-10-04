import React from 'react';
import { Home, Search, Sparkles, Bell, Mail, Feather } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function BottomNav() {
  const { activeTab, navigateTo, unreadNotifications, unreadMessages } = useSocial();

  const navItems = [
    { id: 'feed', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'ai-studio', icon: Sparkles, label: 'Grok' },
    { id: 'notifications', icon: Bell, label: 'Notifications', badge: unreadNotifications },
    { id: 'messages', icon: Mail, label: 'Messages', badge: unreadMessages },
  ];

  return (
    <>
      {/* Twitter Floating Action Button (FAB) for Post on Mobile */}
      <button
        onClick={() => navigateTo('create-post')}
        className="fixed right-4 bottom-16 w-14 h-14 rounded-full bg-[#1D9BF0] hover:bg-[#1A8CD8] active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform sm:hidden z-30 cursor-pointer"
        title="Post"
      >
        <Feather className="w-6 h-6 stroke-[2.2]" />
      </button>

      {/* Twitter Mobile Bottom Bar: exactly 53px height */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-black/85 backdrop-blur-md border-t border-[#EFF3F4] dark:border-[#2F3336] sm:hidden h-[53px] px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className="relative p-2.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <Icon
                className={`w-6 h-6 ${
                  isActive
                    ? 'text-[#0F1419] dark:text-[#E7E9EA] stroke-[2.5]'
                    : 'text-[#536471] dark:text-[#71767B] stroke-[1.8]'
                }`}
              />
              {item.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-[#1D9BF0] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
