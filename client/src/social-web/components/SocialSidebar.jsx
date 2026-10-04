import React from 'react';
import {
  Home,
  Compass,
  Film,
  MessageCircle,
  Bell,
  Radio,
  Users,
  Bookmark,
  Heart,
  Briefcase,
  Sparkles,
  Wallet,
  Vote,
  Calendar,
  Award,
  Clock,
  Settings,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialSidebar() {
  const { activeTab, navigateTo, currentUser, unreadNotifications, unreadMessages } = useSocial();

  const mainNavItems = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'search', label: 'Explore', icon: Compass },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'messages', label: 'Messages', icon: MessageCircle, badge: unreadMessages },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'audio-spaces', label: 'Audio Spaces', icon: Radio },
    { id: 'communities', label: 'Communities', icon: Users },
  ];

  const secondaryNavItems = [
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { id: 'liked-posts', label: 'Liked Posts', icon: Heart },
    { id: 'creator', label: 'Creator Hub', icon: Briefcase },
    { id: 'ai-studio', label: 'AI Studio', icon: Sparkles },
    { id: 'wallet', label: 'Social Wallet', icon: Wallet },
    { id: 'polls', label: 'Live Polls', icon: Vote },
    { id: 'events', label: 'Events Hub', icon: Calendar },
    { id: 'trivia', label: 'Live Trivia', icon: Award },
    { id: 'memories', label: 'Memories', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 hidden md:flex flex-col gap-6 py-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto pr-3">
      {/* Primary Navigation Group */}
      <nav className="flex flex-col gap-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#1E293B] dark:text-[#8AB4F8] font-semibold shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B]/60'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#B3261E] text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-gray-200/80 dark:border-gray-800/80" />

      {/* Secondary Features & Ecosystem */}
      <div className="flex flex-col gap-1">
        <div className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          Ecosystem & Tools
        </div>
        {secondaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex items-center gap-3.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#1E293B] dark:text-[#8AB4F8] font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1E293B]/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mini Profile Chip at Bottom */}
      <div className="mt-auto pt-4 border-t border-gray-200/80 dark:border-gray-800/80">
        <button
          onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
          className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors text-left"
        >
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
            alt={currentUser?.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#1F1F1F] dark:text-white truncate">
              {currentUser?.name || 'Tiwi Member'}
            </div>
            <div className="text-xs text-gray-500 truncate">@{currentUser?.handle || 'user'}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
