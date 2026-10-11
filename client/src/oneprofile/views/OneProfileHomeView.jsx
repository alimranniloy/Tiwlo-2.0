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
 * - Top Hero Banner: "Your Identity, Your Website." + Laptop & NFC Card mockup
 * - Metrics Row (4 cards): Subdomains, Profile Views, Storage Used, Active Template
 * - Middle Row: Your Website (Live preview & action buttons) + Quick Actions (4 colored tiles)
 * - Bottom Row: Popular Templates (4 items) + Cloud Hosting + NFC Business Card
 */
export default function OneProfileHomeView({ currentUser, summary, onNavigateTab }) {
  const displayName = currentUser?.name || currentUser?.email || 'Your profile';
  const primaryDomain = summary?.domains?.[0]?.domain || 'No domain claimed';
  const profileAvatar = currentUser?.avatar || '/tiwlo-icon.png';
  const metrics = summary?.metrics || {};
  const primaryWebsite = summary?.websites?.[0];
  const profileHeadline = summary?.profile?.headline || 'Profile headline not configured';

  return (
    <div className="w-full space-y-4 sm:space-y-5 pb-12 text-left">
      {/* 
        ========================================================================
        1. WELCOME HERO BANNER (Top Card)
        ========================================================================
      */}
      <div className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-7 lg:p-8 bg-gradient-to-r from-[#F0F5FE] via-[#EBF2FE] to-[#F5F8FF] border border-[#E0EAFD] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Ambient subtle fluid wave in background */}
        <div className="absolute inset-0 pointer-events-none opacity-45">
          <svg className="w-full h-full" viewBox="0 0 1000 300" fill="none" preserveAspectRatio="none">
            <path d="M0,80 C200,160 380,20 540,90 C700,160 880,40 1000,100 L1000,300 L0,300 Z" fill="url(#hero-wave-grad)" />
            <defs>
              <linearGradient id="hero-wave-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.18" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
          {/* Left Text & CTA Buttons */}
          <div className="max-w-xl">
            <div className="text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-1.5">
              WELCOME TO UIDS.APP
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-2.5">
              <span>Your Identity, </span>
              <br className="hidden sm:inline" />
              <span className="text-[#2563EB]">Your Website.</span>
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed font-normal mb-5 max-w-md">
              Create your free subdomain, build a beautiful website, and share it with the world — all in one place.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('subdomains')}
                className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-[13px] shadow-xs hover:shadow transition-all duration-150 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Subdomain</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('templates')}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold text-xs sm:text-[13px] shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-95"
              >
                <LayoutGrid className="w-4 h-4 text-slate-600" />
                <span>Browse Templates</span>
              </button>
            </div>
          </div>

          {/* Right Mockup: Laptop Preview & Overlapping NFC Card */}
          <div className="relative shrink-0 w-full max-w-md lg:max-w-[430px] flex items-center justify-center lg:justify-end pr-3 pb-3">
            {/* Laptop / Browser Mockup Card */}
            <div className="relative w-full max-w-[340px] sm:max-w-[370px] bg-white rounded-2xl shadow-xl shadow-blue-500/10 border border-slate-200/80 overflow-hidden transform -rotate-1 hover:rotate-0 transition-transform duration-300">
              {/* Window Header */}
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF5F56]" />
                  <span className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
                  <span className="w-2 h-2 rounded-full bg-[#27C93F]" />
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-md py-0.5 px-2 text-[9px] font-mono text-slate-500 flex items-center gap-1 truncate justify-center">
                  <span>🔍</span>
                  <span className="truncate">{primaryDomain}</span>
                </div>
              </div>

              {/* Profile Body */}
              <div className="p-4 flex flex-col items-center text-center bg-white">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-blue-500/20 shadow-xs mb-1.5">
                  <img
                    src={profileAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="font-extrabold text-xs text-slate-900">{displayName}</div>
                <div className="text-[10px] text-slate-400 mb-2">{summary?.profile?.headline || 'Profile headline not configured'}</div>
                
                {/* Social Icons row */}
                <div className="flex items-center gap-1.5 text-slate-400">
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-700 font-bold">𝕏</div>
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-700 font-bold">gh</div>
                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[8px] text-blue-700 font-bold">in</div>
                  <div className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center text-[8px] text-pink-700 font-bold">🏀</div>
                  <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-[8px] text-red-700 font-bold">▶</div>
                </div>
              </div>
            </div>

            {/* Overlapping NFC Smart Card (Vertical) */}
            <div className="absolute -right-1 sm:right-0 -bottom-3 sm:-bottom-2 w-28 sm:w-32 h-44 sm:h-48 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2.5 flex flex-col justify-between rotate-6 transform hover:rotate-3 transition-transform">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <UidisLogoIcon className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-extrabold text-slate-900">UIDs.app</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="w-14 h-14 mx-auto bg-slate-50 border border-slate-100 rounded-lg p-1 flex items-center justify-center">
                <QrCode className="w-full h-full text-slate-900" />
              </div>

              {/* Details & Wave */}
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-900 leading-tight">{displayName}</div>
                <div className="text-[8px] text-slate-400 leading-tight">Tap to connect</div>
              </div>

              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto shadow-2xs">
                <Wifi className="w-3 h-3 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        2. METRICS ROW (4 Stat Cards - Exact same design, icon on left)
        ========================================================================
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Subdomains */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('subdomains')}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#EBF2FE] text-[#2563EB] flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Subdomains</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">{metrics.domains ?? 0}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                  <span>Active</span>
                </span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Card 2: Profile Views */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('analytics')}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#E6F8F0] text-[#059669] flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Profile Views</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">{Number(metrics.views || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Card 3: Storage Used */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('hosting')}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
            <div className="w-11 h-11 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-slate-400">Storage Used</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900 leading-none">—</span>
                <span className="text-[11px] text-slate-400">not measured</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-[#9333EA] rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 self-end mb-1 shrink-0">—</span>
        </div>

        {/* Card 4: Active Template */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('templates')}
          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400">Active Template</div>
              <div className="mt-0.5">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">{primaryWebsite?.template_id ? 1 : 0}</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>

      {/* 
        ========================================================================
        3. MIDDLE ROW: Your Website (Left 50%) + Quick Actions (Right 50%)
        ========================================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Left Card: Your Website (50%) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            {/* Header: Exact match to screenshot - Only Title and Live badge */}
            <div className="flex items-center gap-2 mb-3.5">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Your Website</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                <span>Live</span>
              </span>
            </div>

            {/* Inner Content: Website Preview on Left (flex-1) + Action Column on Right */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-3.5">
              {/* Framed Website Mini-Preview Card */}
              <div className="flex-1 min-w-0 rounded-xl border border-slate-100 bg-[#F8FAFC] p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 overflow-hidden">
                {/* Profile Card Summary */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Hi, I'm</div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight mt-0.5 truncate">{displayName}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-1 truncate">{profileHeadline}</div>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 leading-snug mb-2 line-clamp-2">
                    {summary?.profile?.bio || 'Add a bio in settings to describe your profile.'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[8px] font-bold">Contact Me</span>
                    <div className="flex items-center gap-1 text-slate-400 text-[9px]">
                      <span className="font-bold">𝕏</span>
                      <span className="font-bold">in</span>
                      <span className="font-bold">🌐</span>
                    </div>
                  </div>
                </div>

                {/* Authenticated profile portrait */}
                <div className="w-20 sm:w-24 h-24 sm:h-28 rounded-xl overflow-hidden bg-slate-200 shrink-0 shadow-2xs">
                  <img
                    src={profileAvatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Right Action Column: Link on Top, Buttons Stacked - Guaranteed no wrapping */}
              <div className="w-full sm:w-36 md:w-40 shrink-0 flex flex-col justify-between gap-2 text-left">
                {/* Domain Link matching screenshot */}
                <a
                  href={primaryDomain === 'No domain claimed' ? '#' : `https://${primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-start gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  <span className="truncate">{primaryDomain}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                {/* Primary: Edit Website */}
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('website')}
                  className="w-full py-2 px-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition active:scale-95 shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit Website</span>
                </button>

                {/* Secondary: Change Template - Guaranteed no wrapping */}
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('templates')}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition active:scale-95"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Change Template</span>
                </button>

                {/* Row: View Site + More Options */}
                <div className="flex items-center gap-1.5 w-full">
                  <a
                    href={primaryDomain === 'No domain claimed' ? '#' : `https://${primaryDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 whitespace-nowrap transition text-center"
                  >
                    <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>View Site</span>
                  </a>

                  <button
                    type="button"
                    className="p-1.5 w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0 transition"
                    title="More options"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Quick Actions (50%) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mb-3 text-left">
              Quick Actions
            </h3>

            {/* 2x2 Grid of Actions matching screenshot colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Tile 1: Create Subdomain (Blue) */}
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('subdomains')}
                className="p-3 rounded-xl bg-[#F0F6FE] border border-[#E1EEFD] hover:border-blue-200 text-left transition-all duration-150 group flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Create Subdomain</div>
                    <div className="text-[10px] text-slate-500 truncate">Get your free .uids.app</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#2563EB] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Tile 2: Browse Templates (Purple) */}
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('templates')}
                className="p-3 rounded-xl bg-[#FAF5FF] border border-[#F3E8FF] hover:border-purple-200 text-left transition-all duration-150 group flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#9333EA] flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Browse Templates</div>
                    <div className="text-[10px] text-slate-500 truncate">Use beautiful templates</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9333EA] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Tile 3: Connect Hosting (Green) */}
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('hosting')}
                className="p-3 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] hover:border-emerald-200 text-left transition-all duration-150 group flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#16A34A] flex items-center justify-center shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Connect Hosting</div>
                    <div className="text-[10px] text-slate-500 truncate">Link to our cloud or server</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#16A34A] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>

              {/* Tile 4: Order NFC Card (Orange) */}
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('nfc')}
                className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FEF3C7] hover:border-amber-200 text-left transition-all duration-150 group flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Order NFC Card</div>
                    <div className="text-[10px] text-slate-500 truncate">Get your physical card</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#D97706] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        4. BOTTOM ROW: Popular Templates (50%) + Cloud Hosting (25%) + NFC Card (25%)
        ========================================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Left Card: Popular Templates (Spans 2 cols / 50%) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Popular Templates</h3>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('templates')}
                className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-0.5"
              >
                <span>See all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Template Thumbnails Grid matching screenshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Template 1: Minimal */}
              <div className="flex flex-col rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                <div className="h-20 bg-slate-950 text-white p-2 flex flex-col items-center justify-center text-center select-none">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mb-1" />
                  <div className="text-[9px] font-bold">{displayName}</div>
                  <div className="text-[7px] text-slate-400">Designer & Developer</div>
                </div>
                <div className="p-2 text-left flex-1 flex flex-col justify-between bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">Minimal</div>
                    <div className="text-[10px] text-slate-400 truncate mb-2">Clean & simple</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab && onNavigateTab('templates')}
                    className="w-full py-1 text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition"
                  >
                    Use Template
                  </button>
                </div>
              </div>

              {/* Template 2: Creative Portfolio */}
              <div className="flex flex-col rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                <div className="h-20 bg-[#FAF7F2] text-slate-900 p-2 flex flex-col justify-between select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold">{displayName}</span>
                    <span className="text-[10px]">🌿</span>
                  </div>
                  <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded self-start">Showcase</span>
                </div>
                <div className="p-2 text-left flex-1 flex flex-col justify-between bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">Creative Portfolio</div>
                    <div className="text-[10px] text-slate-400 truncate mb-2">Showcase your work</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab && onNavigateTab('templates')}
                    className="w-full py-1 text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition"
                  >
                    Use Template
                  </button>
                </div>
              </div>

              {/* Template 3: Portfolio */}
              <div className="flex flex-col rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                <div className="h-20 bg-[#1E1B4B] text-white p-2 flex flex-col items-center justify-center text-center select-none">
                  <div className="text-[9px] font-bold">{displayName}</div>
                  <div className="text-[7px] text-indigo-300">Modern & professional</div>
                </div>
                <div className="p-2 text-left flex-1 flex flex-col justify-between bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">Portfolio</div>
                    <div className="text-[10px] text-slate-400 truncate mb-2">Modern & professional</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab && onNavigateTab('templates')}
                    className="w-full py-1 text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition"
                  >
                    Use Template
                  </button>
                </div>
              </div>

              {/* Template 4: Business */}
              <div className="flex flex-col rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                <div className="h-20 bg-[#F0F6FA] text-slate-900 p-2 flex flex-col justify-between select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold">Business</span>
                    <span className="text-[10px]">🪴</span>
                  </div>
                  <span className="text-[7px] text-slate-500">Corporate site</span>
                </div>
                <div className="p-2 text-left flex-1 flex flex-col justify-between bg-white">
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">Business</div>
                    <div className="text-[10px] text-slate-400 truncate mb-2">Perfect for business</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab && onNavigateTab('templates')}
                    className="w-full py-1 text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] hover:bg-blue-100 rounded-lg transition"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Card: Cloud Hosting (Spans 1 col / 25%) */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Cloud className="w-4 h-4" />
                </div>
                <span>Cloud Hosting</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('hosting')}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-medium">Free Plan</div>
            <div className="flex items-baseline justify-between mt-0.5 mb-1.5">
              <div className="text-base font-extrabold text-slate-900">
                200 MB <span className="text-xs font-normal text-slate-500">Storage</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">24% used</span>
            </div>

            {/* Blue Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3.5">
              <div className="h-full bg-[#2563EB] rounded-full" style={{ width: '24%' }} />
            </div>

            {/* Checklist matching screenshot */}
            <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium mb-4">
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
              onClick={() => onNavigateTab && onNavigateTab('hosting')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition active:scale-95"
            >
              <span>Upgrade for Node.js</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Right Card: NFC Business Card (Spans 1 col / 25%) */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#9333EA] flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span>NFC Business Card</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('nfc')}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="text-xs font-extrabold text-slate-900 mt-1 mb-0.5">
              Tap. Share. Connect.
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
              Turn your profile into a physical NFC business card.
            </p>

            {/* Split row: Checklist on left, realistic overlapping card mockups with New badge on right */}
            <div className="flex items-center justify-between gap-2 mb-3">
              {/* Checklist */}
              <ul className="space-y-1.5 text-[10px] text-slate-600 font-medium flex-1">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
                  <span>Share your digital profile</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
                  <span>Modern & premium design</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
                  <span>Custom branding</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3] shrink-0" />
                  <span>Worldwide shipping</span>
                </li>
              </ul>

              {/* Realistic NFC Overlapping Cards Mockup with New Badge */}
              <div className="relative shrink-0 w-24 h-24 flex flex-col items-end justify-center">
                <span className="absolute top-0 right-1 px-1.5 py-0.2 rounded-md bg-[#FEF2F2] text-[#EF4444] text-[9px] font-bold z-10">
                  New
                </span>
                <div className="relative w-20 h-16 mt-3">
                  {/* Back dark card */}
                  <div className="absolute left-0 bottom-0 w-16 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-between px-1.5 shadow-md -rotate-6">
                    <span className="text-[7px] font-bold">UIDs</span>
                    <Wifi className="w-2.5 h-2.5 text-slate-300 rotate-90" />
                  </div>
                  {/* Front white card */}
                  <div className="absolute right-0 bottom-1 w-16 h-11 rounded-lg bg-white border border-slate-200 text-slate-900 flex items-center justify-between px-1.5 shadow-lg rotate-6">
                    <QrCode className="w-3 h-3 text-slate-800" />
                    <Wifi className="w-2.5 h-2.5 text-[#2563EB] rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('nfc')}
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
