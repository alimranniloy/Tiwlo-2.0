import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
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
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center gap-3 border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <button
          onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
          className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-tight tracking-tight">
            Liked Posts
          </h1>
          <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
            @{currentUser?.handle || 'user'} · {likedPosts.length} liked
          </span>
        </div>
      </div>

      {/* 2. Stream */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : likedPosts.length > 0 ? (
          likedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        ) : (
          <div className="py-20 px-6 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
              <Heart className="w-7 h-7 fill-current" />
            </div>
            <h3 className="font-bold text-[17px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
              No liked posts yet
            </h3>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] max-w-sm leading-relaxed">
              When you like updates across your stream, they will be archived here for easy reference.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
