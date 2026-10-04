import React from 'react';
import { X, Play, Sparkles } from 'lucide-react';

export default function VideoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl rounded-3xl overflow-hidden border border-white/20 bg-[#07090e] shadow-2xl shadow-indigo-950/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c101d]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-sm font-bold text-white">Tiwlo Cloud & E-Commerce Showcase</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas / Visual Player */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <img
            src="/landing/hero-devices.jpg"
            alt="Tiwlo Product Demo"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-600/90 border border-indigo-400/50 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/50 hover:scale-110 transition-transform cursor-pointer mb-4">
              <Play className="w-7 h-7 fill-white translate-x-0.5" />
            </div>
            <h4 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
              Next-Gen Commerce & Cloud Fabric
            </h4>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md">
              Discover how businesses launch stores in under 60 seconds and run high-capacity server instances with zero latency.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#0a0e1a] border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span>Official Tiwlo Release 2026</span>
          <span className="text-indigo-400 font-semibold">4K Ultra HD</span>
        </div>
      </div>
    </div>
  );
}
