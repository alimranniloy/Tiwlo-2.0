import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Image, Video, Radio, Flame, Send } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';

export default function FeedView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [feedFilter, setFeedFilter] = useState('for_you'); // 'for_you' | 'following' | 'popular'
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickPostText, setQuickPostText] = useState('');
  const [submittingQuickPost, setSubmittingQuickPost] = useState(false);

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

  const handleQuickPostSubmit = async (e) => {
    e.preventDefault();
    if (!quickPostText.trim() || submittingQuickPost) return;
    setSubmittingQuickPost(true);
    try {
      const newPost = await TiwiSocialAPI.createPost({
        caption: quickPostText.trim(),
        userId: currentUser?.id,
      });
      setPosts((prev) => [newPost, ...prev]);
      setQuickPostText('');
      showToast('Post published successfully!', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to post', 'error');
    } finally {
      setSubmittingQuickPost(false);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Stories Bar */}
      <StoriesBar />

      {/* Quick Composer Box (Click opens dedicated /tiwi/create-post or submits inline) */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-4 sm:p-5 border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
        <form onSubmit={handleQuickPostSubmit} className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer"
              onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            />
            <textarea
              rows={2}
              placeholder={`What's on your mind, ${currentUser?.name ? currentUser.name.split(' ')[0] : 'friend'}?`}
              value={quickPostText}
              onChange={(e) => setQuickPostText(e.target.value)}
              className="flex-1 bg-[#F8F9FA] dark:bg-[#111827] text-sm text-[#1F1F1F] dark:text-white rounded-2xl p-3 border border-transparent focus:border-[#0B57D0] focus:bg-white dark:focus:bg-[#111827] focus:outline-none resize-none transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111827] transition-colors"
              >
                <Image className="w-4 h-4 text-emerald-500" />
                <span>Photo</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111827] transition-colors"
              >
                <Video className="w-4 h-4 text-blue-500" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('audio-spaces')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111827] transition-colors hidden sm:flex"
              >
                <Radio className="w-4 h-4 text-purple-500" />
                <span>Live Audio</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!quickPostText.trim() || submittingQuickPost}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white px-5 py-2 rounded-full text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feed Filter Tabs */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1 bg-[#F1F3F4] dark:bg-[#1E293B] p-1 rounded-full">
          {[
            { id: 'for_you', label: 'For You' },
            { id: 'following', label: 'Following' },
            { id: 'popular', label: 'Popular' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFeedFilter(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                feedFilter === tab.id
                  ? 'bg-white dark:bg-[#111827] text-[#0B57D0] dark:text-[#8AB4F8] shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-500 transition-colors"
          title="Refresh feed"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#0B57D0]' : ''}`} />
        </button>
      </div>

      {/* Posts Feed List */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 animate-pulse flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1.5" />
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                </div>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mt-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl w-full mt-2" />
            </div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-10 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] flex items-center justify-center text-[#0B57D0] mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#1F1F1F] dark:text-white mb-1">Your feed is fresh!</h3>
          <p className="text-xs text-gray-500 max-w-sm mb-4">
            Be the first to share an update, photo, or thought with the Tiwi community.
          </p>
          <button
            onClick={() => navigateTo('create-post')}
            className="bg-[#0B57D0] hover:bg-[#0842A0] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-xs transition-all"
          >
            Create First Post
          </button>
        </div>
      )}
    </div>
  );
}
