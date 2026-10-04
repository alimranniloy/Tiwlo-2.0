import React, { useState, useEffect } from 'react';
import { Heart, ArrowLeft, Sparkles } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function LikedPostsView() {
  const { currentUser, navigateTo } = useSocial();
  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TiwiSocialAPI.getLikedPosts(currentUser?.id).then((data) => {
      setLikedPosts(Array.isArray(data) ? data : []);
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
              <Heart className="w-5 h-5 text-[#B3261E] fill-current" />
              Liked Posts
            </h2>
            <p className="text-xs text-gray-500">Posts you've liked on Tiwi</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
        </div>
      ) : likedPosts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {likedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-12 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#FCE8E6] dark:bg-red-950/40 flex items-center justify-center text-[#B3261E] mb-3">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white mb-1">No liked posts yet</h3>
          <p className="text-xs text-gray-500 max-w-xs">
            Tap the heart icon on any post you enjoy to keep track of your favorites.
          </p>
        </div>
      )}
    </div>
  );
}
