import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Link as LinkIcon,
  CheckCircle2,
  Edit3,
  MessageCircle,
  Grid,
  Film,
  Heart,
  Bookmark,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function ProfileView() {
  const { currentUser, tabParams, navigateTo, showToast } = useSocial();
  const [profile, setProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'reels' | 'liked' | 'saved'
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const targetHandleOrId = tabParams?.handle || tabParams?.id || currentUser?.handle || currentUser?.id;
  const isOwnProfile = !tabParams?.handle || tabParams?.handle === currentUser?.handle || tabParams?.id === currentUser?.id;

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      if (isOwnProfile && currentUser) {
        setProfile(currentUser);
        const posts = await TiwiSocialAPI.getUserPosts(currentUser.id, currentUser.id);
        setUserPosts(posts);
      } else {
        const p = await TiwiSocialAPI.getProfile(targetHandleOrId, currentUser?.id);
        setProfile(p || currentUser);
        const posts = await TiwiSocialAPI.getUserPosts(p?.id || targetHandleOrId, currentUser?.id);
        setUserPosts(posts);
        setIsFollowing(!!p?.isFollowing);
      }
    } catch (e) {
      console.warn('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [targetHandleOrId]);

  const handleToggleFollow = async () => {
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    try {
      await TiwiSocialAPI.followUser(profile.id, currentUser?.id);
      showToast(nextState ? `Following @${profile.handle}` : `Unfollowed @${profile.handle}`, 'info');
    } catch (e) {
      setIsFollowing(!nextState);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
      </div>
    );
  }

  const p = profile || currentUser;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      {/* Cover & Profile Header Card */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs overflow-hidden">
        {/* Cover Image */}
        <div className="h-44 sm:h-56 w-full bg-gradient-to-r from-[#0B57D0] via-[#4285F4] to-[#34A853] relative">
          {p?.coverPhoto && (
            <img src={p.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Profile Info Bar */}
        <div className="px-5 sm:px-8 pb-6 relative">
          {/* Avatar & Action Button Row */}
          <div className="flex items-end justify-between -mt-16 sm:-mt-20 mb-4 gap-4">
            <div className="relative">
              <img
                src={p?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'}
                alt={p?.name}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white dark:border-[#1E293B] shadow-md bg-white"
              />
            </div>

            {isOwnProfile ? (
              <button
                onClick={() => navigateTo('edit-profile')}
                className="flex items-center gap-2 px-5 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-semibold text-[#1F1F1F] dark:text-white hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTo('messages', p?.id)}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors"
                  title="Send Message"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleFollow}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                    isFollowing
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      : 'bg-[#0B57D0] text-white hover:bg-[#0842A0]'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          {/* Names & Bio */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F1F1F] dark:text-white">
                {p?.name || 'Tiwi Member'}
              </h1>
              {p?.isVerified && <CheckCircle2 className="w-5 h-5 text-[#0B57D0]" />}
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">@{p?.handle || 'tiwi'}</p>

            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-3 leading-relaxed max-w-2xl whitespace-pre-line">
              {p?.bio || 'Living the dream and sharing inspiring thoughts on Tiwi.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
              {p?.website && (
                <a
                  href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#0B57D0] dark:text-[#8AB4F8] hover:underline"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{p.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {p?.joinedDate || 'Recently'}</span>
              </div>
            </div>

            {/* Follower & Post Stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#1F1F1F] dark:text-white">{userPosts.length || p?.postsCount || 0}</span>
                <span className="text-gray-500">Posts</span>
              </div>
              <button
                onClick={() => navigateTo('followers', p?.id)}
                className="flex items-center gap-1.5 hover:underline"
              >
                <span className="font-bold text-[#1F1F1F] dark:text-white">{p?.followersCount || 128}</span>
                <span className="text-gray-500">Followers</span>
              </button>
              <button
                onClick={() => navigateTo('following', p?.id)}
                className="flex items-center gap-1.5 hover:underline"
              >
                <span className="font-bold text-[#1F1F1F] dark:text-white">{p?.followingCount || 42}</span>
                <span className="text-gray-500">Following</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Tabs Navigation */}
        <div className="flex items-center border-t border-gray-100 dark:border-gray-800 px-4">
          {[
            { id: 'posts', label: 'Posts', icon: Grid },
            { id: 'reels', label: 'Reels', icon: Film },
            { id: 'liked', label: 'Liked', icon: Heart },
            { id: 'saved', label: 'Saved', icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3.5 text-xs font-bold border-b-2 transition-all ${
                  isActive
                    ? 'border-[#0B57D0] text-[#0B57D0] dark:text-[#8AB4F8]'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex flex-col gap-4">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={(id) => setUserPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          ))
        ) : (
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-10 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] flex items-center justify-center text-[#0B57D0] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white mb-1">No posts published yet</h3>
            <p className="text-xs text-gray-500">When posts are published, they will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
