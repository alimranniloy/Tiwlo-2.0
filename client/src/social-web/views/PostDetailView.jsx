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
  Link,
  Globe
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
    showToast(nextState ? 'Saved to collection' : 'Removed from collection', 'info');
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
      const added = await TiwiSocialAPI.addComment(post.id, {
        content: replyText.trim(),
        userId: currentUser?.id,
      });

      const commentObj = added || {
        id: `c_${Date.now()}`,
        author: currentUser?.name || 'You',
        handle: currentUser?.handle || 'user',
        avatar: currentUser?.avatar,
        text: replyText.trim(),
        timeAgo: 'Just now',
      };

      setComments((prev) => [...prev, commentObj]);
      setReplyText('');
      showToast('Reply published', 'info');
    } catch {
      showToast('Failed to post reply', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] max-w-lg mx-auto mt-8">
        <h3 className="font-medium text-[18px] text-[#202124] dark:text-[#e8eaed] mb-2">
          Post not found
        </h3>
        <button
          onClick={() => navigateTo('feed')}
          className="text-[#1a73e8] font-medium text-[14px] hover:underline cursor-pointer"
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
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#dadce0] dark:border-[#3c4043] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed]">
          Post Discussion
        </h1>
      </div>

      {/* 2. Main Post Card Container (Google rounded-lg) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs mb-4">
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
                className="w-10 h-10 rounded-full object-cover border border-[#dadce0] dark:border-[#5f6368]"
              />
            </button>

            <div className="flex flex-col leading-tight">
              <button
                onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
                className="font-medium text-[15px] hover:underline text-left text-[#202124] dark:text-[#e8eaed] flex items-center gap-1"
              >
                <span>{post.author?.name || 'Creator'}</span>
                {post.author?.isVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
                )}
              </button>
              <div className="flex items-center gap-1 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
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
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[#202124] dark:text-[#e8eaed] my-4">
            {post.caption}
          </div>
        )}

        {/* Media Attachments */}
        {images.length > 0 && (
          <div className="my-3 rounded-md overflow-hidden border border-[#dadce0] dark:border-[#3c4043]">
            <img src={images[0]} alt="attachment" className="w-full max-h-[500px] object-cover" />
          </div>
        )}

        {/* Interaction Summary */}
        <div className="py-2.5 border-y border-[#f1f3f4] dark:border-[#3c4043] flex items-center justify-between text-[13px] text-[#5f6368] dark:text-[#9aa0a6] mt-4">
          <div className="flex items-center gap-4">
            <span><strong className="text-[#202124] dark:text-[#e8eaed]">{likesCount}</strong> +1s</span>
            <span><strong className="text-[#202124] dark:text-[#e8eaed]">{comments.length}</strong> comments</span>
            <span><strong className="text-[#202124] dark:text-[#e8eaed]">{repostsCount}</strong> reshares</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 text-[#5f6368] dark:text-[#9aa0a6]">
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition cursor-pointer ${
                isLiked ? 'text-[#1a73e8] dark:text-[#8ab4f8] bg-[#e8f0fe] dark:bg-[#183153]' : 'hover:bg-[#f1f3f4]'
              }`}
            >
              <span className="font-bold">+1</span>
              <span>{isLiked ? 'Given' : 'Applaud'}</span>
            </button>

            <button
              onClick={handleToggleRepost}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition cursor-pointer ${
                isReposted ? 'text-[#1e8e3e] bg-green-50' : 'hover:bg-[#f1f3f4]'
              }`}
            >
              <Repeat2 className="w-4 h-4" />
              <span>Reshare</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleBookmark}
              className={`p-1.5 rounded-md hover:bg-[#f1f3f4] transition cursor-pointer ${
                isSaved ? 'text-[#1a73e8]' : ''
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                showToast('Link copied', 'info');
              }}
              className="p-1.5 rounded-md hover:bg-[#f1f3f4] transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Reply Form Container (Google rounded-lg) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs mb-4">
        <form onSubmit={handleAddReply} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name}
              className="w-8 h-8 rounded-full object-cover border border-[#dadce0]"
            />
            <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              Commenting as <span className="text-[#1a73e8] font-medium">@{currentUser?.handle || 'user'}</span>
            </span>
          </div>

          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Add a class comment or reply to this post..."
            className="w-full bg-transparent text-[14px] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] text-[#202124] dark:text-[#e8eaed] outline-none resize-none pt-1 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] dark:border-[#3c4043]">
            <div className="flex items-center gap-1 text-[#5f6368]">
              <button type="button" className="p-1.5 rounded-full hover:bg-[#f1f3f4] transition">
                <Image className="w-4 h-4" />
              </button>
              <button type="button" className="p-1.5 rounded-full hover:bg-[#f1f3f4] transition">
                <Smile className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!replyText.trim() || submittingReply}
              className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-medium text-[13px] px-5 py-1.5 rounded-md shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Replies Stream */}
      <div className="flex flex-col gap-2.5 pb-20">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-3.5 shadow-xs flex gap-3">
            <img
              src={comment.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={comment.author}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5 border border-[#dadce0]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-medium text-[13px] text-[#202124] dark:text-[#e8eaed]">
                  {comment.author || 'User'}
                </span>
                <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                  @{comment.handle || 'user'} · {comment.timeAgo || 'recently'}
                </span>
              </div>
              <p className="text-[13px] text-[#202124] dark:text-[#e8eaed] mt-1 leading-relaxed whitespace-pre-wrap">
                {comment.text || comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
