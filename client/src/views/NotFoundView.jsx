import React, { useState } from 'react';
import { ArrowRight, HelpCircle, LayoutDashboard, Globe } from 'lucide-react';
import { getAuthUrl } from '../utils/navigation';

export default function NotFoundView({ onNavigate }) {
  const [logoError, setLogoError] = useState(false);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  const hasSession = typeof window !== 'undefined' &&
    !!localStorage.getItem('stockpro_session') &&
    !!localStorage.getItem('stockpro_user');

  const handleGoHome = () => {
    if (onNavigate) {
      onNavigate('landing');
    } else {
      window.location.href = '/';
    }
  };

  const handleGoDashboard = () => {
    if (hasSession) {
      if (onNavigate) {
        onNavigate('dashboard');
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      if (onNavigate) {
        onNavigate('login');
      } else {
        window.location.href = getAuthUrl('/login');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#1f1f1f] text-[#202124] dark:text-[#e8eaed] font-sans flex flex-col justify-between selection:bg-[#0b57d0] selection:text-white antialiased transition-colors duration-200">
      
      {/* 1. GOOGLE CLOUD STYLE TOP NAVIGATION BAR */}
      <header className="w-full bg-white dark:bg-[#1f1f1f] border-b border-[#dadce0] dark:border-[#3c4043] px-6 sm:px-12 py-3 flex items-center justify-between sticky top-0 z-30">
        {/* Brand Logo & Platform Identifier */}
        <div
          onClick={handleGoHome}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
          title="Tiwlo Cloud Platform"
        >
          {!logoError ? (
            <>
              <img
                src="/tiwlologo.png"
                alt="Tiwlo"
                onError={() => setLogoError(true)}
                className="h-6 sm:h-7 w-auto object-contain dark:hidden transition-transform group-hover:scale-[1.02]"
              />
              <img
                src="/tiwlologo-dark.png"
                alt="Tiwlo"
                onError={() => setLogoError(true)}
                className="h-6 sm:h-7 w-auto object-contain hidden dark:block transition-transform group-hover:scale-[1.02]"
              />
            </>
          ) : (
            <span className="text-[20px] font-semibold text-[#1f1f1f] dark:text-[#f1f3f4] tracking-tight">
              Tiwlo
            </span>
          )}
          <span className="text-[13px] font-normal text-[#5f6368] dark:text-[#9aa0a6] pl-2.5 border-l border-[#dadce0] dark:border-[#3c4043] hidden sm:inline-block leading-none">
            Cloud
          </span>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
            <span>Help</span>
          </button>

          <button
            onClick={handleGoDashboard}
            className="inline-flex items-center gap-1.5 bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white px-4 py-1.5 rounded-full text-[13px] font-medium shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer"
          >
            {hasSession ? (
              <>
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Console</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN GOOGLE 404 CONTENT AREA */}
      <main className="flex-1 max-w-[1080px] mx-auto w-full px-6 sm:px-12 py-12 sm:py-20 flex flex-col-reverse md:flex-row items-center justify-between gap-12 lg:gap-16">
        
        {/* Left Column: Exact Google 404 Phrasing & Material Pill Controls */}
        <div className="flex-1 text-left w-full max-w-xl">
          {/* Signature Headline */}
          <h1 className="text-[26px] sm:text-[32px] font-normal text-[#202124] dark:text-[#f1f3f4] tracking-tight leading-tight mb-4">
            <span className="font-bold text-[#1f1f1f] dark:text-white">404.</span> That’s an error.
          </h1>

          {/* Requested URL context */}
          <p className="text-[15px] sm:text-[16px] text-[#3c4043] dark:text-[#bdc1c6] leading-relaxed mb-2 break-all">
            The requested URL{' '}
            <code className="bg-[#f1f3f4] dark:bg-[#303134] text-[#0b57d0] dark:text-[#8ab4f8] px-2 py-0.5 rounded font-mono text-[14px] font-medium select-all">
              {currentPath || '/'}
            </code>{' '}
            was not found on this server.
          </p>

          {/* Signature Subtext */}
          <p className="text-[15px] sm:text-[16px] text-[#5f6368] dark:text-[#9aa0a6] font-normal mb-8">
            That’s all we know.
          </p>

          {/* Material 3 Google Pill Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleGoHome}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white text-[14px] font-medium shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer"
            >
              <span>Back to Home</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleGoDashboard}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#747775] text-[#0b57d0] dark:text-[#8ab4f8] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] active:bg-[#f1f3f4] text-[14px] font-medium transition-colors cursor-pointer"
            >
              <span>{hasSession ? 'Go to Console' : 'Sign In'}</span>
            </button>
          </div>

          {/* Helpful Google-style quick navigations */}
          <div className="mt-10 pt-6 border-t border-[#dadce0] dark:border-[#3c4043]">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#747775] dark:text-[#9aa0a6] mb-3">
              Helpful links
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#0b57d0] dark:text-[#8ab4f8]">
              <button
                onClick={handleGoHome}
                className="hover:underline cursor-pointer"
              >
                Platform Overview
              </button>
              <span className="text-[#dadce0] dark:text-[#3c4043]">•</span>
              <button
                onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
                className="hover:underline cursor-pointer"
              >
                Help Center
              </button>
              <span className="text-[#dadce0] dark:text-[#3c4043]">•</span>
              <button
                onClick={() => onNavigate ? onNavigate('pricing') : window.location.href = '/pricing'}
                className="hover:underline cursor-pointer"
              >
                Plans & Pricing
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Authentic Google Broken Robot Vector Graphic */}
        <div className="shrink-0 flex items-center justify-center select-none w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 relative">
          <svg
            viewBox="0 0 320 320"
            className="w-full h-full drop-shadow-sm"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8F9FA" />
                <stop offset="100%" stopColor="#E8EAED" />
              </linearGradient>
              <linearGradient id="robotScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#202124" />
                <stop offset="100%" stopColor="#17181B" />
              </linearGradient>
              <linearGradient id="blueAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="100%" stopColor="#0B57D0" />
              </linearGradient>
              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Base Pedestal / Soft Shadow */}
            <ellipse cx="160" cy="290" rx="90" ry="12" fill="#E8EAED" className="dark:fill-[#2A2B2E]" opacity="0.8" />

            {/* Antenna with Amber/Red Warning Light */}
            <line x1="160" y1="56" x2="160" y2="30" stroke="#5F6368" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="160" cy="24" r="9" fill="#FBBC04" stroke="#EA4335" strokeWidth="2.5" />
            <circle cx="158" cy="21" r="3" fill="#FFF7CC" />

            {/* Left & Right Mechanical Ears */}
            <rect x="74" y="90" width="16" height="34" rx="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />
            <circle cx="82" cy="107" r="3" fill="#5F6368" />
            <rect x="230" y="90" width="16" height="34" rx="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />
            <circle cx="238" cy="107" r="3" fill="#5F6368" />

            {/* Robot Head (Rounded Google Rectangle) */}
            <rect
              x="88"
              y="56"
              width="144"
              height="102"
              rx="20"
              fill="url(#robotBodyGrad)"
              className="dark:fill-[#2D2F31]"
              stroke="#5F6368"
              strokeWidth="4"
            />

            {/* Dark Visor / Display Screen */}
            <rect
              x="106"
              y="74"
              width="108"
              height="48"
              rx="12"
              fill="url(#robotScreenGrad)"
            />

            {/* Left Eye: Disconnected 'X' Mark (Google Blue) */}
            <path d="M125 89 L141 105" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M141 89 L125 105" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round" />

            {/* Right Eye: Disconnected 'X' Mark (Google Blue) */}
            <path d="M179 89 L195 105" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M195 89 L179 105" stroke="#4285F4" strokeWidth="3.5" strokeLinecap="round" />

            {/* Cute Slotted Mouth */}
            <line x1="142" y1="138" x2="178" y2="138" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" />

            {/* Neck Joint */}
            <rect x="144" y="158" width="32" height="12" rx="4" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />

            {/* Robot Torso / Chassis */}
            <rect
              x="98"
              y="170"
              width="124"
              height="94"
              rx="18"
              fill="url(#robotBodyGrad)"
              className="dark:fill-[#2D2F31]"
              stroke="#5F6368"
              strokeWidth="4"
            />

            {/* Left Arm Conduit */}
            <path d="M98 190 C65 190, 60 225, 80 248" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="81" cy="249" r="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2" />

            {/* Right Arm Conduit */}
            <path d="M222 190 C255 190, 260 225, 240 248" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="239" cy="249" r="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2" />

            {/* Center Maintenance Hatch / Gauge Plate */}
            <rect
              x="120"
              y="186"
              width="80"
              height="40"
              rx="8"
              fill="#FFFFFF"
              className="dark:fill-[#1E1F20]"
              stroke="#0B57D0"
              strokeWidth="2.5"
            />

            {/* Digital Error Code Display */}
            <text
              x="160"
              y="212"
              textAnchor="middle"
              fill="#0B57D0"
              fontSize="16"
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="2"
            >
              404
            </text>

            {/* Internal Google Colored Wires Exposed Under Plate */}
            <path d="M132 232 C132 245, 142 248, 148 245" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M152 232 C152 248, 160 250, 166 242" stroke="#EA4335" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M170 232 C170 246, 178 248, 184 240" stroke="#FBBC04" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M188 232 C188 244, 192 246, 196 240" stroke="#34A853" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Disconnected Trailing Power Cable Snaking to the Floor */}
            <path
              d="M160 264 C160 285, 205 285, 215 275 C225 265, 245 270, 255 285"
              stroke="#3C4043"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Unplugged 2-Pin Wall Plug Lying on Ground */}
            <rect x="254" y="278" width="16" height="12" rx="3" fill="#202124" />
            <line x1="270" y1="281" x2="278" y2="281" stroke="#BDC1C6" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="270" y1="287" x2="278" y2="287" stroke="#BDC1C6" strokeWidth="2.5" strokeLinecap="round" />

            {/* Tiny Amber Energy Spark */}
            <path
              d="M282 277 L287 281 L282 284 L289 288"
              stroke="#FBBC04"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </main>

      {/* 3. CLEAN GOOGLE CLOUD STYLE FOOTER */}
      <footer className="w-full border-t border-[#dadce0] dark:border-[#3c4043] px-6 sm:px-12 py-4 bg-white dark:bg-[#1f1f1f] text-[12px] text-[#5f6368] dark:text-[#9aa0a6] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Tiwlo. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
            className="hover:underline cursor-pointer"
          >
            Help
          </button>
          <button
            onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
            className="hover:underline cursor-pointer"
          >
            Privacy
          </button>
          <button
            onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
            className="hover:underline cursor-pointer"
          >
            Terms
          </button>
          <button
            onClick={() => onNavigate ? onNavigate('help-support') : window.location.href = '/help-support'}
            className="hover:underline cursor-pointer"
          >
            Status
          </button>
        </div>
      </footer>
    </div>
  );
}
