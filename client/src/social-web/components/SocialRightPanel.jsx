import React from 'react';
import {
  MoreHorizontal,
  Plus,
  Calendar,
  Gift,
  ExternalLink
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function SocialRightPanel() {
  const { navigateTo, showToast } = useSocial();

  const stories = [
    {
      id: 's1',
      name: 'Pan Feng Shui',
      time: '12 April at 09.28 PM',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'
    },
    {
      id: 's2',
      name: 'Minnie Armstrong',
      time: '12 April at 09.28 PM',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop'
    },
    {
      id: 's3',
      name: 'Russell Hicks',
      time: '12 April at 09.28 PM',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop'
    },
    {
      id: 's4',
      name: 'Lettie Christensen',
      time: '12 April at 09.28 PM',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop'
    }
  ];

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      {/* 1. Sosmed Stories Card matching screenshot */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[14.5px] text-[#111827] dark:text-white">
            Sosmed Stories
          </h3>
          <button
            type="button"
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Create Your Story item */}
        <div
          onClick={() => navigateTo('create-story')}
          className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer mb-2"
        >
          <div className="w-10 h-10 rounded-full border-2 border-[#1E75FF] text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-bold text-[13px] text-[#111827] dark:text-white">
              Create Your Story
            </span>
            <span className="text-[11px] text-[#9CA3AF] truncate">
              Click button beside to create yours.
            </span>
          </div>
        </div>

        {/* Story items list */}
        <div className="flex flex-col gap-2.5 mb-4">
          {stories.map((story) => (
            <div
              key={story.id}
              onClick={() => showToast(`Viewing ${story.name}'s story`, 'info')}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer"
            >
              <img
                src={story.avatar}
                alt={story.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent hover:ring-[#1E75FF] transition flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="font-bold text-[13px] text-[#111827] dark:text-white truncate">
                  {story.name}
                </span>
                <span className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
                  {story.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* SEE ALL pill button */}
        <button
          type="button"
          onClick={() => showToast('All stories loaded', 'info')}
          className="w-full py-2.5 rounded-xl bg-[#F0F5FF] dark:bg-[#1E75FF]/10 hover:bg-[#E5EFFF] dark:hover:bg-[#1E75FF]/20 text-[#1E75FF] font-bold text-[11.5px] uppercase tracking-wider transition-colors cursor-pointer text-center"
        >
          See All
        </button>
      </div>

      {/* 2. Events Card matching screenshot */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[14.5px] text-[#111827] dark:text-white">
            Events
          </h3>
          <button
            type="button"
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div
            onClick={() => navigateTo('events')}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer text-left"
          >
            <Calendar className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 stroke-[1.8]" />
            <span className="text-[13px] font-medium text-[#374151] dark:text-[#D1D5DB] truncate">
              10 Events Invites
            </span>
          </div>

          <div
            onClick={() => navigateTo('events')}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition cursor-pointer text-left"
          >
            <Gift className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 stroke-[1.8]" />
            <span className="text-[13px] font-medium text-[#374151] dark:text-[#D1D5DB] truncate">
              Prada's Invitation Birthday
            </span>
          </div>
        </div>
      </div>

      {/* 3. Suggested Pages Card matching screenshot */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[14.5px] text-[#111827] dark:text-white">
            Suggested Pages
          </h3>
          <button
            type="button"
            onClick={() => navigateTo('communities')}
            className="text-[#1E75FF] font-bold text-[11px] uppercase tracking-wider hover:underline cursor-pointer"
          >
            See All
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* Colorful gradient circle logo for Sebo Studio */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs shadow-xs flex-shrink-0">
              S
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-[13.5px] text-[#111827] dark:text-white">
                Sebo Studio
              </span>
              <span className="text-[11.5px] text-[#9CA3AF]">
                Design Studio
              </span>
            </div>
          </div>

          {/* Team Preview Image */}
          <div className="w-full h-[150px] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop"
              alt="Sebo Studio Team"
              className="w-full h-full object-cover hover:scale-102 transition-transform duration-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
