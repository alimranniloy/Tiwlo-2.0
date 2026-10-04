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
    <div className="max-w-2xl mx-auto w-full h-[calc(100vh-8rem)] bg-[#202124] rounded-lg border border-[#3c4043] p-6 flex flex-col justify-between items-center text-white shadow-lg relative overflow-hidden">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs text-[#9aa0a6]">
        <div className="flex items-center gap-1.5 bg-[#303134] px-3 py-1 rounded-full border border-[#3c4043]">
          <Shield className="w-3.5 h-3.5 text-[#81c995]" />
          <span>End-to-End Encrypted</span>
        </div>
        <span className="font-mono text-white text-sm font-semibold">{formatTime(callDuration)}</span>
      </div>

      {/* Center Avatar & Status */}
      <div className="flex flex-col items-center gap-4 text-center my-auto">
        <div className="relative">
          <div className="w-28 h-28 rounded-full ring-4 ring-[#1a73e8]/40 overflow-hidden shadow-xl animate-pulse">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&h=300&fit=crop"
              alt="Caller"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-1 right-2 w-4 h-4 bg-[#188038] rounded-full border-2 border-[#202124]" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#e8eaed]">Tiwi Community Member</h2>
          <p className="text-xs text-[#9aa0a6] mt-1">Direct Secure WebRTC Connection</p>
        </div>
      </div>

      {/* Call Control Actions: Google Meet Pill Dock */}
      <div className="w-full max-w-sm flex items-center justify-around bg-[#303134] p-3 rounded-full border border-[#3c4043] shadow-md">
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
