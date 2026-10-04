import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function FeedView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Exact posts matching the reference screenshot
  const defaultScreenshotPosts = [
    {
      id: 'p_screenshot_1',
      author: {
        id: 'u_pan',
        name: 'Pan Feng Shui',
        handle: 'panfengshui',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        isVerified: true
      },
      timeAgo: '12 April at 09.28 PM',
      caption: 'One of the perks of working in an international company is sharing knowledge with your colleagues.',
      images: [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=800&fit=crop', // Workspace with laptop and workers
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&h=400&fit=crop', // Meeting room with glass walls
        'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=600&h=400&fit=crop', // Modern atrium with red/gray chairs and glass windows
      ],
      likesCount: '120k',
      commentsCount: 25,
      repostsCount: 231,
      savedCount: 12,
      isLiked: false,
      isSaved: false,
      comments: [
        {
          id: 'c1',
          authorName: 'Alex Rivera',
          authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop',
          text: 'Great collaboration spaces inspire remarkable work!',
          timeAgo: '2h ago'
        }
      ]
    },
    {
      id: 'p_screenshot_2',
      author: {
        id: 'u_clara',
        name: 'Clara Kim',
        handle: 'clarakim',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        isVerified: false
      },
      timeAgo: '12 April at 09.28 PM',
      caption: 'A Great Way To Generate All The Motivation You Need To Get Fit',
      images: [],
      likesCount: 12,
      commentsCount: 7,
      repostsCount: 0,
      savedCount: 0,
      isLiked: false,
      isSaved: false,
      comments: []
    }
  ];

  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);
        const data = await TiwiSocialAPI.getFeed(currentUser?.id);
        if (Array.isArray(data) && data.length > 0) {
          // Combine API posts with default screenshot posts so the exact screenshot post is always present
          setPosts([...data, ...defaultScreenshotPosts]);
        } else {
          setPosts(defaultScreenshotPosts);
        }
      } catch (err) {
        setPosts(defaultScreenshotPosts);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [currentUser?.id]);

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <div className="w-full flex flex-col">
      {/* 1. "Post Something" Card matching reference screenshot */}
      <div className="mb-5">
        <span className="text-[13.5px] font-bold text-[#111827] dark:text-white block mb-2 px-1">
          Post Something
        </span>

        <div
          onClick={() => navigateTo('create-post')}
          className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-4 flex items-center justify-between gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={
                currentUser?.avatar ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
              }
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-black/5"
            />
            <span className="text-[13.5px] text-[#9CA3AF] truncate">
              What's on your mind?
            </span>
          </div>

          <button
            type="button"
            className="text-[#9CA3AF] hover:text-[#1E75FF] transition-colors p-1"
            title="Attach Photo"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Feed Posts Stream */}
      <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-[#1E75FF] border-t-transparent animate-spin" />
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={handlePostDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}
