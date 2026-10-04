import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, Shield } from 'lucide-react';
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
    <div className="max-w-2xl mx-auto w-full h-[calc(100vh-8rem)] bg-gradient-to-b from-[#111827] to-[#030712] rounded-3xl p-6 flex flex-col justify-between items-center text-white shadow-2xl relative overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>End-to-End Encrypted</span>
        </div>
        <span className="font-mono text-white text-sm font-semibold">{formatTime(callDuration)}</span>
      </div>

      {/* Center Avatar & Status */}
      <div className="flex flex-col items-center gap-4 text-center my-auto">
        <div className="relative">
          <div className="w-28 h-28 rounded-full ring-4 ring-[#0B57D0]/40 overflow-hidden shadow-2xl animate-pulse">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&h=300&fit=crop"
              alt="Caller"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-1 right-2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black" />
        </div>

        <div>
          <h2 className="text-xl font-bold">Tiwi Community Member</h2>
          <p className="text-xs text-gray-400 mt-1">Direct Secure WebRTC Connection</p>
        </div>
      </div>

      {/* Call Control Actions */}
      <div className="w-full max-w-sm flex items-center justify-around bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10">
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          className={`p-4 rounded-full transition-colors ${
            isMuted ? 'bg-red-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setIsVideoOff((prev) => !prev)}
          className={`p-4 rounded-full transition-colors ${
            isVideoOff ? 'bg-red-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-[#B3261E] hover:bg-[#8C1D18] text-white shadow-lg active:scale-95 transition-transform"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
