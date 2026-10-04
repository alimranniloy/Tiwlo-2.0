import React, { useState, useEffect } from 'react';
import {
  Search,
  Settings,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function SearchView() {
  const { navigateTo, tabParams } = useSocial();
  const initialQuery = tabParams?.q || '';

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialQuery ? 'top' : 'for_you');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ posts: [], users: [] });
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [followedMap, setFollowedMap] = useState({});

  useEffect(() => {
    TiwiSocialAPI.getTrending().then((trending) => {
      if (Array.isArray(trending) && trending.length > 0) {
        setTrendingTopics(trending);
      } else {
        setTrendingTopics([
          { category: 'Technology', tag: '#ArtificialIntelligence', count: '128K posts' },
          { category: 'Architecture', tag: '#PostgreSQL', count: '94K posts' },
          { category: 'Design', tag: '#GoogleDesign', count: '76K posts' },
          { category: 'Frameworks', tag: '#React19', count: '54K posts' },
          { category: 'Startups', tag: '#NextGenAI', count: '41K posts' },
        ]);
      }
    });
  }, []);

  useEffect(() => {
    if (tabParams?.q) {
      setQuery(tabParams.q);
      executeSearch(tabParams.q);
    }
  }, [tabParams?.q]);

  const executeSearch = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const data = await TiwiSocialAPI.search(searchTerm);
      setResults(data || { posts: [], users: [] });
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const isSearchMode = query.trim().length > 0;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Google App Header with Search Input & Underline Tabs */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md pb-2 mb-3 border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="flex items-center gap-2 pt-2 pb-1 px-1">
          {isSearchMode && (
            <button
              onClick={() => {
                setQuery('');
                setResults({ posts: [], users: [] });
              }}
              className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
              title="Clear"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="flex items-center h-10 bg-white dark:bg-[#303134] rounded-full px-3.5 text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] focus-within:border-[#1a73e8] focus-within:shadow-xs transition">
              <Search className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6] mr-2.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search topics, creators, or keywords"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#5f6368] dark:placeholder-[#9aa0a6]"
              />
            </div>
          </form>

          <button
            onClick={() => navigateTo('settings')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Google Underline Tabs */}
        <div className="flex items-center gap-6 px-2 mt-2">
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
              className={`pb-2 text-[14px] font-medium transition cursor-pointer relative ${
                activeTab === tab.id
                  ? 'text-[#1a73e8] dark:text-[#8ab4f8] font-semibold'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124]'
              }`}
            >
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Content Stream */}
      <div className="flex flex-col pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin" />
          </div>
        ) : isSearchMode ? (
          <div className="flex flex-col gap-3">
            {activeTab === 'people' && results.users?.length > 0 && (
              <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] divide-y divide-[#f1f3f4] dark:divide-[#3c4043] p-1 shadow-xs">
                {results.users.map((u) => {
                  const isFollowing = followedMap[u.id];
                  return (
                    <div
                      key={u.id}
                      onClick={() => navigateTo('profile', u.handle || u.id)}
                      className="p-3 hover:bg-[#f8f9fa] dark:hover:bg-[#202124] rounded-md cursor-pointer transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#dadce0]"
                        />
                        <div className="flex flex-col min-w-0 leading-tight">
                          <div className="flex items-center gap-1 font-medium text-[14px] text-[#202124] dark:text-[#e8eaed] truncate">
                            <span className="truncate">{u.name}</span>
                            {u.isVerified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] truncate">
                            @{u.handle}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(u.id);
                        }}
                        className={`text-[12px] font-medium px-4 py-1.5 rounded-md transition active:scale-95 flex-shrink-0 cursor-pointer shadow-xs ${
                          isFollowing
                            ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed]'
                            : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
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
              <div className="py-16 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6 shadow-xs">
                <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
                  No matching results for "{query}"
                </h3>
                <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                  Try searching for different keywords, topics, or handles.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Google Discover Style Trending Card (rounded-lg) */}
            <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#f1f3f4] dark:border-[#3c4043]">
                <TrendingUp className="w-4 h-4 text-[#1a73e8]" />
                <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed]">
                  What’s happening across Tiwi
                </h3>
              </div>

              <div className="flex flex-col divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                {trendingTopics.map((topic, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const queryTerm = topic.tag ? (topic.tag.startsWith('#') ? topic.tag : `#${topic.tag}`) : topic.title;
                      setQuery(queryTerm);
                      executeSearch(queryTerm);
                    }}
                    className="py-2.5 px-2 hover:bg-[#f8f9fa] dark:hover:bg-[#202124] rounded cursor-pointer transition flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                        {topic.category}
                      </span>
                      <span className="font-medium text-[14px] text-[#1a73e8] dark:text-[#8ab4f8]">
                        {topic.tag || topic.title}
                      </span>
                      <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                        {topic.count || '25K posts'}
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
