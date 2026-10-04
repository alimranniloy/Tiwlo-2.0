import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Music,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Send,
  MoreHorizontal,
  Flame,
  UserPlus,
  UserCheck,
  Disc3,
  X
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function ReelsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedMap, setLikedMap] = useState({});
  const [savedMap, setSavedMap] = useState({});
  const [followingMap, setFollowingMap] = useState({});
  const [progress, setProgress] = useState(0);
  const [showCommentsSidePanel, setShowCommentsSidePanel] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentsList, setCommentsList] = useState([
    {
      id: 'c1',
      author: 'Sophia Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      text: 'This architecture is ridiculously clean! Love the Google-inspired spacing 🔥',
      likes: 42,
      timeAgo: '2h ago'
    },
    {
      id: 'c2',
      author: 'Pan Feng Shui',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      text: 'The transition between frames is super smooth. Great job on the details.',
      likes: 18,
      timeAgo: '5h ago'
    },
    {
      id: 'c3',
      author: 'Marcus Chen',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      text: 'Finally a social experience that does not cram everything into one page! 👏',
      likes: 29,
      timeAgo: '1d ago'
    }
  ]);

  const videoRef = useRef(null);

  useEffect(() => {
    TiwiSocialAPI.getReels(currentUser?.id).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setReels(data);
      } else {
        setReels([
          {
            id: 'reel_1',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            caption: 'Building next-generation design systems with 100% Google-inspired minimalism ⚡️ Clean spacing, zero bloat, pure speed.',
            tags: ['#design', '#architecture', '#minimal', '#tiwistudio'],
            audioTitle: 'Tiwi Sound Studio • Minimalist Lo-Fi Vol. 4',
            likesCount: '124.5K',
            commentsCount: '1,420',
            sharesCount: '18.2K',
            savedCount: '9.4K',
            author: {
              id: 'u_alex',
              name: 'Alex Rivera',
              handle: 'alex_r',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
              isVerified: true
            }
          },
          {
            id: 'reel_2',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
            caption: 'From idea to interactive production. Notice how every card has subtle depth and high-contrast typography ✨',
            tags: ['#webdev', '#uidesign', '#craftsmanship'],
            audioTitle: 'Studio Soundscape • Chill Waves (Original Mix)',
            likesCount: '89.2K',
            commentsCount: '830',
            sharesCount: '12.4K',
            savedCount: '6.1K',
            author: {
              id: 'u_sophia',
              name: 'Sophia Chen',
              handle: 'sophiac',
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
              isVerified: true
            }
          },
          {
            id: 'reel_3',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            caption: 'Full-stack PostgreSQL and real-time state synchronizations in high-load environments 🚀',
            tags: ['#engineering', '#database', '#scale'],
            audioTitle: 'Deep Tech Beats • Synth Resonance',
            likesCount: '210.8K',
            commentsCount: '2,940',
            sharesCount: '34.1K',
            savedCount: '15.8K',
            author: {
              id: 'u_david',
              name: 'David Kim',
              handle: 'davidk',
              avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
              isVerified: false
            }
          }
        ]);
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  const currentReel = reels[activeIndex];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleVideoClick();
      } else if (e.key.toLowerCase() === 'm') {
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, reels.length]);

  const handleNext = () => {
    if (activeIndex < reels.length - 1) {
      setActiveIndex((prev) => prev + 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const handleToggleLike = async () => {
    if (!currentReel) return;
    const nextState = !likedMap[currentReel.id];
    setLikedMap((prev) => ({ ...prev, [currentReel.id]: nextState }));
    try {
      await TiwiSocialAPI.toggleLikeReel(currentReel.id, currentUser?.id);
    } catch {}
  };

  const handleToggleSave = () => {
    if (!currentReel) return;
    const nextState = !savedMap[currentReel.id];
    setSavedMap((prev) => ({ ...prev, [currentReel.id]: nextState }));
    showToast(nextState ? 'Reel saved to bookmarks' : 'Removed from bookmarks', 'info');
  };

  const handleToggleFollow = () => {
    if (!currentReel?.author) return;
    const authorId = currentReel.author.id || currentReel.author.handle;
    const next = !followingMap[authorId];
    setFollowingMap((prev) => ({ ...prev, [authorId]: next }));
    showToast(next ? `Following ${currentReel.author.name}` : `Unfollowed ${currentReel.author.name}`, 'info');
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const newC = {
      id: `c_${Date.now()}`,
      author: currentUser?.name || 'Ahmad Nur Fawaid',
      avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      text: commentInput.trim(),
      likes: 0,
      timeAgo: 'Just now'
    };
    setCommentsList((prev) => [newC, ...prev]);
    setCommentInput('');
    showToast('Comment posted', 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1E75FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] p-8 max-w-md mx-auto">
        <p className="text-sm text-gray-500">No reels available right now.</p>
      </div>
    );
  }

  const isLiked = likedMap[currentReel.id];
  const isSaved = savedMap[currentReel.id];
  const isFollowingAuthor = followingMap[currentReel.author?.id || currentReel.author?.handle];

  return (
    <div className="w-full flex items-center justify-center min-h-[calc(100vh-80px)] py-4 select-none">
      <div className="flex items-center justify-center gap-6 max-w-full">
        {/* Main Reel Container */}
        <div className="relative w-full max-w-[420px] sm:w-[420px] h-[740px] max-h-[85vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center flex-shrink-0 group">
          {/* Video Player */}
          <video
            ref={videoRef}
            src={currentReel.videoUrl}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onClick={handleVideoClick}
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-full object-cover cursor-pointer"
          />

          {/* Pause / Play central overlay indicator */}
          {!isPlaying && (
            <div
              onClick={handleVideoClick}
              className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer backdrop-blur-[2px] transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-black/70 backdrop-blur-md text-white flex items-center justify-center shadow-xl ring-1 ring-white/20">
                <Play className="w-8 h-8 ml-1 fill-current" />
              </div>
            </div>
          )}

          {/* Top Controls: Badge, Audio & More */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[12px] font-bold ring-1 ring-white/10 pointer-events-auto">
              <Sparkles className="w-3.5 h-3.5 text-[#1E75FF]" />
              <span>Tiwi Reels</span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => setIsMuted((prev) => !prev)}
                className="p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition ring-1 ring-white/10 cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Bottom Details Overlay */}
          <div className="absolute bottom-0 left-0 right-16 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 text-white flex flex-col gap-2.5 pointer-events-auto">
            {/* Author Row with Follow Button */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigateTo('profile', currentReel.author?.handle || currentReel.author?.id)}
                className="relative rounded-full ring-2 ring-[#1E75FF] p-0.5 group"
              >
                <img
                  src={currentReel.author?.avatar}
                  alt={currentReel.author?.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    onClick={() => navigateTo('profile', currentReel.author?.handle || currentReel.author?.id)}
                    className="font-bold text-[14px] truncate hover:underline cursor-pointer"
                  >
                    {currentReel.author?.name}
                  </span>
                  {currentReel.author?.isVerified && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1E75FF] fill-current flex-shrink-0" />
                  )}
                </div>
                <span className="text-[11.5px] text-white/70">@{currentReel.author?.handle}</span>
              </div>

              {/* Follow Button */}
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`ml-2 px-3 py-1 rounded-full text-[11.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  isFollowingAuthor
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-[#1E75FF] text-white hover:bg-[#1A66E5]'
                }`}
              >
                {isFollowingAuthor ? 'Following' : '+ Follow'}
              </button>
            </div>

            {/* Caption & Hashtags */}
            <p className="text-[13px] leading-relaxed text-white/95 line-clamp-2">
              {currentReel.caption}
            </p>

            {currentReel.tags && (
              <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold text-[#1E75FF]">
                {currentReel.tags.map((tag, i) => (
                  <span key={i} className="hover:underline cursor-pointer">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Audio Track Chip */}
            <div className="flex items-center gap-2 text-[11.5px] text-white/80 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full w-fit max-w-[90%] overflow-hidden">
              <Music className="w-3.5 h-3.5 text-[#1E75FF] flex-shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="truncate">{currentReel.audioTitle}</span>
            </div>
          </div>

          {/* Right Floating Action Dock */}
          <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 z-20 text-white">
            {/* Like */}
            <button
              type="button"
              onClick={handleToggleLike}
              className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
            >
              <div className={`p-3 rounded-full backdrop-blur-md transition shadow-lg ${
                isLiked ? 'bg-[#FF3B30] text-white' : 'bg-black/50 hover:bg-black/70 text-white ring-1 ring-white/15'
              }`}>
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </div>
              <span className="text-[11px] font-bold">{currentReel.likesCount}</span>
            </button>

            {/* Comments Toggle */}
            <button
              type="button"
              onClick={() => setShowCommentsSidePanel((prev) => !prev)}
              className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              title="Comments Drawer"
            >
              <div className={`p-3 rounded-full backdrop-blur-md text-white transition ring-1 ring-white/15 shadow-lg ${
                showCommentsSidePanel ? 'bg-[#1E75FF]' : 'bg-black/50 hover:bg-black/70'
              }`}>
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold">{currentReel.commentsCount}</span>
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/tiwi/reels`);
                showToast('Reel link copied to clipboard!', 'info');
              }}
              className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              title="Share Reel"
            >
              <div className="p-3 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white transition ring-1 ring-white/15 shadow-lg">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold">Share</span>
            </button>

            {/* Bookmark */}
            <button
              type="button"
              onClick={handleToggleSave}
              className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
              title="Save Reel"
            >
              <div className={`p-3 rounded-full backdrop-blur-md text-white transition ring-1 ring-white/15 shadow-lg ${
                isSaved ? 'bg-[#1E75FF]' : 'bg-black/50 hover:bg-black/70'
              }`}>
                <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              </div>
              <span className="text-[11px] font-bold">Save</span>
            </button>

            {/* Rotating Vinyl Audio Disc at bottom */}
            <div className="relative mt-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-900 via-gray-700 to-black p-1 ring-2 ring-white/30 shadow-lg animate-spin" style={{ animationDuration: '6s' }}>
                <img
                  src={currentReel.author?.avatar}
                  alt="Sound"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1E75FF] text-white flex items-center justify-center text-[8px] font-bold">
                ♪
              </div>
            </div>
          </div>

          {/* Progress Bar scrubber at the very bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
            <div
              className="h-full bg-[#1E75FF] transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Up / Down Navigation Buttons */}
        <div className="hidden lg:flex flex-col gap-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#161822] shadow-md border border-[#EAECF0] dark:border-[#1E232F] disabled:opacity-30 hover:scale-105 active:scale-95 transition cursor-pointer text-[#111827] dark:text-white"
            title="Previous Reel (Up Arrow)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={activeIndex === reels.length - 1}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#161822] shadow-md border border-[#EAECF0] dark:border-[#1E232F] disabled:opacity-30 hover:scale-105 active:scale-95 transition cursor-pointer text-[#111827] dark:text-white"
            title="Next Reel (Down Arrow)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Interactive Comments Drawer (NO POPUP / NO MODAL) */}
        {showCommentsSidePanel && (
          <div className="w-[340px] xl:w-[380px] h-[740px] max-h-[85vh] bg-white dark:bg-[#161822] rounded-3xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-2xl flex flex-col justify-between animate-fadeIn">
            {/* Comments Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F2F4F7] dark:border-[#1E232F]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] text-[#111827] dark:text-white">
                  Comments
                </h3>
                <span className="text-[12px] font-semibold text-[#1E75FF] bg-[#1E75FF]/10 px-2 py-0.5 rounded-full">
                  {commentsList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsSidePanel(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments Scrollable Feed */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              {commentsList.map((comm) => (
                <div key={comm.id} className="flex gap-2.5 text-left">
                  <img
                    src={comm.avatar}
                    alt={comm.author}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[13px] text-[#111827] dark:text-white">
                        {comm.author}
                      </span>
                      <span className="text-[11px] text-gray-400">{comm.timeAgo}</span>
                    </div>
                    <p className="text-[12.5px] text-[#4B5563] dark:text-[#D1D5DB] mt-0.5 leading-snug">
                      {comm.text}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                      <button type="button" className="hover:text-red-500 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        <span>{comm.likes}</span>
                      </button>
                      <button type="button" className="hover:text-[#1E75FF]">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment Composer */}
            <form
              onSubmit={handleAddComment}
              className="pt-3 border-t border-[#F2F4F7] dark:border-[#1E232F] flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 h-[38px] px-3.5 bg-[#F4F5F7] dark:bg-[#1A1D27] rounded-xl text-[12.5px] outline-none focus:ring-2 focus:ring-[#1E75FF]/30 transition"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="p-2 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] disabled:opacity-40 text-white transition cursor-pointer"
                title="Send Comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
