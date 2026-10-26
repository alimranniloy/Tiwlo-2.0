import React, { useState } from 'react';
import {
  ChevronLeft,
  CheckCircle2,
  Play,
  Pause,
  Home,
  Music,
  BarChart2,
  User,
  Wifi,
  Battery,
  Volume2
} from 'lucide-react';
import artistImg from '../assets/imru-artist.jpg';

export default function StudioPhoneMockup() {
  const [playingTrackId, setPlayingTrackId] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const tracks = [
    { id: 1, title: 'Lost World', duration: '2:48' },
    { id: 2, title: 'Midnight', duration: '3:12' },
    { id: 3, title: 'Never Again', duration: '3:05' },
    { id: 4, title: 'Skyline', duration: '2:56' },
  ];

  const togglePlay = (id) => {
    if (playingTrackId === id) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingTrackId(id);
      setIsPlaying(true);
    }
  };

  return (
    <div className="relative mx-auto w-[290px] sm:w-[320px] rounded-[44px] p-3 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.45),0_0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-slate-800/40 select-none">
      {/* Outer Phone Bezel & Reflection Highlights */}
      <div className="absolute top-0 inset-x-12 h-6 bg-slate-950 rounded-b-2xl z-30 flex items-center justify-center">
        {/* Speaker and Camera Island */}
        <div className="w-20 h-3.5 bg-black rounded-full flex items-center justify-end px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
        </div>
      </div>

      {/* Screen Inner Container */}
      <div className="relative overflow-hidden rounded-[36px] bg-slate-950 text-white font-sans aspect-[9/19] flex flex-col justify-between shadow-inner">
        {/* Status Bar */}
        <div className="pt-3 px-6 flex justify-between items-center text-[11px] font-medium text-slate-300 z-20">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Top Header Navigation */}
        <div className="px-4 py-2 flex items-center justify-between z-20">
          <button className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
            <span className="font-semibold text-white tracking-wide">IMRU</span>
          </button>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] text-blue-300 font-medium">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            <span>Verified Artist</span>
          </div>
        </div>

        {/* Hero Release Feature Area */}
        <div className="relative mx-3 rounded-2xl overflow-hidden aspect-[4/3] group shadow-lg border border-white/10">
          <img
            src={artistImg}
            alt="IMRU Artist"
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
          />
          {/* Subtle Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          {/* Release Details & Big Play Button */}
          <div className="absolute bottom-2.5 inset-x-3 flex items-end justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Latest Release
              </span>
              <h4 className="text-base font-bold text-white leading-tight">
                Lost World
              </h4>
              <p className="text-[11px] text-slate-300">Single • 2025</p>
            </div>

            {/* Play Button */}
            <button
              onClick={() => togglePlay(1)}
              className="w-10 h-10 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label="Play Track"
            >
              {isPlaying && playingTrackId === 1 ? (
                <Pause className="w-4 h-4 fill-current text-slate-950" />
              ) : (
                <Play className="w-4 h-4 fill-current text-slate-950 translate-x-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Top Tracks List */}
        <div className="px-4 py-2 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">Top Tracks</span>
            {isPlaying && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <Volume2 className="w-3 h-3 animate-pulse" />
                Playing
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {tracks.map((track) => {
              const isCurrent = playingTrackId === track.id && isPlaying;
              return (
                <div
                  key={track.id}
                  onClick={() => togglePlay(track.id)}
                  className={`flex items-center justify-between p-1.5 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-medium text-slate-400 w-3 text-center">
                      {isCurrent ? (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      ) : (
                        track.id
                      )}
                    </span>
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                      <img
                        src={artistImg}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs font-semibold leading-none truncate max-w-[120px]">
                      {track.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-blue-400 rounded-full animate-bounce h-2" />
                        <span className="w-0.5 bg-blue-400 rounded-full animate-bounce h-3 delay-75" />
                        <span className="w-0.5 bg-blue-400 rounded-full animate-bounce h-1.5 delay-150" />
                      </div>
                    ) : null}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {track.duration}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom App Navigation Bar */}
        <div className="border-t border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-2.5 flex justify-between items-center text-slate-400 text-[10px]">
          <div className="flex flex-col items-center gap-0.5 cursor-pointer hover:text-white">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-blue-400 cursor-pointer font-semibold">
            <Music className="w-4 h-4" />
            <span>Music</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 cursor-pointer hover:text-white">
            <BarChart2 className="w-4 h-4" />
            <span>Analytics</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 cursor-pointer hover:text-white">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
