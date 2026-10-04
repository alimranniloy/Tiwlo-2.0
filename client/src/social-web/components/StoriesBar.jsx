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
    <div className="bg-white dark:bg-[#202124] rounded-lg p-4 border border-[#dadce0] dark:border-[#3c4043] shadow-xs mb-4">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
        {/* Add Story Button (Page-NoPopup: Navigates to /tiwi/create-story) */}
        <button
          onClick={() => navigateTo('create-story')}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none cursor-pointer"
        >
          <div className="relative w-15 h-15 rounded-full p-0.5 border-2 border-dashed border-[#1a73e8]/60 group-hover:border-[#1a73e8] transition-colors flex items-center justify-center">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt="Your story"
              className="w-13 h-13 rounded-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#1a73e8] text-white rounded-full flex items-center justify-center border-2 border-white dark:border-[#202124] shadow-xs">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-[#202124] dark:text-[#e8eaed] max-w-[64px] truncate text-center">
            Your Story
          </span>
        </button>

        {/* Community Stories */}
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => navigateTo('story-view', story.id)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
          >
            <div className="w-15 h-15 rounded-full p-[2.5px] bg-gradient-to-tr from-[#EA4335] via-[#FBBC05] to-[#4285F4] flex items-center justify-center group-hover:scale-105 transition-transform">
              <img
                src={story.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={story.name}
                className="w-13 h-13 rounded-full object-cover border-2 border-white dark:border-[#202124]"
              />
            </div>
            <span className="text-[11px] font-medium text-[#202124] dark:text-[#e8eaed] max-w-[64px] truncate text-center">
              {story.name || 'Member'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
