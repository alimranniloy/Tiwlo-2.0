import React, { useState, useEffect } from 'react';

/**
 * UidsHero Component
 * Updated per user instructions:
 * - Removed THE UIDS NAMESPACE badge.
 * - Removed duplicate HTML/SVG doodles (already present inside the background graphic).
 * - Sized headline harmoniously with dynamic typewriter animation:
 *   "A small name for [dynamic text]|"
 * - Subtitle centered and readable.
 */
export default function UidsHero() {
  const words = [
    'big ideas.',
    'next projects.',
    'indie apps.',
    'creator portfolios.',
    'developer tools.',
    'startup MVPs.'
  ];

  const [wordIndex, setWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typewriter animation
  useEffect(() => {
    const currentWord = words[wordIndex];
    const typingSpeed = isDeleting ? 45 : 95;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        const nextText = currentWord.substring(0, displayText.length + 1);
        setDisplayText(nextText);

        if (nextText === currentWord) {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 1800);
        }
      } else {
        // Deleting backward
        const prevText = currentWord.substring(0, displayText.length - 1);
        setDisplayText(prevText);

        if (prevText === '') {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, wordIndex]);

  return (
    <div className="relative w-full pt-10 sm:pt-16 pb-6 px-4 sm:px-6 select-none text-center">
      <div className="max-w-4xl mx-auto relative">
        {/* Core Title */}
        <h1 className="text-3xl sm:text-5xl md:text-[54px] lg:text-[60px] font-extrabold tracking-tight text-slate-900 leading-[1.12] sm:leading-[1.1]">
          <div>A small name</div>
          <div className="mt-1 sm:mt-2 min-h-[1.2em] flex items-center justify-center flex-wrap">
            <span>for&nbsp;</span>
            <span className="text-[#00C261] font-extrabold">
              {displayText || words[0]}
            </span>
            <span
              className={`inline-block w-[3px] sm:w-[3.5px] h-[30px] sm:h-[46px] bg-slate-900 ml-1 rounded-full transition-opacity duration-100 ${
                cursorVisible ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
            />
          </div>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed font-normal">
          Get a clean, short and memorable subdomain on <span className="font-semibold text-slate-800">uids.app</span> and start building in seconds.
        </p>
      </div>
    </div>
  );
}
