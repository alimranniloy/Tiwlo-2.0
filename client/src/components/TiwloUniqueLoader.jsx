import React, { useState, useEffect } from 'react';

/**
 * Tiwlo Typography Logo (Pure Text "tiwlo." with trailing blue dot)
 * Optically centered: Word "tiwlo" is strictly centered on the X-axis (x=78 in viewBox 160x52),
 * and the blue dot rests naturally on the right baseline without shifting the word off-center.
 */
export function TiwloTextLogo({ className = '', isDrawing = true }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 160 52"
        className="w-auto h-11 sm:h-13 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Optically Centered Word "tiwlo" on the 50% centerline */}
        <text
          x="78"
          y="39"
          textAnchor="middle"
          className={`fill-[#0A1128] dark:fill-white stroke-[#0A1128] dark:stroke-white ${
            isDrawing ? 'tiwlo-text-draw' : ''
          }`}
        >
          tiwlo
        </text>

        {/* Trailing Accent Dot (Positioned naturally after 'o' without biasing word center) */}
        <circle
          cx="134"
          cy="37"
          r="3.2"
          className={isDrawing ? 'tiwlo-logo-dot-draw' : ''}
          fill="#0066FF"
          stroke="#0066FF"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}

// Backwards compatibility aliases
export const TiwloVectorLogo = TiwloTextLogo;

/**
 * Tiwlo Compact Indeterminate Circular Spinner
 * Smooth, 100% borderless, compact rotating arc with expanding/contracting stroke dash.
 * Themed to Tiwlo's official palette: #0066FF (Electric Blue), #38BDF8 (Sky Cyan), #0B57D0 (Deep Cloud Blue), #2563EB (Royal Blue).
 * NO background card borders, NO grey container boxes.
 */
export function TiwloMaterialSpinner({
  size = 34,
  strokeWidth = 3.2,
  variant = 'theme', // 'theme' (Tiwlo 4-blue morph) | 'blue' (solid Tiwlo electric blue)
  className = ''
}) {
  return (
    <div
      className={`inline-block relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        className="google-spinner w-full h-full"
        viewBox="0 0 66 66"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle borderless background circular track (Google soft pale blue track) */}
        <circle
          className="text-[#E8F0FE]"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          cx="33"
          cy="33"
          r="28"
        />
        {/* Dynamic indeterminate animated arc with Tiwlo theme color transitions */}
        <circle
          className={variant === 'blue' ? 'google-spinner-blue-path' : 'google-spinner-path'}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          cx="33"
          cy="33"
          r="28"
        />
      </svg>
    </div>
  );
}

// Backwards compatibility aliases
export const GoogleMaterialSpinner = TiwloMaterialSpinner;
export const MorphLoader = TiwloMaterialSpinner;

/**
 * Tiwlo 4-Dots Pulse (Website Theme Colors: #0066FF, #38BDF8, #0B57D0, #2563EB)
 */
export function TiwloDotPulse({ className = '' }) {
  return (
    <div className={`tiwlo-dot-pulse ${className}`}>
      <div className="tiwlo-dot" />
      <div className="tiwlo-dot" />
      <div className="tiwlo-dot" />
      <div className="tiwlo-dot" />
    </div>
  );
}

// Backwards compatibility alias
export const GoogleFourDots = TiwloDotPulse;

/**
 * Clean Borderless Refresh Indicator (No boxes, no cards, no borders)
 */
export function TiwloRefreshBadge({ size = 38, spinnerSize = 22 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center shrink-0"
    >
      <TiwloMaterialSpinner size={spinnerSize} strokeWidth={3.0} />
    </div>
  );
}

export const GoogleRefreshBadge = TiwloRefreshBadge;

/**
 * Tiwlo Minimalist Linear Progress Bar (Top Browser Progress Beam)
 */
export function TiwloTopSyncBar({ active = false }) {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none">
      <div className="google-linear-progress" />
    </div>
  );
}

/**
 * Tiwlo Google UI-Inspired Page Loader
 * Pure solid white background (#FFFFFF) per user design guidelines.
 * Compact Tiwlo brand circular spinner with clean brand wordmark.
 * Minimalist, polished, responsive, and spacious with zero network latency.
 */
export function TiwloPageLoader({
  showTopBar = false,
  message = '',
  className = '',
  fullScreen = true
}) {
  const containerClasses = fullScreen
    ? `fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden bg-white ${className}`
    : `w-full h-full min-h-[300px] flex flex-col items-center justify-center select-none bg-white p-6 ${className}`;

  return (
    <div
      className={containerClasses}
      onContextMenu={(e) => e.preventDefault()}
      role="status"
      aria-label="Loading Tiwlo"
    >
      {showTopBar && (
        <div className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none">
          <div className="google-linear-progress" />
        </div>
      )}

      <div className="flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150">
        {/* Compact Indeterminate Circular Spinner in Tiwlo Brand Color (No Text, No Logo) */}
        <TiwloMaterialSpinner size={28} strokeWidth={2.8} variant="theme" />
      </div>
    </div>
  );
}

/**
 * Compact Tiwlo Spinner for Buttons, Tables, Cards & Modals
 */
export function TiwloSpinner({ size = 'md', className = '', variant = 'theme' }) {
  const sizeMap = {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 44
  };

  const s = typeof size === 'number' ? size : (sizeMap[size] || 24);
  const stroke = s < 22 ? 2.8 : s < 30 ? 3.0 : 3.2;

  return (
    <div className={`inline-flex items-center justify-center ${className} shrink-0`}>
      <GoogleMaterialSpinner size={s} strokeWidth={stroke} variant={variant} />
    </div>
  );
}

export default TiwloPageLoader;
