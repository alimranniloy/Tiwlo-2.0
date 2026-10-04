import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  CheckCircle2,
  Send,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostDetailView() {
  const { tabParams, currentUser, navigateTo, showToast } = useSocial();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

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
        setComments(p.comments || []);
        setIsLiked(!!p.isLiked);
        setLikesCount(parseInt(p.likesCount || p.likes || 0, 10));
      }
    } catch (e) {
      console.warn('Failed to fetch post:', e);
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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const newComment = await TiwiSocialAPI.addComment(postId, commentText.trim(), currentUser?.id);
      setComments((prev) => [
        ...prev,
        newComment || {
          id: `c_${Date.now()}`,
          author: currentUser?.name || 'You',
          text: commentText.trim(),
          avatar: currentUser?.avatar,
          timeAgo: 'Just now'
        }
      ]);
      setCommentText('');
      showToast('Comment posted', 'info');
    } catch (e) {
      showToast('Could not post comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto w-full text-center py-20 bg-white dark:bg-[#1E293B] rounded-3xl p-8">
        <h3 className="text-base font-bold text-[#1F1F1F] dark:text-white">Post not found</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">This post may have been removed or is unavailable.</p>
        <button
          onClick={() => navigateTo('feed')}
          className="bg-[#0B57D0] text-white px-5 py-2 rounded-full text-xs font-semibold"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : (post.image ? [post.image] : []);

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 md:pb-10 flex flex-col gap-5">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
        <button
          onClick={() => navigateTo('feed')}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-[#0B57D0]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Post Details</span>
        <div className="w-16" />
      </div>

      {/* Main Post Content */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs p-6 flex flex-col gap-4">
        {/* Author Header */}
        <div className="flex items-center gap-3">
          <img
            src={post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
            alt={post.author?.name}
            className="w-12 h-12 rounded-full object-cover cursor-pointer"
            onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
          />
          <div>
            <div className="text-sm font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1.5">
              {post.author?.name || 'Creator'}
              {post.author?.isVerified && <CheckCircle2 className="w-4 h-4 text-[#0B57D0]" />}
            </div>
            <div className="text-xs text-gray-500">
              @{post.author?.handle || 'user'} • {post.timeAgo || 'Recently'}
            </div>
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm sm:text-base text-[#1F1F1F] dark:text-gray-200 leading-relaxed whitespace-pre-line">
            {post.caption}
          </p>
        )}

        {/* Media */}
        {images.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-black/5 dark:bg-black/30">
            {images.map((img, i) => (
              <img key={i} src={img} alt={`Media ${i}`} className="w-full object-cover max-h-[600px] mb-1 last:mb-0" />
            ))}
          </div>
        )}

        {/* Video Player */}
        {post.videoUrl && (
          <div className="rounded-2xl overflow-hidden bg-black aspect-video">
            <video src={post.videoUrl} controls playsInline className="w-full h-full object-contain" />
          </div>
        )}

        {/* Action Counters */}
        <div className="flex items-center gap-4 py-3 border-y border-gray-100 dark:border-gray-800 text-xs text-gray-500">
          <span><b className="text-[#1F1F1F] dark:text-white">{likesCount}</b> Likes</span>
          <span><b className="text-[#1F1F1F] dark:text-white">{comments.length}</b> Comments</span>
          <span><b className="text-[#1F1F1F] dark:text-white">{post.repostsCount || 0}</b> Reposts</span>
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-around py-1 text-gray-600 dark:text-gray-400">
          <button onClick={handleToggleLike} className={`flex items-center gap-2 text-xs font-semibold p-2 ${isLiked ? 'text-[#B3261E]' : ''}`}>
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>Like</span>
          </button>
          <button className="flex items-center gap-2 text-xs font-semibold p-2">
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </button>
          <button className="flex items-center gap-2 text-xs font-semibold p-2">
            <Repeat2 className="w-4 h-4" />
            <span>Repost</span>
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Post link copied!', 'info');
            }}
            className="flex items-center gap-2 text-xs font-semibold p-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs p-6 flex flex-col gap-4">
        <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white">Comments ({comments.length})</h3>

        {/* Comment Composer */}
        <form onSubmit={handleAddComment} className="flex items-center gap-3">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'}
            alt="You"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
          <input
            type="text"
            placeholder="Write a constructive reply..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-full px-4 py-2.5 focus:outline-none focus:border-[#0B57D0]"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || submittingComment}
            className="p-2.5 rounded-full bg-[#0B57D0] text-white disabled:opacity-40 hover:bg-[#0842A0] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Comments Thread */}
        <div className="flex flex-col gap-3 pt-2">
          {comments.map((c, i) => (
            <div key={c.id || i} className="flex items-start gap-3 text-xs">
              <img
                src={c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                alt={c.author}
                className="w-8 h-8 rounded-full object-cover mt-0.5"
              />
              <div className="flex-1 bg-[#F8F9FA] dark:bg-[#111827] p-3.5 rounded-2xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#1F1F1F] dark:text-white">{c.author}</span>
                  <span className="text-[10px] text-gray-400">{c.timeAgo || 'Recently'}</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
