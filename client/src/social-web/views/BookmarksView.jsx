import React, { useState, useEffect } from 'react';
import { Bookmark, Sparkles, ArrowLeft } from 'lucide-react';
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
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="p-1.5 text-gray-500 hover:text-[#0B57D0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-[#0B57D0] fill-current" />
              Saved Bookmarks
            </h2>
            <p className="text-xs text-gray-500">Your privately saved posts and media</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="flex flex-col gap-4">
          {bookmarks.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={(id) => setBookmarks((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-12 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] flex items-center justify-center text-[#0B57D0] mb-3">
            <Bookmark className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white mb-1">No bookmarks yet</h3>
          <p className="text-xs text-gray-500 max-w-xs">
            Save interesting posts by tapping the bookmark icon to easily revisit them anytime.
          </p>
        </div>
      )}
    </div>
  );
}
