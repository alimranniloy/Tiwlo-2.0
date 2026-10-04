import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  Mic,
  MicOff,
  Users,
  Hand,
  LogOut
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function AudioSpacesView() {
  const { currentUser, showToast } = useSocial();
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('Tech & Startups');

  useEffect(() => {
    TiwiSocialAPI.getAudioSpaces().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSpaces(data);
      } else {
        setSpaces([
          {
            id: 'space_1',
            title: 'Modern Web Architecture & Google UI Discussions',
            topic: 'Engineering',
            hostName: 'Alex Rivera',
            hostAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            speakersCount: 3,
            listenerCount: 42,
            isLive: true
          },
          {
            id: 'space_2',
            title: 'Creator Economy & Monetization on Tiwi',
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
      showToast('Live Audio Space is now ON AIR!', 'info');
    } catch (e) {
      showToast('Failed to start space', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] p-5 sm:p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#0B57D0]" />
            Live Audio Spaces
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Drop-in audio conversations and community stages
          </p>
        </div>

        {!activeSpace && (
          <button
            onClick={() => setShowCreate((prev) => !prev)}
            className="flex items-center gap-1.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Start a Space</span>
          </button>
        )}
      </div>

      {/* Create Space Form Box */}
      {showCreate && !activeSpace && (
        <form
          onSubmit={handleCreateSpace}
          className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-4 animate-fadeIn"
        >
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white">Start a new audio room</h3>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Room Title</label>
            <input
              type="text"
              placeholder="What do you want to talk about?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#0B57D0]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Topic</label>
            <select
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none"
            >
              <option value="Tech & Startups">Tech & Startups</option>
              <option value="Creator Economy">Creator Economy</option>
              <option value="Music & Arts">Music & Arts</option>
              <option value="General Hangout">General Hangout</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white px-5 py-2 rounded-full text-xs font-semibold shadow-xs"
            >
              Go Live Now
            </button>
          </div>
        </form>
      )}

      {/* Active Room View (if inside room) */}
      {activeSpace ? (
        <div className="bg-gradient-to-b from-[#0F172A] to-[#1E293B] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col gap-6">
          {/* Room Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-[11px] font-bold text-[#8AB4F8] uppercase tracking-wider">
                {activeSpace.topic || 'Live Space'}
              </span>
              <h1 className="text-lg sm:text-xl font-bold mt-0.5">{activeSpace.title}</h1>
            </div>
            <button
              onClick={handleLeaveSpace}
              className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded-full text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          </div>

          {/* Speakers Stage */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Speakers Stage</h4>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  <img
                    src={activeSpace.hostAvatar || currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                    alt="Host"
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-[#0B57D0]"
                  />
                  <span className="absolute bottom-0 right-0 p-1 bg-[#0B57D0] rounded-full text-white text-[10px]">
                    <Mic className="w-3 h-3" />
                  </span>
                </div>
                <span className="text-xs font-bold">{activeSpace.hostName || 'Host'} (Host)</span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  <img
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt="You"
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-600"
                  />
                  <span className="absolute bottom-0 right-0 p-1 bg-red-500 rounded-full text-white text-[10px]">
                    {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  </span>
                </div>
                <span className="text-xs font-bold">You</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Mute & Raise Hand */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Users className="w-4 h-4 text-[#8AB4F8]" />
              <span>{activeSpace.listenerCount || 24} listeners</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsHandRaised((prev) => !prev);
                  showToast(isHandRaised ? 'Hand lowered' : 'Hand raised to speak', 'info');
                }}
                className={`p-3 rounded-full transition-all ${
                  isHandRaised ? 'bg-amber-500 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
                title="Raise Hand"
              >
                <Hand className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsMuted((prev) => !prev);
                  showToast(isMuted ? 'Microphone unmuted' : 'Microphone muted', 'info');
                }}
                className={`px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
                  isMuted ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[#0B57D0] text-white shadow-md'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Speaking'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Rooms Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col justify-between gap-4 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#0B57D0] dark:bg-blue-950/40 dark:text-[#8AB4F8] uppercase tracking-wider">
                    {space.topic || 'Live Room'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                  </div>
                </div>

                <h3 className="font-bold text-sm sm:text-base text-[#1F1F1F] dark:text-white leading-snug line-clamp-2">
                  {space.title}
                </h3>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src={space.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt={space.hostName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-gray-800 dark:text-gray-200 block truncate max-w-[120px]">
                      {space.hostName || 'Host'}
                    </span>
                    <span className="text-[10px] text-gray-400">{space.listenerCount || 18} listening</span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinSpace(space)}
                  className="bg-[#0B57D0] hover:bg-[#0842A0] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs transition-all"
                >
                  Join Room
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
