import React, { useState, useEffect } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
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
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              Bookmarks
            </h1>
            <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
              @{currentUser?.handle || 'user'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {}}
          className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Bookmarked Posts Stream */}
      <div className="flex flex-col pb-24 md:pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
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
          <div className="py-24 px-8 text-center flex flex-col items-center">
            <h3 className="font-extrabold text-[28px] text-[#0F1419] dark:text-[#E7E9EA] mb-2 leading-tight">
              Save posts for later
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-sm leading-relaxed">
              Don’t let the good ones fly away! Bookmark posts to easily find them again in the future.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
