import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Radio,
  Mic,
  MicOff,
  Users,
  Hand,
  Plus,
  Volume2
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function AudioSpacesView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic] = useState('Tech & AI');

  useEffect(() => {
    TiwiSocialAPI.getAudioSpaces().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSpaces(data);
      } else {
        setSpaces([
          {
            id: 'space_1',
            title: 'Modern Web Architecture & AI Engineering',
            topic: 'Technology',
            hostName: 'Alex Rivera',
            hostAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            speakersCount: 3,
            listenerCount: 42,
            isLive: true
          },
          {
            id: 'space_2',
            title: 'Creator Economy & Monetization Live Discussion',
            topic: 'Creators',
            hostName: 'Sophia Chen',
            hostAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
            speakersCount: 2,
            listenerCount: 28,
            isLive: true
          }
        ]);
      }
    });
  }, []);

  const handleJoinSpace = (space) => {
    setActiveSpace(space);
    showToast(`Joined "${space.title}"`, 'info');
  };

  const handleLeaveSpace = () => {
    setActiveSpace(null);
    showToast('Left audio broadcast', 'info');
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await TiwiSocialAPI.createAudioSpace(
        {
          title: newTitle.trim(),
          topic: newTopic,
          hostName: currentUser?.name || 'Creator',
          hostAvatar: currentUser?.avatar
        },
        currentUser?.id
      );

      const spaceObj = created || {
        id: `sp_${Date.now()}`,
        title: newTitle.trim(),
        topic: newTopic,
        hostName: currentUser?.name || 'You',
        hostAvatar: currentUser?.avatar,
        speakersCount: 1,
        listenerCount: 1,
        isLive: true
      };

      setSpaces((prev) => [spaceObj, ...prev]);
      setActiveSpace(spaceObj);
      setShowCreate(false);
      setNewTitle('');
      showToast('Live Audio Broadcast started!', 'info');
    } catch {
      showToast('Failed to start space', 'error');
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen pb-24 md:pb-12">
      {/* 1. Google M3 Header */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#1E1F20]/90 backdrop-blur-md px-4 sm:px-6 h-[64px] flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-[#1F1F1F] dark:text-[#E3E3E3] transition active:scale-95"
            title="Back to feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] sm:text-[20px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] flex items-center gap-2">
              <span>Live Broadcasts</span>
              <span className="w-2 h-2 rounded-full bg-[#B3261E] animate-pulse" />
            </h1>
            <p className="text-[12px] text-[#747775] dark:text-[#8E918F]">
              Real-time interactive audio rooms
            </p>
          </div>
        </div>

        {!activeSpace && (
          <button
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-1.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white dark:bg-[#A8C7FA] dark:hover:bg-[#80AAEF] dark:text-[#062E6F] font-medium text-[14px] px-5 py-2 rounded-full transition shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Start Room</span>
          </button>
        )}
      </div>

      <div className="max-w-[680px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* 2. Google Material 3 Room Creation Card */}
        {showCreate && !activeSpace && (
          <form
            onSubmit={handleCreateSpace}
            className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-[#0B57D0] dark:text-[#A8C7FA]">
              <Radio className="w-5 h-5" />
              <h3 className="font-semibold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                Start an Audio Broadcast
              </h3>
            </div>
            
            <div className="rounded-2xl border border-[#C4C7C5] dark:border-[#444746] p-3 focus-within:border-[#0B57D0] dark:focus-within:border-[#A8C7FA] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 bg-[#F8FAFD]/50 dark:bg-[#131314]/50">
              <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5]">Topic / Title</label>
              <input
                type="text"
                required
                placeholder="What would you like to discuss with the community?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-1 font-medium placeholder-[#747775] dark:placeholder-[#8E918F]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-full text-[14px] font-medium text-[#747775] dark:text-[#8E918F] hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="bg-[#0B57D0] hover:bg-[#0842A0] text-white dark:bg-[#A8C7FA] dark:hover:bg-[#80AAEF] dark:text-[#062E6F] font-medium text-[14px] px-6 py-2 rounded-full transition shadow-xs disabled:opacity-50"
              >
                Go Live
              </button>
            </div>
          </form>
        )}

        {/* 3. Active Broadcast Surface (Google Meet / Studio Aesthetic) */}
        {activeSpace && (
          <div className="bg-[#1E1F20] text-white rounded-3xl border border-[#313335] p-6 shadow-md flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#B3261E]/30 text-[#F2B8B5] border border-[#B3261E]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F2B8B5] animate-pulse" />
                  LIVE ON AIR
                </span>
                <span className="text-xs text-[#C4C7C5]">{activeSpace.topic}</span>
              </div>
              <button
                onClick={handleLeaveSpace}
                className="bg-white/10 hover:bg-white/20 text-[#E3E3E3] px-4 py-1.5 rounded-full font-medium text-xs transition"
              >
                Leave Room
              </button>
            </div>

            <div>
              <h2 className="text-[20px] font-semibold text-[#E3E3E3] leading-snug">
                {activeSpace.title}
              </h2>
            </div>

            <div className="flex items-center gap-4 py-2">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src={activeSpace.hostAvatar}
                    alt={activeSpace.hostName}
                    className="w-14 h-14 rounded-full border-2 border-[#A8C7FA] object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0B57D0] flex items-center justify-center text-white">
                    <Volume2 className="w-3 h-3" />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#E3E3E3] mt-2">{activeSpace.hostName}</span>
                <span className="text-[11px] text-[#C4C7C5]">Host</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium transition ${
                  isMuted
                    ? 'bg-[#B3261E] text-white hover:bg-[#8C1D18]'
                    : 'bg-[#A8C7FA] text-[#062E6F] hover:bg-[#80AAEF]'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Microphone Muted' : 'Microphone Live'}</span>
              </button>

              <button
                onClick={() => {
                  setIsHandRaised((prev) => !prev);
                  showToast(isHandRaised ? 'Hand lowered' : 'Hand raised to speak', 'info');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium transition ${
                  isHandRaised ? 'bg-[#7D5700] text-[#FFDF99]' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Hand className="w-4 h-4" />
                <span>{isHandRaised ? 'Hand Raised' : 'Request to Speak'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Live Broadcasts Feed */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3]">
              Active Broadcasts
            </h3>
            <span className="text-xs text-[#747775] dark:text-[#8E918F]">
              {spaces.length} ongoing
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {spaces.map((space) => (
              <div
                key={space.id}
                onClick={() => handleJoinSpace(space)}
                className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs hover:border-[#C4C7C5] dark:hover:border-[#444746] transition cursor-pointer flex flex-col gap-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FCE8E6] text-[#B3261E] dark:bg-[#601410] dark:text-[#F2B8B5]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B3261E] dark:bg-[#F2B8B5] animate-pulse" />
                      LIVE
                    </span>
                    <span className="text-xs font-medium bg-[#E8DEF8] text-[#4A4458] dark:bg-[#4A4458] dark:text-[#E8DEF8] px-2.5 py-0.5 rounded-full">
                      {space.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#747775] dark:text-[#8E918F]">
                    <Users className="w-3.5 h-3.5" />
                    <span>{space.listenerCount} listening</span>
                  </div>
                </div>

                <h4 className="text-[16px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] leading-snug group-hover:text-[#0B57D0] dark:group-hover:text-[#A8C7FA] transition">
                  {space.title}
                </h4>

                <div className="flex items-center justify-between pt-2 border-t border-[#F2F2F2] dark:border-[#2D2E30] text-xs text-[#747775] dark:text-[#8E918F]">
                  <div className="flex items-center gap-2">
                    <img
                      src={space.hostAvatar}
                      alt={space.hostName}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">{space.hostName}</span>
                  </div>
                  <button className="text-xs font-medium text-[#0B57D0] dark:text-[#A8C7FA] group-hover:underline">
                    Listen in &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
