import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function BookmarksView() {
  const { currentUser, navigateTo } = useSocial();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TiwiSocialAPI.getBookmarks(currentUser?.id).then((data) => {
      setBookmarks(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [currentUser?.id]);

  return (
    <div className="w-full flex flex-col min-h-screen max-w-3xl mx-auto">
      {/* 1. Header App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[20px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
            Saved Posts
          </h1>
          <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Bookmarked Posts Stream */}
      <div className="flex flex-col pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
          </div>
        ) : bookmarks.length > 0 ? (
          bookmarks.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={(id) => setBookmarks((prev) => prev.filter((p) => p.id !== id))}
            />
          ))
        ) : (
          <div className="py-20 px-6 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] shadow-xs flex flex-col items-center">
            <Bookmark className="w-10 h-10 text-[#0B57D0] mb-2" />
            <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              Your collection is empty
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] max-w-sm leading-relaxed">
              Bookmark useful posts and discussions across your stream to review them whenever you want.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
