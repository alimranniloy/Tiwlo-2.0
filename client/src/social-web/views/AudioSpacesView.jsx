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
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-3 sm:px-4 h-[56px] flex items-center justify-between border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back to feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
              <span>Live Broadcasts</span>
              <span className="w-2 h-2 rounded-full bg-[#d93025] animate-pulse" />
            </h1>
          </div>
        </div>

        {!activeSpace && (
          <button
            onClick={() => setShowCreate((prev) => !prev)}
            className="inline-flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-4 py-1.5 rounded-md transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start Room</span>
          </button>
        )}
      </div>

      <div className="max-w-[680px] w-full mx-auto p-3 sm:p-4 flex flex-col gap-4">
        {/* 2. Room Creation Card (rounded-lg) */}
        {showCreate && !activeSpace && (
          <form
            onSubmit={handleCreateSpace}
            className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-[#1a73e8]">
              <Radio className="w-4 h-4" />
              <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed]">
                Start an Audio Broadcast
              </h3>
            </div>
            
            <div className="rounded-md border border-[#dadce0] dark:border-[#5f6368] p-2.5 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
              <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Topic / Title</label>
              <input
                type="text"
                required
                placeholder="What would you like to discuss with the community?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-1 placeholder-[#5f6368] dark:placeholder-[#9aa0a6]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3.5 py-1.5 rounded-md text-[13px] font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-5 py-1.5 rounded-md transition shadow-xs disabled:opacity-50"
              >
                Go Live
              </button>
            </div>
          </form>
        )}

        {/* 3. Active Broadcast Surface (rounded-lg) */}
        {activeSpace && (
          <div className="bg-[#202124] text-white rounded-lg border border-[#3c4043] p-5 shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#d93025] text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs text-[#9aa0a6]">{activeSpace.topic}</span>
              </div>
              <button
                onClick={handleLeaveSpace}
                className="bg-white/10 hover:bg-white/20 text-[#e8eaed] px-3 py-1 rounded-md font-medium text-xs transition"
              >
                Leave Room
              </button>
            </div>

            <div>
              <h2 className="text-[18px] font-medium text-[#e8eaed] leading-snug">
                {activeSpace.title}
              </h2>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src={activeSpace.hostAvatar}
                    alt={activeSpace.hostName}
                    className="w-12 h-12 rounded-full border-2 border-[#8ab4f8] object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1a73e8] flex items-center justify-center text-white">
                    <Volume2 className="w-2.5 h-2.5" />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#e8eaed] mt-1.5">{activeSpace.hostName}</span>
                <span className="text-[10px] text-[#9aa0a6]">Host</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition ${
                  isMuted
                    ? 'bg-[#d93025] text-white hover:bg-[#b3261e]'
                    : 'bg-[#8ab4f8] text-[#041e49] hover:bg-[#aecbfa]'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Live'}</span>
              </button>

              <button
                onClick={() => {
                  setIsHandRaised((prev) => !prev);
                  showToast(isHandRaised ? 'Hand lowered' : 'Hand raised to speak', 'info');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition ${
                  isHandRaised ? 'bg-[#f29900] text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Hand className="w-4 h-4" />
                <span>{isHandRaised ? 'Hand Raised' : 'Request to Speak'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Live Broadcasts Feed */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed]">
              Active Broadcasts
            </h3>
            <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
              {spaces.length} ongoing
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {spaces.map((space) => (
              <div
                key={space.id}
                onClick={() => handleJoinSpace(space)}
                className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs hover:border-[#1a73e8] transition cursor-pointer flex flex-col gap-2.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-[#d93025]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d93025] animate-pulse" />
                      LIVE
                    </span>
                    <span className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6]">
                      {space.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                    <Users className="w-3.5 h-3.5" />
                    <span>{space.listenerCount} listening</span>
                  </div>
                </div>

                <h4 className="text-[15px] font-medium text-[#202124] dark:text-[#e8eaed] leading-snug group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] transition">
                  {space.title}
                </h4>

                <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] dark:border-[#3c4043] text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                  <div className="flex items-center gap-2">
                    <img
                      src={space.hostAvatar}
                      alt={space.hostName}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="font-medium text-[#202124] dark:text-[#e8eaed]">{space.hostName}</span>
                  </div>
                  <span className="text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] group-hover:underline">
                    Join &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
