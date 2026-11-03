import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, Sparkles } from 'lucide-react';
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
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f2f2f2]/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl px-2 py-3 flex items-center gap-3 border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#676767] dark:text-[#b3b3b3] transition cursor-pointer active:scale-95"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[18px] font-bold text-[#1e1e1e] dark:text-[#e6e6e6] leading-tight tracking-tight">
            Saved Posts
          </h1>
          <span className="text-[12px] text-[#676767] dark:text-[#8d8d8d]">
            @{currentUser?.handle || 'user'} · {bookmarks.length} saved
          </span>
        </div>
      </div>

      {/* 2. Posts Stream */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
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
          <div className="py-20 px-6 text-center bg-white dark:bg-[#171717] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-3">
              <Bookmark className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-[17px] text-[#1e1e1e] dark:text-[#e6e6e6] mb-1">
              Your collection is empty
            </h3>
            <p className="text-[13px] text-[#676767] dark:text-[#8d8d8d] max-w-sm leading-relaxed">
              Bookmark insightful posts and discussions across your stream to review them whenever you want.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
