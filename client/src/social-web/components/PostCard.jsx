import React, { useState } from 'react';
import {
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  MoreHorizontal,
  Paperclip,
  Smile,
  Image as ImageIcon,
  CheckCircle2,
  Send
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostCard({ post, onPostDeleted }) {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [isLiked, setIsLiked] = useState(!!post.isLiked);
  const [likesCount, setLikesCount] = useState(
    post.likesCount || post.likes || (post.author?.name === 'Pan Feng Shui' ? '120k' : '12')
  );
  const [isSaved, setIsSaved] = useState(!!post.isSaved);
  const [commentsCount, setCommentsCount] = useState(
    post.commentsCount || (post.author?.name === 'Pan Feng Shui' ? '25' : '7')
  );
  const [sharesCount, setSharesCount] = useState(
    post.repostsCount || (post.author?.name === 'Pan Feng Shui' ? '231' : '0')
  );
  const [savedCount, setSavedCount] = useState(
    post.savedCount || (post.author?.name === 'Pan Feng Shui' ? '12' : '0')
  );

  const [commentInput, setCommentInput] = useState('');
  const [comments, setComments] = useState(Array.isArray(post.comments) ? post.comments : []);

  const handleToggleLike = async (e) => {
    e.stopPropagation();
    const nextState = !isLiked;
    setIsLiked(nextState);
    if (typeof likesCount === 'number') {
      setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
    try {
      await TiwiSocialAPI.toggleLikePost(post.id, currentUser?.id);
    } catch {
      // quiet
    }
  };

  const handleToggleBookmark = async (e) => {
    e.stopPropagation();
    const nextState = !isSaved;
    setIsSaved(nextState);
    showToast(nextState ? 'Saved to bookmarks' : 'Removed from bookmarks', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch {
      // quiet
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`${window.location.origin}/tiwi/post/${post.id}`);
    showToast('Post link copied to clipboard', 'info');
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const newComment = {
      id: `c_${Date.now()}`,
      authorName: currentUser?.name || 'Ahmad Nur Fawaid',
      authorAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      text: commentInput.trim(),
      timeAgo: 'Just now'
    };

    setComments((prev) => [...prev, newComment]);
    setCommentInput('');
    setCommentsCount((prev) => (typeof prev === 'number' ? prev + 1 : parseInt(prev || 0, 10) + 1));
    showToast('Comment added', 'info');
  };

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
    ? [post.image]
    : [];

  return (
    <article className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-5 text-[#111827] dark:text-[#E2E8F0] transition-colors">
      {/* 1. Author Header matching screenshot */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
            className="rounded-full hover:opacity-90 transition block flex-shrink-0"
          >
            <img
              src={
                post.author?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={post.author?.name || 'Author'}
              className="w-10 h-10 rounded-full object-cover"
            />
          </button>

          <div className="flex flex-col leading-tight">
            <button
              type="button"
              onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
              className="font-bold text-[14.5px] text-[#111827] dark:text-white hover:text-[#1E75FF] dark:hover:text-[#1E75FF] text-left transition-colors"
            >
              {post.author?.name || 'Pan Feng Shui'}
            </button>
            <span className="text-[11.5px] text-[#9CA3AF] mt-0.5">
              {post.timeAgo || post.createdAt || '12 April at 09.28 PM'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => showToast('Post options', 'info')}
          className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Caption Text */}
      {post.caption && (
        <p className="text-[13.5px] text-[#374151] dark:text-[#D1D5DB] leading-relaxed mb-3">
          {post.caption}
        </p>
      )}

      {/* 3. Media Grid Mosaic (Pristine layout, fixed image crop issue!) */}
      {images.length === 3 ? (
        <div className="grid grid-cols-2 gap-2.5 my-3 h-[360px] sm:h-[400px] rounded-2xl overflow-hidden">
          {/* Left tall image */}
          <div className="h-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
            <img
              src={images[0]}
              alt="Media 1"
              className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
            />
          </div>
          {/* Right stacked 2 images */}
          <div className="grid grid-rows-2 gap-2.5 h-full">
            <div className="h-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <img
                src={images[1]}
                alt="Media 2"
                className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
              />
            </div>
            <div className="h-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <img
                src={images[2]}
                alt="Media 3"
                className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
              />
            </div>
          </div>
        </div>
      ) : images.length === 2 ? (
        <div className="grid grid-cols-2 gap-2.5 my-3 aspect-[16/9] rounded-2xl overflow-hidden">
          {images.map((img, idx) => (
            <div key={idx} className="h-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <img src={img} alt={`Media ${idx}`} className="w-full h-full object-cover hover:scale-102 transition-transform duration-300" />
            </div>
          ))}
        </div>
      ) : images.length === 1 ? (
        <div className="my-3 max-h-[420px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={images[0]}
            alt="Media"
            className="w-full h-full max-h-[420px] object-cover hover:scale-101 transition-transform duration-300"
          />
        </div>
      ) : images.length > 3 ? (
        <div className="grid grid-cols-2 gap-2.5 my-3 aspect-square rounded-2xl overflow-hidden">
          {images.slice(0, 4).map((img, idx) => (
            <div key={idx} className="h-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <img src={img} alt={`Media ${idx}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}

      {/* 4. Action Counts Row matching screenshot */}
      <div className="flex items-center justify-between py-3 border-t border-[#F2F4F7] dark:border-[#1E232F] text-[12.5px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
        {/* Comments */}
        <button
          type="button"
          onClick={() => navigateTo('post-detail', post.id)}
          className="flex items-center gap-2 hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 stroke-[1.8]" />
          <span>{commentsCount} Comments</span>
        </button>

        {/* Likes */}
        <button
          type="button"
          onClick={handleToggleLike}
          className={`flex items-center gap-2 transition-colors cursor-pointer ${
            isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current stroke-red-500' : 'stroke-[1.8]'}`} />
          <span>{likesCount} Likes</span>
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-2 hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 stroke-[1.8]" />
          <span>{sharesCount} Share</span>
        </button>

        {/* Saved */}
        <button
          type="button"
          onClick={handleToggleBookmark}
          className={`flex items-center gap-2 transition-colors cursor-pointer ${
            isSaved ? 'text-[#1E75FF] font-bold' : 'hover:text-[#1E75FF]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current stroke-[#1E75FF]' : 'stroke-[1.8]'}`} />
          <span>{savedCount} Saved</span>
        </button>
      </div>

      {/* 5. Inline Comment Composer matching screenshot */}
      <form
        onSubmit={handleAddComment}
        className="flex items-center gap-3 pt-3 border-t border-[#F2F4F7] dark:border-[#1E232F]"
      >
        <img
          src={
            currentUser?.avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop'
          }
          alt="Current User"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />

        <div className="flex-1 flex items-center bg-[#F4F5F7] dark:bg-[#1A1D27] rounded-xl px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#1E75FF]/30 transition-all">
          <input
            type="text"
            placeholder="Write your comment..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            className="bg-transparent text-[12.5px] text-[#111827] dark:text-[#E2E8F0] placeholder-[#9CA3AF] outline-none w-full"
          />

          <div className="flex items-center gap-2.5 text-[#9CA3AF] flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={() => showToast('Attach file', 'info')}
              className="hover:text-[#4B5563] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
              title="Attach File"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => showToast('Choose emoji', 'info')}
              className="hover:text-[#4B5563] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
              title="Add Emoji"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => showToast('Attach image', 'info')}
              className="hover:text-[#4B5563] dark:hover:text-[#E2E8F0] transition-colors cursor-pointer"
              title="Add Photo"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </article>
  );
}
