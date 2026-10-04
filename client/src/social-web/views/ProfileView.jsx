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
  Edit3,
  Grid3X3
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function ProfileView() {
  const { currentProfileHandle, navigateTo, currentUser, showToast } = useSocial();
  const targetHandleOrId = currentProfileHandle || currentUser?.handle || currentUser?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
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
    showToast(next ? `Following @${p?.handle}` : `Unfollowed @${p?.handle}`, 'info');
    try {
      await TiwiSocialAPI.followUser(p?.id, currentUser?.id);
    } catch {
      setIsFollowing(!next);
    }
  };

  const mediaPosts = userPosts.filter((post) => Array.isArray(post.images) && post.images.length > 0);
  const postCount = userPosts.length;

  return (
    <div className="w-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/95 dark:bg-[#0a0a0f]/95 backdrop-blur-xl px-2 py-3 flex items-center gap-3 mb-3">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.07] flex items-center justify-center text-[#65676b] dark:text-[#8a8d91] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-semibold text-[#1c1e21] dark:text-[#e4e6eb]">
              {p?.name || 'Profile'}
            </h1>
            {p?.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-violet-500 fill-current flex-shrink-0" />
            )}
          </div>
          <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
            {postCount} posts
          </span>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] overflow-hidden shadow-sm mb-4">
        {/* Cover Banner */}
        <div className="h-36 sm:h-44 w-full bg-gradient-to-r from-violet-400 via-purple-500 to-fuchsia-500 relative">
          {p?.coverPhoto && (
            <img src={p.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Profile Info */}
        <div className="px-4 sm:px-5 pb-4 relative">
          {/* Avatar */}
          <div className="absolute -top-12 left-4 sm:left-5">
            <img
              src={p?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'}
              alt={p?.name}
              className="w-[90px] h-[90px] rounded-2xl object-cover ring-4 ring-white dark:ring-[#16161f] shadow-md"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end pt-3 mb-8 gap-2">
            {isOwnProfile ? (
              <button
                onClick={() => navigateTo('edit-profile')}
                className="flex items-center gap-2 border border-black/[0.1] dark:border-white/[0.1] rounded-xl px-4 py-2 font-semibold text-[13px] text-[#1c1e21] dark:text-[#e4e6eb] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { const next = !isNotified; setIsNotified(next); showToast(next ? 'Notifications on' : 'Notifications off', 'info'); }}
                  className={`w-9 h-9 rounded-xl border border-black/[0.1] dark:border-white/[0.1] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] flex items-center justify-center transition cursor-pointer ${isNotified ? 'text-violet-500' : 'text-[#65676b] dark:text-[#8a8d91]'}`}
                  title="Notify"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateTo('messages', p?.id)}
                  className="w-9 h-9 rounded-xl border border-black/[0.1] dark:border-white/[0.1] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] flex items-center justify-center transition cursor-pointer text-[#65676b] dark:text-[#8a8d91]"
                  title="Message"
                >
                  <Mail className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleFollow}
                  className={`font-semibold text-[13px] px-5 py-2 rounded-xl transition-all active:scale-95 cursor-pointer ${
                    isFollowing
                      ? 'border border-black/[0.1] dark:border-white/[0.1] text-[#1c1e21] dark:text-[#e4e6eb] hover:bg-red-50 dark:hover:bg-red-500/8 hover:border-red-200 hover:text-red-500'
                      : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/35'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          {/* Name, Handle, Bio */}
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <h2 className="text-[19px] font-bold text-[#1c1e21] dark:text-[#e4e6eb]">
                {p?.name || 'Creator'}
              </h2>
              {p?.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-violet-500 fill-current flex-shrink-0" />
              )}
            </div>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] mb-2.5">@{p?.handle || 'creator'}</p>

            {p?.bio && (
              <p className="text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] leading-relaxed whitespace-pre-wrap mb-3">
                {p.bio}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[#65676b] dark:text-[#8a8d91] mb-3">
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
                    className="text-violet-600 dark:text-violet-400 hover:underline"
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

            {/* Stats */}
            <div className="flex items-center gap-5 pt-3 border-t border-black/[0.05] dark:border-white/[0.05]">
              <button
                onClick={() => navigateTo('following', p?.handle || p?.id)}
                className="flex items-center gap-1.5 group cursor-pointer"
              >
                <span className="font-bold text-[15px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {p?.followingCount || 420}
                </span>
                <span className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">Following</span>
              </button>
              <button
                onClick={() => navigateTo('followers', p?.handle || p?.id)}
                className="flex items-center gap-1.5 group cursor-pointer"
              >
                <span className="font-bold text-[15px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {p?.followersCount || 1840}
                </span>
                <span className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">Followers</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-2xl p-1 mb-4">
        {[
          { id: 'posts', label: 'Posts', icon: null },
          { id: 'media', label: 'Media', icon: Grid3X3 },
          { id: 'likes', label: 'Likes', icon: Heart },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#16161f] text-[#1c1e21] dark:text-[#e4e6eb] shadow-sm'
                  : 'text-[#65676b] dark:text-[#8a8d91] hover:text-[#1c1e21] dark:hover:text-[#e4e6eb]'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
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
            <div className="py-16 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6">
              <h3 className="font-semibold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1.5">No posts yet</h3>
              <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">Posts will appear here when shared.</p>
            </div>
          )
        )}

        {activeTab === 'media' && (
          mediaPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {mediaPosts.map((post) =>
                post.images.map((img, i) => (
                  <div
                    key={`${post.id}_${i}`}
                    onClick={() => navigateTo('post-detail', post.id)}
                    className="aspect-square bg-black/[0.04] dark:bg-white/[0.04] rounded-xl overflow-hidden cursor-pointer group"
                  >
                    <img src={img} alt="media" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-16 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6">
              <ImageIcon className="w-8 h-8 text-[#8a8d91] mx-auto mb-3" />
              <h3 className="font-semibold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1.5">No media yet</h3>
              <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">Photos and videos will appear here.</p>
            </div>
          )
        )}

        {activeTab === 'likes' && (
          <div className="py-16 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6">
            <Heart className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <h3 className="font-semibold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1.5">No liked posts yet</h3>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">Posts you like will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
