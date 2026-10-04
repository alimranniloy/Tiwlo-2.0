import React, { useState } from 'react';
import {
  Home,
  Search,
  Bell,
  Mail,
  Sparkles,
  Bookmark,
  Users,
  Award,
  User,
  MoreHorizontal,
  Feather,
  Settings,
  Flame,
  Radio,
  Vote,
  Compass,
  Film,
  LogOut,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialSidebar({ onNavigateHome }) {
  const { activeTab, navigateTo, currentUser, unreadNotifications, unreadMessages } = useSocial();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'search', label: 'Explore', icon: Search },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Messages', icon: Mail, badge: unreadMessages },
    { id: 'ai-studio', label: 'Grok / AI', icon: Sparkles },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'creator', label: 'Premium', icon: Award },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const moreItems = [
    { id: 'audio-spaces', label: 'Audio Spaces', icon: Radio },
    { id: 'reels', label: 'Video Reels', icon: Film },
    { id: 'polls', label: 'Live Polls', icon: Vote },
    { id: 'settings', label: 'Settings and privacy', icon: Settings },
  ];

  return (
    <aside className="w-[68px] xl:w-[275px] h-screen sticky top-0 flex flex-col justify-between px-2 xl:px-4 py-2 border-r border-[#EFF3F4] dark:border-[#2F3336] select-none">
      <div className="flex flex-col gap-1 items-center xl:items-start">
        {/* Tiwi / Twitter Iconic Logo Button */}
        <div className="flex items-center gap-2 mb-1 w-full justify-center xl:justify-start">
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else navigateTo('feed');
            }}
            className="w-12 h-12 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors group cursor-pointer"
            title="Tiwi Home"
          >
            {/* Iconic Tiwi Bird / X mark */}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="w-7 h-7 fill-black dark:fill-white transition-transform group-hover:scale-105"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </button>
        </div>

        {/* Primary Navigation Links */}
        <nav className="flex flex-col gap-0.5 w-full items-center xl:items-start">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'profile') {
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  } else {
                    navigateTo(item.id);
                  }
                }}
                className={`flex items-center gap-5 p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors w-fit xl:w-full group cursor-pointer ${
                  isActive ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]' : 'font-normal text-[#0F1419] dark:text-[#E7E9EA]'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-[26px] h-[26px] transition-transform group-hover:scale-105 ${
                      isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#1D9BF0] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-black">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden xl:inline text-[20px] leading-tight tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More Options Dropdown Button */}
          <div className="relative w-fit xl:w-full">
            <button
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className={`flex items-center gap-5 p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors w-fit xl:w-full group cursor-pointer ${
                showMoreMenu ? 'font-bold' : 'font-normal'
              } text-[#0F1419] dark:text-[#E7E9EA]`}
            >
              <div className="relative flex items-center justify-center">
                <MoreHorizontal className="w-[26px] h-[26px] stroke-[1.8] group-hover:scale-105" />
              </div>
              <span className="hidden xl:inline text-[20px] leading-tight tracking-tight">
                More
              </span>
            </button>

            {showMoreMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-black rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] border border-[#EFF3F4] dark:border-[#2F3336] py-2 z-50">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setShowMoreMenu(false);
                        navigateTo(item.id);
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition text-left text-[15px] font-medium text-[#0F1419] dark:text-[#E7E9EA]"
                    >
                      <Icon className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Twitter Iconic Post Button */}
        <div className="w-full mt-4 flex justify-center xl:justify-start">
          {/* Mobile / Compact Post Icon Button */}
          <button
            onClick={() => navigateTo('create-post')}
            className="xl:hidden w-12 h-12 rounded-full bg-[#1D9BF0] hover:bg-[#1A8CD8] active:scale-95 text-white flex items-center justify-center shadow-sm transition cursor-pointer"
            title="Post"
          >
            <Feather className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Full Desktop "Post" Button */}
          <button
            onClick={() => navigateTo('create-post')}
            className="hidden xl:block w-full bg-[#1D9BF0] hover:bg-[#1A8CD8] active:scale-[0.99] text-white font-bold rounded-full py-3.5 text-[17px] shadow-sm transition cursor-pointer text-center"
          >
            Post
          </button>
        </div>
      </div>

      {/* Bottom Profile / Account Switcher Pill */}
      <div className="relative w-full mb-3">
        <button
          onClick={() => setShowAccountMenu((prev) => !prev)}
          className="flex items-center justify-between p-2 xl:p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer w-full transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name || 'User'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="hidden xl:flex flex-col text-left min-w-0 leading-tight">
              <div className="flex items-center gap-1 font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] truncate">
                <span className="truncate">{currentUser?.name || 'Tiwi Member'}</span>
                {currentUser?.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                )}
              </div>
              <span className="text-[14px] text-[#536471] dark:text-[#71767B] truncate">
                @{currentUser?.handle || 'user'}
              </span>
            </div>
          </div>
          <div className="hidden xl:block text-[#0F1419] dark:text-[#E7E9EA]">
            <MoreHorizontal className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
          </div>
        </button>

        {showAccountMenu && (
          <div className="absolute left-0 bottom-full mb-2 w-72 bg-white dark:bg-black rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] border border-[#EFF3F4] dark:border-[#2F3336] py-3 z-50">
            <div className="px-4 py-2 border-b border-[#EFF3F4] dark:border-[#2F3336]">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                  alt={currentUser?.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] truncate">
                    {currentUser?.name || 'Tiwi Member'}
                  </div>
                  <div className="text-[14px] text-[#536471] dark:text-[#71767B] truncate">
                    @{currentUser?.handle || 'user'}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowAccountMenu(false);
                navigateTo('profile', currentUser?.handle || currentUser?.id);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
            >
              <User className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
              View Profile
            </button>

            <button
              onClick={() => {
                setShowAccountMenu(false);
                navigateTo('settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
            >
              <Settings className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
              Settings and privacy
            </button>

            <div className="border-t border-[#EFF3F4] dark:border-[#2F3336] my-1" />

            <button
              onClick={() => {
                setShowAccountMenu(false);
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#F4212E]"
            >
              <LogOut className="w-5 h-5" />
              Log out @{currentUser?.handle || 'user'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
