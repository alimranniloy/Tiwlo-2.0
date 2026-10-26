import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function StudioFooter({ onNavigateAuth, onNavigateTab }) {
  const handleGetStarted = () => {
    if (onNavigateAuth) {
      onNavigateAuth('signup');
    } else if (onNavigateTab) {
      onNavigateTab('create-account');
    } else {
      window.location.href = '/create-account';
    }
  };

  return (
    <footer className="pt-12 pb-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top Rounded Banner Card */}
        <div className="rounded-3xl bg-slate-100/80 border border-slate-200/70 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-12 shadow-xs">

          {/* Left: Brand & Tagline */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-xs shrink-0">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-950 tracking-tight leading-none mb-1">
                Tiwlo Studio
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Music Level • Distribution
              </p>
            </div>
          </div>

          {/* Center: Mission Mantra */}
          <div className="text-center text-sm font-medium text-slate-600 tracking-wide">
            Create <span className="text-slate-400 mx-1.5">•</span> Level Up{' '}
            <span className="text-slate-400 mx-1.5">•</span> Go Global
          </div>

          {/* Right: CTA Button */}
          <div>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-950 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 transition-all cursor-pointer group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Bottom Legal & Socials Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-200/50 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Tiwlo Studio. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#privacy"
              className="hover:text-slate-900 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Privacy
            </a>
            <a
              href="#terms"
              className="hover:text-slate-900 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Terms
            </a>
            <a
              href="#contact"
              className="hover:text-slate-900 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Contact
            </a>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4 text-slate-700">
            {/* YouTube */}
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-950 transition-colors"
              aria-label="YouTube"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>

            {/* Spotify */}
            <a
              href="https://spotify.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-950 transition-colors"
              aria-label="Spotify"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-950 transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>

            {/* X (Twitter) */}
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-950 transition-colors"
              aria-label="X"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
