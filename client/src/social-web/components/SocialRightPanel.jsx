import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, CheckCircle2, Sparkles, UserPlus, Check } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SocialRightPanel() {
  const { currentUser, navigateTo } = useSocial();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [followedMap, setFollowedMap] = useState({});

  useEffect(() => {
    // 1. Fetch real suggested users from database
    TiwiSocialAPI.getUsers().then((users) => {
      if (Array.isArray(users)) {
        const filtered = users
          .filter((u) => u.id !== currentUser?.id && u.handle !== currentUser?.handle)
          .slice(0, 3);
        setSuggestedUsers(filtered);
      }
    });

    // 2. Fetch real trending tags
    TiwiSocialAPI.getTrending().then((trending) => {
      if (Array.isArray(trending) && trending.length > 0) {
        setTrendingTopics(trending.slice(0, 5));
      } else {
        setTrendingTopics([
          { category: 'Technology', tag: '#ArtificialIntelligence', count: '94.2K discussions' },
          { category: 'Architecture', tag: '#CleanCode', count: '48.6K discussions' },
          { category: 'Design', tag: '#MaterialYou', count: '32.1K discussions' },
          { category: 'Cloud', tag: '#PostgreSQL', count: '28.4K discussions' },
          { category: 'Frameworks', tag: '#React19', count: '21.7K discussions' },
        ]);
      }
    });
  }, [currentUser?.id, currentUser?.handle]);

  const handleToggleFollow = async (userId) => {
    const isNowFollowing = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNowFollowing }));
    try {
      await TiwiSocialAPI.followUser(userId, currentUser?.id);
    } catch {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNowFollowing }));
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateTo('search', { q: searchQuery.trim() });
  };

  return (
    <div className="w-full flex flex-col gap-4 sticky top-0 min-h-screen">
      {/* 1. Google Pill Search Bar */}
      <div className="sticky top-0 bg-[#F8FAFD] dark:bg-[#131314] pt-1 pb-1 z-10">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="flex items-center h-[46px] bg-[#EEF2F6] dark:bg-[#1E1F20] rounded-full px-4 text-[#1F1F1F] dark:text-[#E3E3E3] focus-within:bg-white dark:focus-within:bg-[#282A2C] focus-within:ring-2 focus-within:ring-[#0B57D0]/30 focus-within:border-[#0B57D0] border border-transparent shadow-xs transition-all">
            <Search className="w-4 h-4 text-[#747775] dark:text-[#8E918F] mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search posts, topics, or people"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[14px] outline-none w-full placeholder-[#747775] dark:placeholder-[#8E918F]"
            />
          </div>
        </form>
      </div>

      {/* 2. Tiwi Creator Pass / One Card (Google One Inspired) */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0B57D0]/10 text-[#0B57D0] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3]">
            Tiwi Creator Pass
          </span>
        </div>
        <p className="text-[13px] text-[#444746] dark:text-[#C4C7C5] leading-relaxed">
          Access high-fidelity 1080p media uploads, verified creator badge, and ads revenue sharing.
        </p>
        <button
          onClick={() => navigateTo('creator')}
          className="bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-[13px] rounded-full px-4 py-2 shadow-xs active:scale-95 transition w-fit mt-1 cursor-pointer"
        >
          View Plans
        </button>
      </div>

      {/* 3. Trending Topics Card (Google Discover Inspired) */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#0B57D0]" />
          <h3 className="font-bold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3]">
            Trending on Tiwi
          </h3>
        </div>

        <div className="flex flex-col divide-y divide-[#E0E2EC]/60 dark:divide-[#313335]">
          {trendingTopics.map((topic, idx) => {
            const topicText = topic.tag ? (topic.tag.startsWith('#') ? topic.tag : `#${topic.tag}`) : topic.title || 'Topic';
            const countText = topic.count || topic.postsCount || '15K posts';

            return (
              <div
                key={idx}
                onClick={() => navigateTo('search', { q: topicText })}
                className="py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] -mx-2 px-2 rounded-2xl cursor-pointer transition flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-[#747775] dark:text-[#8E918F]">
                    {topic.category || 'Trending'}
                  </span>
                  <span className="font-bold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                    {topicText}
                  </span>
                  <span className="text-[11px] text-[#747775] dark:text-[#8E918F]">
                    {countText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => navigateTo('search')}
          className="mt-3 text-left text-[13px] font-semibold text-[#0B57D0] hover:underline cursor-pointer"
        >
          Explore all topics
        </button>
      </div>

      {/* 4. Suggested Creators Card */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex flex-col">
        <h3 className="font-bold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-3">
          Suggested for you
        </h3>

        <div className="flex flex-col gap-3">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((user) => {
              const isFollowing = followedMap[user.id];
              return (
                <div
                  key={user.id}
                  onClick={() => navigateTo('profile', user.handle || user.id)}
                  className="flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-[#E0E2EC] dark:ring-[#444746]"
                    />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate group-hover:underline">
                        <span className="truncate">{user.name}</span>
                        {user.isVerified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] fill-current inline flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[12px] text-[#747775] dark:text-[#8E918F] truncate">
                        @{user.handle}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFollow(user.id);
                    }}
                    className={`text-[12px] font-semibold px-3.5 py-1 rounded-full transition active:scale-95 flex-shrink-0 cursor-pointer ${
                      isFollowing
                        ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3] bg-transparent'
                        : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white shadow-xs'
                    }`}
                  >
                    {isFollowing ? (
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Following</span>
                    ) : (
                      'Follow'
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-[13px] text-[#747775] dark:text-[#8E918F]">
              Discovering profiles...
            </div>
          )}
        </div>
      </div>

      {/* 5. Google-Style Footer */}
      <footer className="px-2 text-[12px] text-[#747775] dark:text-[#8E918F] flex flex-wrap gap-x-3 gap-y-1.5 pb-8">
        <button onClick={() => navigateTo('settings', 'about')} className="hover:underline">Privacy</button>
        <button onClick={() => navigateTo('settings', 'about')} className="hover:underline">Terms</button>
        <button onClick={() => navigateTo('settings', 'privacy')} className="hover:underline">Community Guidelines</button>
        <span>© 2026 Tiwi Social</span>
      </footer>
    </div>
  );
}
