import React, { useState, useEffect } from 'react';
import { Search, Hash, User, Image, Flame, CheckCircle2, ArrowRight } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SearchView() {
  const { tabParams, navigateTo } = useSocial();
  const [query, setQuery] = useState(tabParams?.q || '');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'creators' | 'tags' | 'media'
  const [results, setResults] = useState({ users: [], posts: [], tags: [] });
  const [trendingTags, setTrendingTags] = useState([]);

  const executeSearch = async (searchTerm) => {
    try {
      const data = await TiwiSocialAPI.search(searchTerm);
      setResults(data);
    } catch (e) {
      console.warn('Search failed:', e);
    }
  };

  useEffect(() => {
    if (tabParams?.q) {
      setQuery(tabParams.q);
      executeSearch(tabParams.q);
    } else {
      executeSearch('');
    }
  }, [tabParams?.q]);

  useEffect(() => {
    TiwiSocialAPI.getTrending().then((tags) => {
      if (Array.isArray(tags)) setTrendingTags(tags);
    });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      {/* Search Input Banner */}
      <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search creators, keywords, or #hashtags..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              executeSearch(e.target.value);
            }}
            className="w-full pl-12 pr-4 py-3 bg-[#F1F3F4] dark:bg-[#111827] text-sm text-[#1F1F1F] dark:text-white rounded-full border border-transparent focus:border-[#0B57D0] focus:bg-white dark:focus:bg-[#111827] focus:outline-none transition-all"
          />
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'creators', label: 'Creators' },
            { id: 'tags', label: 'Hashtags' },
            { id: 'media', label: 'Photos & Media' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0B57D0] text-white shadow-xs'
                  : 'bg-[#F1F3F4] dark:bg-[#111827] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Creators Results */}
      {(activeTab === 'all' || activeTab === 'creators') && results.users?.length > 0 && (
        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-3">
          <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-[#0B57D0]" />
            Creators
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.users.map((user) => (
              <div
                key={user.id}
                onClick={() => navigateTo('profile', user.handle || user.id)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-[#111827] border border-gray-100 dark:border-gray-800 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1 truncate">
                      {user.name}
                      {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] inline" />}
                    </div>
                    <div className="text-xs text-gray-500 truncate">@{user.handle}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Hashtags Section */}
      {(activeTab === 'all' || activeTab === 'tags') && (
        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-3">
          <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Popular Topics & Hashtags
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(trendingTags.length > 0 ? trendingTags : [
              { tag: 'Technology', postsCount: '2.4K' },
              { tag: 'AIRevolution', postsCount: '1.8K' },
              { tag: 'Photography', postsCount: '950' },
              { tag: 'WebDevelopment', postsCount: '620' },
              { tag: 'DesignInspiration', postsCount: '410' },
              { tag: 'Innovation', postsCount: '380' }
            ]).map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(`#${item.tag}`);
                  executeSearch(`#${item.tag}`);
                }}
                className="p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#111827] hover:bg-[#E8F0FE] dark:hover:bg-[#1E293B] text-left transition-colors flex flex-col gap-1 border border-transparent hover:border-[#0B57D0]/30"
              >
                <div className="text-xs font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-[#0B57D0]" />
                  <span>{item.tag}</span>
                </div>
                <div className="text-[11px] text-gray-500">{item.postsCount || '1.2K'} posts</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Media Grid */}
      {(activeTab === 'all' || activeTab === 'media') && (
        <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-3">
          <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Image className="w-4 h-4 text-emerald-500" />
            Explore Media & Photos
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(results.posts?.length > 0 ? results.posts : [
              { id: 'exp_1', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&h=500&fit=crop' },
              { id: 'exp_2', image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&h=500&fit=crop' },
              { id: 'exp_3', image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=500&h=500&fit=crop' },
              { id: 'exp_4', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&h=500&fit=crop' },
              { id: 'exp_5', image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=500&h=500&fit=crop' },
              { id: 'exp_6', image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&h=500&fit=crop' },
            ]).map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigateTo('post-detail', item.id)}
                className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer group relative"
              >
                <img
                  src={item.image || (Array.isArray(item.images) ? item.images[0] : null)}
                  alt="Explore item"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
