import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  MoreHorizontal,
  CheckCircle2,
  BarChart2,
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

  // Approximate views format (e.g. 1.2K, 4.5M)
  const viewsCount = post.viewsCount || Math.floor((likesCount * 12 + 137));

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
    } catch (err) {
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleRepost = async (e) => {
    e.stopPropagation();
    const nextState = !isReposted;
    setIsReposted(nextState);
    setRepostsCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    showToast(nextState ? 'Reposted to your profile' : 'Repost undone', 'info');
    try {
      await TiwiSocialAPI.toggleRepost(post.id, currentUser?.id);
    } catch (err) {
      setIsReposted(!nextState);
      setRepostsCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleBookmark = async (e) => {
    e.stopPropagation();
    const nextState = !isSaved;
    setIsSaved(nextState);
    showToast(nextState ? 'Added to your Bookmarks' : 'Removed from Bookmarks', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch (err) {
      setIsSaved(!nextState);
    }
  };

  const handleCopyLink = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const postUrl = `${window.location.origin}/tiwi/post/${post.id}`;
    navigator.clipboard?.writeText(postUrl);
    showToast('Copied to clipboard', 'info');
  };

  const handleDeletePost = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!window.confirm('Delete this post?')) return;
    try {
      await TiwiSocialAPI.deletePost(post.id, currentUser?.id);
      showToast('Your post was deleted', 'info');
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (err) {
      showToast('Failed to delete post', 'error');
    }
  };

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
    ? [post.image]
    : [];

  const formatNumber = (num) => {
    if (!num || num === 0) return '';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  return (
    <article
      onClick={() => navigateTo('post-detail', post.id)}
      className="px-4 py-3 border-b border-[#EFF3F4] dark:border-[#2F3336] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-200 cursor-pointer flex gap-3 text-[#0F1419] dark:text-[#E7E9EA]"
    >
      {/* 1. Left Avatar */}
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigateTo('profile', post.author?.handle || post.author?.id);
          }}
          className="rounded-full hover:opacity-90 transition block"
        >
          <img
            src={
              post.author?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
            }
            alt={post.author?.name || 'User'}
            className="w-10 h-10 rounded-full object-cover"
          />
        </button>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 min-w-0">
        {/* Header Row: Name, Verified, @Handle, Dot, Timestamp, More Menu */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('profile', post.author?.handle || post.author?.id);
              }}
              className="font-bold text-[15px] hover:underline truncate text-[#0F1419] dark:text-[#E7E9EA]"
            >
              {post.author?.name || 'Tiwi Creator'}
            </button>

            {post.author?.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('profile', post.author?.handle || post.author?.id);
              }}
              className="text-[15px] text-[#536471] dark:text-[#71767B] truncate ml-0.5"
            >
              @{post.author?.handle || 'creator'}
            </button>

            <span className="text-[#536471] dark:text-[#71767B] text-[15px]">·</span>

            <span className="text-[15px] text-[#536471] dark:text-[#71767B] hover:underline flex-shrink-0">
              {post.timeAgo || 'recently'}
            </span>
          </div>

          {/* Three dots dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="w-8 h-8 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition -mr-2"
              title="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 w-60 bg-white dark:bg-black rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] border border-[#EFF3F4] dark:border-[#2F3336] py-2 z-40"
              >
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
                >
                  <Link className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                  Copy link to post
                </button>

                {isOwner ? (
                  <button
                    type="button"
                    onClick={handleDeletePost}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#F4212E]"
                  >
                    <Trash2 className="w-5 h-5" />
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
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
                    >
                      <UserX className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                      Mute @{post.author?.handle}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        showToast('Report received. Thank you.', 'info');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
                    >
                      <Flag className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                      Report post
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Text Content */}
        {post.caption && (
          <div className="text-[15px] leading-normal mt-1 whitespace-pre-wrap break-words text-[#0F1419] dark:text-[#E7E9EA]">
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
                    className="text-[#1D9BF0] hover:underline"
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
                    className="text-[#1D9BF0] hover:underline"
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
                    className="text-[#1D9BF0] hover:underline"
                  >
                    {part}
                  </a>
                );
              }
              return part;
            })}
          </div>
        )}

        {/* Media Attachments (Twitter Media Container) */}
        {images.length > 0 && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-[#EFF3F4] dark:border-[#2F3336]">
            {images.length === 1 ? (
              <img
                src={images[0]}
                alt="Post attachment"
                className="w-full max-h-[510px] object-cover bg-black/5 dark:bg-white/5"
                loading="lazy"
              />
            ) : images.length === 2 ? (
              <div className="grid grid-cols-2 gap-0.5">
                <img src={images[0]} alt="attachment 1" className="w-full h-72 object-cover" />
                <img src={images[1]} alt="attachment 2" className="w-full h-72 object-cover" />
              </div>
            ) : images.length === 3 ? (
              <div className="grid grid-cols-2 gap-0.5">
                <img src={images[0]} alt="attachment 1" className="w-full h-72 object-cover row-span-2" />
                <div className="grid grid-rows-2 gap-0.5">
                  <img src={images[1]} alt="attachment 2" className="w-full h-36 object-cover" />
                  <img src={images[2]} alt="attachment 3" className="w-full h-36 object-cover" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-0.5">
                {images.slice(0, 4).map((img, idx) => (
                  <img key={idx} src={img} alt={`attachment ${idx}`} className="w-full h-44 object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Twitter Action Bar: Reply, Repost, Like, Views, Bookmark/Share */}
        <div className="flex items-center justify-between mt-3 text-[#536471] dark:text-[#71767B] max-w-md">
          {/* Reply Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateTo('post-detail', post.id);
            }}
            className="flex items-center gap-1.5 group text-[13px] hover:text-[#1D9BF0] transition"
            title="Reply"
          >
            <div className="p-2 rounded-full group-hover:bg-[#1D9BF0]/10 transition">
              <MessageCircle className="w-[18px] h-[18px]" />
            </div>
            <span>{formatNumber(commentsCount)}</span>
          </button>

          {/* Repost Button */}
          <button
            type="button"
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 group text-[13px] transition ${
              isReposted ? 'text-[#00BA7C]' : 'hover:text-[#00BA7C]'
            }`}
            title="Repost"
          >
            <div className="p-2 rounded-full group-hover:bg-[#00BA7C]/10 transition">
              <Repeat2 className="w-[18px] h-[18px]" />
            </div>
            <span>{formatNumber(repostsCount)}</span>
          </button>

          {/* Like Button */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 group text-[13px] transition ${
              isLiked ? 'text-[#F91880]' : 'hover:text-[#F91880]'
            }`}
            title="Like"
          >
            <div className="p-2 rounded-full group-hover:bg-[#F91880]/10 transition">
              <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span>{formatNumber(likesCount)}</span>
          </button>

          {/* Views Button */}
          <div
            className="flex items-center gap-1.5 group text-[13px] hover:text-[#1D9BF0] transition"
            title="Views"
          >
            <div className="p-2 rounded-full group-hover:bg-[#1D9BF0]/10 transition">
              <BarChart2 className="w-[18px] h-[18px]" />
            </div>
            <span>{formatNumber(viewsCount)}</span>
          </div>

          {/* Bookmark & Share Buttons */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`p-2 rounded-full hover:bg-[#1D9BF0]/10 transition ${
                isSaved ? 'text-[#1D9BF0]' : 'hover:text-[#1D9BF0]'
              }`}
              title="Bookmark"
            >
              <Bookmark className={`w-[18px] h-[18px] ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 rounded-full hover:bg-[#1D9BF0]/10 hover:text-[#1D9BF0] transition"
              title="Share"
            >
              <Share className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
