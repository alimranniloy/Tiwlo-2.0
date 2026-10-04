import React, { useState } from 'react';
import {
  Menu,
  Search,
  Settings,
  HelpCircle,
  Grid,
  Sparkles,
  ShoppingBag,
  MessageCircle,
  X
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function GoogleTopBar({ onToggleSidebar, onNavigateHome }) {
  const { currentUser, navigateTo } = useSocial();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateTo('search');
  };

  const appLauncherItems = [
    {
      name: 'Tiwi Social',
      desc: 'Connect & Share',
      color: 'bg-[#1a73e8]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('feed');
      },
      active: true,
    },
    {
      name: 'Tiwi AI Studio',
      desc: 'Gemini Assistant',
      color: 'bg-[#8e24aa]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('ai-studio');
      },
    },
    {
      name: 'Direct Chat',
      desc: 'Google Chat style',
      color: 'bg-[#1e8e3e]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('messages');
      },
    },
    {
      name: 'Communities',
      desc: 'Spaces & Groups',
      color: 'bg-[#d93025]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('communities');
      },
    },
    {
      name: 'Live Rooms',
      desc: 'Meet Audio Broadcast',
      color: 'bg-[#f29900]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('audio-spaces');
      },
    },
    {
      name: 'Creator Hub',
      desc: 'Studio & Analytics',
      color: 'bg-[#1a73e8]',
      action: () => {
        setShowAppsMenu(false);
        navigateTo('creator');
      },
    },
  ];

  return (
    <header className="sticky top-0 z-50 h-16 w-full bg-white dark:bg-[#202124] border-b border-[#dadce0] dark:border-[#3c4043] px-3 sm:px-4 flex items-center justify-between select-none">
      {/* 1. Left Section: Google Hamburger + Logo */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-10 h-10 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
          title="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (onNavigateHome) onNavigateHome();
            else navigateTo('feed');
          }}
          className="flex items-center gap-1.5 focus:outline-none cursor-pointer group"
          title="Tiwi Social"
        >
          {/* Authentic Google 4-Color styled Tiwi Logo */}
          <div className="flex items-center font-medium text-[22px] tracking-tight">
            <span className="text-[#4285F4] font-semibold text-[23px]">T</span>
            <span className="text-[#EA4335] font-semibold text-[23px]">i</span>
            <span className="text-[#FBBC05] font-semibold text-[23px]">w</span>
            <span className="text-[#34A853] font-semibold text-[23px]">i</span>
            <span className="ml-1.5 text-[18px] font-normal text-[#5f6368] dark:text-[#9aa0a6]">
              Social
            </span>
          </div>
        </button>
      </div>

      {/* 2. Center Section: Authentic Google Pill Search Bar */}
      <div className="flex-1 max-w-[720px] mx-2 sm:mx-6">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex items-center w-full h-11 bg-[#f1f3f4] dark:bg-[#303134] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] focus-within:bg-white dark:focus-within:bg-[#202124] focus-within:shadow-md focus-within:border focus-within:border-[#dadce0] dark:focus-within:border-[#5f6368] rounded-full px-4 transition-all duration-150"
        >
          <Search className="w-5 h-5 text-[#5f6368] dark:text-[#9aa0a6] mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across Tiwi posts, communities, or people"
            className="w-full bg-transparent text-[15px] text-[#202124] dark:text-[#e8eaed] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* 3. Right Section: Google Apps (9-dots), Help, Settings, Profile */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigateTo('ai-studio')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] bg-[#e8f0fe] dark:bg-[#183153] hover:bg-[#d2e3fc] transition"
          title="Tiwi AI Assistant"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Assistant</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('settings')}
          className="w-10 h-10 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Google 9-dots App Launcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowAppsMenu((prev) => !prev);
              setShowUserMenu(false);
            }}
            className={`w-10 h-10 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer ${
              showAppsMenu ? 'bg-[#e8eaed] dark:bg-[#3c4043]' : ''
            }`}
            title="Tiwi Workspace Apps"
          >
            <Grid className="w-5 h-5" />
          </button>

          {showAppsMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-12 w-80 bg-white dark:bg-[#303134] rounded-2xl shadow-xl border border-[#dadce0] dark:border-[#3c4043] p-4 z-50 animate-fadeIn"
            >
              <div className="text-[12px] font-semibold text-[#5f6368] dark:text-[#9aa0a6] px-2 mb-3 uppercase tracking-wider">
                Tiwi Ecosystem Apps
              </div>
              <div className="grid grid-cols-3 gap-2">
                {appLauncherItems.map((app) => (
                  <button
                    key={app.name}
                    onClick={app.action}
                    className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-[#f1f3f4] dark:hover:bg-[#202124] transition text-center group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-full ${app.color} text-white flex items-center justify-center text-sm font-bold shadow-xs group-hover:scale-105 transition-transform`}>
                      {app.name.charAt(0)}
                    </div>
                    <span className="text-[12px] font-medium text-[#202124] dark:text-[#e8eaed] mt-1.5 truncate w-full">
                      {app.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Account Avatar with Google ring */}
        <div className="relative pl-1">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowAppsMenu(false);
            }}
            className="w-9 h-9 rounded-full ring-2 ring-[#1a73e8] p-0.5 hover:opacity-90 transition block flex-shrink-0 cursor-pointer"
            title="Google Account"
          >
            <img
              src={
                currentUser?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={currentUser?.name || 'Account'}
              className="w-full h-full rounded-full object-cover"
            />
          </button>

          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-12 w-72 bg-white dark:bg-[#303134] rounded-2xl shadow-xl border border-[#dadce0] dark:border-[#3c4043] p-4 z-50 animate-fadeIn text-center flex flex-col items-center"
            >
              <img
                src={
                  currentUser?.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop'
                }
                alt="Account"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-[#1a73e8] mb-2"
              />
              <div className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed]">
                {currentUser?.name || 'Tiwi User'}
              </div>
              <div className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] mb-3">
                @{currentUser?.handle || 'user'}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigateTo('profile', currentUser?.handle || currentUser?.id);
                }}
                className="w-full py-2 px-4 rounded-full border border-[#dadce0] dark:border-[#5f6368] text-[13px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f3f4] dark:hover:bg-[#202124] transition mb-2"
              >
                Manage your Tiwi Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigateTo('settings');
                }}
                className="w-full py-2 px-4 text-[13px] font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#202124] rounded-lg transition"
              >
                Account Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
