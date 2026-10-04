import React, { useState, useEffect } from 'react';
import {
  Image,
  Film,
  Smile,
  Calendar,
  MapPin,
  ListFilter,
  Sparkles,
  Globe,
  Radio,
  Vote,
  RefreshCw
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
  const [tweetText, setTweetText] = useState('');
  const [submittingTweet, setSubmittingTweet] = useState(false);

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
    if (!tweetText.trim() || submittingTweet) return;
    setSubmittingTweet(true);
    try {
      const newPost = await TiwiSocialAPI.createPost({
        caption: tweetText.trim(),
        userId: currentUser?.id,
      });
      setPosts((prev) => [newPost, ...prev]);
      setTweetText('');
      showToast('Your post was sent', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to post', 'error');
    } finally {
      setSubmittingTweet(false);
    }
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Twitter Sticky Header: Tabs 'For you' & 'Following' */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA]">
            Home
          </h1>
          <button
            onClick={handleRefresh}
            className="w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1D9BF0]' : ''}`} />
          </button>
        </div>

        <div className="flex border-t border-[#EFF3F4] dark:border-[#2F3336]">
          {/* 'For you' Tab */}
          <button
            type="button"
            onClick={() => setFeedFilter('for_you')}
            className="flex-1 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative text-center cursor-pointer"
          >
            <span
              className={`text-[15px] ${
                feedFilter === 'for_you'
                  ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                  : 'font-medium text-[#536471] dark:text-[#71767B]'
              }`}
            >
              For you
            </span>
            {feedFilter === 'for_you' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>

          {/* 'Following' Tab */}
          <button
            type="button"
            onClick={() => setFeedFilter('following')}
            className="flex-1 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative text-center cursor-pointer"
          >
            <span
              className={`text-[15px] ${
                feedFilter === 'following'
                  ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                  : 'font-medium text-[#536471] dark:text-[#71767B]'
              }`}
            >
              Following
            </span>
            {feedFilter === 'following' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Twitter Inline Composer ("What is happening?!") */}
      <div className="px-4 py-3 border-b border-[#EFF3F4] dark:border-[#2F3336] flex gap-3">
        <button
          type="button"
          onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
          className="flex-shrink-0 self-start"
        >
          <img
            src={
              currentUser?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
            }
            alt={currentUser?.name || 'User'}
            className="w-10 h-10 rounded-full object-cover hover:opacity-90 transition"
          />
        </button>

        <form onSubmit={handlePostSubmit} className="flex-1 min-w-0 flex flex-col">
          <textarea
            rows={tweetText.length > 80 ? 4 : 2}
            value={tweetText}
            onChange={(e) => setTweetText(e.target.value)}
            placeholder="What is happening?!"
            className="w-full bg-transparent text-[20px] placeholder-[#536471] dark:placeholder-[#71767B] text-[#0F1419] dark:text-[#E7E9EA] outline-none resize-none pt-2 font-normal leading-relaxed"
          />

          {/* Everyone can reply pill indicator */}
          <div className="flex items-center gap-1.5 text-[#1D9BF0] font-bold text-[13px] pb-3 border-b border-[#EFF3F4] dark:border-[#2F3336] mt-2 mb-2">
            <Globe className="w-3.5 h-3.5" />
            <span>Everyone can reply</span>
          </div>

          {/* Composer Action Toolbar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-0.5 text-[#1D9BF0] -ml-2">
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
                title="Media"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
                title="GIF"
              >
                <Film className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('polls')}
                className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
                title="Poll"
              >
                <Vote className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('create-post')}
                className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('audio-spaces')}
                className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
                title="Audio Spaces"
              >
                <Radio className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!tweetText.trim() || submittingTweet}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 text-white font-bold text-[15px] px-4 py-1.5 rounded-full shadow-sm transition active:scale-95 cursor-pointer"
            >
              Post
            </button>
          </div>
        </form>
      </div>

      {/* 3. Tweets Timeline Stream */}
      <div className="flex flex-col pb-24 md:pb-12">
        {loading ? (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="w-1/3 h-4 bg-black/10 dark:bg-white/10 rounded" />
                  <div className="w-full h-12 bg-black/10 dark:bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDeleted={handlePostDeleted} />
          ))
        ) : (
          <div className="py-20 px-6 text-center flex flex-col items-center">
            <h3 className="font-extrabold text-[22px] text-[#0F1419] dark:text-[#E7E9EA] mb-2">
              Welcome to your timeline!
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-sm mb-5 leading-relaxed">
              This is the best place to see what’s happening in your world. Find people and topics to follow now.
            </p>
            <button
              onClick={() => navigateTo('search')}
              className="bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] font-bold text-[15px] px-5 py-2.5 rounded-full hover:opacity-90 transition"
            >
              Let’s go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
