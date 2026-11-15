import React, { useEffect, useRef, useState } from 'react';
import { PLATFORM_DOMAIN } from '../config/platformConfig';

function parseRgbaColor(colorStr) {
  if (!colorStr || colorStr === 'transparent') return null;
  const match = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1
  };
}

function getColorLuminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function resolveElementBackgroundDarkness(startEl) {
  let el = startEl;
  while (el && el.nodeType === 1) {
    const style = window.getComputedStyle(el);
    const parsed = parseRgbaColor(style.backgroundColor);
    if (parsed && parsed.a >= 0.25) {
      return getColorLuminance(parsed) < 0.5;
    }
    el = el.parentElement;
  }
  return null;
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export default function FreeStoreAttribution({ isFreeStore = false }) {
  const badgeRef = useRef(null);
  const [isOverDark, setIsOverDark] = useState(false);

  useEffect(() => {
    if (!isFreeStore || typeof window === 'undefined') return undefined;

    let rafId = null;

    const evaluateContrast = () => {
      rafId = null;
      const badge = badgeRef.current;
      if (!badge) return;

      const badgeRect = badge.getBoundingClientRect();
      if (badgeRect.width === 0 || badgeRect.height === 0) return;

      const docIsDark = document.documentElement.classList.contains('dark');

      // 1. Check bounding rect overlap with any footer element (e.g. TiwiFooter bg-[#131313])
      const footers = document.querySelectorAll('footer');
      for (const footer of footers) {
        const footerRect = footer.getBoundingClientRect();
        if (rectsOverlap(badgeRect, footerRect)) {
          const footerDark = resolveElementBackgroundDarkness(footer);
          if (footerDark !== null) {
            setIsOverDark(footerDark);
            return;
          }
        }
      }

      // 2. Sample underlying elements at badge points via elementsFromPoint + luminance check
      const samplePoints = [
        [badgeRect.left + badgeRect.width * 0.5, badgeRect.top + badgeRect.height * 0.5],
        [badgeRect.left + badgeRect.width * 0.15, badgeRect.top + badgeRect.height * 0.5],
        [badgeRect.left + badgeRect.width * 0.85, badgeRect.top + badgeRect.height * 0.5]
      ];

      let darkHits = 0;
      let lightHits = 0;

      for (const [x, y] of samplePoints) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        const stack =
          typeof document.elementsFromPoint === 'function'
            ? document.elementsFromPoint(x, y)
            : [document.elementFromPoint(x, y)].filter(Boolean);

        const underlying = stack.find((el) => el && !badge.contains(el));
        if (!underlying) continue;

        // Check stack layers from front to back for an explicit background color first
        let pointDark = null;
        for (const layer of stack) {
          if (!layer || badge.contains(layer)) continue;
          const style = window.getComputedStyle(layer);
          const parsed = parseRgbaColor(style.backgroundColor);
          if (parsed && parsed.a >= 0.25) {
            pointDark = getColorLuminance(parsed) < 0.5;
            break;
          }
        }
        if (pointDark === null) {
          pointDark = resolveElementBackgroundDarkness(underlying);
        }

        if (pointDark === true) darkHits += 1;
        else if (pointDark === false) lightHits += 1;
      }

      if (darkHits > 0 || lightHits > 0) {
        setIsOverDark(darkHits >= lightHits);
        return;
      }

      setIsOverDark(docIsDark);
    };

    const scheduleEvaluation = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateContrast);
    };

    evaluateContrast();

    window.addEventListener('scroll', scheduleEvaluation, { passive: true, capture: true });
    window.addEventListener('resize', scheduleEvaluation, { passive: true });

    let intersectionObserver = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(scheduleEvaluation, {
        threshold: [0, 0.1, 0.5, 1]
      });
      document.querySelectorAll('footer').forEach((footer) => {
        intersectionObserver.observe(footer);
      });
    }

    const mutationObserver = new MutationObserver(() => {
      if (intersectionObserver) {
        document.querySelectorAll('footer').forEach((footer) => {
          intersectionObserver.observe(footer);
        });
      }
      scheduleEvaluation();
    });
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
      childList: true,
      subtree: true
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleEvaluation, { capture: true });
      window.removeEventListener('resize', scheduleEvaluation);
      intersectionObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, [isFreeStore]);

  if (!isFreeStore) return null;

  const platformHref = PLATFORM_DOMAIN ? `https://${PLATFORM_DOMAIN}` : 'https://tiwlo.com';

  return (
    <a
      ref={badgeRef}
      href={platformHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Free store · Created by Tiwlo"
      className={`fixed right-3 bottom-[68px] lg:bottom-4 lg:right-4 z-50 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[11px] font-medium transition-colors select-none ${
        isOverDark
          ? 'text-neutral-100 hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]'
          : 'text-neutral-800 hover:text-neutral-950'
      }`}
    >
      <img
        src="/favicon.png"
        alt=""
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 object-contain bg-transparent"
      />
      <span>Free store · Created by Tiwlo</span>
    </a>
  );
}
