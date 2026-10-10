import React, { useState, useEffect } from 'react';

/**
 * UidsHero Component
 * Exactly matches screenshot:
 * - Eyebrow badge: ● THE UIDS NAMESPACE
 * - Big headline: "A small name / for big ideas.|"
 * - Hand-drawn doodle annotations on left and right with curved arrows
 * - Subheadline: "Get a clean, short and memorable subdomain on uids.app and start building in seconds."
 * - Floating subtle accent cubes / frosted cards
 */
export default function UidsHero() {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full pt-8 sm:pt-12 pb-6 px-4 sm:px-6 select-none text-center">
      {/* Decorative Subtle Background Floating Elements (Pixel squares & Frosted Glass from screenshot) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        {/* Left Floating Frosted Glass Card */}
        <div className="hidden lg:block absolute left-4 xl:left-12 top-6 w-36 h-48 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-xl shadow-slate-200/40 -rotate-12 transition-transform duration-700 hover:rotate-0" />

        {/* Right Floating Frosted Glass Card */}
        <div className="hidden lg:block absolute right-4 xl:right-12 top-10 w-44 h-56 rounded-3xl bg-white/40 backdrop-blur-md border border-white/60 shadow-xl shadow-emerald-100/40 rotate-12 transition-transform duration-700 hover:rotate-0" />

        {/* Subtle Pixel Accent Dots (Emerald & Slate) */}
        <div className="absolute left-[8%] top-[25%] w-3 h-3 bg-[#00C261]/40 rounded-sm" />
        <div className="absolute left-[12%] top-[32%] w-4 h-4 bg-[#00C261]/30 rounded-sm" />
        <div className="absolute left-[15%] top-[20%] w-3 h-3 bg-slate-300/40 rounded-sm" />

        <div className="absolute right-[12%] top-[18%] w-3.5 h-3.5 bg-[#00C261]/40 rounded-sm" />
        <div className="absolute right-[15%] top-[30%] w-3 h-3 bg-[#00C261]/25 rounded-sm" />
        <div className="absolute right-[18%] top-[24%] w-4 h-4 bg-slate-300/40 rounded-sm" />
      </div>

      <div className="max-w-4xl mx-auto relative">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50/90 border border-emerald-200/70 shadow-xs mb-6 sm:mb-8">
          <span className="w-2 h-2 rounded-full bg-[#00C261] animate-pulse" />
          <span className="text-[11px] sm:text-xs font-bold text-emerald-900 tracking-widest uppercase">
            THE UIDS NAMESPACE
          </span>
        </div>

        {/* Main Headline Container with Doodle Annotations */}
        <div className="relative">
          {/* Left Hand-Drawn Doodle Annotation: "Short. Clean. Yours." */}
          <div className="hidden md:flex flex-col items-end absolute -left-2 sm:-left-6 lg:-left-16 top-0 -rotate-3 text-slate-800">
            <div className="text-right font-['Caveat',cursive] text-lg lg:text-xl font-bold leading-tight tracking-wide text-slate-800">
              <div>Short.</div>
              <div>Clean.</div>
              <div>Yours.</div>
            </div>
            {/* Curved Hand-Drawn Arrow pointing down-right */}
            <svg
              className="w-12 h-12 lg:w-14 lg:h-14 mt-1 text-slate-800"
              viewBox="0 0 60 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 12 10 Q 18 38 48 42"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 40 36 L 48 42 L 44 50"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {/* Right Hand-Drawn Doodle Annotation: "Build something great here." */}
          <div className="hidden md:flex flex-col items-start absolute -right-2 sm:-right-6 lg:-right-16 top-2 rotate-3 text-slate-800">
            <div className="text-left font-['Caveat',cursive] text-lg lg:text-xl font-bold leading-tight tracking-wide text-slate-800">
              <div>Build</div>
              <div>something</div>
              <div>great here.</div>
            </div>
            {/* Curved Hand-Drawn Arrow pointing down-left */}
            <svg
              className="w-12 h-12 lg:w-14 lg:h-14 mt-1 text-slate-800"
              viewBox="0 0 60 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 48 10 Q 42 38 12 42"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 20 36 L 12 42 L 16 50"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          {/* Core Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] sm:leading-[1.06]">
            <div>A small name</div>
            <div className="inline-flex items-center">
              <span>for&nbsp;</span>
              <span className="text-[#00C261]">big ideas.</span>
              <span
                className={`inline-block w-[3px] sm:w-[4px] h-[36px] sm:h-[58px] bg-slate-900 ml-1 transition-opacity duration-150 ${
                  cursorVisible ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              />
            </div>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-[19px] text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
          Get a clean, short and memorable subdomain on <span className="font-semibold text-slate-800">uids.app</span> and start building in seconds.
        </p>
      </div>
    </div>
  );
}
