import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  Send,
  Trash2,
  ExternalLink
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
  const [commentsCount, setCommentsCount] = useState(parseInt(post.commentsCount || (post.comments?.length || 0), 10));
  const [showInlineComments, setShowInlineComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = currentUser?.id && (post.author?.id === currentUser?.id || post.author?.handle === currentUser?.handle);

  const handleToggleLike = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await TiwiSocialAPI.toggleLikePost(post.id, currentUser?.id);
    } catch (e) {
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleToggleBookmark = async () => {
    const nextState = !isSaved;
    setIsSaved(nextState);
    showToast(nextState ? 'Post saved to bookmarks' : 'Post removed from bookmarks', 'info');
    try {
      await TiwiSocialAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch (e) {
      setIsSaved(!nextState);
    }
  };

  const handleToggleRepost = async () => {
    const nextState = !isReposted;
    setIsReposted(nextState);
    setRepostsCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    showToast(nextState ? 'Reposted to your feed' : 'Repost undone', 'info');
    try {
      await TiwiSocialAPI.toggleRepost(post.id, currentUser?.id);
    } catch (e) {
      setIsReposted(!nextState);
      setRepostsCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const newComment = await TiwiSocialAPI.addComment(post.id, commentText.trim(), currentUser?.id);
      setComments((prev) => [...prev, newComment || {
        id: `c_${Date.now()}`,
        author: currentUser?.name || 'You',
        text: commentText.trim(),
        avatar: currentUser?.avatar,
        timeAgo: 'Just now'
      }]);
      setCommentsCount((prev) => prev + 1);
      setCommentText('');
      showToast('Comment posted', 'info');
    } catch (err) {
      showToast('Failed to post comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await TiwiSocialAPI.deletePost(post.id, currentUser?.id);
      showToast('Post deleted', 'info');
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (e) {
      showToast('Could not delete post', 'error');
    }
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/tiwi/post/${post.id}`;
    navigator.clipboard?.writeText(postUrl);
    showToast('Post link copied to clipboard!', 'info');
    setMenuOpen(false);
  };

  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : (post.image ? [post.image] : []);

  return (
    <article className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs hover:shadow-sm transition-all overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 pb-3 flex items-center justify-between gap-3">
        <button
          onClick={() => navigateTo('profile', post.author?.handle || post.author?.id)}
          className="flex items-center gap-3 text-left min-w-0 group"
        >
          <img
            src={post.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
            alt={post.author?.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[#0B57D0] transition-all"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1.5 truncate group-hover:text-[#0B57D0] transition-colors">
              {post.author?.name || 'Creator'}
              {post.author?.isVerified && <CheckCircle2 className="w-4 h-4 text-[#0B57D0] inline flex-shrink-0" />}
            </div>
            <div className="text-xs text-gray-500 truncate">
              @{post.author?.handle || 'tiwi'} • {post.timeAgo || 'Recently'}
            </div>
          </div>
        </button>

        {/* Post Options Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#111827] text-gray-500 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#111827] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-1.5 z-30">
              <button
                onClick={handleCopyLink}
                className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1E293B] flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5 text-gray-400" />
                Copy Link
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigateTo('post-detail', post.id);
                }}
                className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1E293B] flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                View Dedicated Page
              </button>
              {isOwner && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleDeletePost();
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  Delete Post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text / Caption */}
      {post.caption && (
        <div className="px-4 sm:px-5 py-2 text-sm leading-relaxed text-[#1F1F1F] dark:text-gray-200 whitespace-pre-line">
          {post.caption}
        </div>
      )}

      {/* Post Media (Images or Video) */}
      {images.length > 0 && (
        <div className="mt-2 bg-black/5 dark:bg-black/30">
          {images.length === 1 ? (
            <img
              src={images[0]}
              alt="Post media"
              className="w-full max-h-[540px] object-cover sm:rounded-none cursor-pointer"
              onClick={() => navigateTo('post-detail', post.id)}
            />
          ) : (
            <div className={`grid gap-1 ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {images.slice(0, 4).map((img, i) => (
                <div key={i} className="relative aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={img}
                    alt={`Media ${i + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => navigateTo('post-detail', post.id)}
                  />
                  {i === 3 && images.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                      +{images.length - 3}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Media (if videoUrl is present) */}
      {post.videoUrl && (
        <div className="mt-2 bg-black overflow-hidden aspect-video relative flex items-center justify-center">
          <video
            src={post.videoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Actions Bar */}
      <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-800/80 mt-2">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Like Button */}
          <button
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isLiked
                ? 'text-[#B3261E] bg-[#FCE8E6] dark:bg-red-950/40'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#111827]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likesCount}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => setShowInlineComments((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#111827] transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{commentsCount}</span>
          </button>

          {/* Repost Button */}
          <button
            onClick={handleToggleRepost}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              isReposted
                ? 'text-[#137333] bg-[#E6F4EA] dark:bg-emerald-950/40'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#111827]'
            }`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{repostsCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Bookmark Button */}
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-full transition-all ${
              isSaved
                ? 'text-[#0B57D0] bg-[#E8F0FE] dark:bg-blue-950/40'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#111827]'
            }`}
            title="Save to bookmarks"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          {/* Share */}
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-[#111827] transition-all"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Comments Section */}
      {showInlineComments && (
        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-[#111827]/40 flex flex-col gap-3">
          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'}
              alt="You"
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-1.5 text-xs text-[#1F1F1F] dark:text-white focus:outline-none focus:border-[#0B57D0]"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              className="p-1.5 rounded-full bg-[#0B57D0] text-white disabled:opacity-40 hover:bg-[#0842A0] transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Recent Comments List */}
          {comments.length > 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              {comments.slice(-3).map((c, idx) => (
                <div key={c.id || idx} className="flex items-start gap-2.5 text-xs">
                  <img
                    src={c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                    alt={c.author}
                    className="w-6 h-6 rounded-full object-cover mt-0.5"
                  />
                  <div className="flex-1 bg-white dark:bg-[#1E293B] p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <span className="font-bold text-[#1F1F1F] dark:text-white mr-1.5">{c.author}</span>
                    <span className="text-gray-700 dark:text-gray-300">{c.text}</span>
                  </div>
                </div>
              ))}

              {comments.length > 3 && (
                <button
                  onClick={() => navigateTo('post-detail', post.id)}
                  className="text-xs text-[#0B57D0] dark:text-[#8AB4F8] hover:underline font-semibold text-left pt-1"
                >
                  View all {commentsCount} comments on dedicated page →
                </button>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 py-1 text-center">No comments yet. Start the conversation!</div>
          )}
        </div>
      )}
    </article>
  );
}
