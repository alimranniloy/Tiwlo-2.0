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
  ChevronDown
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
        // Fallback reel placeholders if none uploaded yet
        setReels([
          {
            id: 'reel_demo_1',
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            caption: 'Exploring modern web architecture on Tiwi! 🚀 #Tech #Innovation',
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
            caption: 'Clean Google-inspired design systems in action. Minimalist & polished.',
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
        <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No reels found.</p>
      </div>
    );
  }

  const isLiked = likedMap[currentReel.id] || currentReel.isLiked;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-6rem)] pb-16 md:pb-6">
      <div className="relative w-full max-w-[400px] h-[720px] max-h-[85vh] bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center select-none">
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
            className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg">
              <Play className="w-8 h-8 ml-1" />
            </div>
          </div>
        )}

        {/* Top Controls: Mute & Progress */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Bottom Details Overlay */}
        <div className="absolute bottom-0 left-0 right-16 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 text-white flex flex-col gap-2.5">
          {/* Author */}
          <button
            onClick={() => navigateTo('profile', currentReel.author?.handle || currentReel.author?.id)}
            className="flex items-center gap-2.5 text-left group"
          >
            <img
              src={currentReel.author?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
              alt={currentReel.author?.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-white"
            />
            <div>
              <div className="text-sm font-bold flex items-center gap-1 group-hover:underline">
                {currentReel.author?.name}
                {currentReel.author?.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#4285F4] inline" />}
              </div>
              <div className="text-xs text-gray-300">@{currentReel.author?.handle}</div>
            </div>
          </button>

          {/* Caption */}
          <p className="text-xs leading-relaxed text-gray-100 line-clamp-2">
            {currentReel.caption}
          </p>

          {/* Audio */}
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <Music className="w-3 h-3 text-[#4285F4]" />
            <span className="truncate">{currentReel.audioTitle || 'Original Audio'}</span>
          </div>
        </div>

        {/* Right Action Icons Bar */}
        <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 z-20 text-white">
          {/* Like */}
          <button onClick={handleToggleLike} className="flex flex-col items-center gap-1 group">
            <div className={`p-3 rounded-full backdrop-blur-md transition-all ${
              isLiked ? 'bg-red-500/80 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
            }`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-bold">{currentReel.likesCount || '0'}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => showToast('Open comments on post details', 'info')}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold">{currentReel.commentsCount || '0'}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Reel link copied!', 'info');
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold">Share</span>
          </button>
        </div>

        {/* Next / Previous Reel buttons */}
        <div className="absolute right-[-60px] top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3">
          <button
            onClick={handlePrev}
            disabled={activeIndex === 0}
            className="p-3 rounded-full bg-white dark:bg-[#1E293B] shadow-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:scale-105 transition-all text-gray-700 dark:text-gray-200"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={activeIndex === reels.length - 1}
            className="p-3 rounded-full bg-white dark:bg-[#1E293B] shadow-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:scale-105 transition-all text-gray-700 dark:text-gray-200"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
