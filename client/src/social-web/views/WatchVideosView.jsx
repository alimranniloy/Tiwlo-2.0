import React, { useState } from 'react';
import {
  PlaySquare,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Heart,
  Bookmark,
  CheckCircle2,
  Eye,
  Clock,
  Search,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function WatchVideosView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeVideo, setActiveVideo] = useState({
    id: 'vid_hero',
    title: 'Designing the Next Generation Social Architecture: Deep Dive into Modern Clean UI',
    channel: 'Tiwi Engineering & Design',
    channelAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=600&fit=crop',
    views: '320,400',
    timeAgo: 'Yesterday',
    likes: '14.2K',
    duration: '18:42'
  });

  const categories = [
    'All',
    'Trending',
    'Tech & Architecture',
    'Product Design',
    'Live Streams',
    'Audio & Music',
    'Tutorials'
  ];

  const videosList = [
    {
      id: 'vid_1',
      title: 'Building Scalable Full-Stack Microservices with PostgreSQL & GraphQL',
      channel: 'Alex Rivera',
      channelAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      views: '142K views',
      timeAgo: '3 days ago',
      duration: '14:28',
      category: 'Tech & Architecture'
    },
    {
      id: 'vid_2',
      title: 'Google-Inspired Minimal UI/UX Systems: Spacing, Typography & Hierarchy',
      channel: 'Sophia Chen',
      channelAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      views: '98K views',
      timeAgo: '1 week ago',
      duration: '22:15',
      category: 'Product Design'
    },
    {
      id: 'vid_3',
      title: 'Live Stage: Real-Time Audio Synthesizer & Lo-Fi Beats Workshop',
      channel: 'Studio Soundscape',
      channelAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      views: '210K views',
      timeAgo: '2 weeks ago',
      duration: '45:00',
      category: 'Audio & Music'
    },
    {
      id: 'vid_4',
      title: 'How Global Marketplaces Manage Millions of High-Frequency Transactions',
      channel: 'Tiwi Engineering',
      channelAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      views: '350K views',
      timeAgo: '5 days ago',
      duration: '16:04',
      category: 'Trending'
    },
    {
      id: 'vid_5',
      title: 'Mastering Modern Frontend State with Zero Unnecessary Re-renders',
      channel: 'David Kim',
      channelAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
      views: '84K views',
      timeAgo: '4 days ago',
      duration: '11:50',
      category: 'Tech & Architecture'
    },
    {
      id: 'vid_6',
      title: 'From Wireframe to Production in 48 Hours: A Case Study',
      channel: 'Sebo Studio',
      channelAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=600&h=350&fit=crop',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      views: '119K views',
      timeAgo: '6 days ago',
      duration: '28:30',
      category: 'Product Design'
    }
  ];

  const handlePlaySelected = (video) => {
    setActiveVideo(video);
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Now playing: ${video.title}`, 'info');
  };

  const filteredVideos = selectedCategory === 'All'
    ? videosList
    : videosList.filter((v) => v.category === selectedCategory);

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <PlaySquare className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Watch Videos
              <span className="text-[11px] font-bold bg-[#1E75FF] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                HD
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
              High quality streams, tech workshops, creative keynotes, and curated video feeds
            </p>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#1E75FF] text-white shadow-xs'
                  : 'bg-[#F4F5F7] dark:bg-[#1A1D27] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Featured Theater Player Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-black overflow-hidden flex items-center justify-center group">
          {isPlaying ? (
            <video
              src={activeVideo.videoUrl}
              autoPlay
              controls
              muted={isMuted}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="relative w-full h-full">
              <img
                src={activeVideo.thumbnail}
                alt={activeVideo.title}
                className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 m-auto w-16 h-16 rounded-2xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Play Video"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </button>
            </div>
          )}

          {/* Duration Badge */}
          <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md text-white text-[12px] font-bold px-2.5 py-1 rounded-md">
            {activeVideo.duration}
          </div>
        </div>

        {/* Video Info Row */}
        <div className="p-5 flex flex-col gap-3">
          <h2 className="text-[17px] font-bold text-[#111827] dark:text-white leading-snug">
            {activeVideo.title}
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#F2F4F7] dark:border-[#1E232F]">
            <div className="flex items-center gap-3">
              <img
                src={activeVideo.channelAvatar}
                alt={activeVideo.channel}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5"
              />
              <div>
                <span className="font-bold text-[14px] text-[#111827] dark:text-white flex items-center gap-1.5">
                  {activeVideo.channel}
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E75FF] fill-current" />
                </span>
                <span className="text-[12px] text-[#9CA3AF]">
                  {activeVideo.views} views • {activeVideo.timeAgo}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => showToast('Liked video', 'info')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4F5F7] dark:bg-[#1A1D27] hover:bg-gray-200 dark:hover:bg-gray-800 text-[12.5px] font-semibold text-[#374151] dark:text-[#D1D5DB] transition cursor-pointer"
              >
                <Heart className="w-4 h-4" />
                <span>{activeVideo.likes || '12K'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  showToast('Video link copied!', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4F5F7] dark:bg-[#1A1D27] hover:bg-gray-200 dark:hover:bg-gray-800 text-[12.5px] font-semibold text-[#374151] dark:text-[#D1D5DB] transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={() => showToast('Saved to Watch Later', 'info')}
                className="p-2 rounded-xl bg-[#F4F5F7] dark:bg-[#1A1D27] hover:bg-gray-200 dark:hover:bg-gray-800 text-[#374151] dark:text-[#D1D5DB] transition cursor-pointer"
                title="Save"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Up Next / Video Feed Grid */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <h3 className="text-[16px] font-bold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
          <span>More Recommended Videos</span>
          <span className="text-[12px] font-medium text-[#9CA3AF]">
            ({filteredVideos.length})
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => handlePlaySelected(video)}
              className="group cursor-pointer flex flex-col gap-2.5 rounded-xl transition"
            >
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-900 shadow-xs">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                {/* Duration Badge */}
                <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                  {video.duration}
                </span>

                {/* Play button hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-[#1E75FF] text-white flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <img
                  src={video.channelAvatar}
                  alt={video.channel}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <h4 className="font-bold text-[13.5px] text-[#111827] dark:text-white group-hover:text-[#1E75FF] line-clamp-2 leading-snug transition-colors">
                    {video.title}
                  </h4>
                  <span className="text-[12px] text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    {video.channel}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF]">
                    {video.views} • {video.timeAgo}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
