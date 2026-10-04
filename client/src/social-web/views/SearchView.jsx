import React, { useState, useEffect } from 'react';
import { Search, Settings, MoreHorizontal, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function SearchView() {
  const { tabParams, navigateTo } = useSocial();
  const [query, setQuery] = useState(tabParams?.q || '');
  const [activeTab, setActiveTab] = useState(tabParams?.q ? 'top' : 'for_you');
  const [results, setResults] = useState({ users: [], posts: [], tags: [] });
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [followedMap, setFollowedMap] = useState({});

  const executeSearch = async (searchTerm) => {
    setLoading(true);
    try {
      const data = await TiwiSocialAPI.search(searchTerm);
      setResults(data || { users: [], posts: [], tags: [] });
    } catch {
      console.warn('Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabParams?.q) {
      setQuery(tabParams.q);
      setActiveTab('top');
      executeSearch(tabParams.q);
    } else {
      executeSearch('');
    }
  }, [tabParams?.q]);

  useEffect(() => {
    TiwiSocialAPI.getTrending().then((tags) => {
      if (Array.isArray(tags) && tags.length > 0) {
        setTrendingTopics(tags);
      } else {
        setTrendingTopics([
          { category: 'Technology · Trending', tag: '#ArtificialIntelligence', count: '94.2K posts' },
          { category: 'Sports · Trending', tag: '#WorldCup2026', count: '142.8K posts' },
          { category: 'Entertainment · Trending', tag: 'New Music Friday', count: '52.1K posts' },
          { category: 'Business · Trending', tag: '#StockMarket', count: '38.4K posts' },
          { category: 'Development · Trending', tag: '#React19', count: '29.7K posts' },
          { category: 'Politics · Trending', tag: 'Global Summit 2026', count: '64.9K posts' },
          { category: 'Science · Trending', tag: 'James Webb Telescope', count: '18.1K posts' },
        ]);
      }
    });
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    executeSearch(query);
  };

  const handleToggleFollow = async (userId) => {
    const isNowFollowing = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNowFollowing }));
    try {
      await TiwiSocialAPI.followUser(userId);
    } catch {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNowFollowing }));
    }
  };

  const isSearchMode = !!query.trim();

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header with Search Input Bar: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="h-[53px] flex items-center gap-3 px-4">
          {isSearchMode && (
            <button
              onClick={() => {
                setQuery('');
                setActiveTab('for_you');
                navigateTo('search');
              }}
              className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="flex items-center h-[42px] bg-[#EFF3F4] dark:bg-[#202327] rounded-full px-4 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] focus-within:border-[#1D9BF0] border border-transparent transition">
              <Search className="w-4 h-4 text-[#536471] dark:text-[#71767B] mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-[15px] outline-none w-full placeholder-[#536471] dark:placeholder-[#71767B]"
              />
            </div>
          </form>

          <button
            onClick={() => navigateTo('settings')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Explore Tabs: 53px height */}
        <div className="h-[53px] flex border-t border-[#EFF3F4] dark:border-[#2F3336] overflow-x-auto no-scrollbar">
          {(isSearchMode
            ? [
                { id: 'top', label: 'Top' },
                { id: 'latest', label: 'Latest' },
                { id: 'people', label: 'People' },
                { id: 'media', label: 'Media' },
              ]
            : [
                { id: 'for_you', label: 'For you' },
                { id: 'trending', label: 'Trending' },
                { id: 'news', label: 'News' },
                { id: 'sports', label: 'Sports' },
                { id: 'entertainment', label: 'Entertainment' },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 h-full min-w-[80px] flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
            >
              <span
                className={`text-[15px] whitespace-nowrap ${
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

      {/* 2. Main Content Stream */}
      <div className="flex flex-col pb-24 md:pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
          </div>
        ) : isSearchMode ? (
          /* Search Results */
          <div>
            {/* If people tab or top tab, show matched users */}
            {(activeTab === 'people' || activeTab === 'top') && results.users?.length > 0 && (
              <div className="border-b border-[#EFF3F4] dark:border-[#2F3336]">
                <div className="px-4 py-3 font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA]">
                  People
                </div>
                {results.users.map((user) => {
                  const isFollowing = followedMap[user.id];
                  return (
                    <div
                      key={user.id}
                      onClick={() => navigateTo('profile', user.handle || user.id)}
                      className="px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-center justify-between gap-3 border-b border-[#EFF3F4] dark:border-[#2F3336]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            user.avatar ||
                            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
                          }
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
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
                            <p className="text-[14px] text-[#0F1419] dark:text-[#E7E9EA] mt-1 line-clamp-1">
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
                })}
              </div>
            )}

            {/* Matched Tweets */}
            {results.posts?.length > 0 ? (
              results.posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-24 px-6 text-center">
                <h3 className="font-extrabold text-[28px] text-[#0F1419] dark:text-[#E7E9EA] mb-2 leading-tight">
                  No results for "{query}"
                </h3>
                <p className="text-[15px] text-[#536471] dark:text-[#71767B]">
                  Try searching for something else, or check your spelling.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Default Explore: Trends for you */
          <div>
            <div className="px-4 py-3 font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] border-b border-[#EFF3F4] dark:border-[#2F3336]">
              Trends for you
            </div>

            <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
              {trendingTopics.map((topic, idx) => {
                const categoryText = topic.category || 'Trending worldwide';
                const topicText = topic.tag ? (topic.tag.startsWith('#') ? topic.tag : `#${topic.tag}`) : topic.title || 'Breaking';
                const postCount = topic.count || topic.postsCount || '22.3K posts';

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setQuery(topicText);
                      setActiveTab('top');
                      executeSearch(topicText);
                    }}
                    className="px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-start justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
                        {categoryText}
                      </span>
                      <span className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] mt-0.5">
                        {topicText}
                      </span>
                      <span className="text-[13px] text-[#536471] dark:text-[#71767B] mt-0.5">
                        {postCount}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
