import React, { useState, useEffect } from 'react';
import {
  Search,
  Settings,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  UserPlus,
  Sparkles,
  Flame,
  Hash
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
          { category: 'Technology', tag: '#ArtificialIntelligence', count: '128K posts', hot: true },
          { category: 'Architecture', tag: '#PostgreSQL', count: '94K posts', hot: false },
          { category: 'Design Systems', tag: '#ModernUI', count: '76K posts', hot: true },
          { category: 'Web Frameworks', tag: '#React19', count: '54K posts', hot: false },
          { category: 'Startups & Venture', tag: '#NextGenAI', count: '41K posts', hot: false },
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
      {/* 1. Modern Header with Floating Search Input & Pill Tabs */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl pb-3 mb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5 pt-2 pb-1 px-1">
          {isSearchMode && (
            <button
              onClick={() => {
                setQuery('');
                setResults({ posts: [], users: [] });
              }}
              className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
              title="Clear"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="flex items-center h-11 bg-white dark:bg-[#16161f] rounded-2xl px-4 text-[#1c1e21] dark:text-[#e4e6eb] border border-black/[0.06] dark:border-white/[0.08] focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-transparent shadow-xs transition-all">
              <Search className="w-4 h-4 text-[#65676b] dark:text-[#8a8d91] mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search topics, creators, or keywords..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91]"
              />
            </div>
          </form>

          <button
            onClick={() => navigateTo('settings')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Modern Pill Filter Tabs */}
        <div className="flex items-center gap-2 px-1 mt-2 overflow-x-auto no-scrollbar">
          {(isSearchMode
            ? [
                { id: 'top', label: 'Top' },
                { id: 'people', label: 'Creators' },
                { id: 'media', label: 'Media' },
              ]
            : [
                { id: 'for_you', label: 'Explore' },
                { id: 'trending', label: 'Trending' },
                { id: 'tech', label: 'Technology' },
              ]
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 font-semibold'
                    : 'bg-white dark:bg-[#16161f] text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.06]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Content Stream */}
      <div className="flex flex-col pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : isSearchMode ? (
          <div className="flex flex-col gap-3">
            {activeTab === 'people' && results.users?.length > 0 && (
              <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-2 shadow-sm space-y-1">
                {results.users.map((u) => {
                  const isFollowing = followedMap[u.id];
                  return (
                    <div
                      key={u.id}
                      onClick={() => navigateTo('profile', u.handle || u.id)}
                      className="p-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-xl cursor-pointer transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                          alt={u.name}
                          className="w-11 h-11 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <div className="flex flex-col min-w-0 leading-tight">
                          <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] truncate">
                            <span className="truncate">{u.name}</span>
                            {u.isVerified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 fill-current inline flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91] truncate">
                            @{u.handle}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(u.id);
                        }}
                        className={`text-[12.5px] font-semibold px-4 py-2 rounded-xl transition active:scale-95 flex-shrink-0 cursor-pointer shadow-sm ${
                          isFollowing
                            ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-95 shadow-violet-500/20'
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
              <div className="py-20 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-8 shadow-sm">
                <h3 className="font-semibold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
                  No matching results for "{query}"
                </h3>
                <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">
                  Try searching for different keywords, topics, or creator handles.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Trending Card */}
            <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-[#1c1e21] dark:text-[#e4e6eb]">
                    What’s trending across Tiwi
                  </h3>
                  <p className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">Curated top topics updated every hour</p>
                </div>
              </div>

              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {trendingTopics.map((topic, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const queryTerm = topic.tag ? (topic.tag.startsWith('#') ? topic.tag : `#${topic.tag}`) : topic.title;
                      setQuery(queryTerm);
                      executeSearch(queryTerm);
                    }}
                    className="py-3 px-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] rounded-xl cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-bold text-violet-500/50 group-hover:text-violet-600 w-5">
                        #{i + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91] font-medium">
                          {topic.category}
                        </span>
                        <span className="font-bold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {topic.tag || topic.title}
                        </span>
                        <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                          {topic.count || '25K posts'}
                        </span>
                      </div>
                    </div>

                    {topic.hot && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                        <Flame className="w-3 h-3 fill-current" />
                        Trending
                      </span>
                    )}
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
