import React, { useState } from 'react';
import {
  Heart,
  MessageSquare,
  Repeat2,
  Bookmark,
  Share2,
  MoreVertical,
  CheckCircle2,
  Trash2,
  Link,
  Flag,
  UserX
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostCard({ post, onPostDeleted }) {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [isLiked, setIsLiked] = useState(!!post.isLiked);
  const [likesCount, setLikesCount] = useState(parseInt(post.likesCount || post.likes || 0, 10));
  const [isSaved, setIsSaved] = useState(!!post.isSaved);
  const [isReposted, setIsReposted] = useState(!!post.isReposted);
  const [repostsCount, setRepostsCount] = useState(parseInt(post.repostsCount || 0, 10));
  const [commentsCount] = useState(parseInt(post.commentsCount || (post.comments?.length || 0), 10));
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner =
    currentUser?.id &&
    (post.author?.id === currentUser?.id || post.author?.handle === currentUser?.handle);

  const handleToggleLike = async (e) => {
    e.stopPropagation();
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await TiwiSocialAPI.toggleLikePost(post.id, currentUser?.id);
    } catch {
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleRepost = async (e) => {
    e.stopPropagation();
    const nextState = !isReposted;
    setIsReposted(nextState);
    setRepostsCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    showToast(nextState ? 'Shared with your followers' : 'Share removed', 'info');
    try {
      await TiwiSocialAPI.toggleRepost(post.id, currentUser?.id);
    } catch {
      setIsReposted(!nextState);
      setRepostsCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleBookmark = async (e) => {
    e.stopPropagation();
    const nextState = !isSaved;
    setIsSaved(nextState);
    showToast(nextState ? 'Saved to collection' : 'Removed from collection', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch {
      setIsSaved(!nextState);
    }
  };

  const handleCopyLink = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const postUrl = `${window.location.origin}/tiwi/post/${post.id}`;
    navigator.clipboard?.writeText(postUrl);
    showToast('Link copied to clipboard', 'info');
  };

  const handleDeletePost = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm('Delete this post?')) return;
    try {
      await TiwiSocialAPI.deletePost(post.id, currentUser?.id);
      showToast('Post deleted', 'info');
      if (onPostDeleted) onPostDeleted(post.id);
    } catch {
      showToast('Failed to delete post', 'error');
    }
  };

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
    ? [post.image]
    : [];

  return (
    <article
      onClick={() => navigateTo('post-detail', post.id)}
      className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col gap-3.5 mb-3.5 text-[#1F1F1F] dark:text-[#E3E3E3]"
    >
      {/* 1. Author Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateTo('profile', post.author?.handle || post.author?.id);
            }}
            className="rounded-full hover:opacity-90 transition block flex-shrink-0"
          >
            <img
              src={
                post.author?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={post.author?.name || 'User'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#E0E2EC] dark:ring-[#444746]"
            />
          </button>

          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo('profile', post.author?.handle || post.author?.id);
                }}
                className="font-bold text-[15px] hover:underline truncate text-[#1F1F1F] dark:text-[#E3E3E3]"
              >
                {post.author?.name || 'Tiwi Creator'}
              </button>

              {post.author?.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-[#0B57D0] fill-current inline flex-shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[12px] text-[#747775] dark:text-[#8E918F]">
              <span className="truncate">@{post.author?.handle || 'creator'}</span>
              <span>·</span>
              <span>{post.timeAgo || 'recently'}</span>
            </div>
          </div>
        </div>

        {/* Action Options Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="w-8 h-8 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#747775] dark:text-[#8E918F] transition"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 w-56 bg-white dark:bg-[#1E1F20] rounded-3xl shadow-lg border border-[#E0E2EC] dark:border-[#313335] py-2 z-40 animate-fadeIn"
            >
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-left text-[14px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]"
              >
                <Link className="w-4 h-4 text-[#747775]" />
                Copy link to post
              </button>

              {isOwner ? (
                <button
                  type="button"
                  onClick={handleDeletePost}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 text-left text-[14px] font-medium text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete post
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      showToast(`Muted @${post.author?.handle}`, 'info');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-left text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]"
                  >
                    <UserX className="w-4 h-4 text-[#747775]" />
                    Mute @{post.author?.handle}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      showToast('Post reported to moderators', 'info');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-left text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]"
                  >
                    <Flag className="w-4 h-4 text-[#747775]" />
                    Report post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Text Content */}
      {post.caption && (
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[#1F1F1F] dark:text-[#E3E3E3]">
          {post.caption.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+|https?:\/\/[^\s]+)/g).map((part, i) => {
            if (part.startsWith('#')) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo('search', { q: part });
                  }}
                  className="text-[#0B57D0] dark:text-[#A8C7FA] font-medium hover:underline mr-0.5"
                >
                  {part}
                </button>
              );
            }
            if (part.startsWith('@')) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo('profile', part.replace('@', ''));
                  }}
                  className="text-[#0B57D0] dark:text-[#A8C7FA] font-medium hover:underline mr-0.5"
                >
                  {part}
                </button>
              );
            }
            if (part.startsWith('http')) {
              return (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#0B57D0] dark:text-[#A8C7FA] hover:underline"
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
        </div>
      )}

      {/* 3. Media Attachments */}
      {images.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-[#E0E2EC] dark:border-[#313335]">
          {images.length === 1 ? (
            <img
              src={images[0]}
              alt="Post attachment"
              className="w-full max-h-[480px] object-cover bg-black/5 dark:bg-white/5"
              loading="lazy"
            />
          ) : images.length === 2 ? (
            <div className="grid grid-cols-2 gap-1">
              <img src={images[0]} alt="attachment 1" className="w-full h-64 object-cover" />
              <img src={images[1]} alt="attachment 2" className="w-full h-64 object-cover" />
            </div>
          ) : images.length === 3 ? (
            <div className="grid grid-cols-2 gap-1">
              <img src={images[0]} alt="attachment 1" className="w-full h-64 object-cover row-span-2" />
              <div className="grid grid-rows-2 gap-1">
                <img src={images[1]} alt="attachment 2" className="w-full h-32 object-cover" />
                <img src={images[2]} alt="attachment 3" className="w-full h-32 object-cover" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {images.slice(0, 4).map((img, idx) => (
                <img key={idx} src={img} alt={`attachment ${idx}`} className="w-full h-40 object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Google Material Action Chips Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#E0E2EC]/70 dark:border-[#313335] text-[#444746] dark:text-[#C4C7C5]">
        <div className="flex items-center gap-1">
          {/* Like Chip */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition active:scale-95 cursor-pointer ${
              isLiked
                ? 'text-[#B3261E] bg-red-50 dark:bg-red-950/20'
                : 'hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
            }`}
            title="Applaud / Like"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-[#B3261E]' : ''}`} />
            <span>{likesCount > 0 ? likesCount : 'Like'}</span>
          </button>

          {/* Comment Chip */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateTo('post-detail', post.id);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer"
            title="Comment"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{commentsCount > 0 ? commentsCount : 'Reply'}</span>
          </button>

          {/* Reshare Chip */}
          <button
            type="button"
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition cursor-pointer ${
              isReposted
                ? 'text-[#0F5223] dark:text-[#6DD58C] bg-green-50 dark:bg-green-950/20'
                : 'hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
            }`}
            title="Share"
          >
            <Repeat2 className="w-4 h-4" />
            <span>{repostsCount > 0 ? repostsCount : 'Repost'}</span>
          </button>
        </div>

        {/* Right Actions: Bookmark & Share */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer ${
              isSaved ? 'text-[#0B57D0]' : ''
            }`}
            title="Save"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
