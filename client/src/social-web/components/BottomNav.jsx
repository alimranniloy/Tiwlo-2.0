import React from 'react';
import { Home, Compass, Plus, Film, MessageCircle, User } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function BottomNav() {
  const { activeTab, navigateTo, currentUser, unreadMessages } = useSocial();

  const navItems = [
    { id: 'feed', icon: Home, label: 'Feed' },
    { id: 'search', icon: Compass, label: 'Explore' },
    { id: 'create-post', icon: Plus, label: 'Create', isSpecial: true },
    { id: 'reels', icon: Film, label: 'Reels' },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-800/80 md:hidden px-3 py-1 flex items-center justify-around">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        if (item.isSpecial) {
          return (
            <button
              key={item.id}
              onClick={() => navigateTo('create-post')}
              className="w-11 h-11 -mt-4 bg-[#0B57D0] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#0B57D0]/30 active:scale-95 transition-transform"
              title="Create Post"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => navigateTo(item.id, item.id === 'profile' ? (currentUser?.handle || currentUser?.id) : null)}
            className={`relative flex flex-col items-center py-1.5 px-3 rounded-2xl transition-colors ${
              isActive
                ? 'text-[#0B57D0] dark:text-[#8AB4F8]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            {item.badge > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-[#B3261E] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
