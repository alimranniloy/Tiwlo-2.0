import React, { useState, useEffect } from 'react';
import {
  Image,
  Film,
  Smile,
  Globe,
  Radio,
  Vote,
  RefreshCw,
  Send
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
      showToast('Post published to stream', 'info');
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
      {/* 1. Google Material 3 App Header with Stream Tabs */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md pb-2 mb-2">
        <div className="h-[56px] flex items-center justify-between px-2 sm:px-0">
          <h1 className="text-[22px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] tracking-tight">
            Stream
          </h1>
          <button
            onClick={handleRefresh}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Refresh stream"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#0B57D0]' : ''}`} />
          </button>
        </div>

        {/* Material 3 Segmented Pill Tabs */}
        <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full w-full max-w-sm">
          <button
            type="button"
            onClick={() => setFeedFilter('for_you')}
            className={`flex-1 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer text-center ${
              feedFilter === 'for_you'
                ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F]'
            }`}
          >
            For you
          </button>

          <button
            type="button"
            onClick={() => setFeedFilter('following')}
            className={`flex-1 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer text-center ${
              feedFilter === 'following'
                ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F]'
            }`}
          >
            Following
          </button>
        </div>
      </div>

      {/* 2. Google-Style Compose Card (Material Surface) */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-4.5 shadow-xs mb-4 transition-all focus-within:shadow-sm">
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
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#E0E2EC] dark:ring-[#444746]"
              />
            </button>

            <div className="flex-1 min-w-0">
              <textarea
                rows={postText.length > 60 ? 3 : 2}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share an update, link, or idea with your network..."
                className="w-full bg-transparent text-[16px] placeholder-[#747775] dark:placeholder-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none resize-none pt-1 leading-relaxed font-normal"
              />
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E0E2EC]/70 dark:border-[#313335]">
            <div className="flex items-center gap-1 text-[#444746] dark:text-[#C4C7C5]">
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer text-[#0B57D0]"
                title="Attach Image"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer text-[#0F5223]"
                title="Add Video"
              >
                <Film className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('polls')}
                className="w-9 h-9 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer text-[#7D5700]"
                title="Create Poll"
              >
                <Vote className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer text-[#444746]"
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!postText.trim() || submittingPost}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white font-semibold text-[14px] px-5 py-2 rounded-full shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Stream of Material 3 Cards */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-3xl bg-white dark:bg-[#1E1F20] border border-[#E0E2EC] dark:border-[#313335] animate-pulse flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-1/3 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="w-1/5 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
                  </div>
                </div>
                <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
          ))
        ) : (
          <div className="py-20 px-6 text-center flex flex-col items-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335]">
            <h3 className="font-extrabold text-[22px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-2">
              Your Stream is ready
            </h3>
            <p className="text-[14px] text-[#747775] dark:text-[#8E918F] max-w-sm mb-6 leading-relaxed">
              Explore trending discussions or follow creators to start seeing real-time updates.
            </p>
            <button
              onClick={() => navigateTo('search')}
              className="bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-[14px] px-6 py-2.5 rounded-full shadow-xs active:scale-95 transition cursor-pointer"
            >
              Explore Communities
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
