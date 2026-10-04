import React, { useState } from 'react';
import { RefreshCw, ArrowRight, AlertTriangle, LayoutDashboard, Copy, Check, HelpCircle } from 'lucide-react';
import { getAuthUrl } from '../utils/navigation';

export default function ServerErrorView({ error, onReload, onNavigate }) {
  const [logoError, setLogoError] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasSession = typeof window !== 'undefined' &&
    !!localStorage.getItem('stockpro_session') &&
    !!localStorage.getItem('stockpro_user');

  const errorMessage = typeof error === 'string'
    ? error
    : (error?.message || 'Internal Server or Client Runtime Exception');

  const handleReload = () => {
    if (onReload) {
      onReload();
    } else {
      window.location.reload();
    }
  };

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

  const handleCopyDiagnostics = () => {
    const diagText = `[Tiwlo Platform Error 500]\nTime: ${new Date().toISOString()}\nPath: ${window.location.pathname}\nError: ${errorMessage}\nStack: ${error?.stack || 'N/A'}`;
    navigator.clipboard?.writeText(diagText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
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

      {/* 2. MAIN GOOGLE 500 CONTENT AREA */}
      <main className="flex-1 max-w-[1080px] mx-auto w-full px-6 sm:px-12 py-12 sm:py-20 flex flex-col-reverse md:flex-row items-center justify-between gap-12 lg:gap-16">
        
        {/* Left Column: Exact Google 500 Phrasing & Controls */}
        <div className="flex-1 text-left w-full max-w-xl">
          {/* Signature Headline */}
          <h1 className="text-[26px] sm:text-[32px] font-normal text-[#202124] dark:text-[#f1f3f4] tracking-tight leading-tight mb-4">
            <span className="font-bold text-[#1f1f1f] dark:text-white">500.</span> That’s an error.
          </h1>

          {/* Core Explanation */}
          <p className="text-[15px] sm:text-[16px] text-[#3c4043] dark:text-[#bdc1c6] leading-relaxed mb-2">
            The server encountered an error and was unable to complete your request.
          </p>

          {/* Signature Subtext */}
          <p className="text-[15px] sm:text-[16px] text-[#5f6368] dark:text-[#9aa0a6] font-normal mb-6">
            If the problem persists, please report your problem and try again later. That’s all we know.
          </p>

          {/* Google Cloud Style Incident Diagnostic Card */}
          {error && (
            <div className="mb-8 p-4 rounded-xl bg-[#f8f9fa] dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e8eaed] dark:border-[#303134] text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#d93025] dark:text-[#f28b82]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Incident Diagnostics
                </span>
                <button
                  type="button"
                  onClick={handleCopyDiagnostics}
                  className="inline-flex items-center gap-1 text-[11px] text-[#0b57d0] dark:text-[#8ab4f8] hover:underline cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-[#137333]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy details</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-[12px] font-mono text-[#d93025] dark:text-[#f28b82] break-all select-all leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Material 3 Google Pill Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReload}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white text-[14px] font-medium shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>

            <button
              onClick={handleGoHome}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#747775] text-[#0b57d0] dark:text-[#8ab4f8] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] active:bg-[#f1f3f4] text-[14px] font-medium transition-colors cursor-pointer"
            >
              <span>Back to Home</span>
            </button>

            {hasSession && (
              <button
                onClick={handleGoDashboard}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#747775] text-[#0b57d0] dark:text-[#8ab4f8] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] active:bg-[#f1f3f4] text-[14px] font-medium transition-colors cursor-pointer"
              >
                <span>Console</span>
              </button>
            )}
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
                Support Center
              </button>
              <span className="text-[#dadce0] dark:text-[#3c4043]">•</span>
              <button
                onClick={handleReload}
                className="hover:underline cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Google 500 Maintenance Repair Robot Vector Graphic */}
        <div className="shrink-0 flex items-center justify-center select-none w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 relative">
          <svg
            viewBox="0 0 320 320"
            className="w-full h-full drop-shadow-sm"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="robotBodyGrad500" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8F9FA" />
                <stop offset="100%" stopColor="#E8EAED" />
              </linearGradient>
              <linearGradient id="robotScreenGrad500" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#202124" />
                <stop offset="100%" stopColor="#17181B" />
              </linearGradient>
              <linearGradient id="wrenchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="100%" stopColor="#0B57D0" />
              </linearGradient>
            </defs>

            {/* Base Pedestal / Soft Shadow */}
            <ellipse cx="160" cy="290" rx="90" ry="12" fill="#E8EAED" className="dark:fill-[#2A2B2E]" opacity="0.8" />

            {/* Antenna with Flashing Red Warning Light */}
            <line x1="160" y1="56" x2="160" y2="30" stroke="#5F6368" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="160" cy="24" r="9" fill="#EA4335" stroke="#C5221F" strokeWidth="2.5" />
            <circle cx="158" cy="21" r="3" fill="#FAD2CF" />

            {/* Left & Right Mechanical Ears */}
            <rect x="74" y="90" width="16" height="34" rx="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />
            <circle cx="82" cy="107" r="3" fill="#5F6368" />
            <rect x="230" y="90" width="16" height="34" rx="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />
            <circle cx="238" cy="107" r="3" fill="#5F6368" />

            {/* Robot Head */}
            <rect
              x="88"
              y="56"
              width="144"
              height="102"
              rx="20"
              fill="url(#robotBodyGrad500)"
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
              fill="url(#robotScreenGrad500)"
            />

            {/* Warning Triangle In Visor Screen */}
            <polygon points="160,82 176,108 144,108" fill="#FBBC04" stroke="#EA4335" strokeWidth="1.5" />
            <text x="160" y="105" textAnchor="middle" fill="#202124" fontSize="13" fontWeight="900" fontFamily="sans-serif">!</text>

            {/* Concerned Slanted Eyebrow Details */}
            <line x1="116" y1="84" x2="136" y2="89" stroke="#BDC1C6" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="204" y1="84" x2="184" y2="89" stroke="#BDC1C6" strokeWidth="2.5" strokeLinecap="round" />

            {/* Slotted Mouth */}
            <line x1="140" y1="138" x2="180" y2="138" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" />

            {/* Neck Joint */}
            <rect x="144" y="158" width="32" height="12" rx="4" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2.5" />

            {/* Robot Torso / Chassis */}
            <rect
              x="98"
              y="170"
              width="124"
              height="94"
              rx="18"
              fill="url(#robotBodyGrad500)"
              className="dark:fill-[#2D2F31]"
              stroke="#5F6368"
              strokeWidth="4"
            />

            {/* Left Arm Conduit Resting */}
            <path d="M98 190 C65 190, 60 225, 80 248" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="81" cy="249" r="6" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2" />

            {/* Right Arm Conduit Raised Holding Tool */}
            <path d="M222 190 C250 185, 260 160, 245 140" stroke="#5F6368" strokeWidth="4" strokeLinecap="round" fill="none" />
            <circle cx="245" cy="140" r="7" fill="#BDC1C6" stroke="#5F6368" strokeWidth="2" />

            {/* Google Blue Service Wrench in Hand */}
            <g transform="translate(236, 105) rotate(25)">
              <rect x="0" y="15" width="10" height="42" rx="4" fill="url(#wrenchGrad)" stroke="#1A73E8" strokeWidth="1.5" />
              <path d="M -4 15 C -4 4, 14 4, 14 15 C 14 11, 7 11, 7 18 L 3 18 C 3 11, -4 11, -4 15 Z" fill="url(#wrenchGrad)" stroke="#1A73E8" strokeWidth="1.5" />
            </g>

            {/* Center Maintenance Hatch / Gear Display */}
            <rect
              x="120"
              y="186"
              width="80"
              height="40"
              rx="8"
              fill="#FFFFFF"
              className="dark:fill-[#1E1F20]"
              stroke="#EA4335"
              strokeWidth="2.5"
            />

            {/* Digital Error Code Display */}
            <text
              x="160"
              y="212"
              textAnchor="middle"
              fill="#EA4335"
              fontSize="16"
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="2"
            >
              500
            </text>

            {/* Internal Gears / Rebooting Circuit */}
            <circle cx="140" cy="244" r="8" fill="none" stroke="#5F6368" strokeWidth="2.5" strokeDasharray="3 2" />
            <circle cx="160" cy="244" r="10" fill="none" stroke="#4285F4" strokeWidth="2.5" strokeDasharray="4 2" />
            <circle cx="180" cy="244" r="8" fill="none" stroke="#FBBC04" strokeWidth="2.5" strokeDasharray="3 2" />

            {/* Maintenance Ground Wire */}
            <path
              d="M160 264 C160 282, 175 285, 195 285 C215 285, 230 280, 240 285"
              stroke="#5F6368"
              strokeWidth="3.5"
              strokeLinecap="round"
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
