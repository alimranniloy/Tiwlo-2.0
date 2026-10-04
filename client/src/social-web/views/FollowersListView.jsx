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
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20">
      {/* 1. Header with Pills */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl pb-3 mb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div className="h-14 flex items-center gap-3 px-1">
          <button
            onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-tight tracking-tight">
              {currentUser?.name || 'User'}
            </h1>
            <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              @{currentUser?.handle || 'user'}
            </span>
          </div>
        </div>

        {/* Modern Pill Tabs */}
        <div className="flex items-center gap-2 px-1 mt-1">
          <button
            className="px-4 py-1.5 rounded-xl text-[13px] font-semibold bg-violet-600 text-white shadow-md shadow-violet-500/20 transition cursor-pointer"
          >
            Followers
          </button>
          <button
            onClick={() => navigateTo('following')}
            className="px-4 py-1.5 rounded-xl text-[13px] font-medium bg-white dark:bg-[#16161f] text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.06] transition cursor-pointer"
          >
            Following
          </button>
        </div>
      </div>

      {/* 2. Users List as Modern Rounded Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.05] p-2 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : users.length > 0 ? (
          users.map((user) => {
            const isFollowing = followedMap[user.id];
            return (
              <div
                key={user.id}
                onClick={() => navigateTo('profile', user.handle || user.id)}
                className="p-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-xl cursor-pointer transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt={user.name}
                    className="w-11 h-11 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0"
                  />
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] truncate">
                      <span className="truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{user.name}</span>
                      {user.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91] truncate">
                      @{user.handle}
                    </span>
                    {user.bio && (
                      <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91] line-clamp-1 mt-0.5">
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
                  className={`text-[12.5px] font-semibold px-4 py-2 rounded-xl transition active:scale-95 flex-shrink-0 cursor-pointer shadow-sm ${
                    isFollowing
                      ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/20'
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
          <div className="py-16 text-center">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
              No followers yet
            </h3>
            <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              Share announcements to grow your network circles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
