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
  ArrowLeft,
  Sparkles,
  CreditCard,
  Zap
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

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#111118]/80 backdrop-blur-xl border-b border-black/[0.05] dark:border-white/[0.06] transition-colors">
      <div className="max-w-[1400px] mx-auto px-4 h-15 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Back to portal */}
        <div className="flex items-center gap-3">
          {onBackToPortal && (
            <button
              onClick={onBackToPortal}
              className="w-9 h-9 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer"
              title="Return to Portal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => navigateTo('feed')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-violet-500/20 group-hover:scale-105 transition-transform">
              T
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Tiwi
            </span>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-md hidden sm:block">
          <div className="flex items-center h-10 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl px-3.5 border border-black/[0.05] dark:border-white/[0.08] focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
            <Search className="w-4 h-4 text-[#65676b] dark:text-[#8a8d91] mr-2.5" />
            <input
              type="text"
              placeholder="Search topics, creators, or keywords..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="bg-transparent text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91]"
            />
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-[#16161f] rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.08] p-3 z-50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#65676b] dark:text-[#8a8d91] px-2 block mb-2">
                Quick Results
              </span>
              <button
                onClick={() => {
                  setSearchOpen(false);
                  navigateTo('search', { q: searchQuery });
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/10 text-xs font-semibold text-violet-600 dark:text-violet-400 transition"
              >
                Search all results for "{searchQuery}" →
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2">
          {/* Create Post Button */}
          <button
            onClick={() => navigateTo('create-post')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Post</span>
          </button>

          {/* Messages */}
          <button
            onClick={() => navigateTo('messages')}
            className="w-9 h-9 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] relative transition cursor-pointer"
            title="Messages"
          >
            <MessageCircle className="w-5 h-5" />
            {unreadMessages > 0 && (
              <span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600" />
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigateTo('notifications')}
            className="w-9 h-9 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] relative transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Profile Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="w-9 h-9 rounded-xl overflow-hidden ring-2 ring-violet-500/40 hover:ring-violet-500 transition cursor-pointer"
            >
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                alt={currentUser?.name || 'Account'}
                className="w-full h-full object-cover"
              />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 top-12 w-56 bg-white dark:bg-[#16161f] rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.08] p-2 z-50">
                <div className="p-3 border-b border-black/[0.05] dark:border-white/[0.05] mb-1">
                  <div className="font-semibold text-xs text-[#1c1e21] dark:text-[#e4e6eb] truncate">
                    {currentUser?.name || 'User'}
                  </div>
                  <div className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                    @{currentUser?.handle || 'user'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('profile', currentUser?.handle || currentUser?.id);
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-semibold text-[#1c1e21] dark:text-[#e4e6eb] transition text-left"
                >
                  <User className="w-4 h-4 text-[#65676b]" />
                  <span>Your Profile</span>
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('creator');
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-semibold text-[#1c1e21] dark:text-[#e4e6eb] transition text-left"
                >
                  <Zap className="w-4 h-4 text-violet-500" />
                  <span>Creator Hub</span>
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('wallet');
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-semibold text-[#1c1e21] dark:text-[#e4e6eb] transition text-left"
                >
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <span>Wallet</span>
                </button>

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigateTo('settings');
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-semibold text-[#1c1e21] dark:text-[#e4e6eb] transition text-left"
                >
                  <Settings className="w-4 h-4 text-[#65676b]" />
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
