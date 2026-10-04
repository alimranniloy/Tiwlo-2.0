import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  MoreHorizontal,
  CheckCircle2,
  Image,
  Smile,
  BarChart2,
  Trash2,
  Link
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostDetailView() {
  const { tabParams, currentUser, navigateTo, showToast } = useSocial();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [comments, setComments] = useState([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const postId = tabParams?.id;

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const p = await TiwiSocialAPI.getPost(postId, currentUser?.id);
      if (p) {
        setPost(p);
        setComments(Array.isArray(p.comments) ? p.comments : []);
        setIsLiked(!!p.isLiked);
        setLikesCount(parseInt(p.likesCount || p.likes || 0, 10));
        setIsSaved(!!p.isSaved);
        setIsReposted(!!p.isReposted);
        setRepostsCount(parseInt(p.repostsCount || 0, 10));
      }
    } catch (e) {
      console.warn('Failed to load post detail:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await TiwiSocialAPI.toggleLikePost(postId, currentUser?.id);
    } catch (e) {
      setIsLiked(!next);
    }
  };

  const handleToggleRepost = async () => {
    const next = !isReposted;
    setIsReposted(next);
    setRepostsCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await TiwiSocialAPI.toggleRepost(postId, currentUser?.id);
    } catch (e) {
      setIsReposted(!next);
    }
  };

  const handleToggleBookmark = async () => {
    const next = !isSaved;
    setIsSaved(next);
    showToast(next ? 'Added to your Bookmarks' : 'Removed from Bookmarks', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(postId, currentUser?.id);
    } catch (e) {
      setIsSaved(!next);
    }
  };

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      const newComment = await TiwiSocialAPI.addComment(postId, replyText.trim(), currentUser?.id);
      setComments((prev) => [
        ...prev,
        newComment || {
          id: `c_${Date.now()}`,
          author: currentUser?.name || 'You',
          handle: currentUser?.handle || 'user',
          text: replyText.trim(),
          avatar: currentUser?.avatar,
          timeAgo: 'Just now'
        }
      ]);
      setReplyText('');
      showToast('Your reply was sent', 'info');
    } catch (e) {
      showToast('Could not post reply', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const images = Array.isArray(post?.images) && post?.images.length > 0
    ? post.images
    : post?.image
    ? [post.image]
    : [];

  const viewsCount = post?.viewsCount || Math.floor((likesCount * 14 + 260));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-20 px-6 text-center">
        <h3 className="font-extrabold text-[22px] text-[#0F1419] dark:text-[#E7E9EA] mb-2">
          Post not found
        </h3>
        <p className="text-[15px] text-[#536471] dark:text-[#71767B] mb-4">
          This post may have been deleted or is unavailable.
        </p>
        <button
          onClick={() => navigateTo('feed')}
          className="bg-[#1D9BF0] text-white font-bold text-[15px] px-5 py-2 rounded-full"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-3 flex items-center gap-6 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA]">
          Post
        </h1>
      </div>

      {/* 2. Main Tweet Content */}
      <div className="px-4 pt-3 pb-2 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        {/* Author Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
              className="rounded-full hover:opacity-90 transition block"
            >
              <img
                src={
                  post.author?.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                }
                alt={post.author?.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            </button>

            <div className="flex flex-col">
              <button
                onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
                className="font-bold text-[15px] hover:underline text-left text-[#0F1419] dark:text-[#E7E9EA] flex items-center gap-1"
              >
                <span>{post.author?.name || 'Creator'}</span>
                {post.author?.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                )}
              </button>
              <span className="text-[14px] text-[#536471] dark:text-[#71767B]">
                @{post.author?.handle || 'creator'}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-56 bg-white dark:bg-black rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] border border-[#EFF3F4] dark:border-[#2F3336] py-2 z-40">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigator.clipboard?.writeText(window.location.href);
                    showToast('Link copied to clipboard', 'info');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/10 text-left text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]"
                >
                  <Link className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                  Copy link
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Large Tweet Text */}
        {post.caption && (
          <div className="text-[17px] sm:text-[19px] leading-relaxed text-[#0F1419] dark:text-[#E7E9EA] mt-4 whitespace-pre-wrap break-words">
            {post.caption}
          </div>
        )}

        {/* Media Attachments */}
        {images.length > 0 && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-[#EFF3F4] dark:border-[#2F3336]">
            {images.map((img, i) => (
              <img key={i} src={img} alt="attachment" className="w-full max-h-[550px] object-cover" />
            ))}
          </div>
        )}

        {/* Timestamp & Views Row */}
        <div className="py-3 mt-3 text-[15px] text-[#536471] dark:text-[#71767B] border-b border-[#EFF3F4] dark:border-[#2F3336] flex items-center gap-2">
          <span>{post.timeAgo || '10:24 PM · Oct 5, 2026'}</span>
          <span>·</span>
          <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">
            {viewsCount.toLocaleString()}
          </span>
          <span>Views</span>
        </div>

        {/* Retweets, Quotes, Likes stats row */}
        {(repostsCount > 0 || likesCount > 0) && (
          <div className="py-3 border-b border-[#EFF3F4] dark:border-[#2F3336] flex items-center gap-6 text-[14px]">
            {repostsCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">{repostsCount}</span>
                <span className="text-[#536471] dark:text-[#71767B]">Reposts</span>
              </div>
            )}
            {likesCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">{likesCount}</span>
                <span className="text-[#536471] dark:text-[#71767B]">Likes</span>
              </div>
            )}
          </div>
        )}

        {/* Twitter Action Bar: Reply, Repost, Like, Bookmark, Share */}
        <div className="flex items-center justify-around py-1 text-[#536471] dark:text-[#71767B]">
          <button
            onClick={() => document.getElementById('reply-input')?.focus()}
            className="p-2 rounded-full hover:bg-[#1D9BF0]/10 hover:text-[#1D9BF0] transition"
            title="Reply"
          >
            <MessageCircle className="w-[20px] h-[20px]" />
          </button>

          <button
            onClick={handleToggleRepost}
            className={`p-2 rounded-full hover:bg-[#00BA7C]/10 transition ${
              isReposted ? 'text-[#00BA7C]' : 'hover:text-[#00BA7C]'
            }`}
            title="Repost"
          >
            <Repeat2 className="w-[20px] h-[20px]" />
          </button>

          <button
            onClick={handleToggleLike}
            className={`p-2 rounded-full hover:bg-[#F91880]/10 transition ${
              isLiked ? 'text-[#F91880]' : 'hover:text-[#F91880]'
            }`}
            title="Like"
          >
            <Heart className={`w-[20px] h-[20px] ${isLiked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-full hover:bg-[#1D9BF0]/10 transition ${
              isSaved ? 'text-[#1D9BF0]' : 'hover:text-[#1D9BF0]'
            }`}
            title="Bookmark"
          >
            <Bookmark className={`w-[20px] h-[20px] ${isSaved ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Link copied to clipboard', 'info');
            }}
            className="p-2 rounded-full hover:bg-[#1D9BF0]/10 hover:text-[#1D9BF0] transition"
            title="Share"
          >
            <Share className="w-[20px] h-[20px]" />
          </button>
        </div>
      </div>

      {/* 3. Inline "Post your reply" Form */}
      <div className="px-4 py-3 border-b border-[#EFF3F4] dark:border-[#2F3336] flex gap-3">
        <img
          src={
            currentUser?.avatar ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
          }
          alt={currentUser?.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />

        <form onSubmit={handleAddReply} className="flex-1 min-w-0 flex flex-col">
          <span className="text-[13px] text-[#536471] dark:text-[#71767B] mb-1">
            Replying to <span className="text-[#1D9BF0]">@{post.author?.handle || 'creator'}</span>
          </span>

          <textarea
            id="reply-input"
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Post your reply"
            className="w-full bg-transparent text-[18px] placeholder-[#536471] dark:placeholder-[#71767B] text-[#0F1419] dark:text-[#E7E9EA] outline-none resize-none pt-1"
          />

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1 text-[#1D9BF0] -ml-2">
              <button
                type="button"
                className="w-8 h-8 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!replyText.trim() || submittingReply}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 text-white font-bold text-[14px] px-4 py-1.5 rounded-full shadow-sm transition active:scale-95"
            >
              Reply
            </button>
          </div>
        </form>
      </div>

      {/* 4. Replies Stream */}
      <div className="flex flex-col pb-24 md:pb-12 divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
        {comments.map((comment) => (
          <div key={comment.id} className="px-4 py-3 flex gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition">
            <img
              src={
                comment.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={comment.author}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  {comment.author || 'User'}
                </span>
                <span className="text-[14px] text-[#536471] dark:text-[#71767B]">
                  @{comment.handle || 'user'} · {comment.timeAgo || 'recently'}
                </span>
              </div>
              <p className="text-[15px] leading-normal text-[#0F1419] dark:text-[#E7E9EA] mt-1 whitespace-pre-wrap">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
