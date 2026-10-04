import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function StoriesBar() {
  const { currentUser, navigateTo } = useSocial();
  const [stories, setStories] = useState([]);

  useEffect(() => {
    TiwiSocialAPI.getStories(currentUser?.id).then((data) => {
      if (Array.isArray(data)) {
        setStories(data);
      }
    });
  }, [currentUser?.id]);

  return (
    <div className="bg-white dark:bg-[#16161f] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.06] shadow-sm mb-4">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Add Story */}
        <button
          onClick={() => navigateTo('create-story')}
          className="flex flex-col items-center gap-2 flex-shrink-0 group focus:outline-none cursor-pointer"
        >
          <div className="relative w-[60px] h-[60px] rounded-2xl p-0.5 border-2 border-dashed border-violet-300 dark:border-violet-500/40 group-hover:border-violet-500 transition-colors flex items-center justify-center">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt="Your story"
              className="w-[52px] h-[52px] rounded-xl object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white rounded-lg flex items-center justify-center shadow-sm border-2 border-white dark:border-[#16161f]">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-[#65676b] dark:text-[#8a8d91] max-w-[64px] truncate text-center">
            Your Story
          </span>
        </button>

        {/* Stories */}
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => navigateTo('story-view', story.id)}
            className="flex flex-col items-center gap-2 flex-shrink-0 group focus:outline-none cursor-pointer"
          >
            <div className="w-[60px] h-[60px] rounded-2xl p-0.5 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shadow-violet-500/20">
              <img
                src={story.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={story.name}
                className="w-[52px] h-[52px] rounded-xl object-cover border-2 border-white dark:border-[#16161f]"
              />
            </div>
            <span className="text-[11px] font-medium text-[#1c1e21] dark:text-[#e4e6eb] max-w-[64px] truncate text-center">
              {story.name || 'Member'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
