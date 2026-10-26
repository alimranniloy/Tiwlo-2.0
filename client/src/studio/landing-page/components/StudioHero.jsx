import React, { useState } from 'react';
import { ArrowRight, Play, AudioWaveform, Disc, Sparkles } from 'lucide-react';
import StudioPhoneMockup from './StudioPhoneMockup';
import heroFluidImg from '../assets/hero-fluid-3d.jpg';

export default function StudioHero({ onNavigateAuth, onNavigateTab }) {
  const [showVideoModal, setShowVideoModal] = useState(false);

  const handleStartNow = () => {
    if (onNavigateAuth) {
      onNavigateAuth('signup');
    } else if (onNavigateTab) {
      onNavigateTab('create-account');
    } else {
      window.location.href = '/create-account';
    }
  };

  const platforms = [
    {
      name: 'Spotify',
      color: '#1DB954',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      )
    },
    {
      name: 'Apple Music',
      color: '#FC3C44',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FC3C44">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.36c.64-.78 1.08-1.86.96-2.95-1 .04-2.16.66-2.83 1.45-.58.67-1.1 1.77-.96 2.84 1.11.08 2.19-.56 2.83-1.34z" />
        </svg>
      )
    },
    {
      name: 'YouTube Music',
      color: '#FF0000',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF0000">
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-11.664c-2.52 0-4.56 2.04-4.56 4.56s2.04 4.56 4.56 4.56 4.56-2.04 4.56-4.56-2.04-4.56-4.56-4.56zm-1.2 6.36V10.2l3.12 1.8-3.12 1.8z" />
        </svg>
      )
    },
    {
      name: 'Amazon Music',
      color: '#00A8E1',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#00A8E1">
          <path d="M13.958 10.09c0 1.25-.05 2.29-.684 3.395-.53.94-1.378 1.547-2.35 1.547-1.353 0-2.07-.99-2.07-2.457 0-2.89 2.45-3.412 5.104-3.412v.927zm3.766 6.815c-.247-.212-.39-.537-.367-.866l.092-1.33c-.768.913-1.63 1.564-2.736 1.942-1.07.364-2.203.413-3.328.14-1.23-.3-2.29-1.01-2.955-2.06-.665-1.047-.845-2.338-.507-3.535.48-1.7 1.815-2.94 3.49-3.39 1.637-.44 3.447-.25 4.954.53V7.8c0-.75-.152-1.393-.666-1.89-.513-.497-1.29-.696-2.05-.696-1.127 0-2.18.43-2.98 1.22-.24.237-.585.346-.913.29-.328-.057-.604-.265-.733-.556L8.44 4.195c-.172-.37-.098-.813.185-1.11 1.6-1.677 3.82-2.317 6.13-2.08 1.48.15 2.82.87 3.73 1.99.91 1.12 1.34 2.58 1.34 4.07v6.62c0 .484.22.846.6 1.096.38.25.43.68.21 1.03l-1.62 2.09c-.28.36-.81.44-1.29.1z" />
        </svg>
      )
    },
    {
      name: 'Deezer',
      color: '#A238FF',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#A238FF">
          <path d="M18.8 6.4h3.6v2.4h-3.6V6.4zm0 3.6h3.6v2.4h-3.6v-2.4zm0 3.6h3.6v2.4h-3.6v-2.4zm0 3.6h3.6v2.4h-3.6v-2.4zm-4.8-3.6h3.6v2.4H14v-2.4zm0 3.6h3.6v2.4H14v-2.4zm-4.8 0h3.6v2.4H9.2v-2.4zm-4.8 0H8v2.4H4.4v-2.4zm-4.4 0h3.6v2.4H0v-2.4z" />
        </svg>
      )
    }
  ];

  return (
    <section id="home" className="relative pt-6 pb-20 md:pt-12 md:pb-32 overflow-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-blue-100/60 via-indigo-50/50 to-purple-100/40 blur-3xl pointer-events-none -z-10 rounded-full" />
      <div className="absolute top-10 right-10 w-[450px] h-[450px] bg-sky-100/40 blur-3xl pointer-events-none -z-10 rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Hero Content Column */}
          <div className="lg:col-span-7 flex flex-col items-start text-left z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/60 shadow-xs mb-6 text-slate-700 text-xs sm:text-sm font-medium">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 text-blue-600">
                <AudioWaveform className="w-3.5 h-3.5" />
              </span>
              <span>Music Level</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-900 font-semibold">Music Distribution</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-tight text-slate-950 leading-[1.08] mb-6">
              Your Music.
              <br />
              <span className="bg-gradient-to-r from-[#6366F1] via-[#818CF8] to-[#38BDF8] bg-clip-text text-transparent">
                Our Platform.
              </span>
            </h1>

            {/* Description Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-xl font-normal leading-relaxed mb-8">
              Tiwlo Studio is now your complete music level and distribution platform. Create, grow and get your music heard — worldwide.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-14">
              <button
                onClick={handleStartNow}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-slate-950 text-white text-base font-semibold shadow-md hover:bg-slate-800 active:scale-98 transition-all cursor-pointer group"
              >
                <span>Start Now</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => setShowVideoModal(true)}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-white/90 hover:bg-white text-slate-900 border border-slate-200/80 shadow-xs text-base font-semibold transition-all cursor-pointer group"
              >
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                  <Play className="w-3 h-3 fill-current translate-x-0.5" />
                </span>
                <span>Watch Intro</span>
              </button>
            </div>

            {/* Stats Metrics Row */}
            <div className="w-full pt-8 border-t border-slate-200/70 grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Global Reach</p>
                <div className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  +200
                </div>
                <p className="text-xs text-slate-500">Platforms</p>
              </div>

              <div className="border-l border-slate-200/60 pl-4 sm:pl-8">
                <p className="text-xs font-medium text-slate-500 mb-1">For Artists</p>
                <div className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  100%
                </div>
                <p className="text-xs text-slate-500">Your Rights</p>
              </div>

              <div className="border-l border-slate-200/60 pl-4 sm:pl-8">
                <p className="text-xs font-medium text-slate-500 mb-1">Fast Delivery</p>
                <div className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  &lt; 7 Days
                </div>
                <p className="text-xs text-slate-500">To Stores</p>
              </div>
            </div>
          </div>

          {/* Right Visual Column (Phone + 3D Glass + Floating Platform Card) */}
          <div className="lg:col-span-5 relative flex items-center justify-center pt-8 lg:pt-0">
            {/* 3D Iridescent Liquid Ribbon Artwork in Background */}
            <div className="absolute -inset-4 sm:-inset-10 flex items-center justify-center pointer-events-none -z-10">
              <img
                src={heroFluidImg}
                alt=""
                className="w-full max-w-[550px] object-contain opacity-85 mix-blend-multiply filter contrast-105"
              />
            </div>

            {/* Interactive Phone Mockup */}
            <div className="relative z-20 transform hover:-translate-y-1 transition-transform duration-500">
              <StudioPhoneMockup />
            </div>

            {/* Floating "Available on" Glass Badge */}
            <div className="absolute top-6 right-0 sm:-right-6 md:-right-8 z-30 bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_15px_35px_-5px_rgba(15,23,42,0.12)] rounded-2xl p-4 w-44 sm:w-48 animate-in fade-in zoom-in-95 duration-700">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                Available on
              </p>
              <div className="space-y-2">
                {platforms.map((plat) => (
                  <div key={plat.name} className="flex items-center gap-2.5">
                    <span className="shrink-0">{plat.icon}</span>
                    <span className="text-xs font-semibold text-slate-800 leading-none">
                      {plat.name}
                    </span>
                  </div>
                ))}
                <div className="pt-1 border-t border-slate-100 flex items-center gap-1.5 text-slate-500 text-[11px] font-medium hover:text-slate-900 cursor-pointer">
                  <span>+ More</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Inline Video Player Panel (No popup rule compliant) */}
      {showVideoModal && (
        <div className="max-w-4xl mx-auto px-4 mt-12 animate-in fade-in duration-300">
          <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold">Tiwlo Studio Overview</h3>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
            <div className="relative aspect-video rounded-2xl bg-slate-900 flex flex-col items-center justify-center p-6 text-center border border-slate-800">
              <div className="w-16 h-16 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center mb-4 ring-8 ring-blue-500/10">
                <Disc className="w-8 h-8 animate-spin" />
              </div>
              <h4 className="text-xl font-bold mb-2">Welcome to Tiwlo Studio</h4>
              <p className="text-sm text-slate-400 max-w-md">
                Learn how independent creators distribute tracks to over 200 platforms worldwide while keeping 100% of master royalties and creative control.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
