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
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#dadce0] dark:border-[#3c4043] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[18px] font-medium text-[#202124] dark:text-[#e8eaed] leading-tight">
            Saved Posts
          </h1>
          <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Bookmarked Posts Stream */}
      <div className="flex flex-col pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin" />
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
          <div className="py-16 px-6 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex flex-col items-center">
            <Bookmark className="w-8 h-8 text-[#1a73e8] mb-2" />
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
              Your collection is empty
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] max-w-sm leading-relaxed">
              Bookmark useful posts and discussions across your stream to review them whenever you want.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
