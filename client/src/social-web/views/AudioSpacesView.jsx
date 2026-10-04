import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Radio,
  Mic,
  MicOff,
  Users,
  Hand
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
  const [newTopic] = useState('Tech & Startups');

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
    showToast(`Listening to "${space.title}"`, 'info');
  };

  const handleLeaveSpace = () => {
    setActiveSpace(null);
    showToast('Left audio space', 'info');
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
      showToast('Live Audio Space started!', 'info');
    } catch {
      showToast('Failed to start space', 'error');
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              Spaces
            </h1>
            <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
              Live audio conversations
            </span>
          </div>
        </div>

        {!activeSpace && (
          <button
            onClick={() => setShowCreate((prev) => !prev)}
            className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[14px] px-4 py-1.5 rounded-full transition"
          >
            Start a Space
          </button>
        )}
      </div>

      {/* 2. Create Space Form */}
      {showCreate && !activeSpace && (
        <form onSubmit={handleCreateSpace} className="p-4 border-b border-[#EFF3F4] dark:border-[#2F3336] flex flex-col gap-3 bg-[#F7F9F9] dark:bg-[#16181C]">
          <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
            What do you want to talk about?
          </h3>
          <input
            type="text"
            required
            placeholder="Name your Space..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-white dark:bg-black border border-[#CFD9DE] dark:border-[#536471] text-[15px] text-[#0F1419] dark:text-[#E7E9EA] rounded-xl px-4 py-2.5 focus:border-[#1D9BF0] outline-none"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-1.5 rounded-full text-[14px] font-bold text-[#536471] dark:text-[#71767B] hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[14px] px-5 py-1.5 rounded-full"
            >
              Start now
            </button>
          </div>
        </form>
      )}

      {/* 3. Active Space Modal/Banner */}
      {activeSpace && (
        <div className="m-4 rounded-3xl p-6 bg-gradient-to-br from-[#7928CA] to-[#FF0080] text-white shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/20 pb-3">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                LIVE NOW
              </span>
              <h2 className="text-[20px] font-extrabold mt-1">{activeSpace.title}</h2>
            </div>
            <button
              onClick={handleLeaveSpace}
              className="bg-black/40 hover:bg-black/60 px-4 py-1.5 rounded-full font-bold text-xs"
            >
              Leave
            </button>
          </div>

          <div className="flex items-center gap-4 py-3">
            <div className="flex flex-col items-center">
              <img
                src={activeSpace.hostAvatar}
                alt={activeSpace.hostName}
                className="w-14 h-14 rounded-full border-2 border-white object-cover"
              />
              <span className="text-xs font-bold mt-1">{activeSpace.hostName}</span>
              <span className="text-[10px] text-white/80">Host</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/20">
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-xs font-bold"
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            <button
              onClick={() => {
                setIsHandRaised((prev) => !prev);
                showToast(isHandRaised ? 'Hand lowered' : 'Hand raised to speak', 'info');
              }}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-xs font-bold"
            >
              <Hand className="w-4 h-4" />
              <span>{isHandRaised ? 'Hand Raised' : 'Request to speak'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Live Spaces List */}
      <div className="p-4 flex flex-col gap-4 pb-24 md:pb-12">
        <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
          Happening Now
        </h3>

        {spaces.map((space) => (
          <div
            key={space.id}
            onClick={() => handleJoinSpace(space)}
            className="rounded-2xl p-5 bg-gradient-to-r from-[#202327] to-[#16181C] text-white border border-[#2F3336] cursor-pointer hover:opacity-95 transition flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-[#1D9BF0] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE</span>
              <span>·</span>
              <span className="text-white/60">{space.topic}</span>
            </div>

            <h4 className="text-[18px] font-extrabold leading-snug">{space.title}</h4>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <img
                  src={space.hostAvatar}
                  alt={space.hostName}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span>{space.hostName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{space.listenerCount} listening</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
