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
  UserX,
  Globe,
  Send
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
  const [comments, setComments] = useState(Array.isArray(post.comments) ? post.comments : []);
  const [commentsCount, setCommentsCount] = useState(
    parseInt(post.commentsCount || (post.comments?.length || 0), 10)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInlineComments, setShowInlineComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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

  const handleAddInlineComment = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentInput.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const newComment = await TiwiSocialAPI.addComment(post.id, {
        content: commentInput.trim(),
        userId: currentUser?.id,
      });

      const commentObj = newComment || {
        id: `c_${Date.now()}`,
        content: commentInput.trim(),
        author: {
          id: currentUser?.id,
          name: currentUser?.name || 'You',
          handle: currentUser?.handle || 'user',
          avatar: currentUser?.avatar,
        },
        timeAgo: 'Just now',
      };

      setComments((prev) => [...prev, commentObj]);
      setCommentsCount((prev) => prev + 1);
      setCommentInput('');
      setShowInlineComments(true);
      showToast('Comment added', 'info');
    } catch {
      showToast('Failed to add comment', 'error');
    } finally {
      setSubmittingComment(false);
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
      className="bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] rounded-lg shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col mb-3.5 text-[#202124] dark:text-[#e8eaed] overflow-hidden"
    >
      {/* 1. Google Author Header Row */}
      <div className="p-4 pb-2.5 flex items-center justify-between">
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
              className="w-10 h-10 rounded-full object-cover border border-[#dadce0] dark:border-[#5f6368]"
            />
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateTo('profile', post.author?.handle || post.author?.id);
                }}
                className="font-medium text-[14px] hover:underline truncate text-[#202124] dark:text-[#e8eaed]"
              >
                {post.author?.name || 'Tiwi Creator'}
              </button>

              {post.author?.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              <span className="truncate">@{post.author?.handle || 'creator'}</span>
              <span>·</span>
              <span>{post.timeAgo || 'recently'}</span>
              <span>·</span>
              <Globe className="w-3 h-3 text-[#5f6368] dark:text-[#9aa0a6] inline" title="Public" />
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
            className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 w-52 bg-white dark:bg-[#303134] rounded-lg shadow-lg border border-[#dadce0] dark:border-[#3c4043] py-1.5 z-40 animate-fadeIn"
            >
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#202124] text-left text-[13px] text-[#202124] dark:text-[#e8eaed]"
              >
                <Link className="w-4 h-4 text-[#5f6368]" />
                Copy link to post
              </button>

              {isOwner ? (
                <button
                  type="button"
                  onClick={handleDeletePost}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-left text-[13px] text-[#d93025] font-medium"
                >
                  <Trash2 className="w-4 h-4 text-[#d93025]" />
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
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#202124] text-left text-[13px] text-[#202124] dark:text-[#e8eaed]"
                  >
                    <UserX className="w-4 h-4 text-[#5f6368]" />
                    Mute @{post.author?.handle}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      showToast('Post reported', 'info');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#202124] text-left text-[13px] text-[#202124] dark:text-[#e8eaed]"
                  >
                    <Flag className="w-4 h-4 text-[#5f6368]" />
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
        <div className="px-4 pb-3 text-[14px] leading-relaxed whitespace-pre-wrap break-words text-[#202124] dark:text-[#e8eaed]">
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
                  className="text-[#1a73e8] dark:text-[#8ab4f8] font-medium hover:underline mr-0.5"
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
                  className="text-[#1a73e8] dark:text-[#8ab4f8] font-medium hover:underline mr-0.5"
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
                  className="text-[#1a73e8] dark:text-[#8ab4f8] hover:underline"
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
        </div>
      )}

      {/* 3. Media Attachments (Crisp Google rounded-md) */}
      {images.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-md overflow-hidden border border-[#dadce0] dark:border-[#3c4043]">
            {images.length === 1 ? (
              <img
                src={images[0]}
                alt="Post attachment"
                className="w-full max-h-[460px] object-cover bg-black/5 dark:bg-white/5"
                loading="lazy"
              />
            ) : images.length === 2 ? (
              <div className="grid grid-cols-2 gap-0.5">
                <img src={images[0]} alt="attachment 1" className="w-full h-64 object-cover" />
                <img src={images[1]} alt="attachment 2" className="w-full h-64 object-cover" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-0.5">
                {images.slice(0, 4).map((img, idx) => (
                  <img key={idx} src={img} alt={`attachment ${idx}`} className="w-full h-44 object-cover" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Google+ / Currents Style Action Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#f1f3f4] dark:border-[#3c4043] text-[#5f6368] dark:text-[#9aa0a6] text-[13px]">
        <div className="flex items-center gap-1">
          {/* +1 / Applaud Button */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              isLiked
                ? 'text-[#1a73e8] dark:text-[#8ab4f8] bg-[#e8f0fe] dark:bg-[#183153]'
                : 'hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]'
            }`}
            title="+1 / Applaud"
          >
            <span className="font-bold text-[13px]">{isLiked ? '+1' : '+1'}</span>
            <span>{likesCount > 0 ? likesCount : ''}</span>
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowInlineComments((prev) => !prev);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition cursor-pointer"
            title="Comments"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{commentsCount > 0 ? commentsCount : 'Comment'}</span>
          </button>

          {/* Reshare Button */}
          <button
            type="button"
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              isReposted
                ? 'text-[#1e8e3e] bg-green-50 dark:bg-green-950/20'
                : 'hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]'
            }`}
            title="Reshare"
          >
            <Repeat2 className="w-4 h-4" />
            <span>{repostsCount > 0 ? repostsCount : 'Share'}</span>
          </button>
        </div>

        {/* Right Action Icons: Bookmark & Share Link */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`p-1.5 rounded-md hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition cursor-pointer ${
              isSaved ? 'text-[#1a73e8]' : ''
            }`}
            title="Save to bookmarks"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-md hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition cursor-pointer"
            title="Copy link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5. Google Classroom / Google+ Signature Inline Comments Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-2.5 bg-[#f8f9fa] dark:bg-[#202124] border-t border-[#f1f3f4] dark:border-[#3c4043] flex flex-col gap-2"
      >
        {/* Existing Comments List (if expanded or has comments) */}
        {showInlineComments && comments.length > 0 && (
          <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 items-start text-[13px]">
                <img
                  src={
                    c.author?.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop'
                  }
                  alt={c.author?.name || 'User'}
                  className="w-7 h-7 rounded-full object-cover mt-0.5"
                />
                <div className="bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] rounded-lg p-2.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#202124] dark:text-[#e8eaed]">
                      {c.author?.name || 'User'}
                    </span>
                    <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                      {c.timeAgo || 'recently'}
                    </span>
                  </div>
                  <p className="text-[#202124] dark:text-[#e8eaed] mt-0.5">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline Input Box */}
        <form onSubmit={handleAddInlineComment} className="flex items-center gap-2.5">
          <img
            src={
              currentUser?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop'
            }
            alt={currentUser?.name || 'User'}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 flex items-center bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8] rounded-full px-3.5 py-1.5 transition">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add a class comment or reply..."
              className="w-full bg-transparent text-[13px] text-[#202124] dark:text-[#e8eaed] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] outline-none"
            />
            {commentInput.trim() && (
              <button
                type="submit"
                disabled={submittingComment}
                className="text-[#1a73e8] hover:text-[#1557b0] p-1 ml-1 cursor-pointer"
                title="Post comment"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </article>
  );
}
