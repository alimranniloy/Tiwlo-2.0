import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  Repeat2,
  Bookmark,
  Share2,
  MoreVertical,
  CheckCircle2,
  Image as ImageIcon,
  Smile,
  Send,
  Link,
  Globe,
  MessageCircle
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostDetailView() {
  const { currentPostId, navigateTo, currentUser, showToast } = useSocial();
  const postId = currentPostId || window.location.pathname.split('/').pop();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
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
    } catch {
      console.warn('Failed to load post detail');
    } finally {
      setLoading(false);
    }
  }, [postId, currentUser?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleToggleLike = async () => {
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

  const handleToggleRepost = async () => {
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

  const handleToggleBookmark = async () => {
    const nextState = !isSaved;
    setIsSaved(nextState);
    showToast(nextState ? 'Saved to bookmarks' : 'Removed from bookmarks', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch {
      setIsSaved(!nextState);
    }
  };

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const commentObj = {
        id: `c_${Date.now()}`,
        authorName: currentUser?.name || 'You',
        authorHandle: currentUser?.handle || 'user',
        authorAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
        text: replyText.trim(),
        createdAt: 'Just now',
      };

      setComments((prev) => [...prev, commentObj]);
      setReplyText('');
      showToast('Reply published', 'info');

      await TiwiSocialAPI.addComment(post.id, {
        text: commentObj.text,
        userId: currentUser?.id,
      });
    } catch {
      showToast('Failed to add comment', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] max-w-lg mx-auto mt-8 shadow-sm">
        <h3 className="font-bold text-[18px] text-[#1c1e21] dark:text-[#e4e6eb] mb-2">
          Post not found
        </h3>
        <button
          onClick={() => navigateTo('feed')}
          className="text-violet-600 font-semibold text-[14px] hover:underline cursor-pointer"
        >
          Return to stream
        </button>
      </div>
    );
  }

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
    ? [post.image]
    : [];

  return (
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center gap-3 border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
          Post Discussion
        </h1>
      </div>

      {/* 2. Main Post Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm mb-4">
        {/* Author Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
              className="rounded-xl hover:opacity-90 transition block"
            >
              <img
                src={post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                alt={post.author?.name}
                className="w-11 h-11 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10"
              />
            </button>

            <div className="flex flex-col leading-tight">
              <button
                onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
                className="font-bold text-[15px] hover:text-violet-600 dark:hover:text-violet-400 text-left text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-1.5 transition-colors"
              >
                <span>{post.author?.name || 'Creator'}</span>
                {post.author?.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-violet-500 fill-current inline flex-shrink-0" />
                )}
              </button>
              <div className="flex items-center gap-1 text-[12px] text-[#65676b] dark:text-[#8a8d91]">
                <span>@{post.author?.handle || 'creator'}</span>
                <span>·</span>
                <span>{post.timeAgo || 'recently'}</span>
                <span>·</span>
                <Globe className="w-3 h-3 inline" />
              </div>
            </div>
          </div>
        </div>

        {/* Text Content */}
        {post.caption && (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[#1c1e21] dark:text-[#e4e6eb] my-4 font-normal">
            {post.caption}
          </div>
        )}

        {/* Media Attachments */}
        {images.length > 0 && (
          <div className="my-3 rounded-2xl overflow-hidden border border-black/[0.05] dark:border-white/[0.06]">
            {images.map((img, i) => (
              <img key={i} src={img} alt="Post media" className="w-full max-h-[500px] object-cover" />
            ))}
          </div>
        )}

        {/* Interaction Action Row */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-[#65676b] dark:text-[#8a8d91]">
          {/* Like */}
          <button
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 p-2 rounded-xl hover:bg-rose-500/10 transition-colors text-xs font-semibold cursor-pointer ${
              isLiked ? 'text-rose-500' : 'hover:text-rose-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likesCount}</span>
          </button>

          {/* Comment */}
          <div className="flex items-center gap-1.5 p-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <MessageCircle className="w-4 h-4" />
            <span>{comments.length}</span>
          </div>

          {/* Repost */}
          <button
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 p-2 rounded-xl hover:bg-emerald-500/10 transition-colors text-xs font-semibold cursor-pointer ${
              isReposted ? 'text-emerald-500' : 'hover:text-emerald-500'
            }`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{repostsCount}</span>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-xl hover:bg-violet-500/10 transition-colors text-xs font-semibold cursor-pointer ${
              isSaved ? 'text-violet-600 dark:text-violet-400' : 'hover:text-violet-600'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Link copied to clipboard', 'info');
            }}
            className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Reply Composer Card */}
      <form
        onSubmit={handleAddReply}
        className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-sm mb-4 flex items-center gap-3"
      >
        <img
          src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'}
          alt="Current user"
          className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0"
        />
        <input
          type="text"
          placeholder="Post your reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          className="flex-1 bg-black/[0.03] dark:bg-white/[0.05] px-4 py-2 rounded-xl text-[13.5px] outline-none text-[#1c1e21] dark:text-[#e4e6eb] placeholder-[#65676b] dark:placeholder-[#8a8d91] focus:ring-2 focus:ring-violet-500/30"
        />
        <button
          type="submit"
          disabled={!replyText.trim() || submittingReply}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[13px] px-4 py-2 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Reply</span>
        </button>
      </form>

      {/* 4. Comments Thread */}
      <div className="space-y-2.5">
        <h3 className="text-[14px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] px-1">
          Discussion ({comments.length})
        </h3>

        {comments.length > 0 ? (
          comments.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-sm flex items-start gap-3"
            >
              <img
                src={c.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                alt={c.authorName}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13px] text-[#1c1e21] dark:text-[#e4e6eb]">
                      {c.authorName}
                    </span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                      @{c.authorHandle}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                    {c.createdAt || 'recently'}
                  </span>
                </div>
                <p className="text-[13px] text-[#4b4f56] dark:text-[#b0b3b8] leading-relaxed">
                  {c.text}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">
              No replies yet. Be the first to join the conversation!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
