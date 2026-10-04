import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Music,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Sparkles
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
  const videoRef = useRef(null);

  useEffect(() => {
    TiwiSocialAPI.getReels(currentUser?.id).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setReels(data);
      } else {
        setReels([
          {
            id: 'reel_demo_1',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            caption: 'Exploring modern web architecture on Tiwi! 🚀 Built with real database integration and sleek aesthetics.',
            audioTitle: 'Tiwi Beats • Original Audio',
            likesCount: '4.2K',
            commentsCount: '182',
            author: {
              name: 'Alex Rivera',
              handle: 'alex_r',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
              isVerified: true
            }
          },
          {
            id: 'reel_demo_2',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
            caption: 'Ultra-modern, premium quality design systems in action. Minimalist, spacious, and polished.',
            audioTitle: 'Studio Soundscape • Chill Lo-Fi',
            likesCount: '2.8K',
            commentsCount: '94',
            author: {
              name: 'Sophia Chen',
              handle: 'sophiac',
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
              isVerified: false
            }
          }
        ]);
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  const currentReel = reels[activeIndex];

  const handleNext = () => {
    if (activeIndex < reels.length - 1) {
      setActiveIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  };

  const handleToggleLike = async () => {
    if (!currentReel) return;
    const nextState = !likedMap[currentReel.id];
    setLikedMap((prev) => ({ ...prev, [currentReel.id]: nextState }));
    try {
      await TiwiSocialAPI.toggleLikeReel(currentReel.id, currentUser?.id);
    } catch (e) {}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-8 max-w-md mx-auto">
        <p className="text-sm text-[#65676b] dark:text-[#8a8d91]">No reels found.</p>
      </div>
    );
  }

  const isLiked = likedMap[currentReel.id] || currentReel.isLiked;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-6rem)] pb-16 md:pb-6">
      <div className="relative w-full max-w-[420px] h-[740px] max-h-[85vh] bg-black rounded-3xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10 flex items-center justify-center select-none">
        {/* Video Player */}
        <video
          ref={videoRef}
          src={currentReel.videoUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          onClick={handleVideoClick}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Play/Pause Overlay indicator when paused */}
        {!isPlaying && (
          <div
            onClick={handleVideoClick}
            className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer backdrop-blur-[2px] transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-xl ring-1 ring-white/20">
              <Play className="w-8 h-8 ml-1" />
            </div>
          </div>
        )}

        {/* Top Controls: Sound & Brand */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[12px] font-semibold ring-1 ring-white/10 pointer-events-auto">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Tiwi Shorts</span>
          </div>

          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all ring-1 ring-white/10 pointer-events-auto active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom Details Overlay */}
        <div className="absolute bottom-0 left-0 right-16 p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 text-white flex flex-col gap-2.5 pointer-events-auto">
          {/* Author */}
          <button
            onClick={() => navigateTo('profile', currentReel.author?.handle || currentReel.author?.id)}
            className="flex items-center gap-2.5 text-left group"
          >
            <img
              src={currentReel.author?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
              alt={currentReel.author?.name}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-violet-500/80 shadow-md"
            />
            <div className="min-w-0">
              <div className="text-[14px] font-bold flex items-center gap-1 group-hover:text-violet-400 transition-colors">
                <span className="truncate">{currentReel.author?.name}</span>
                {currentReel.author?.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 fill-current inline flex-shrink-0" />}
              </div>
              <div className="text-[11px] text-white/70">@{currentReel.author?.handle}</div>
            </div>
          </button>

          {/* Caption */}
          <p className="text-[13px] leading-relaxed text-white/90 line-clamp-2">
            {currentReel.caption}
          </p>

          {/* Audio */}
          <div className="flex items-center gap-2 text-[11px] text-white/70 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full w-fit max-w-[90%]">
            <Music className="w-3 h-3 text-violet-400 flex-shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="truncate">{currentReel.audioTitle || 'Original Audio'}</span>
          </div>
        </div>

        {/* Right Floating Action Dock */}
        <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 z-20 text-white">
          {/* Like */}
          <button onClick={handleToggleLike} className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform">
            <div className={`p-3 rounded-2xl backdrop-blur-md transition-all shadow-lg ${
              isLiked ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-black/40 hover:bg-black/60 text-white ring-1 ring-white/15'
            }`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[11px] font-bold">{currentReel.likesCount || '0'}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => showToast('Open comments on post details', 'info')}
            className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
          >
            <div className="p-3 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all ring-1 ring-white/15 shadow-lg">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold">{currentReel.commentsCount || '0'}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Reel link copied!', 'info');
            }}
            className="flex flex-col items-center gap-1 group cursor-pointer active:scale-90 transition-transform"
          >
            <div className="p-3 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all ring-1 ring-white/15 shadow-lg">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold">Share</span>
          </button>
        </div>

        {/* Next / Previous Reel buttons */}
        <div className="absolute -right-16 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-3">
          <button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="p-3 rounded-2xl bg-white dark:bg-[#16161f] shadow-lg border border-black/[0.05] dark:border-white/[0.08] disabled:opacity-30 hover:scale-105 active:scale-95 transition-all text-[#1c1e21] dark:text-[#e4e6eb] cursor-pointer"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={activeIndex === reels.length - 1}
            className="p-3 rounded-2xl bg-white dark:bg-[#16161f] shadow-lg border border-black/[0.05] dark:border-white/[0.08] disabled:opacity-30 hover:scale-105 active:scale-95 transition-all text-[#1c1e21] dark:text-[#e4e6eb] cursor-pointer"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
