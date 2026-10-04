import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Shield, Sparkles } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function AudioVideoCallView() {
  const { tabParams, navigateTo, showToast } = useSocial();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleEndCall = () => {
    showToast('Call ended', 'info');
    navigateTo('messages');
  };

  return (
    <div className="max-w-2xl mx-auto w-full h-[calc(100vh-7.5rem)] bg-gradient-to-b from-[#181824] to-[#0c0c12] rounded-3xl border border-white/10 p-6 sm:p-8 flex flex-col justify-between items-center text-white shadow-2xl relative overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs text-white/70">
        <div className="flex items-center gap-1.5 bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium">End-to-End Encrypted</span>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 font-mono font-semibold">
          {formatTime(callDuration)}
        </div>
      </div>

      {/* Center Avatar & Status */}
      <div className="flex flex-col items-center gap-5 text-center my-auto">
        <div className="relative">
          <div className="w-32 h-32 rounded-3xl ring-4 ring-violet-500/40 overflow-hidden shadow-2xl shadow-violet-500/30 animate-pulse">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&h=300&fit=crop"
              alt="Caller"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-1 right-2 w-4 h-4 bg-emerald-500 rounded-full ring-3 ring-[#181824]" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Alex Rivera</h2>
          <p className="text-xs text-violet-400 font-semibold mt-1 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>HD Voice & Video Active</span>
          </p>
        </div>
      </div>

      {/* Modern Control Dock */}
      <div className="w-full max-w-sm flex items-center justify-around bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl">
        <button
          onClick={() => {
            setIsMuted((prev) => !prev);
            showToast(isMuted ? 'Microphone on' : 'Microphone muted', 'info');
          }}
          className={`p-3.5 rounded-xl transition cursor-pointer active:scale-95 ${
            isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/15 hover:bg-white/20 text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={() => {
            setIsVideoOff((prev) => !prev);
            showToast(isVideoOff ? 'Camera turned on' : 'Camera turned off', 'info');
          }}
          className={`p-3.5 rounded-xl transition cursor-pointer active:scale-95 ${
            isVideoOff ? 'bg-rose-500/20 text-rose-400' : 'bg-white/15 hover:bg-white/20 text-white'
          }`}
          title={isVideoOff ? 'Start Video' : 'Stop Video'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={handleEndCall}
          className="p-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
