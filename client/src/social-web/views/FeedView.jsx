import React, { useState, useEffect } from 'react';
import {
  Image,
  Film,
  Smile,
  Globe,
  Vote,
  RefreshCw,
  Send,
  MessageSquare
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function FeedView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [feedFilter, setFeedFilter] = useState('for_you'); // 'for_you' | 'following'
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postText, setPostText] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  const fetchFeed = async (filterMode = feedFilter) => {
    try {
      setLoading(true);
      const data = await TiwiSocialAPI.getFeed(currentUser?.id, filterMode);
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Error loading feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed(feedFilter);
  }, [currentUser?.id, feedFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFeed(feedFilter);
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postText.trim() || submittingPost) return;
    setSubmittingPost(true);
    try {
      const newPost = await TiwiSocialAPI.createPost({
        caption: postText.trim(),
        userId: currentUser?.id,
      });
      setPosts((prev) => [newPost, ...prev]);
      setPostText('');
      showToast('Announced to network', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to post', 'error');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Google Classroom / Google+ Style Header Tabs */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md pb-1 mb-3 pt-1 border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setFeedFilter('for_you')}
              className={`pb-2 text-[14px] font-medium transition cursor-pointer relative ${
                feedFilter === 'for_you'
                  ? 'text-[#1a73e8] dark:text-[#8ab4f8] font-semibold'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124]'
              }`}
            >
              <span>Stream</span>
              {feedFilter === 'for_you' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setFeedFilter('following')}
              className={`pb-2 text-[14px] font-medium transition cursor-pointer relative ${
                feedFilter === 'following'
                  ? 'text-[#1a73e8] dark:text-[#8ab4f8] font-semibold'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124]'
              }`}
            >
              <span>Following</span>
              {feedFilter === 'following' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
              )}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Refresh stream"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1a73e8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Google Classroom Style "Announce something to your network" Card */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs mb-4 transition focus-within:shadow-md">
        <form onSubmit={handlePostSubmit} className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
              className="flex-shrink-0 self-start pt-1"
            >
              <img
                src={
                  currentUser?.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                }
                alt={currentUser?.name || 'User'}
                className="w-10 h-10 rounded-full object-cover border border-[#dadce0] dark:border-[#5f6368]"
              />
            </button>

            <div className="flex-1 min-w-0">
              <textarea
                rows={postText.length > 60 ? 3 : 2}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Announce something to your community or share a link..."
                className="w-full bg-transparent text-[14px] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] text-[#202124] dark:text-[#e8eaed] outline-none resize-none pt-1 leading-relaxed"
              />
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] dark:border-[#3c4043]">
            <div className="flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6]">
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#1e8e3e]"
                title="Add Photo"
              >
                <Image className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#d93025]"
                title="Add Video"
              >
                <Film className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('polls')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#f29900]"
                title="Create Poll"
              >
                <Vote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#1a73e8]"
                title="Insert Link or Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!postText.trim() || submittingPost}
              className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-medium text-[14px] px-5 py-2 rounded-md shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Stream of Google Cards */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] animate-pulse flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-1/3 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="w-1/5 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
                <div className="w-full h-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
          ))
        ) : (
          <div className="py-16 px-6 text-center flex flex-col items-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043]">
            <h3 className="font-medium text-[18px] text-[#202124] dark:text-[#e8eaed] mb-1.5">
              Stream is up to date
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] max-w-sm mb-5 leading-relaxed">
              No new announcements right now. Connect with more circles or explore communities.
            </p>
            <button
              onClick={() => navigateTo('search')}
              className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-5 py-2 rounded-md shadow-xs active:scale-95 transition cursor-pointer"
            >
              Explore Communities
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
