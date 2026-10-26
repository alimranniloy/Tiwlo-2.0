import React from 'react';
import {
  BarChart3,
  Globe2,
  ShieldCheck,
  Zap,
  Play,
  Sparkles
} from 'lucide-react';
import artistImg from '../assets/imru-artist.jpg';

export default function StudioForArtists({ onNavigateAuth, onNavigateTab }) {
  const features = [
    {
      id: 'analytics',
      title: 'Real-Time',
      subtitle: 'Analytics',
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />
    },
    {
      id: 'audience',
      title: 'Global',
      subtitle: 'Audience',
      icon: <Globe2 className="w-5 h-5 text-blue-600" />
    },
    {
      id: 'rights',
      title: '100%',
      subtitle: 'Your Rights',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />
    },
    {
      id: 'reliable',
      title: 'Fast',
      subtitle: '& Reliable',
      icon: <Zap className="w-5 h-5 text-blue-600" />
    }
  ];

  return (
    <section id="for-artists" className="py-20 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">

          {/* Column 1 (Left): Artist Showcase Visual Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/4.5] sm:aspect-[4/4.2] rounded-[36px] overflow-hidden shadow-2xl border border-slate-200/50 group select-none">
              {/* Artist High-Res Photo */}
              <img
                src={artistImg}
                alt="Independent Artist"
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              />

              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/30 via-transparent to-purple-900/20" />

              {/* Top Left Signature */}
              <div className="absolute top-6 left-6">
                <span className="font-serif italic text-2xl sm:text-3xl font-light text-white/90 tracking-wide drop-shadow-md">
                  Imru
                </span>
              </div>

              {/* Bottom Card Footer with Slogan and Play Button */}
              <div className="absolute bottom-6 inset-x-6 flex items-end justify-between z-10">
                <div className="max-w-[200px] sm:max-w-[240px]">
                  <p className="text-lg sm:text-xl font-bold text-white leading-tight drop-shadow-md">
                    Independent Artists.
                    <br />
                    Global Dreams.
                  </p>
                </div>

                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <Play className="w-5 h-5 fill-current translate-x-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 (Center): Feature Highlights */}
          <div className="lg:col-span-4 flex flex-col items-start">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 shadow-2xs mb-5 text-blue-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>For Artists</span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-950 tracking-tight leading-[1.15] mb-4">
              More Than Just
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                Distribution
              </span>
            </h2>

            {/* Description */}
            <p className="text-base text-slate-600 leading-relaxed mb-8">
              Tiwlo Studio gives you the freedom to focus on what you do best — creating music.
            </p>

            {/* 4 Feature Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 w-full">
              {features.map((feat) => (
                <div key={feat.id} className="flex flex-col items-center text-center p-2">
                  <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 shadow-2xs hover:bg-blue-100/70 transition-colors">
                    {feat.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {feat.title}
                  </span>
                  <span className="text-xs text-slate-500 leading-tight">
                    {feat.subtitle}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 (Right): Testimonial Quote Card */}
          <div className="lg:col-span-3">
            <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-b from-blue-50/60 via-slate-50/70 to-white border border-slate-200/70 shadow-sm relative">
              {/* Blue accent indicator line */}
              <div className="w-8 h-1 bg-blue-500 rounded-full mb-6" />

              {/* Quote */}
              <blockquote className="text-sm sm:text-base font-medium text-slate-700 leading-relaxed mb-8">
                “Tiwlo Studio helps independent artists reach the world without limits.”
              </blockquote>

              {/* Author Profile */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shadow-2xs shrink-0">
                  <img
                    src={artistImg}
                    alt="IMRU"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    IMRU
                  </h4>
                  <p className="text-xs text-slate-500">Artist</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
