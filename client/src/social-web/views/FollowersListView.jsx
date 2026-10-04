import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Check, UserPlus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function FollowersListView() {
  const { currentUser, navigateTo } = useSocial();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followedMap, setFollowedMap] = useState({});

  useEffect(() => {
    TiwiSocialAPI.getUsers().then((all) => {
      if (Array.isArray(all)) {
        const filtered = all.filter((u) => u.id !== currentUser?.id);
        setUsers(filtered);
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  const handleToggleFollow = async (userId) => {
    const isNow = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNow }));
    try {
      await TiwiSocialAPI.followUser(userId);
    } catch {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNow }));
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen max-w-3xl mx-auto">
      {/* 1. Header App Bar with Google Underline Tabs */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md pb-2 mb-3 border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="h-[48px] flex items-center gap-3 px-1">
          <button
            onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed] leading-tight">
              {currentUser?.name || 'User'}
            </h1>
            <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
              @{currentUser?.handle || 'user'}
            </span>
          </div>
        </div>

        {/* Google Underline Tabs */}
        <div className="flex items-center gap-6 px-2 mt-1">
          <button
            className="pb-2 text-[14px] font-semibold text-[#1a73e8] dark:text-[#8ab4f8] transition cursor-pointer relative"
          >
            <span>Followers</span>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
          </button>
          <button
            onClick={() => navigateTo('following')}
            className="pb-2 text-[14px] font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] transition cursor-pointer"
          >
            Following
          </button>
        </div>
      </div>

      {/* 2. Users List as Google Card Container (rounded-lg) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] divide-y divide-[#f1f3f4] dark:divide-[#3c4043] p-1 shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin" />
          </div>
        ) : users.length > 0 ? (
          users.map((user) => {
            const isFollowing = followedMap[user.id];
            return (
              <div
                key={user.id}
                onClick={() => navigateTo('profile', user.handle || user.id)}
                className="p-3.5 hover:bg-[#f8f9fa] dark:hover:bg-[#202124] rounded-md cursor-pointer transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#dadce0]"
                  />
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-1 font-medium text-[14px] text-[#202124] dark:text-[#e8eaed] truncate">
                      <span className="truncate">{user.name}</span>
                      {user.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] truncate">
                      @{user.handle}
                    </span>
                    {user.bio && (
                      <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] line-clamp-1 mt-0.5">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFollow(user.id);
                  }}
                  className={`text-[12px] font-medium px-4 py-1.5 rounded-md transition active:scale-95 flex-shrink-0 cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed]'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                  }`}
                >
                  {isFollowing ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Following</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <div className="py-14 text-center">
            <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed] mb-1">
              No followers yet
            </h3>
            <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              Share announcements to grow your network circles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
