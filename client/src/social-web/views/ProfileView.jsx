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
  const { currentProfileHandle, navigateTo, currentUser, showToast } = useSocial();
  const targetHandleOrId = currentProfileHandle || currentUser?.handle || currentUser?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'media' | 'likes'
  const [isFollowing, setIsFollowing] = useState(false);
  const [isNotified, setIsNotified] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const u = await TiwiSocialAPI.getUserProfile(targetHandleOrId, currentUser?.id);
        if (u) {
          setProfileUser(u);
          setIsFollowing(!!u.isFollowing);
        } else {
          setProfileUser(currentUser);
        }

        const posts = await TiwiSocialAPI.getUserPosts(u?.id || targetHandleOrId);
        setUserPosts(Array.isArray(posts) ? posts : []);
      } catch (err) {
        console.warn('Error loading profile:', err);
      }
    }
    loadProfile();
  }, [targetHandleOrId, currentUser?.id, currentUser]);

  const p = profileUser || currentUser;
  const isOwnProfile =
    currentUser?.id && (p?.id === currentUser?.id || p?.handle === currentUser?.handle);

  const handleToggleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    showToast(next ? `Added @${p?.handle}` : `Removed @${p?.handle}`, 'info');
    try {
      await TiwiSocialAPI.followUser(p?.id, currentUser?.id);
    } catch {
      setIsFollowing(!next);
    }
  };

  const mediaPosts = userPosts.filter((post) => Array.isArray(post.images) && post.images.length > 0);
  const postCount = userPosts.length;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-2.5 flex items-center gap-4 border-b border-[#dadce0] dark:border-[#3c4043] mb-3">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed]">
              {p?.name || 'Tiwi Creator'}
            </h1>
            {p?.isVerified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
            )}
          </div>
          <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* 2. Google Profile Card Container (Google rounded-lg) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] overflow-hidden shadow-xs mb-4">
        {/* Banner with Google clean gradient */}
        <div className="h-40 sm:h-48 w-full bg-gradient-to-r from-[#d2e3fc] via-[#e8eaed] to-[#ceead6] dark:from-[#183153] dark:to-[#202124] relative">
          {p?.coverPhoto && (
            <img src={p.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Profile Details Container */}
        <div className="p-4 sm:p-5 relative">
          {/* Avatar overlapping banner */}
          <div className="absolute -top-14 left-5">
            <img
              src={
                p?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
              }
              alt={p?.name}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-[#303134] bg-white dark:bg-[#303134] border border-[#dadce0]"
            />
          </div>

          {/* Action Button Row */}
          <div className="flex justify-end min-h-[40px] mb-2">
            {isOwnProfile ? (
              <button
                onClick={() => navigateTo('edit-profile')}
                className="flex items-center gap-2 border border-[#dadce0] dark:border-[#5f6368] rounded-md px-4 py-1.5 font-medium text-[13px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#202124] transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
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
                  className={`w-9 h-9 rounded-md border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer ${
                    isNotified ? 'text-[#1a73e8]' : 'text-[#5f6368] dark:text-[#9aa0a6]'
                  }`}
                  title="Notify"
                >
                  <Bell className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigateTo('messages', p?.id)}
                  className="w-9 h-9 rounded-md border border-[#dadce0] dark:border-[#5f6368] hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#5f6368] dark:text-[#9aa0a6]"
                  title="Message"
                >
                  <Mail className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToggleFollow}
                  className={`font-medium text-[13px] px-5 py-1.5 rounded-md transition active:scale-95 cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed] hover:bg-red-50'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          {/* Name & Bio */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[20px] font-semibold text-[#202124] dark:text-[#e8eaed]">
                {p?.name || 'Creator'}
              </h2>
              {p?.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-[#1a73e8] fill-current" />
              )}
            </div>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">@{p?.handle || 'creator'}</p>

            {p?.bio && (
              <p className="text-[14px] text-[#202124] dark:text-[#e8eaed] mt-2.5 leading-relaxed whitespace-pre-wrap">
                {p.bio}
              </p>
            )}

            {/* Meta Attributes */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              {p?.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{p.location}</span>
                </div>
              )}
              {p?.website && (
                <div className="flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <a
                    href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1a73e8] dark:text-[#8ab4f8] hover:underline"
                  >
                    {p.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {p?.joinedDate || 'October 2026'}</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f1f3f4] dark:border-[#3c4043] text-[13px]">
              <button
                onClick={() => navigateTo('following', p?.handle || p?.id)}
                className="hover:underline flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6]"
              >
                <strong className="text-[#202124] dark:text-[#e8eaed] font-medium">
                  {p?.followingCount || 420}
                </strong>
                <span>Following</span>
              </button>
              <button
                onClick={() => navigateTo('followers', p?.handle || p?.id)}
                className="hover:underline flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6]"
              >
                <strong className="text-[#202124] dark:text-[#e8eaed] font-medium">
                  {p?.followersCount || 1840}
                </strong>
                <span>Followers</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Google Underline Tabs */}
      <div className="flex items-center gap-6 border-b border-[#dadce0] dark:border-[#3c4043] mb-4 px-2">
        {[
          { id: 'posts', label: 'Posts' },
          { id: 'media', label: 'Media' },
          { id: 'likes', label: 'Likes' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 text-[14px] font-medium transition cursor-pointer relative ${
              activeTab === tab.id
                ? 'text-[#1a73e8] dark:text-[#8ab4f8] font-semibold'
                : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124]'
            }`}
          >
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
            )}
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
            <div className="py-14 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6">
              <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
                No posts shared yet
              </h3>
              <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                When updates are posted, they will appear here in the stream.
              </p>
            </div>
          )
        )}

        {activeTab === 'media' && (
          mediaPosts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {mediaPosts.map((post) =>
                post.images.map((img, i) => (
                  <div
                    key={`${post.id}_${i}`}
                    onClick={() => navigateTo('post-detail', post.id)}
                    className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden cursor-pointer group shadow-xs border border-[#dadce0] dark:border-[#3c4043]"
                  >
                    <img src={img} alt="media" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-14 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6">
              <ImageIcon className="w-8 h-8 text-[#5f6368] mx-auto mb-2" />
              <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
                No media attachments
              </h3>
              <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
                Photos and video uploads will be displayed here in your gallery.
              </p>
            </div>
          )
        )}

        {activeTab === 'likes' && (
          <div className="py-14 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6">
            <Heart className="w-8 h-8 text-[#d93025] mx-auto mb-2" />
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
              No liked posts yet
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
              Posts that you applaud or like will be collected in this section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
