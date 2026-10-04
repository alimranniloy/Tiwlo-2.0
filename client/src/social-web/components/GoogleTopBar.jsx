import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Bell,
  MessageCircle,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Menu
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function GoogleTopBar({ onToggleSidebar, onNavigateHome }) {
  const {
    currentUser,
    navigateTo,
    isDarkMode,
    toggleDarkMode,
    unreadNotifications,
    unreadMessages
  } = useSocial();

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateTo('search', { q: searchQuery.trim() });
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#111319] border-b border-[#EAECF0] dark:border-[#1E232F] transition-colors">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="sm:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else navigateTo('feed');
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            {/* Square/Tiwi Rounded Blue Loop Logo matching screenshot */}
            <div className="w-[34px] h-[34px] rounded-[10px] bg-[#1E75FF] flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#1E75FF" />
                <path
                  d="M7.5 15.5C7.5 12 9.5 9 13.5 9C16.5 9 17.5 10.5 17.5 12.5C17.5 14.8 15.5 16.5 13 16.5C10.5 16.5 9.5 15 9.5 13.5"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="font-extrabold text-[20px] text-[#111827] dark:text-white tracking-tight">
              Square
            </span>
          </div>
        </div>

        {/* Center: Search pill bar with right-side search icon */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 max-w-[480px] hidden md:block"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[40px] pl-4 pr-11 bg-[#F4F5F7] dark:bg-[#1A1D27] text-[#111827] dark:text-[#E2E8F0] placeholder-[#9CA3AF] text-[13.5px] rounded-full outline-none focus:bg-white dark:focus:bg-[#151821] focus:ring-2 focus:ring-[#1E75FF]/30 border border-transparent focus:border-[#1E75FF]/40 transition-all"
            />
            <button
              type="submit"
              className="absolute right-3.5 text-[#9CA3AF] hover:text-[#1E75FF] transition-colors cursor-pointer"
              title="Search"
            >
              <Search className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
        </form>

        {/* Right: Actions matching screenshot */}
        <div className="flex items-center gap-2">
          {/* Add Friend / UserPlus icon matching screenshot */}
          <button
            type="button"
            onClick={() => navigateTo('followers')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2430] hover:text-[#111827] transition-all cursor-pointer"
            title="Find Friends"
          >
            <UserPlus className="w-[19px] h-[19px] stroke-[1.8]" />
          </button>

          {/* Messages */}
          <button
            type="button"
            onClick={() => navigateTo('messages')}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2430] hover:text-[#111827] transition-all cursor-pointer"
            title="Messages"
          >
            <MessageCircle className="w-[19px] h-[19px] stroke-[1.8]" />
            {unreadMessages > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1E75FF]" />
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => navigateTo('notifications')}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2430] hover:text-[#111827] transition-all cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-[19px] h-[19px] stroke-[1.8]" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2430] transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-[18px] h-[18px] text-amber-400" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* User Account Avatar */}
          <div ref={userMenuRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[#1E75FF]/40 transition cursor-pointer"
            >
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={currentUser?.name || 'Account'}
                className="w-full h-full object-cover"
              />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 top-12 w-64 bg-white dark:bg-[#161822] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 z-50 animate-fadeIn"
              >
                <div className="p-3 border-b border-gray-100 dark:border-gray-800 mb-1 flex items-center gap-3">
                  <img
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt="User"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] text-gray-900 dark:text-white truncate">
                      {currentUser?.name || 'Ahmad Nur Fawaid'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      @{currentUser?.handle || 'fawait'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigateTo('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Settings</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
