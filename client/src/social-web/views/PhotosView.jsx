import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Folder,
  Upload,
  Heart,
  MessageSquare,
  Sparkles,
  Maximize2,
  Share2,
  Download
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function PhotosView() {
  const { currentUser, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'albums', 'tagged'
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const albums = [
    {
      id: 'alb_1',
      title: 'Profile Pictures',
      count: 18,
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop'
    },
    {
      id: 'alb_2',
      title: 'Cover Photos',
      count: 12,
      cover: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop'
    },
    {
      id: 'alb_3',
      title: 'Design Systems & UI',
      count: 42,
      cover: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=400&fit=crop'
    },
    {
      id: 'alb_4',
      title: 'Studio & Workspace',
      count: 29,
      cover: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop'
    }
  ];

  const photos = [
    {
      id: 'ph_1',
      src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=600&fit=crop',
      title: 'Abstract Architectural Flow',
      likes: '1.2K',
      comments: '84',
      date: 'Yesterday'
    },
    {
      id: 'ph_2',
      src: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=600&fit=crop',
      title: 'Workspace Desk Setup with Dual 4K Displays',
      likes: '890',
      comments: '42',
      date: '3 days ago'
    },
    {
      id: 'ph_3',
      src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
      title: 'Silicon Wafer Technology & Hardware',
      likes: '2.4K',
      comments: '130',
      date: '1 week ago'
    },
    {
      id: 'ph_4',
      src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=600&fit=crop',
      title: 'Editorial Portrait',
      likes: '3.1K',
      comments: '210',
      date: '2 weeks ago'
    },
    {
      id: 'ph_5',
      src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop',
      title: 'Engineering Code & Coffee Session',
      likes: '950',
      comments: '67',
      date: '2 weeks ago'
    },
    {
      id: 'ph_6',
      src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      title: 'Data Visualizations & Financial Dashboard',
      likes: '1.5K',
      comments: '92',
      date: '3 weeks ago'
    },
    {
      id: 'ph_7',
      src: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800&h=600&fit=crop',
      title: 'Creative Team Strategy Meeting',
      likes: '720',
      comments: '35',
      date: '1 month ago'
    },
    {
      id: 'ph_8',
      src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600&fit=crop',
      title: 'Dark Mode IDE Syntax Theme',
      likes: '1.8K',
      comments: '115',
      date: '1 month ago'
    }
  ];

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Photos & Media
              <span className="text-[12px] font-semibold bg-[#1E75FF]/10 text-[#1E75FF] px-2.5 py-0.5 rounded-full">
                {photos.length} Photos
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
              Browse high-resolution albums, design screenshots, and community captures
            </p>
          </div>
        </div>

        {/* Action & Filter buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center bg-[#F4F5F7] dark:bg-[#1A1D27] p-1 rounded-xl flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#161822] text-[#1E75FF] shadow-xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              All Photos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('albums')}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition cursor-pointer ${
                activeTab === 'albums'
                  ? 'bg-white dark:bg-[#161822] text-[#1E75FF] shadow-xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              Albums ({albums.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => showToast('Upload modal / selector opened', 'info')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12.5px] font-bold shadow-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {/* 2. Albums Grid (shown in albums tab or top of gallery) */}
      {(activeTab === 'albums' || activeTab === 'all') && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <h2 className="text-[16px] font-bold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
            <Folder className="w-4 h-4 text-[#1E75FF]" />
            <span>Featured Albums</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {albums.map((alb) => (
              <div
                key={alb.id}
                onClick={() => showToast(`Opened ${alb.title} album`, 'info')}
                className="group cursor-pointer flex flex-col gap-2 rounded-xl"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={alb.cover}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  <span className="absolute bottom-2 left-2 text-white text-[11px] font-bold bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-md">
                    {alb.count} photos
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-[13.5px] text-[#111827] dark:text-white group-hover:text-[#1E75FF] truncate transition-colors">
                    {alb.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Photos Gallery Grid (Fixed crop: natural aspect-ratio card tiles) */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <h2 className="text-[16px] font-bold text-[#111827] dark:text-white mb-4 flex items-center gap-2">
          <span>All Media Uploads</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-[4/3] cursor-pointer shadow-xs"
            >
              <img
                src={photo.src}
                alt={photo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 text-white">
                <div className="flex justify-end">
                  <span className="p-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white hover:bg-black/80 transition">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-[12.5px] line-clamp-1 leading-snug">
                    {photo.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1.5 text-[11.5px] font-medium text-white/90">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      {photo.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 fill-current" />
                      {photo.comments}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Dedicated In-Page Showcase Preview (NO POPUP / NO MODAL) */}
      {selectedPhoto && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border-2 border-[#1E75FF] p-5 shadow-lg flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1E75FF]" />
              <span>{selectedPhoto.title}</span>
            </h3>
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="text-[12px] font-bold text-[#6B7280] hover:text-[#111827] px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 transition cursor-pointer"
            >
              Close Preview
            </button>
          </div>

          <div className="w-full max-h-[500px] overflow-hidden rounded-xl bg-black flex items-center justify-center">
            <img
              src={selectedPhoto.src}
              alt={selectedPhoto.title}
              className="w-full h-full max-h-[500px] object-contain"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4 text-sm text-[#6B7280]">
              <span className="flex items-center gap-1.5 font-semibold text-red-500">
                <Heart className="w-4 h-4 fill-current" />
                {selectedPhoto.likes} Likes
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <MessageSquare className="w-4 h-4" />
                {selectedPhoto.comments} Comments
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(selectedPhoto.src);
                  showToast('Photo URL copied!', 'info');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[12px] font-semibold transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
