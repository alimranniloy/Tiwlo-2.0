import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  MapPin,
  CheckCircle2,
  Mail,
  Bell,
  Image as ImageIcon,
  Heart,
  Edit3
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function ProfileView() {
  const { currentUser, tabParams, navigateTo, showToast } = useSocial();
  const [profile, setProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'media' | 'likes'
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isNotified, setIsNotified] = useState(false);

  const targetHandleOrId = tabParams?.handle || tabParams?.id || currentUser?.handle || currentUser?.id;
  const isOwnProfile =
    !tabParams?.handle ||
    tabParams?.handle === currentUser?.handle ||
    tabParams?.id === currentUser?.id;

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      if (isOwnProfile && currentUser) {
        setProfile(currentUser);
        const posts = await TiwiSocialAPI.getUserPosts(currentUser.id, currentUser.id);
        setUserPosts(Array.isArray(posts) ? posts : []);
      } else {
        const p = await TiwiSocialAPI.getProfile(targetHandleOrId, currentUser?.id);
        setProfile(p || currentUser);
        const posts = await TiwiSocialAPI.getUserPosts(p?.id || targetHandleOrId, currentUser?.id);
        setUserPosts(Array.isArray(posts) ? posts : []);
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
    } catch {
      setIsFollowing(!nextState);
    }
  };

  const p = profile || currentUser;
  const postCount = userPosts.length;

  const mediaPosts = userPosts.filter(
    (post) => Array.isArray(post.images) && post.images.length > 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <button
          onClick={() => navigateTo('feed')}
          className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
            <span className="truncate">{p?.name || 'User'}</span>
            {p?.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-[#0B57D0] fill-current inline flex-shrink-0" />
            )}
          </div>
          <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* 2. Google Profile Card Container */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] overflow-hidden shadow-xs mb-4">
        {/* Banner with Google clean gradient */}
        <div className="h-44 sm:h-52 w-full bg-gradient-to-r from-[#D3E3FD] via-[#E8DEF8] to-[#C2E7FF] dark:from-[#004A77] dark:to-[#1E293B] relative">
          {p?.coverPhoto && (
            <img src={p.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Profile Details Container */}
        <div className="p-5 sm:p-6 relative">
          {/* Avatar overlapping banner */}
          <div className="absolute -top-16 left-6">
            <img
              src={
                p?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
              }
              alt={p?.name}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-white dark:ring-[#1E1F20] bg-white dark:bg-[#1E1F20] shadow-sm"
            />
          </div>

          {/* Action Button Row */}
          <div className="flex justify-end min-h-[44px] mb-3">
            {isOwnProfile ? (
              <button
                onClick={() => navigateTo('edit-profile')}
                className="flex items-center gap-2 border border-[#747775] rounded-full px-5 py-2 font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = !isNotified;
                    setIsNotified(next);
                    showToast(next ? 'Notifications enabled' : 'Notifications disabled', 'info');
                  }}
                  className={`w-10 h-10 rounded-full border border-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer ${
                    isNotified ? 'text-[#0B57D0]' : 'text-[#444746] dark:text-[#C4C7C5]'
                  }`}
                  title="Notify"
                >
                  <Bell className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigateTo('messages', p?.id)}
                  className="w-10 h-10 rounded-full border border-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition cursor-pointer text-[#444746] dark:text-[#C4C7C5]"
                  title="Message"
                >
                  <Mail className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToggleFollow}
                  className={`font-semibold text-[14px] px-6 py-2 rounded-full transition active:scale-95 cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-red-50 dark:hover:bg-red-950/20'
                      : 'bg-[#0B57D0] hover:bg-[#0842A0] text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          {/* Name & Bio */}
          <div className="mt-4 flex flex-col">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-[22px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                {p?.name || 'Tiwi Member'}
              </h2>
              {p?.isVerified && (
                <CheckCircle2 className="w-5 h-5 text-[#0B57D0] fill-current inline flex-shrink-0" />
              )}
            </div>
            <span className="text-[14px] text-[#747775] dark:text-[#8E918F]">
              @{p?.handle || 'user'}
            </span>

            <p className="text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] mt-3 whitespace-pre-wrap leading-relaxed">
              {p?.bio || 'Building clean, intuitive software experiences and open web technologies.'}
            </p>

            {/* Metas Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[13px] text-[#747775] dark:text-[#8E918F]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>Worldwide</span>
              </div>

              {p?.website && (
                <div className="flex items-center gap-1.5">
                  <LinkIcon className="w-4 h-4" />
                  <a
                    href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0B57D0] dark:text-[#A8C7FA] hover:underline"
                  >
                    {p.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Joined October 2023</span>
              </div>
            </div>

            {/* Google-Style Followers Stats Chips */}
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[#E0E2EC]/70 dark:border-[#313335]">
              <button
                onClick={() => navigateTo('following')}
                className="flex items-center gap-1.5 text-[14px] hover:text-[#0B57D0] transition cursor-pointer"
              >
                <span className="font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                  {p?.followingCount || 142}
                </span>
                <span className="text-[#747775] dark:text-[#8E918F]">Following</span>
              </button>

              <button
                onClick={() => navigateTo('followers')}
                className="flex items-center gap-1.5 text-[14px] hover:text-[#0B57D0] transition cursor-pointer"
              >
                <span className="font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                  {p?.followersCount || 1840}
                </span>
                <span className="text-[#747775] dark:text-[#8E918F]">Followers</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Material 3 Tabs */}
      <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full w-full max-w-sm mb-4">
        {[
          { id: 'posts', label: 'Posts' },
          { id: 'media', label: 'Media' },
          { id: 'likes', label: 'Likes' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer text-center ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Stream or Gallery Content */}
      <div className="flex flex-col">
        {activeTab === 'posts' && (
          userPosts.length > 0 ? (
            userPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={(id) => setUserPosts((prev) => prev.filter((item) => item.id !== id))}
              />
            ))
          ) : (
            <div className="py-16 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6">
              <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
                No posts shared yet
              </h3>
              <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
                When updates are posted, they will appear here in the stream.
              </p>
            </div>
          )
        )}

        {activeTab === 'media' && (
          mediaPosts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {mediaPosts.map((post) =>
                post.images.map((img, i) => (
                  <div
                    key={`${post.id}_${i}`}
                    onClick={() => navigateTo('post-detail', post.id)}
                    className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden cursor-pointer group shadow-xs"
                  >
                    <img src={img} alt="media" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-16 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6">
              <ImageIcon className="w-10 h-10 text-[#747775] mx-auto mb-2" />
              <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
                No media attachments
              </h3>
              <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
                Photos and video uploads will be displayed here in your gallery.
              </p>
            </div>
          )
        )}

        {activeTab === 'likes' && (
          <div className="py-16 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6">
            <Heart className="w-10 h-10 text-[#B3261E] mx-auto mb-2" />
            <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              No liked posts yet
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
              Posts that you applaud or like will be collected in this section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
