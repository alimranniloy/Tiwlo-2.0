import React from 'react';
import { 
  Plus, 
  ArrowRight, 
  LayoutGrid, 
  Globe, 
  Eye, 
  Database, 
  Layers, 
  ChevronRight, 
  ExternalLink, 
  Edit3, 
  MoreHorizontal, 
  Cloud, 
  CreditCard, 
  Check, 
  X as XIcon, 
  QrCode, 
  Wifi,
  Sparkles
} from 'lucide-react';
import UidisLogoIcon from '../components/UidisLogoIcon';

/**
 * OneProfileHomeView Component
 * Exact 100% clone of the user's provided screenshot:
 * 1. Hero banner: "Your Identity, Your Website." + laptop & NFC card mockup
 * 2. 4 Stat cards: Subdomains (2 Active), Profile Views (1.2K +12%), Storage Used (48MB/200MB), Active Template (1)
 * 3. Your Website live card + Quick Actions (4 tiles)
 * 4. Popular Templates (4 items) + Cloud Hosting + NFC Business Card
 */
export default function OneProfileHomeView({ onNavigateTab }) {
  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-12">
      {/* 
        ========================================================================
        1. WELCOME HERO BANNER (Top Card)
        ========================================================================
      */}
      <div className="relative rounded-3xl p-6 sm:p-8 lg:p-9 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-sky-50/80 border border-blue-100/90 shadow-2xs overflow-hidden">
        {/* Soft background ambient waves */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="w-full h-full" viewBox="0 0 1000 300" fill="none" preserveAspectRatio="none">
            <path d="M0,100 C150,180 350,20 500,100 C650,180 850,50 1000,120 L1000,300 L0,300 Z" fill="url(#wave-grad)" />
            <defs>
              <linearGradient id="wave-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Text & Actions */}
          <div className="max-w-xl text-left">
            <div className="text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-2">
              WELCOME TO UIDIS.APP
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-3">
              <span>Your Identity, </span>
              <span className="text-[#2563EB]">Your Website.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mb-6 max-w-lg">
              Create your free subdomain, build a beautiful website, and share it with the world — all in one place.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab('subdomains')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow transition-all duration-150 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Subdomain</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('templates')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold text-xs sm:text-sm shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-95"
              >
                <LayoutGrid className="w-4 h-4 text-slate-600" />
                <span>Browse Templates</span>
              </button>
            </div>
          </div>

          {/* Right Mockup Illustration (Laptop Preview & NFC Card) matching screenshot */}
          <div className="relative shrink-0 w-full max-w-md lg:max-w-[420px] flex items-center justify-center">
            {/* Laptop / Browser Mockup Card */}
            <div className="relative w-full bg-white rounded-2xl shadow-xl shadow-blue-500/10 border border-slate-200/90 overflow-hidden transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              {/* Browser Window Bar */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-md py-0.5 px-2 text-[10px] font-mono text-slate-500 flex items-center gap-1 truncate">
                  <span>🔍</span>
                  <span className="truncate">john.uidis.app</span>
                </div>
              </div>

              {/* Profile Body */}
              <div className="p-4 sm:p-5 flex flex-col items-center text-center bg-gradient-to-b from-white to-slate-50/50">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-blue-500/20 shadow-xs mb-2.5">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="John Doe"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366F1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <div className="font-extrabold text-sm text-slate-900">John Doe</div>
                <div className="text-[11px] text-slate-500 mb-2.5">Designer & Developer</div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-bold">𝕏</div>
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-bold">gh</div>
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-bold">in</div>
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-bold">🌐</div>
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-bold">yt</div>
                </div>
              </div>
            </div>

            {/* Floating NFC Card Mockup on the right */}
            <div className="absolute -right-3 -bottom-4 w-32 sm:w-36 rounded-2xl bg-white border border-slate-200/90 p-3 shadow-2xl shadow-slate-400/20 rotate-6 transform hover:rotate-3 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <UidisLogoIcon className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold text-slate-800">UIDis.app</span>
                </div>
              </div>
              <div className="w-12 h-12 mx-auto bg-slate-50 border border-slate-200 rounded-lg p-1 mb-2 flex items-center justify-center">
                <QrCode className="w-full h-full text-slate-800" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-900">John Doe</div>
                <div className="text-[8px] text-slate-500">Tap to connect</div>
              </div>
              <div className="mt-1 flex justify-center text-slate-400">
                <Wifi className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        2. METRICS ROW (4 Stat Cards)
        ========================================================================
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Subdomains */}
        <div 
          onClick={() => onNavigateTab('subdomains')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100/90 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Subdomains</div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">2</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Active</span>
            </span>
          </div>
        </div>

        {/* Card 2: Profile Views */}
        <div 
          onClick={() => onNavigateTab('analytics')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100/90 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Profile Views</div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">1.2K</span>
            <span className="text-[11px] font-bold text-emerald-600 flex items-center">
              ↑ 12%
            </span>
          </div>
        </div>

        {/* Card 3: Storage Used */}
        <div 
          onClick={() => onNavigateTab('hosting')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100/90 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 font-mono">24%</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Storage Used</div>
          <div className="text-sm sm:text-base font-extrabold text-slate-900 mb-1.5">
            48 MB <span className="text-xs font-normal text-slate-400">/ 200 MB</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: '24%' }} />
          </div>
        </div>

        {/* Card 4: Active Template */}
        <div 
          onClick={() => onNavigateTab('templates')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100/90 shadow-2xs hover:shadow-xs hover:border-slate-200 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1">Active Template</div>
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">1</span>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        3. MIDDLE ROW: Your Website (Left) + Quick Actions (Right)
        ========================================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Your Website (7 Columns) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Your Website</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Live</span>
                </span>
              </div>

              <a
                href="https://john.uidis.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <span>john.uidis.app</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Preview Banner */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5 mb-5">
              <div className="flex-1 text-left">
                <div className="text-xs text-slate-400 font-medium">Hi, I'm</div>
                <div className="text-lg font-extrabold text-slate-900">John Doe</div>
                <div className="text-xs font-semibold text-blue-600 mb-1.5">Designer & Developer</div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Building digital experiences that make an impact.
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-bold">Contact Me</span>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                    <span className="font-bold text-slate-700">𝕏</span>
                    <span className="font-bold text-slate-700">in</span>
                    <span className="font-bold text-slate-700">🌐</span>
                  </div>
                </div>
              </div>

              <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden bg-slate-200 shrink-0 shadow-2xs">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                  alt="John Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigateTab('website')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Website</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('templates')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Change Template</span>
            </button>

            <a
              href="https://john.uidis.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>View Site</span>
            </a>

            <button
              type="button"
              className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition ml-auto"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Card: Quick Actions (5 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 mb-4 text-left">
              Quick Actions
            </h3>

            {/* 2x2 Grid of Actions matching screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tile 1: Create Subdomain (Blue) */}
              <button
                type="button"
                onClick={() => onNavigateTab('subdomains')}
                className="p-3.5 rounded-xl bg-blue-50/50 hover:bg-blue-50 border border-blue-100/80 text-left transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-900">Create Subdomain</div>
                <div className="text-[11px] text-slate-500">Get your free .uidis.app</div>
              </button>

              {/* Tile 2: Browse Templates (Purple) */}
              <button
                type="button"
                onClick={() => onNavigateTab('templates')}
                className="p-3.5 rounded-xl bg-purple-50/50 hover:bg-purple-50 border border-purple-100/80 text-left transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-900">Browse Templates</div>
                <div className="text-[11px] text-slate-500">Use beautiful templates</div>
              </button>

              {/* Tile 3: Connect Hosting (Green) */}
              <button
                type="button"
                onClick={() => onNavigateTab('hosting')}
                className="p-3.5 rounded-xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/80 text-left transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-900">Connect Hosting</div>
                <div className="text-[11px] text-slate-500">Link to our cloud or server</div>
              </button>

              {/* Tile 4: Order NFC Card (Orange) */}
              <button
                type="button"
                onClick={() => onNavigateTab('nfc')}
                className="p-3.5 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-100/80 text-left transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-xs font-bold text-slate-900">Order NFC Card</div>
                <div className="text-[11px] text-slate-500">Get your physical card</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        4. BOTTOM ROW: Popular Templates + Cloud Hosting + NFC Business Card
        ========================================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Popular Templates (6 Columns) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Popular Templates</h3>
              <button
                type="button"
                onClick={() => onNavigateTab('templates')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>See all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Template Thumbnails Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'Minimal', desc: 'Clean & simple', bg: 'bg-slate-950 text-white' },
                { name: 'Creative Portfolio', desc: 'Showcase your work', bg: 'bg-emerald-50 text-slate-900' },
                { name: 'Portfolio', desc: 'Modern & professional', bg: 'bg-indigo-950 text-white' },
                { name: 'Business', desc: 'Perfect for business', bg: 'bg-blue-50 text-slate-900' },
              ].map((t, i) => (
                <div key={i} className="flex flex-col rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50">
                  {/* Thumbnail Mockup */}
                  <div className={`h-24 ${t.bg} p-2.5 flex flex-col justify-between select-none`}>
                    <div className="w-4 h-4 rounded-full bg-white/20" />
                    <div className="text-[9px] font-bold truncate opacity-80">{t.name}</div>
                  </div>
                  {/* Details & Button */}
                  <div className="p-2.5 bg-white text-left flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate">{t.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mb-2">{t.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('templates')}
                      className="w-full py-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 rounded-lg transition"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Cloud Hosting (3 Columns) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Cloud Hosting</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('hosting')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-medium">Free Plan</div>
            <div className="text-base font-extrabold text-slate-900 mt-1 mb-2">
              200 MB <span className="text-xs font-normal text-slate-500">Storage</span>
            </div>

            <div className="text-[10px] text-slate-500 mb-1 flex justify-between">
              <span>Usage</span>
              <span className="font-semibold text-slate-700">24% used</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '24%' }} />
            </div>

            {/* Checklist matching screenshot */}
            <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium mb-5">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Static website hosting</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>SSL certificate</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Free subdomain</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <XIcon className="w-3.5 h-3.5 text-rose-500 stroke-[3] shrink-0" />
                <span>No Node.js backend</span>
              </li>
            </ul>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onNavigateTab('billing')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition active:scale-95"
            >
              <span>Upgrade for Node.js</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Right Column: NFC Business Card (3 Columns) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                <CreditCard className="w-4 h-4 text-purple-600" />
                <span>NFC Business Card</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold">New</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('nfc')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Manage
                </button>
              </div>
            </div>

            <div className="text-sm font-extrabold text-slate-900 mt-1 mb-1">
              Tap. Share. Connect.
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3.5">
              Turn your profile into a physical NFC business card.
            </p>

            {/* Checklist matching screenshot */}
            <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium mb-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Share your digital profile</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Modern and premium design</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Custom branding</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                <span>Worldwide shipping</span>
              </li>
            </ul>

            {/* NFC Card Graphic Mockup */}
            <div className="relative h-16 rounded-xl bg-slate-50 border border-slate-100 p-2 flex items-center justify-center overflow-hidden mb-4">
              <div className="w-24 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-between px-3 shadow-md -rotate-6">
                <span className="text-[9px] font-bold">UIDis</span>
                <Wifi className="w-3 h-3 text-slate-300 rotate-90" />
              </div>
              <div className="w-24 h-12 rounded-lg bg-white border border-slate-200 text-slate-900 flex items-center justify-between px-3 shadow-lg rotate-6 -ml-8">
                <QrCode className="w-4 h-4 text-slate-800" />
                <Wifi className="w-3 h-3 text-blue-600 rotate-90" />
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onNavigateTab('nfc')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition active:scale-95"
            >
              <span>Order NFC Card</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
