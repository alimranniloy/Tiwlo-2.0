import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';
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
          { category: 'Technology · Trending', tag: '#ArtificialIntelligence', count: '94.2K posts' },
          { category: 'Sports · Trending', tag: '#WorldCup2026', count: '142.8K posts' },
          { category: 'Entertainment · Trending', tag: 'New Music Friday', count: '52.1K posts' },
          { category: 'Business · Trending', tag: '#StockMarket', count: '38.4K posts' },
          { category: 'Development · Trending', tag: '#React19', count: '29.7K posts' },
        ]);
      }
    });
  }, [currentUser?.id]);

  const handleToggleFollow = async (userId) => {
    const isNowFollowing = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNowFollowing }));
    try {
      await TiwiSocialAPI.followUser(userId, currentUser?.id);
    } catch (e) {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNowFollowing }));
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigateTo('search', { q: searchQuery.trim() });
  };

  return (
    <div className="w-full flex flex-col gap-4 py-1 sticky top-0 min-h-screen">
      {/* 1. Search Bar */}
      <div className="sticky top-0 bg-white dark:bg-black pt-1 pb-1 z-10">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="flex items-center bg-[#EFF3F4] dark:bg-[#202327] rounded-full px-4 py-2.5 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] focus-within:border-[#1D9BF0] border border-transparent transition-all">
            <Search className="w-4 h-4 text-[#536471] dark:text-[#71767B] mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[15px] outline-none w-full placeholder-[#536471] dark:placeholder-[#71767B]"
            />
          </div>
        </form>
      </div>

      {/* 2. Subscribe to Premium Card */}
      <div className="bg-[#F7F9F9] dark:bg-[#16181C] rounded-2xl border border-[#EFF3F4] dark:border-[#2F3336] p-4 flex flex-col gap-2.5">
        <h3 className="font-extrabold text-[20px] leading-6 text-[#0F1419] dark:text-[#E7E9EA]">
          Subscribe to Premium
        </h3>
        <p className="text-[15px] text-[#536471] dark:text-[#71767B] leading-5">
          Subscribe to unlock new features and if eligible, receive a share of ads revenue.
        </p>
        <button
          onClick={() => navigateTo('creator')}
          className="bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] font-bold text-[15px] rounded-full px-4 py-2 hover:opacity-90 active:scale-95 transition w-fit mt-0.5"
        >
          Subscribe
        </button>
      </div>

      {/* 3. What's happening (Trending Card) */}
      <div className="bg-[#F7F9F9] dark:bg-[#16181C] rounded-2xl border border-[#EFF3F4] dark:border-[#2F3336] overflow-hidden flex flex-col">
        <h3 className="font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] px-4 pt-3 pb-2">
          What’s happening
        </h3>

        <div className="flex flex-col">
          {trendingTopics.map((topic, idx) => {
            const categoryText = topic.category || 'Trending in Tech';
            const topicText = topic.tag ? (topic.tag.startsWith('#') ? topic.tag : `#${topic.tag}`) : topic.title || 'Breaking';
            const postCount = topic.count || topic.postsCount || '18.4K posts';

            return (
              <div
                key={idx}
                onClick={() => navigateTo('search', { q: topicText })}
                className="px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-start justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[13px] text-[#536471] dark:text-[#71767B] leading-4">
                    {categoryText}
                  </span>
                  <span className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] leading-5 mt-0.5">
                    {topicText}
                  </span>
                  <span className="text-[13px] text-[#536471] dark:text-[#71767B] leading-4 mt-0.5">
                    {postCount}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="w-8 h-8 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => navigateTo('search')}
          className="px-4 py-3.5 text-left text-[15px] text-[#1D9BF0] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
        >
          Show more
        </button>
      </div>

      {/* 4. Who to follow Card */}
      <div className="bg-[#F7F9F9] dark:bg-[#16181C] rounded-2xl border border-[#EFF3F4] dark:border-[#2F3336] overflow-hidden flex flex-col">
        <h3 className="font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] px-4 pt-3 pb-2">
          Who to follow
        </h3>

        <div className="flex flex-col">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((user) => {
              const isFollowing = followedMap[user.id];
              return (
                <div
                  key={user.id}
                  onClick={() => navigateTo('profile', user.handle || user.id)}
                  className="px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1 font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] truncate hover:underline">
                        <span className="truncate">{user.name}</span>
                        {user.isVerified && (
                          <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[14px] text-[#536471] dark:text-[#71767B] truncate">
                        @{user.handle}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFollow(user.id);
                    }}
                    className={`font-bold text-[14px] px-4 py-1.5 rounded-full transition active:scale-95 flex-shrink-0 ${
                      isFollowing
                        ? 'border border-[#CFD9DE] dark:border-[#536471] text-[#0F1419] dark:text-[#E7E9EA] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                        : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] hover:opacity-90'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-[14px] text-[#536471] dark:text-[#71767B]">
              Discovering people you might like...
            </div>
          )}
        </div>

        <button
          onClick={() => navigateTo('search', { tab: 'people' })}
          className="px-4 py-3.5 text-left text-[15px] text-[#1D9BF0] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
        >
          Show more
        </button>
      </div>

      {/* 5. Twitter Footer Links */}
      <footer className="px-4 text-[13px] text-[#536471] dark:text-[#71767B] flex flex-wrap gap-x-2.5 gap-y-1 pb-8">
        <button onClick={() => navigateTo('settings', 'about')} className="hover:underline">Terms of Service</button>
        <button onClick={() => navigateTo('settings', 'privacy')} className="hover:underline">Privacy Policy</button>
        <button onClick={() => navigateTo('settings', 'privacy')} className="hover:underline">Cookie Policy</button>
        <button onClick={() => navigateTo('settings', 'accessibility')} className="hover:underline">Accessibility</button>
        <button onClick={() => navigateTo('settings', 'ads')} className="hover:underline">Ads info</button>
        <span>© {new Date().getFullYear()} Tiwi Corp.</span>
      </footer>
    </div>
  );
}
