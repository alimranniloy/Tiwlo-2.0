import React, { useState, useEffect } from 'react';

/**
 * UidsHero Component
 * Minimized, compact and beautifully proportioned per user feedback:
 * - Headline with smooth typewriter animation cycling through systems:
 *   "A small name for [startup MVPs. | developer tools. | AI agent apps. | indie SaaS. | creative portfolios.]"
 * - Compact typography and spacing (no huge awkward height).
 */
export default function UidsHero() {
  const systems = [
    'startup MVPs.',
    'developer tools.',
    'AI agent apps.',
    'indie SaaS.',
    'creative portfolios.',
    'side projects.'
  ];

  const [systemIndex, setSystemIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 480);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typewriter animation cycling through systems
  useEffect(() => {
    const currentWord = systems[systemIndex];
    const speed = isDeleting ? 40 : 85;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        const next = currentWord.substring(0, displayText.length + 1);
        setDisplayText(next);

        if (next === currentWord) {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        const prev = currentWord.substring(0, displayText.length - 1);
        setDisplayText(prev);

        if (prev === '') {
          setIsDeleting(false);
          setSystemIndex((idx) => (idx + 1) % systems.length);
        }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, systemIndex]);

  return (
    <div className="relative w-full pt-6 sm:pt-10 pb-3 px-4 sm:px-6 select-none text-center">
      <div className="max-w-3xl mx-auto relative">
        {/* Core Headline - Compact, crisp and enhanced */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
          <div>A small name</div>
          <div className="mt-1 flex items-center justify-center flex-wrap">
            <span>for&nbsp;</span>
            <span className="text-[#00C261] font-extrabold">
              {displayText || systems[0]}
            </span>
            <span
              className={`inline-block w-[2.5px] sm:w-[3px] h-[26px] sm:h-[38px] bg-slate-900 ml-1 rounded-full transition-opacity duration-100 ${
                cursorVisible ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
            />
          </div>
        </h1>

        {/* Subtitle - Minimized and clean */}
        <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-slate-600 max-w-lg mx-auto leading-relaxed font-normal">
          Get a clean, short and memorable subdomain on <span className="font-semibold text-slate-800">uids.app</span> and start building in seconds.
        </p>
      </div>
    </div>
  );
}
