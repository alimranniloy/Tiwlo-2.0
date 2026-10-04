import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Bell,
  MessageCircle,
  Sun,
  Moon,
  Compass,
  User,
  Bookmark,
  Settings,
  LogOut,
  Sparkles,
  CheckCircle2,
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
      setSearchResults({ users: [], posts: [], tags: [] });
      return;
    }
    const timer = setTimeout(() => {
      TiwiSocialAPI.search(searchQuery).then((results) => {
        setSearchResults(results);
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
    if (searchQuery.trim()) {
      setSearchOpen(false);
      navigateTo('search', { q: searchQuery.trim() });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0B57D0] to-[#4285F4] flex items-center justify-center text-white shadow-md shadow-[#0B57D0]/20 group-hover:scale-105 transition-transform">
              <span className="font-extrabold text-xl tracking-tight">T</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-lg leading-tight tracking-tight text-[#1F1F1F] dark:text-white flex items-center gap-1.5">
                Tiwi <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] text-[#0B57D0] dark:text-[#8AB4F8] font-semibold">Social</span>
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">Connect & Inspire</span>
            </div>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md relative hidden sm:block" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search creators, hashtags, posts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="w-full pl-10 pr-4 py-2 bg-[#F1F3F4] dark:bg-[#1E293B] text-sm text-[#1F1F1F] dark:text-white rounded-full border border-transparent focus:border-[#0B57D0] focus:bg-white dark:focus:bg-[#111827] focus:outline-none transition-all placeholder:text-gray-400"
            />
          </form>

          {/* Instant Search Results Dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 z-50 max-h-96 overflow-y-auto">
              <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Creators</div>
              {searchResults.users?.length > 0 ? (
                searchResults.users.slice(0, 4).map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSearchOpen(false);
                      navigateTo('profile', user.handle || user.id);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-[#F8F9FA] dark:hover:bg-[#111827] rounded-xl text-left transition-colors"
                  >
                    <img
                      src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#1F1F1F] dark:text-white flex items-center gap-1 truncate">
                        {user.name}
                        {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] inline" />}
                      </div>
                      <div className="text-xs text-gray-500 truncate">@{user.handle}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-xs text-gray-500 text-center">No creators found</div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
              <button
                onClick={handleSearchSubmit}
                className="w-full text-center py-2 text-xs font-semibold text-[#0B57D0] dark:text-[#8AB4F8] hover:underline"
              >
                View all results for "{searchQuery}" →
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Create Post Button (Dedicated Page, No Popup!) */}
          <button
            onClick={() => navigateTo('create-post')}
            className="flex items-center gap-2 bg-[#0B57D0] hover:bg-[#0842A0] text-white px-4 py-2 rounded-full font-medium text-sm shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98]"
            title="Create Post"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* Messages */}
          <button
            onClick={() => navigateTo('messages')}
            className={`relative p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors ${
              activeTab === 'messages' ? 'bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#1E293B] dark:text-[#8AB4F8]' : ''
            }`}
            title="Messages"
          >
            <MessageCircle className="w-5 h-5" />
            {unreadMessages > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#B3261E] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigateTo('notifications')}
            className={`relative p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors ${
              activeTab === 'notifications' ? 'bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#1E293B] dark:text-[#8AB4F8]' : ''
            }`}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#B3261E] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-600 dark:text-gray-300 transition-colors"
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Profile Dropdown */}
          <div className="relative ml-1" ref={profileRef}>
            <button
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 focus:outline-none"
            >
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop'}
                alt={currentUser?.name || 'User'}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-transparent hover:ring-[#0B57D0] transition-all"
              />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-semibold text-[#1F1F1F] dark:text-white truncate">
                    {currentUser?.name || 'Tiwi Member'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">@{currentUser?.handle || 'tiwi'}</div>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111827] flex items-center gap-3 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Your Profile
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('bookmarks');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111827] flex items-center gap-3 transition-colors"
                >
                  <Bookmark className="w-4 h-4 text-gray-400" />
                  Bookmarks
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('settings');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111827] flex items-center gap-3 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Settings
                </button>

                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

                {onBackToPortal && (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onBackToPortal();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#0B57D0] dark:text-[#8AB4F8] hover:bg-gray-50 dark:hover:bg-[#111827] flex items-center gap-3 transition-colors font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Tiwlo Portal
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
