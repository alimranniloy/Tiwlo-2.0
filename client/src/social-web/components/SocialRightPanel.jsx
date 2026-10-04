import React, { useState, useEffect } from 'react';
import { Radio, Hash, UserPlus, Check, Sparkles, Flame, CheckCircle2 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SocialRightPanel() {
  const { currentUser, navigateTo } = useSocial();
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [activeSpaces, setActiveSpaces] = useState([]);
  const [followedMap, setFollowedMap] = useState({});

  useEffect(() => {
    // 1. Fetch suggested users from real database
    TiwiSocialAPI.getUsers().then((users) => {
      if (Array.isArray(users)) {
        const filtered = users
          .filter((u) => u.id !== currentUser?.id && u.handle !== currentUser?.handle)
          .slice(0, 4);
        setSuggestedUsers(filtered);
      }
    });

    // 2. Fetch trending hashtags
    TiwiSocialAPI.getTrending().then((trending) => {
      if (Array.isArray(trending) && trending.length > 0) {
        setTrendingTags(trending.slice(0, 5));
      } else {
        setTrendingTags([
          { tag: 'Technology', postsCount: '2.4K' },
          { tag: 'AIRevolution', postsCount: '1.8K' },
          { tag: 'Photography', postsCount: '950' },
          { tag: 'WebDevelopment', postsCount: '620' },
          { tag: 'DesignInspiration', postsCount: '410' },
        ]);
      }
    });

    // 3. Fetch active live audio spaces
    TiwiSocialAPI.getAudioSpaces().then((spaces) => {
      if (Array.isArray(spaces)) {
        setActiveSpaces(spaces.filter((s) => s.isLive !== false).slice(0, 2));
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

  return (
    <aside className="w-80 flex-shrink-0 hidden lg:flex flex-col gap-6 py-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto pl-3">
      {/* Live Audio Spaces Card */}
      {activeSpaces.length > 0 && (
        <div className="bg-[#E8F0FE]/60 dark:bg-[#1E293B]/60 p-4 rounded-3xl border border-[#0B57D0]/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B57D0] dark:text-[#8AB4F8] uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0B57D0] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0B57D0]" />
              </span>
              Live Audio Space
            </div>
            <button
              onClick={() => navigateTo('audio-spaces')}
              className="text-xs text-[#0B57D0] hover:underline font-semibold"
            >
              Explore
            </button>
          </div>

          {activeSpaces.map((space) => (
            <div
              key={space.id}
              onClick={() => navigateTo('audio-spaces', space.id)}
              className="bg-white dark:bg-[#111827] p-3 rounded-2xl shadow-xs cursor-pointer hover:shadow-sm transition-all"
            >
              <div className="text-sm font-semibold text-[#1F1F1F] dark:text-white line-clamp-1">
                {space.title || space.topic || 'Open Community Room'}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <Radio className="w-3.5 h-3.5 text-[#0B57D0]" />
                <span>{space.listenerCount || space.participantsCount || 12} listening</span>
                <span>•</span>
                <span>{space.hostName || 'Community'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Creators */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 flex flex-col gap-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white">Who to follow</h3>
          <button
            onClick={() => navigateTo('search')}
            className="text-xs text-[#0B57D0] dark:text-[#8AB4F8] hover:underline font-medium"
          >
            See all
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((user) => {
              const isFollowing = followedMap[user.id];
              return (
                <div key={user.id} className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => navigateTo('profile', user.handle || user.id)}
                    className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1F1F1F] dark:text-white flex items-center gap-1 truncate">
                        {user.name}
                        {user.isVerified && <CheckCircle2 className="w-3 h-3 text-[#0B57D0] inline flex-shrink-0" />}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">@{user.handle}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleToggleFollow(user.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        : 'bg-[#0B57D0] text-white hover:bg-[#0842A0]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-gray-400 py-2 text-center">Finding community members...</div>
          )}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 font-bold text-sm text-[#1F1F1F] dark:text-white">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>Trending on Tiwi</span>
        </div>

        <div className="flex flex-col gap-2">
          {trendingTags.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigateTo('search', { q: `#${item.tag}` })}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#111827] text-left transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-[#1F1F1F] dark:text-white flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-[#0B57D0]" />
                  <span>{item.tag}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{item.postsCount || '1.2K'} posts</div>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">#{idx + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Footer Links */}
      <div className="text-[11px] text-gray-400 dark:text-gray-500 px-2 flex flex-wrap gap-x-3 gap-y-1">
        <button onClick={() => navigateTo('settings', 'about')} className="hover:underline">About Tiwi</button>
        <button onClick={() => navigateTo('settings', 'privacy')} className="hover:underline">Privacy</button>
        <button onClick={() => navigateTo('settings', 'security')} className="hover:underline">Security</button>
        <button onClick={() => navigateTo('settings', 'verification')} className="hover:underline">Verification</button>
        <span>© {new Date().getFullYear()} Tiwlo Ecosystem</span>
      </div>
    </aside>
  );
}
