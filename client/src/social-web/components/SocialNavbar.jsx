import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Bell,
  MessageCircle,
  Sun,
  Moon,
  User,
  Bookmark,
  Settings,
  ArrowLeft
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SocialNavbar({ onBackToPortal }) {
  const {
    currentUser,
    activeTab,
    navigateTo,
    isDarkMode,
    toggleDarkMode,
    unreadNotifications,
    unreadMessages,
  } = useSocial();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], posts: [], tags: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  // Search debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      TiwiSocialAPI.search(searchQuery).then((results) => {
        setSearchResults(results || { users: [], posts: [], tags: [] });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    navigateTo('search', { q: searchQuery.trim() });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Back to Main Portal */}
        <div className="flex items-center gap-3">
          {onBackToPortal && (
            <button
              onClick={onBackToPortal}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors"
              title="Return to Tiwlo Portal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => navigateTo('feed')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0B57D0] via-[#4285F4] to-[#1A73E8] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="font-extrabold text-base tracking-tight">T</span>
            </div>
            <div className="hidden sm:block">
              <div className="text-base font-bold text-[#1F1F1F] dark:text-white leading-tight">
                Tiwi <span className="text-[#0B57D0] dark:text-[#8AB4F8] font-normal">Social</span>
              </div>
            </div>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Tiwi creators, hashtags, posts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="w-full pl-10 pr-4 py-2 bg-[#F1F3F4] dark:bg-[#1E293B] text-xs text-[#1F1F1F] dark:text-white rounded-full border border-transparent focus:border-[#0B57D0] focus:bg-white dark:focus:bg-[#111827] focus:outline-none transition-all placeholder:text-gray-400"
            />
          </form>

          {/* Autocomplete Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#111827] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-fadeIn">
              {searchResults.users?.length > 0 && (
                <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-[11px] font-semibold text-gray-400 px-3 py-1">Creators</div>
                  {searchResults.users.slice(0, 3).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSearchOpen(false);
                        navigateTo('profile', u.handle || u.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1E293B] text-left transition-colors"
                    >
                      <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1F1F1F] dark:text-white truncate">{u.name}</div>
                        <div className="text-[11px] text-gray-500">@{u.handle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => navigateTo('create-post')}
            className="flex items-center gap-1.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Post</span>
          </button>

          <button
            onClick={() => navigateTo('notifications')}
            className={`relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors ${
              activeTab === 'notifications' ? 'text-[#0B57D0] dark:text-[#8AB4F8]' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B3261E]" />
            )}
          </button>

          <button
            onClick={() => navigateTo('messages')}
            className={`relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors ${
              activeTab === 'messages' ? 'text-[#0B57D0] dark:text-[#8AB4F8]' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            {unreadMessages > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B3261E]" />
            )}
          </button>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User Profile Avatar Pill */}
          <div ref={profileRef} className="relative ml-1">
            <button
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#0B57D0]/30 transition-all focus:outline-none"
            >
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                alt={currentUser?.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#111827] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50 animate-fadeIn">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-[#1F1F1F] dark:text-white truncate">{currentUser?.name || 'Tiwi Member'}</div>
                  <div className="text-[11px] text-gray-500 truncate">@{currentUser?.handle || 'user'}</div>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1E293B] flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  Your Profile
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('bookmarks');
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1E293B] flex items-center gap-2"
                >
                  <Bookmark className="w-3.5 h-3.5 text-gray-400" />
                  Bookmarks
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('settings');
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1E293B] flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  Settings & Safety
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
