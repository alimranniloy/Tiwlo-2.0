import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  MapPin,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function ProfileView() {
  const { currentUser, tabParams, navigateTo, showToast } = useSocial();
  const [profile, setProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'replies' | 'highlights' | 'media' | 'likes'
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Twitter Sticky Header: 53px height, Back Button + Name + Post Count */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center gap-7 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 font-bold text-[20px] leading-tight text-[#0F1419] dark:text-[#E7E9EA] truncate">
            <span className="truncate">{p?.name || 'User'}</span>
            {p?.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
            )}
          </div>
          <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* 2. Cover Banner */}
      <div className="h-[200px] w-full bg-[#CFD9DE] dark:bg-[#333639] relative overflow-hidden">
        {p?.coverPhoto && (
          <img src={p.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
        )}
      </div>

      {/* 3. Profile Avatar & Actions Row */}
      <div className="px-4 pb-3 relative">
        {/* Avatar overlapping banner */}
        <div className="absolute -top-[67px] left-4">
          <img
            src={
              p?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
            }
            alt={p?.name}
            className="w-[134px] h-[134px] rounded-full object-cover border-4 border-white dark:border-black bg-white dark:bg-black"
          />
        </div>

        {/* Top Right Buttons */}
        <div className="flex justify-end pt-3 gap-2 min-h-[64px]">
          {isOwnProfile ? (
            <button
              onClick={() => navigateTo('edit-profile')}
              className="border border-[#CFD9DE] dark:border-[#536471] rounded-full px-4 py-1.5 font-bold text-[15px] hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Edit profile
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateTo('messages', p?.id)}
                className="w-9 h-9 rounded-full border border-[#CFD9DE] dark:border-[#536471] hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition"
                title="Message"
              >
                <Mail className="w-5 h-5 text-[#0F1419] dark:text-[#E7E9EA]" />
              </button>

              <button
                onClick={handleToggleFollow}
                className={`font-bold text-[15px] px-5 py-1.5 rounded-full transition active:scale-95 ${
                  isFollowing
                    ? 'border border-[#CFD9DE] dark:border-[#536471] text-[#0F1419] dark:text-[#E7E9EA] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                    : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] hover:opacity-90'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        {/* 4. Profile Details: Name, Handle, Bio, Metas, Stats */}
        <div className="mt-8 flex flex-col">
          <div className="flex items-center gap-1">
            <h2 className="font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              {p?.name || 'Tiwi Member'}
            </h2>
            {p?.isVerified && (
              <CheckCircle2 className="w-5 h-5 text-[#1D9BF0] fill-current inline flex-shrink-0" />
            )}
          </div>
          <span className="text-[15px] text-[#536471] dark:text-[#71767B]">
            @{p?.handle || 'user'}
          </span>

          {/* Bio */}
          <p className="text-[15px] text-[#0F1419] dark:text-[#E7E9EA] mt-3 whitespace-pre-wrap leading-relaxed">
            {p?.bio || 'Building the future of community & technology.'}
          </p>

          {/* Location, Website, Joined Date */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[15px] text-[#536471] dark:text-[#71767B]">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>Worldwide</span>
            </div>

            {p?.website && (
              <div className="flex items-center gap-1">
                <LinkIcon className="w-4 h-4" />
                <a
                  href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1D9BF0] hover:underline"
                >
                  {p.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Joined October 2023</span>
            </div>
          </div>

          {/* Following / Followers Counters */}
          <div className="flex items-center gap-5 mt-3 text-[14px]">
            <button
              onClick={() => navigateTo('following')}
              className="hover:underline flex items-center gap-1"
            >
              <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">
                {p?.followingCount || 142}
              </span>
              <span className="text-[#536471] dark:text-[#71767B]">Following</span>
            </button>

            <button
              onClick={() => navigateTo('followers')}
              className="hover:underline flex items-center gap-1"
            >
              <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">
                {p?.followersCount || 1840}
              </span>
              <span className="text-[#536471] dark:text-[#71767B]">Followers</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Twitter Profile Tabs: 53px height */}
      <div className="h-[53px] flex border-b border-[#EFF3F4] dark:border-[#2F3336]">
        {[
          { id: 'posts', label: 'Posts' },
          { id: 'replies', label: 'Replies' },
          { id: 'highlights', label: 'Highlights' },
          { id: 'media', label: 'Media' },
          { id: 'likes', label: 'Likes' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 h-full flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
          >
            <span
              className={`text-[15px] ${
                activeTab === tab.id
                  ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                  : 'font-medium text-[#536471] dark:text-[#71767B]'
              }`}
            >
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 6. Timeline of Posts */}
      <div className="flex flex-col pb-24 md:pb-12">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={(id) => setUserPosts((prev) => prev.filter((item) => item.id !== id))}
            />
          ))
        ) : (
          <div className="py-24 px-6 text-center">
            <h3 className="font-extrabold text-[28px] text-[#0F1419] dark:text-[#E7E9EA] mb-2 leading-tight">
              @{p?.handle || 'user'} hasn’t posted
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B]">
              When they post, their posts will show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
