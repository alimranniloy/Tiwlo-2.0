import React, { useState, useEffect } from 'react';
import { Search, Settings, CheckCircle2, ArrowLeft, TrendingUp, Users, Check } from 'lucide-react';
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
          { category: 'Technology', tag: '#ArtificialIntelligence', count: '94.2K posts' },
          { category: 'Architecture', tag: '#CleanCode', count: '48.6K posts' },
          { category: 'Design', tag: '#MaterialYou', count: '32.1K posts' },
          { category: 'Cloud', tag: '#PostgreSQL', count: '28.4K posts' },
          { category: 'Frameworks', tag: '#React19', count: '21.7K posts' },
          { category: 'Science', tag: '#SpaceExploration', count: '18.1K posts' },
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
    const isNow = !followedMap[userId];
    setFollowedMap((prev) => ({ ...prev, [userId]: isNow }));
    try {
      await TiwiSocialAPI.followUser(userId);
    } catch {
      setFollowedMap((prev) => ({ ...prev, [userId]: !isNow }));
    }
  };

  const isSearchMode = !!query.trim();

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header App Bar with Google Search Pill */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md pb-3 mb-2 border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="h-[56px] flex items-center gap-3 px-2 sm:px-0">
          {isSearchMode && (
            <button
              onClick={() => {
                setQuery('');
                setActiveTab('for_you');
                navigateTo('search');
              }}
              className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="flex items-center h-[46px] bg-white dark:bg-[#1E1F20] rounded-full px-4 text-[#1F1F1F] dark:text-[#E3E3E3] border border-[#E0E2EC] dark:border-[#313335] focus-within:border-[#0B57D0] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 shadow-xs transition">
              <Search className="w-4 h-4 text-[#747775] dark:text-[#8E918F] mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search topics, creators, or keywords"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#747775] dark:placeholder-[#8E918F]"
              />
            </div>
          </form>

          <button
            onClick={() => navigateTo('settings')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Material 3 Segmented Tabs */}
        <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full w-full max-w-md mt-1">
          {(isSearchMode
            ? [
                { id: 'top', label: 'Top' },
                { id: 'people', label: 'Creators' },
                { id: 'media', label: 'Media' },
              ]
            : [
                { id: 'for_you', label: 'Discover' },
                { id: 'trending', label: 'Trending' },
                { id: 'tech', label: 'Technology' },
              ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer text-center ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                  : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Content Stream */}
      <div className="flex flex-col pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
          </div>
        ) : isSearchMode ? (
          <div className="flex flex-col gap-3">
            {activeTab === 'people' && results.users?.length > 0 && (
              <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] divide-y divide-[#E0E2EC]/70 dark:divide-[#313335] p-2 shadow-xs">
                {results.users.map((u) => {
                  const isFollowing = followedMap[u.id];
                  return (
                    <div
                      key={u.id}
                      onClick={() => navigateTo('profile', u.handle || u.id)}
                      className="p-3.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] rounded-2xl cursor-pointer transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-[#E0E2EC] dark:ring-[#444746]"
                        />
                        <div className="flex flex-col min-w-0 leading-tight">
                          <div className="flex items-center gap-1 font-semibold text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                            <span className="truncate">{u.name}</span>
                            {u.isVerified && (
                              <CheckCircle2 className="w-4 h-4 text-[#0B57D0] fill-current inline flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[13px] text-[#747775] dark:text-[#8E918F] truncate">
                            @{u.handle}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(u.id);
                        }}
                        className={`text-[12px] font-semibold px-4 py-1.5 rounded-full transition active:scale-95 flex-shrink-0 cursor-pointer shadow-xs ${
                          isFollowing
                            ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3]'
                            : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {results.posts?.length > 0 ? (
              results.posts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-20 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs">
                <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
                  No matching results for "{query}"
                </h3>
                <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
                  Try searching for different keywords, topics, or handles.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Google Discover Style Trending Card */}
            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-[#0B57D0]" />
                <h3 className="font-bold text-[17px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                  What’s happening across Tiwi
                </h3>
              </div>

              <div className="divide-y divide-[#E0E2EC]/70 dark:divide-[#313335]">
                {trendingTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const tag = topic.tag || topic.title;
                      setQuery(tag);
                      executeSearch(tag);
                    }}
                    className="py-3 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] -mx-2 px-2 rounded-2xl cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[12px] font-medium text-[#747775] dark:text-[#8E918F]">
                        {topic.category || 'Topic'}
                      </span>
                      <h4 className="font-bold text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                        {topic.tag || topic.title}
                      </h4>
                      <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
                        {topic.count || '25K discussions'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
