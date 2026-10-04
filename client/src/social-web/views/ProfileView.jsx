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
  Grid3X3,
  List,
  Film,
  Users,
  Sparkles,
  Share2,
  MoreHorizontal,
  Bookmark,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function ProfileView() {
  const { currentProfileHandle, navigateTo, currentUser, showToast } = useSocial();
  const targetHandleOrId = currentProfileHandle || currentUser?.handle || currentUser?.id;

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts', 'reels', 'photos', 'friends', 'about'
  const [viewMode, setViewMode] = useState('feed'); // 'feed' or 'grid'
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
          // Default profile matching Ahmad Nur Fawaid from screenshot
          setProfileUser({
            id: 'u_fawait',
            name: 'Ahmad Nur Fawaid',
            handle: 'fawait',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
            coverPhoto: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop',
            bio: 'Lead Product Designer & Architect at Tiwi Studio 🚀 Crafting clean, Google-inspired digital experiences. Coffee, typography & design systems.',
            location: 'San Francisco, CA',
            website: 'https://fawaid.design',
            joinedDate: 'Joined April 2024',
            isVerified: true,
            postsCount: 142,
            followersCount: '42.8K',
            followingCount: '1,230',
            likesCount: '890K',
            work: 'Lead Designer at Sebo Studio',
            education: 'B.Sc in Interaction Design'
          });
        }
        const posts = await TiwiSocialAPI.getUserPosts(u?.id || targetHandleOrId);
        if (Array.isArray(posts) && posts.length > 0) {
          setUserPosts(posts);
        } else {
          // Default demo post matching screenshot
          setUserPosts([
            {
              id: 'p_pan_1',
              author: {
                name: 'Ahmad Nur Fawaid',
                handle: 'fawait',
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
              },
              caption: 'Deep in the flow designing the new Square experience. Every single component follows strict typographic hierarchy, natural spacing, and accessible contrast. 📐✨',
              images: [
                'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=600&fit=crop'
              ],
              timeAgo: '12 April at 09.28 PM',
              likesCount: '120k',
              commentsCount: '25',
              repostsCount: '231',
              savedCount: '12'
            }
          ]);
        }
      } catch (err) {
        console.warn('Error loading profile:', err);
      }
    }
    loadProfile();
  }, [targetHandleOrId, currentUser?.id, currentUser]);

  const p = profileUser || currentUser;
  const isOwnProfile =
    !currentProfileHandle ||
    (currentUser?.id && (p?.id === currentUser?.id || p?.handle === currentUser?.handle));

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

  const dummyReels = [
    {
      id: 'pr_1',
      thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=600&fit=crop',
      views: '142K',
      likes: '12K'
    },
    {
      id: 'pr_2',
      thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=600&fit=crop',
      views: '89K',
      likes: '8.4K'
    },
    {
      id: 'pr_3',
      thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=600&fit=crop',
      views: '210K',
      likes: '19K'
    }
  ];

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card with Cover and Avatar */}
      <div className="bg-white dark:bg-[#161822] rounded-3xl border border-[#EAECF0] dark:border-[#1E232F] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        {/* Cover Photo Banner */}
        <div className="relative h-48 sm:h-64 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 overflow-hidden">
          {p?.coverPhoto && (
            <img
              src={p.coverPhoto}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        {/* Profile Info Bar */}
        <div className="px-6 pb-6 pt-3 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <img
                src={p?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop'}
                alt={p?.name}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover ring-4 ring-white dark:ring-[#161822] shadow-xl bg-white"
              />
              <span className="absolute bottom-2 right-2 w-4 h-4 bg-[#10B981] rounded-full ring-2 ring-white dark:ring-[#161822]" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigateTo('edit-profile')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[13px] font-bold transition shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      showToast('Profile URL copied!', 'info');
                    }}
                    className="p-2.5 rounded-xl border border-[#EAECF0] dark:border-[#1E232F] text-[#6B7280] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
                    title="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition shadow-xs cursor-pointer ${
                      isFollowing
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                        : 'bg-[#1E75FF] hover:bg-[#1A66E5] text-white'
                    }`}
                  >
                    {isFollowing ? 'Following' : '+ Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('messages', p?.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#EAECF0] dark:border-[#1E232F] text-[#111827] dark:text-white hover:bg-gray-50 text-[13px] font-semibold transition cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Message</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isNotified;
                      setIsNotified(next);
                      showToast(next ? 'Notifications on for this user' : 'Notifications off', 'info');
                    }}
                    className={`p-2.5 rounded-xl border border-[#EAECF0] dark:border-[#1E232F] transition cursor-pointer ${
                      isNotified ? 'text-[#1E75FF]' : 'text-[#6B7280]'
                    }`}
                    title="Notify"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Name & Handle */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-extrabold text-[#111827] dark:text-white tracking-tight">
                {p?.name || 'Ahmad Nur Fawaid'}
              </h1>
              {p?.isVerified && (
                <CheckCircle2 className="w-5 h-5 text-[#1E75FF] fill-current flex-shrink-0" />
              )}
            </div>
            <span className="text-[14px] text-[#6B7280] dark:text-[#9CA3AF]">
              @{p?.handle || 'fawait'}
            </span>
          </div>

          {/* Bio */}
          {p?.bio && (
            <p className="text-[14px] text-[#374151] dark:text-[#D1D5DB] leading-relaxed mt-3 max-w-2xl">
              {p.bio}
            </p>
          )}

          {/* Metadata Row: Location, Website, Joined */}
          <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#6B7280] dark:text-[#9CA3AF] mt-4 pt-4 border-t border-[#F2F4F7] dark:border-[#1E232F]">
            {p?.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1E75FF]" />
                {p.location}
              </span>
            )}
            {p?.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[#1E75FF] hover:underline"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {p.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {p?.joinedDate || 'Joined April 2024'}
            </span>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-[#F2F4F7] dark:border-[#1E232F]">
            <div>
              <span className="font-extrabold text-[16px] text-[#111827] dark:text-white mr-1.5">
                {p?.postsCount || userPosts.length}
              </span>
              <span className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">Posts</span>
            </div>
            <div className="cursor-pointer" onClick={() => navigateTo('friends')}>
              <span className="font-extrabold text-[16px] text-[#111827] dark:text-white mr-1.5">
                {p?.followersCount || '42.8K'}
              </span>
              <span className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">Followers</span>
            </div>
            <div className="cursor-pointer" onClick={() => navigateTo('friends')}>
              <span className="font-extrabold text-[16px] text-[#111827] dark:text-white mr-1.5">
                {p?.followingCount || '1,230'}
              </span>
              <span className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">Following</span>
            </div>
            <div>
              <span className="font-extrabold text-[16px] text-[#111827] dark:text-white mr-1.5">
                {p?.likesCount || '890K'}
              </span>
              <span className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">Likes</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Profile Tabs Navigation Bar */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'posts'
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Posts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'reels'
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Reels</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Photos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'about'
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            <span>About</span>
          </button>
        </div>

        {activeTab === 'posts' && (
          <div className="flex items-center gap-1 text-[#6B7280] dark:text-[#9CA3AF] mr-2">
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'feed' ? 'bg-gray-100 dark:bg-gray-800 text-[#1E75FF]' : ''}`}
              title="Feed View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800 text-[#1E75FF]' : ''}`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'posts' && (
        viewMode === 'feed' ? (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
            {userPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {userPosts.map((post) => {
              const coverImg = (post.images && post.images[0]) || post.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=600&fit=crop';
              return (
                <div
                  key={post.id}
                  onClick={() => navigateTo('post-detail', post.id)}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer shadow-xs"
                >
                  <img
                    src={coverImg}
                    alt="Post thumbnail"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-bold text-[14px]">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 fill-current" />
                      {post.likesCount || 120}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Bookmark className="w-4 h-4" />
                      {post.savedCount || 12}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'reels' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {dummyReels.map((reel) => (
            <div
              key={reel.id}
              onClick={() => navigateTo('reels')}
              className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900 cursor-pointer shadow-md"
            >
              <img
                src={reel.thumbnail}
                alt="Reel"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 text-white text-[12px] font-bold flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-[#1E75FF]" />
                <span>{reel.views}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[
            'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=600&fit=crop',
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=600&fit=crop'
          ].map((src, i) => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-xs">
              <img src={src} alt={`Media ${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col gap-5">
          <h3 className="font-bold text-[17px] text-[#111827] dark:text-white">
            About & Experience
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#FAFBFD] dark:bg-[#14161F] border border-[#EAECF0] dark:border-[#1E232F] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider block">Work</span>
                <span className="font-bold text-[14px] text-[#111827] dark:text-white">
                  {p?.work || 'Lead Designer at Sebo Studio'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFBFD] dark:bg-[#14161F] border border-[#EAECF0] dark:border-[#1E232F] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider block">Education</span>
                <span className="font-bold text-[14px] text-[#111827] dark:text-white">
                  {p?.education || 'B.Sc in Interaction Design'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
