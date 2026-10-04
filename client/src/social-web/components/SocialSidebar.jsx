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
  MoreHorizontal,
  Plus,
  Settings,
  Radio,
  Vote,
  Film,
  LogOut,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialSidebar({ onNavigateHome }) {
  const { activeTab, navigateTo, currentUser, unreadNotifications, unreadMessages } = useSocial();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const navItems = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'search', label: 'Explore', icon: Compass },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Messages', icon: Mail, badge: unreadMessages },
    { id: 'ai-studio', label: 'Tiwi AI', icon: Sparkles },
    { id: 'communities', label: 'Spaces', icon: Users },
    { id: 'bookmarks', label: 'Saved', icon: Bookmark },
    { id: 'creator', label: 'Creator Hub', icon: Award },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const moreItems = [
    { id: 'creator', label: 'Monetization', icon: DollarSign },
    { id: 'audio-spaces', label: 'Audio Spaces', icon: Radio },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'polls', label: 'Live Polls', icon: Vote },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[72px] xl:w-[260px] h-screen sticky top-0 flex flex-col justify-between py-4 select-none">
      <div className="flex flex-col gap-2 items-center xl:items-start w-full">
        {/* Brand Header: Google-inspired Clean Tiwi Emblem */}
        <div className="flex items-center gap-3 px-3 py-2 w-full justify-center xl:justify-start">
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else navigateTo('feed');
            }}
            className="flex items-center gap-3 group cursor-pointer"
            title="Tiwi Social"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0B57D0] to-[#4285F4] flex items-center justify-center text-white shadow-xs group-hover:shadow-sm transition-all">
              <span className="font-black text-xl tracking-tighter">T</span>
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="font-extrabold text-[20px] tracking-tight text-[#1F1F1F] dark:text-[#E3E3E3]">
                Tiwi
              </span>
              <span className="text-[11px] font-medium text-[#747775] dark:text-[#8E918F] -mt-1">
                Social Workspace
              </span>
            </div>
          </button>
        </div>

        {/* Google-Style "Create Post" Button (like Gmail Compose pill) */}
        <div className="w-full my-2 flex justify-center xl:justify-start px-2">
          {/* Compact Plus Icon for tablet */}
          <button
            onClick={() => navigateTo('create-post')}
            className="xl:hidden w-12 h-12 rounded-2xl bg-[#C2E7FF] dark:bg-[#004A77] hover:bg-[#B3DCFF] dark:hover:bg-[#005A92] text-[#001D35] dark:text-[#C2E7FF] flex items-center justify-center shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
            title="Create Post"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Desktop Sized Compose Pill */}
          <button
            onClick={() => navigateTo('create-post')}
            className="hidden xl:flex items-center gap-3 w-full bg-[#C2E7FF] dark:bg-[#004A77] hover:bg-[#B3DCFF] dark:hover:bg-[#005A92] text-[#001D35] dark:text-[#C2E7FF] font-semibold text-[15px] px-5 py-3.5 rounded-2xl shadow-xs hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>Create Post</span>
          </button>
        </div>

        {/* Primary Navigation Rail Items with Google Pill Highlight */}
        <nav className="flex flex-col gap-1 w-full items-center xl:items-start px-1">
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
                className={`flex items-center justify-center xl:justify-start gap-4 px-3.5 py-3 rounded-full w-12 h-12 xl:w-full xl:h-auto transition-all cursor-pointer relative group ${
                  isActive
                    ? 'bg-[#D3E3FD] dark:bg-[#004A77] text-[#041E49] dark:text-[#C2E7FF] font-semibold'
                    : 'text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] font-medium'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-[22px] h-[22px] transition-transform group-hover:scale-105 ${
                      isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-[#B3261E] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden xl:inline text-[15px] leading-tight tracking-normal">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* More Options Dropdown Button */}
          <div className="relative w-fit xl:w-full">
            <button
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className={`flex items-center justify-center xl:justify-start gap-4 px-3.5 py-3 rounded-full w-12 h-12 xl:w-full xl:h-auto transition-all cursor-pointer text-[#444746] dark:text-[#C4C7C5] hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] font-medium ${
                showMoreMenu ? 'bg-[#E9EEF6] dark:bg-[#282A2C]' : ''
              }`}
            >
              <div className="relative flex items-center justify-center">
                <MoreHorizontal className="w-[22px] h-[22px] stroke-[1.8]" />
              </div>
              <span className="hidden xl:inline text-[15px] leading-tight">
                More
              </span>
            </button>

            {showMoreMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-[#1E1F20] rounded-3xl shadow-lg border border-[#E0E2EC] dark:border-[#444746] py-2 z-50 animate-fadeIn">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setShowMoreMenu(false);
                        navigateTo(item.id);
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition text-left text-[14px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3] cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#747775] dark:text-[#8E918F]" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Bottom Profile / Account Card */}
      <div className="relative w-full px-1">
        <button
          onClick={() => setShowAccountMenu((prev) => !prev)}
          className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] cursor-pointer w-fit xl:w-full transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name || 'User'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-[#E0E2EC] dark:ring-[#444746]"
            />
            <div className="hidden xl:flex flex-col text-left min-w-0 leading-tight">
              <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                <span className="truncate">{currentUser?.name || 'Tiwi Member'}</span>
                {currentUser?.isVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] fill-current inline flex-shrink-0" />
                )}
              </div>
              <span className="text-[12px] text-[#747775] dark:text-[#8E918F] truncate">
                @{currentUser?.handle || 'user'}
              </span>
            </div>
          </div>
          <div className="hidden xl:block text-[#747775] dark:text-[#8E918F]">
            <MoreHorizontal className="w-4 h-4" />
          </div>
        </button>

        {showAccountMenu && (
          <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-[#1E1F20] rounded-3xl shadow-lg border border-[#E0E2EC] dark:border-[#444746] py-2 z-50 animate-fadeIn">
            <div className="px-5 py-3 border-b border-[#E0E2EC] dark:border-[#444746]">
              <div className="text-[14px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                {currentUser?.name || 'Tiwi Member'}
              </div>
              <div className="text-[12px] text-[#747775] dark:text-[#8E918F] truncate">
                @{currentUser?.handle || 'user'}
              </div>
            </div>

            <button
              onClick={() => {
                setShowAccountMenu(false);
                navigateTo('settings', 'account');
              }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition text-left text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[#747775]" />
              <span>Manage Tiwi Account</span>
            </button>

            <button
              onClick={() => {
                setShowAccountMenu(false);
                if (onNavigateHome) onNavigateHome();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-500/10 text-left text-[14px] font-medium text-red-500 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
