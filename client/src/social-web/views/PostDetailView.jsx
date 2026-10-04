import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  Repeat2,
  Bookmark,
  Share2,
  MoreVertical,
  CheckCircle2,
  Image,
  Smile,
  Send,
  Link
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function PostDetailView() {
  const { tabParams, currentUser, navigateTo, showToast } = useSocial();
  const postId = tabParams?.id || tabParams?.postId;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
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
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await TiwiSocialAPI.toggleLikePost(post.id, currentUser?.id);
    } catch {
      setIsLiked(!next);
      setLikesCount((prev) => (!next ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleRepost = async () => {
    const next = !isReposted;
    setIsReposted(next);
    setRepostsCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    showToast(next ? 'Shared with your followers' : 'Share removed', 'info');
    try {
      await TiwiSocialAPI.toggleRepost(post.id, currentUser?.id);
    } catch {
      setIsReposted(!next);
    }
  };

  const handleToggleBookmark = async () => {
    const next = !isSaved;
    setIsSaved(next);
    showToast(next ? 'Saved to collection' : 'Removed from collection', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch {
      setIsSaved(!next);
    }
  };

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submittingReply) return;
    setSubmittingReply(true);

    const tempComment = {
      id: `c_${Date.now()}`,
      author: currentUser?.name || 'You',
      handle: currentUser?.handle || 'user',
      avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      text: replyText.trim(),
      timeAgo: 'Just now',
    };

    setComments((prev) => [...prev, tempComment]);
    setReplyText('');

    try {
      await TiwiSocialAPI.addComment(post.id, {
        text: tempComment.text,
        userId: currentUser?.id,
      });
      showToast('Reply added to discussion', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to reply', 'error');
    } finally {
      setSubmittingReply(false);
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
      <div className="p-8 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] max-w-lg mx-auto mt-8">
        <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-2">
          Post not found
        </h3>
        <button
          onClick={() => navigateTo('feed')}
          className="text-[#0B57D0] font-semibold text-[14px] hover:underline cursor-pointer"
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
    <div className="w-full flex flex-col min-h-screen max-w-3xl mx-auto">
      {/* 1. Header App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
          Post Discussion
        </h1>
      </div>

      {/* 2. Main Post Card Container */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs mb-4">
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
                className="w-11 h-11 rounded-full object-cover ring-2 ring-[#E0E2EC]"
              />
            </button>

            <div className="flex flex-col leading-tight">
              <button
                onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
                className="font-bold text-[16px] hover:underline text-left text-[#1F1F1F] dark:text-[#E3E3E3] flex items-center gap-1"
              >
                <span>{post.author?.name || 'Creator'}</span>
                {post.author?.isVerified && (
                  <CheckCircle2 className="w-4 h-4 text-[#0B57D0] fill-current inline flex-shrink-0" />
                )}
              </button>
              <span className="text-[13px] text-[#747775] dark:text-[#8E918F]">
                @{post.author?.handle || 'creator'}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-9 h-9 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#747775] dark:text-[#8E918F] transition"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#1E1F20] rounded-2xl shadow-lg border border-[#E0E2EC] dark:border-[#313335] py-2 z-40">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigator.clipboard?.writeText(window.location.href);
                    showToast('Link copied to clipboard', 'info');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-left text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]"
                >
                  <Link className="w-4 h-4 text-[#747775]" />
                  <span>Copy link</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Text */}
        {post.caption && (
          <div className="text-[18px] leading-relaxed text-[#1F1F1F] dark:text-[#E3E3E3] mt-4 whitespace-pre-wrap break-words">
            {post.caption}
          </div>
        )}

        {/* Media Attachments */}
        {images.length > 0 && (
          <div className="mt-4 rounded-2xl overflow-hidden border border-[#E0E2EC] dark:border-[#313335]">
            {images.map((img, i) => (
              <img key={i} src={img} alt="attachment" className="w-full max-h-[500px] object-cover" />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="py-3 mt-4 text-[13px] text-[#747775] dark:text-[#8E918F] border-t border-[#E0E2EC]/70 dark:border-[#313335]">
          <span>{post.timeAgo || 'Shared recently'}</span>
        </div>

        {/* Action Chips Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E0E2EC]/70 dark:border-[#313335] text-[#444746] dark:text-[#C4C7C5]">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition cursor-pointer ${
                isLiked ? 'text-[#B3261E] bg-red-50 dark:bg-red-950/20' : 'hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-[#B3261E]' : ''}`} />
              <span>{likesCount > 0 ? likesCount : 'Like'}</span>
            </button>

            <button
              onClick={handleToggleRepost}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition cursor-pointer ${
                isReposted ? 'text-[#0F5223] bg-green-50 dark:bg-green-950/20' : 'hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
              }`}
            >
              <Repeat2 className="w-4 h-4" />
              <span>{repostsCount > 0 ? repostsCount : 'Repost'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleBookmark}
              className={`p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer ${
                isSaved ? 'text-[#0B57D0]' : ''
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                showToast('Link copied to clipboard', 'info');
              }}
              className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Reply Form Container */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-4.5 shadow-xs mb-4">
        <form onSubmit={handleAddReply} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name}
              className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E0E2EC]"
            />
            <span className="text-[13px] text-[#747775] dark:text-[#8E918F]">
              Replying to <span className="text-[#0B57D0] font-medium">@{post.author?.handle || 'creator'}</span>
            </span>
          </div>

          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Add your perspective..."
            className="w-full bg-transparent text-[16px] placeholder-[#747775] dark:placeholder-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none resize-none pt-1"
          />

          <div className="flex items-center justify-between pt-2 border-t border-[#E0E2EC]/70 dark:border-[#313335]">
            <div className="flex items-center gap-1 text-[#747775]">
              <button type="button" className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition">
                <Image className="w-4 h-4" />
              </button>
              <button type="button" className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition">
                <Smile className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!replyText.trim() || submittingReply}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white font-semibold text-[13px] px-5 py-2 rounded-full shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Replies Stream */}
      <div className="flex flex-col gap-3 pb-20">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-4.5 shadow-xs flex gap-3">
            <img
              src={comment.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={comment.author}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5 ring-1 ring-[#E0E2EC]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                  {comment.author || 'User'}
                </span>
                <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
                  @{comment.handle || 'user'} · {comment.timeAgo || 'recently'}
                </span>
              </div>
              <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1.5 leading-relaxed whitespace-pre-wrap">
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
