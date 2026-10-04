import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function FollowersListView() {
  const { currentUser, navigateTo } = useSocial();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('followers');
  const [followedMap, setFollowedMap] = useState({});

  useEffect(() => {
    TiwiSocialAPI.getUsers().then((all) => {
      if (Array.isArray(all)) {
        setUsers(all.filter((u) => u.id !== currentUser?.id));
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  const handleToggleFollow = async (userId) => {
    const isNow = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNow }));
    try {
      await TiwiSocialAPI.followUser(userId);
    } catch (e) {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNow }));
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="px-4 py-1.5 flex items-center gap-6">
          <button
            onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            className="w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              {currentUser?.name || 'User'}
            </h1>
            <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
              @{currentUser?.handle || 'user'}
            </span>
          </div>
        </div>

        {/* Twitter Tabs: Verified Followers / Followers / Following */}
        <div className="flex border-t border-[#EFF3F4] dark:border-[#2F3336]">
          {[
            { id: 'verified', label: 'Verified Followers' },
            { id: 'followers', label: 'Followers' },
            { id: 'following', label: 'Following', to: 'following' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.to) navigateTo(tab.to);
                else setActiveTab(tab.id);
              }}
              className="flex-1 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative text-center"
            >
              <span
                className={`text-[15px] ${
                  activeTab === tab.id
                    ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                    : 'font-medium text-[#536471] dark:text-[#71767B]'
                }`}
              >
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="flex flex-col pb-24 md:pb-12 divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
          </div>
        ) : users.length > 0 ? (
          users.map((user) => {
            const isFollowing = followedMap[user.id];
            return (
              <div
                key={user.id}
                onClick={() => navigateTo('profile', user.handle || user.id)}
                className="px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <img
                    src={
                      user.avatar ||
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
                    }
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1 font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] truncate">
                      <span className="truncate">{user.name}</span>
                      {user.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[14px] text-[#536471] dark:text-[#71767B] truncate">
                      @{user.handle}
                    </span>
                    {user.bio && (
                      <p className="text-[14px] text-[#0F1419] dark:text-[#E7E9EA] mt-1 leading-relaxed">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFollow(user.id);
                  }}
                  className={`font-bold text-[14px] px-4 py-1.5 rounded-full transition active:scale-95 flex-shrink-0 ${
                    isFollowing
                      ? 'border border-[#CFD9DE] dark:border-[#536471] text-[#0F1419] dark:text-[#E7E9EA]'
                      : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419]'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })
        ) : (
          <div className="py-24 px-8 text-center flex flex-col items-center">
            <h3 className="font-extrabold text-[28px] text-[#0F1419] dark:text-[#E7E9EA] mb-2">
              Looking for followers?
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-sm">
              When people follow this account, they’ll show up here. Posting and interacting with others helps you get noticed!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
