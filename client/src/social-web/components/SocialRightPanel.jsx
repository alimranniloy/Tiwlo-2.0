import React, { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle2, Sparkles, UserPlus, Check } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SocialRightPanel() {
  const { currentUser, navigateTo } = useSocial();
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
          { category: 'Technology', tag: '#ArtificialIntelligence', count: '94.2K posts' },
          { category: 'Architecture', tag: '#CleanCode', count: '48.6K posts' },
          { category: 'Design', tag: '#GoogleDesign', count: '32.1K posts' },
          { category: 'Cloud', tag: '#PostgreSQL', count: '28.4K posts' },
          { category: 'Frameworks', tag: '#React19', count: '21.7K posts' },
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

  return (
    <div className="w-full flex flex-col gap-3.5 sticky top-20">
      {/* 1. Tiwi Creator Pass / Storage Card (Google One Style) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#e8f0fe] dark:bg-[#183153] text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-medium text-[14px] text-[#202124] dark:text-[#e8eaed]">
            Tiwi Creator Pass
          </span>
        </div>
        <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
          High-fidelity media, verified badge, and creator revenue opportunities.
        </p>
        <button
          onClick={() => navigateTo('creator')}
          className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[12px] rounded-md px-4 py-1.5 shadow-xs active:scale-95 transition w-fit mt-1 cursor-pointer"
        >
          View Plans
        </button>
      </div>

      {/* 2. Trending Topics Card (Google Discover Inspired) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs flex flex-col">
        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-[#f1f3f4] dark:border-[#3c4043]">
          <TrendingUp className="w-4 h-4 text-[#1a73e8]" />
          <h3 className="font-medium text-[14px] text-[#202124] dark:text-[#e8eaed]">
            Trending topics
          </h3>
        </div>

        <div className="flex flex-col divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
          {trendingTopics.map((topic, idx) => {
            const topicText = topic.tag
              ? topic.tag.startsWith('#')
                ? topic.tag
                : `#${topic.tag}`
              : topic.title || 'Topic';
            const countText = topic.count || topic.postsCount || '15K posts';

            return (
              <div
                key={idx}
                onClick={() => navigateTo('search', { q: topicText })}
                className="py-2 hover:bg-[#f8f9fa] dark:hover:bg-[#202124] -mx-2 px-2 rounded cursor-pointer transition flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                    {topic.category || 'Trending'}
                  </span>
                  <span className="font-medium text-[13px] text-[#1a73e8] dark:text-[#8ab4f8]">
                    {topicText}
                  </span>
                  <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                    {countText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => navigateTo('search')}
          className="mt-2.5 text-left text-[12px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:underline cursor-pointer"
        >
          View all trending
        </button>
      </div>

      {/* 3. Suggested People / Circles Card */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs flex flex-col">
        <h3 className="font-medium text-[14px] text-[#202124] dark:text-[#e8eaed] mb-2.5 pb-2 border-b border-[#f1f3f4] dark:border-[#3c4043]">
          People you may know
        </h3>

        <div className="flex flex-col gap-2.5">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((user) => {
              const isFollowing = followedMap[user.id];
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div
                    onClick={() => navigateTo('profile', user.handle || user.id)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                  >
                    <img
                      src={
                        user.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'
                      }
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border border-[#dadce0] dark:border-[#5f6368]"
                    />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-[13px] text-[#202124] dark:text-[#e8eaed] truncate">
                          {user.name}
                        </span>
                        {user.isVerified && (
                          <CheckCircle2 className="w-3 h-3 text-[#1a73e8] fill-current flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] truncate">
                        @{user.handle}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleFollow(user.id)}
                    className={`px-3 py-1 rounded-md text-[12px] font-medium transition cursor-pointer flex items-center gap-1 ${
                      isFollowing
                        ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4]'
                        : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              No recommendations right now.
            </p>
          )}
        </div>
      </div>

      {/* 4. Google Style Footer */}
      <div className="px-2 text-[11px] text-[#5f6368] dark:text-[#9aa0a6] flex flex-wrap gap-x-3 gap-y-1">
        <button onClick={() => navigateTo('settings')} className="hover:underline">Privacy</button>
        <button onClick={() => navigateTo('settings')} className="hover:underline">Terms</button>
        <button onClick={() => navigateTo('creator')} className="hover:underline">About Tiwi</button>
        <span>© 2026 Tiwi</span>
      </div>
    </div>
  );
}
