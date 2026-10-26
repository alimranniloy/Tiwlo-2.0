import React from 'react';
import { AudioWaveform, CloudUpload, ArrowRight, Sparkles } from 'lucide-react';

export default function StudioServices({ onNavigateAuth, onNavigateTab }) {
  const handleCardClick = (type) => {
    if (onNavigateAuth) {
      onNavigateAuth('signup');
    } else if (onNavigateTab) {
      onNavigateTab('create-account');
    } else {
      window.location.href = '/create-account';
    }
  };

  return (
    <section id="distribution" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100/80 border border-slate-200/60 shadow-2xs mb-4 text-slate-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Tiwlo Studio</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
            Two Powerful Services
            <br />
            <span className="bg-gradient-to-r from-slate-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">
              For Your Music Journey
            </span>
          </h2>
        </div>

        {/* 2 Side-by-Side Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">

          {/* Card 1: Music Level */}
          <div
            id="music-level"
            className="group relative overflow-hidden rounded-[32px] p-8 sm:p-10 bg-gradient-to-br from-white via-white/90 to-blue-50/50 border border-slate-100 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(99,102,241,0.12)] transition-all duration-300 flex flex-col justify-between"
          >
            {/* Background 3D Wave Art Graphic */}
            <div className="absolute right-0 bottom-0 top-0 w-3/5 pointer-events-none opacity-90 transition-transform duration-500 group-hover:scale-105">
              <svg
                viewBox="0 0 400 300"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full object-cover"
              >
                <defs>
                  <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#C084FC" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
                  </linearGradient>
                  <linearGradient id="waveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0.05" />
                  </linearGradient>
                  <filter id="softGlow1" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                </defs>
                <path
                  d="M120 180 C 180 80, 260 220, 390 120 C 420 100, 440 140, 420 190 C 370 270, 240 280, 160 220 Z"
                  fill="url(#waveGrad1)"
                  filter="url(#softGlow1)"
                />
                <path
                  d="M140 190 C 210 110, 290 200, 390 140"
                  stroke="#6366F1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <path
                  d="M110 210 C 190 140, 280 230, 370 170"
                  stroke="#818CF8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.45"
                />
                <circle cx="280" cy="110" r="16" fill="url(#waveGrad2)" opacity="0.7" />
                <circle cx="330" cy="190" r="9" fill="#818CF8" opacity="0.3" />
              </svg>
            </div>

            {/* Card Content */}
            <div className="relative z-10 max-w-sm">
              {/* Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-6 shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <AudioWaveform className="w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold text-slate-950 mb-1">
                Music Level
              </h3>
              <p className="text-sm font-semibold text-slate-500 mb-4">
                Build Your Sound
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Get the tools you need to create, manage and grow your music brand. From analytics to audience insights — everything in one place.
              </p>
            </div>

            <div className="relative z-10">
              <button
                onClick={() => handleCardClick('level')}
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer group/link"
              >
                <span>Explore Music Level</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Card 2: Music Distribution */}
          <div className="group relative overflow-hidden rounded-[32px] p-8 sm:p-10 bg-gradient-to-br from-white via-white/90 to-emerald-50/40 border border-slate-100 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.12)] transition-all duration-300 flex flex-col justify-between">
            {/* Background 3D Planet & Orbital Ring Art Graphic */}
            <div className="absolute right-0 bottom-0 top-0 w-3/5 pointer-events-none opacity-90 transition-transform duration-500 group-hover:scale-105">
              <svg
                viewBox="0 0 400 300"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full object-cover"
              >
                <defs>
                  <linearGradient id="orbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34D399" stopOpacity="0.5" />
                    <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.1" />
                  </linearGradient>
                  <filter id="softGlow2" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="10" />
                  </filter>
                </defs>
                {/* 3D Sphere */}
                <circle
                  cx="280"
                  cy="150"
                  r="65"
                  fill="url(#orbGrad)"
                  filter="url(#softGlow2)"
                />
                <circle
                  cx="270"
                  cy="145"
                  r="50"
                  fill="url(#orbGrad)"
                  stroke="#10B981"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />
                {/* Orbital Rings */}
                <ellipse
                  cx="270"
                  cy="150"
                  rx="95"
                  ry="32"
                  transform="rotate(-25 270 150)"
                  stroke="#059669"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.65"
                />
                <ellipse
                  cx="270"
                  cy="150"
                  rx="110"
                  ry="40"
                  transform="rotate(-25 270 150)"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                  opacity="0.4"
                />
              </svg>
            </div>

            {/* Card Content */}
            <div className="relative z-10 max-w-sm">
              {/* Icon Badge */}
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-6 shadow-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CloudUpload className="w-7 h-7" />
              </div>

              <h3 className="text-2xl font-bold text-slate-950 mb-1">
                Music Distribution
              </h3>
              <p className="text-sm font-semibold text-slate-500 mb-4">
                Go Global
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-8">
                Distribute your music to 200+ platforms worldwide. Reach new audiences and turn your passion into real growth.
              </p>
            </div>

            <div className="relative z-10">
              <button
                onClick={() => handleCardClick('distribution')}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer group/link"
              >
                <span>Explore Distribution</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
