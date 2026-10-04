import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Radio,
  Mic,
  MicOff,
  Users,
  Hand,
  Plus,
  Volume2,
  Sparkles,
  PhoneOff,
  CheckCircle2
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
  const [newTopic, setNewTopic] = useState('Tech & AI');

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
            title: 'Creator Economy & Monetization Live Hangout',
            topic: 'Creators',
            hostName: 'Sophia Chen',
            hostAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
            speakersCount: 2,
            listenerCount: 28,
            isLive: true
          },
          {
            id: 'space_3',
            title: 'Next-Gen Design Systems: Google & Apple Aesthetics',
            topic: 'Design',
            hostName: 'Sarah Jenkins',
            hostAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
            speakersCount: 4,
            listenerCount: 65,
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
    showToast('Left audio space', 'info');
  };

  const handleCreateSpace = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Please enter a space title', 'error');
      return;
    }

    const created = {
      id: `space_${Date.now()}`,
      title: newTitle.trim(),
      topic: newTopic,
      hostName: currentUser?.name || 'You',
      hostAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      speakersCount: 1,
      listenerCount: 1,
      isLive: true
    };

    setSpaces((prev) => [created, ...prev]);
    setActiveSpace(created);
    setShowCreate(false);
    setNewTitle('');
    showToast('Audio space started live!', 'info');
  };

  return (
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
              <span>Audio Spaces</span>
            </h1>
            <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              Live audio conversations and interactive stages
            </span>
          </div>
        </div>

        {!activeSpace && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-[13px] shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Host a Space</span>
          </button>
        )}
      </div>

      {/* 2. In-Page Create Space Form (Strictly No Popups) */}
      {showCreate && (
        <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm mb-4">
          <h2 className="text-[17px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
            Start a Live Space
          </h2>
          <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] mb-4">
            Pick a topic and go live right now with voice communication.
          </p>

          <form onSubmit={handleCreateSpace} className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                What do you want to talk about?
              </label>
              <input
                type="text"
                placeholder="e.g. Discussing the new React 19 Compiler"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                Topic Category
              </label>
              <select
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
              >
                <option value="Tech & AI">Tech & AI</option>
                <option value="Creators">Creators</option>
                <option value="Design">Design</option>
                <option value="Casual Hangout">Casual Hangout</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-semibold text-[13px] text-[#65676b] dark:text-[#8a8d91] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
              >
                Go Live Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Active Space Stage Dock (If user is inside a space) */}
      {activeSpace && (
        <div className="bg-gradient-to-b from-[#181824] to-[#12121a] text-white rounded-3xl border border-white/10 p-6 shadow-2xl mb-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div>
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full w-fit mb-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                LIVE STAGE
              </span>
              <h2 className="text-xl font-bold">{activeSpace.title}</h2>
              <span className="text-xs text-white/60">Hosted by {activeSpace.hostName} · {activeSpace.topic}</span>
            </div>

            <button
              onClick={handleLeaveSpace}
              className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Leave quietly</span>
            </button>
          </div>

          {/* Speakers Grid */}
          <div className="mb-8">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-4">Speakers</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative mb-2">
                  <img
                    src={activeSpace.hostAvatar}
                    alt={activeSpace.hostName}
                    className="w-16 h-16 rounded-2xl object-cover ring-3 ring-violet-500 shadow-lg"
                  />
                  <span className="absolute -bottom-1 -right-1 p-1 bg-violet-600 rounded-full text-white">
                    <Mic className="w-3 h-3" />
                  </span>
                </div>
                <span className="text-xs font-bold truncate w-full">{activeSpace.hostName}</span>
                <span className="text-[10px] text-violet-400 font-semibold">Host</span>
              </div>

              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative mb-2">
                  <img
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt="You"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/20"
                  />
                  <span className="absolute -bottom-1 -right-1 p-1 bg-black/60 rounded-full text-white">
                    {isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                  </span>
                </div>
                <span className="text-xs font-bold truncate w-full">You</span>
                <span className="text-[10px] text-white/50">{isMuted ? 'Muted' : 'Speaking'}</span>
              </div>
            </div>
          </div>

          {/* Room Controls Dock */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className={`p-3.5 rounded-2xl flex items-center gap-2 font-semibold text-xs transition cursor-pointer active:scale-95 ${
                isMuted
                  ? 'bg-white/10 hover:bg-white/15 text-white'
                  : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
            </button>

            <button
              onClick={() => {
                setIsHandRaised((prev) => !prev);
                showToast(isHandRaised ? 'Hand lowered' : 'Hand raised to speak', 'info');
              }}
              className={`p-3.5 rounded-2xl flex items-center gap-2 font-semibold text-xs transition cursor-pointer active:scale-95 ${
                isHandRaised
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              <Hand className="w-4 h-4" />
              <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Live Spaces Catalog */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] px-1">
          Happening Now ({spaces.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spaces.map((sp) => (
            <div
              key={sp.id}
              onClick={() => handleJoinSpace(sp)}
              className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm hover:shadow-md dark:hover:shadow-black/30 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    LIVE
                  </span>
                  <span className="text-[12px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full">
                    {sp.topic}
                  </span>
                </div>

                <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug mb-3">
                  {sp.title}
                </h3>

                <div className="flex items-center gap-2.5">
                  <img
                    src={sp.hostAvatar}
                    alt={sp.hostName}
                    className="w-8 h-8 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-[#1c1e21] dark:text-[#e4e6eb] block">{sp.hostName}</span>
                    <span className="text-[#65676b] dark:text-[#8a8d91]">Host</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/[0.05] dark:border-white/[0.06] mt-4">
                <div className="flex items-center gap-3 text-xs text-[#65676b] dark:text-[#8a8d91]">
                  <span className="flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5 text-violet-500" />
                    {sp.speakersCount} speakers
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    {sp.listenerCount} listening
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoinSpace(sp);
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4 py-1.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Join
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
