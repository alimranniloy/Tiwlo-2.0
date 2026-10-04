import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Check } from 'lucide-react';
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
      {/* 1. Header App Bar with Google Segmented Tabs */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md pb-3 mb-2 border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="h-[56px] flex items-center gap-4 px-2 sm:px-0">
          <button
            onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[20px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
              {currentUser?.name || 'User'}
            </h1>
            <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
              @{currentUser?.handle || 'user'}
            </span>
          </div>
        </div>

        {/* Material 3 Segmented Tabs */}
        <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full w-full max-w-xs mt-1">
          <button
            className="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs text-center"
          >
            Followers
          </button>
          <button
            onClick={() => navigateTo('following')}
            className="flex-1 py-1.5 rounded-full text-[13px] font-semibold transition text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F] text-center"
          >
            Following
          </button>
        </div>
      </div>

      {/* 2. Users List as Google Card Container */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] divide-y divide-[#E0E2EC]/70 dark:divide-[#313335] p-2 shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
          </div>
        ) : users.length > 0 ? (
          users.map((user) => {
            const isFollowing = followedMap[user.id];
            return (
              <div
                key={user.id}
                onClick={() => navigateTo('profile', user.handle || user.id)}
                className="p-4 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] rounded-2xl cursor-pointer transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt={user.name}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-1 ring-[#E0E2EC]"
                  />
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-1 font-semibold text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                      <span className="truncate">{user.name}</span>
                      {user.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-[#0B57D0] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[13px] text-[#747775] dark:text-[#8E918F] truncate">
                      @{user.handle}
                    </span>
                    {user.bio && (
                      <p className="text-[13px] text-[#444746] dark:text-[#C4C7C5] line-clamp-1 mt-1">
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
                  className={`text-[12px] font-semibold px-4 py-1.5 rounded-full transition active:scale-95 flex-shrink-0 cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3] bg-transparent'
                      : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white'
                  }`}
                >
                  {isFollowing ? (
                    <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Following</span>
                  ) : (
                    'Follow back'
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center text-[#747775] text-[14px]">
            No followers found.
          </div>
        )}
      </div>
    </div>
  );
}
