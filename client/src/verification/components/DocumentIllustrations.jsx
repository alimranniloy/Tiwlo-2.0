import React from 'react';

/**
 * Authentic SVG Illustrations matching the reference design for:
 * 1. Passport (Navy/charcoal cover with gold crest & PASSPORT title)
 * 2. National ID Card (Emerald green card with photo, chip & credentials)
 * 3. Other Document (Government ID / Driver's License / Residence Permit card)
 * 4. Upload Hero Graphic (Passport + ID card with soft backdrop)
 */

export function PassportIcon({ className = "w-12 h-12" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        {/* Passport booklet body */}
        <rect x="2" y="2" width="44" height="52" rx="5" fill="#272727" />
        <rect x="4" y="4" width="40" height="48" rx="4" stroke="#D4AF37" strokeWidth="0.8" strokeOpacity="0.4" />

        {/* Gold Emblem Globe */}
        <circle cx="24" cy="22" r="9" stroke="#E6C65B" strokeWidth="1.2" strokeOpacity="0.9" fill="none" />
        <ellipse cx="24" cy="22" rx="4.5" ry="9" stroke="#E6C65B" strokeWidth="0.9" strokeOpacity="0.8" fill="none" />
        <line x1="15" y1="22" x2="33" y2="22" stroke="#E6C65B" strokeWidth="0.9" strokeOpacity="0.8" />
        <line x1="17" y1="17" x2="31" y2="17" stroke="#E6C65B" strokeWidth="0.7" strokeOpacity="0.7" />
        <line x1="17" y1="27" x2="31" y2="27" stroke="#E6C65B" strokeWidth="0.7" strokeOpacity="0.7" />

        {/* PASSPORT Text */}
        <text x="24" y="37" fill="#F3E5AB" fontSize="4.5" fontWeight="700" letterSpacing="0.8" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">
          PASSPORT
        </text>

        {/* Biometric symbol */}
        <rect x="21" y="42" width="6" height="4" rx="1" stroke="#E6C65B" strokeWidth="0.7" fill="none" />
        <line x1="19" y1="44" x2="29" y2="44" stroke="#E6C65B" strokeWidth="0.7" />
        <circle cx="24" cy="44" r="1" fill="#E6C65B" />
      </svg>
    </div>
  );
}

export function NationalIdIcon({ className = "w-12 h-12" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 54 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        {/* ID Card Base */}
        <rect x="1" y="1" width="52" height="38" rx="5" fill="#0D5C3A" />
        <rect x="1" y="1" width="52" height="38" rx="5" stroke="#10B981" strokeWidth="0.8" strokeOpacity="0.4" />

        {/* Header bar */}
        <rect x="1" y="1" width="52" height="7" rx="5" fill="#09432A" />
        <rect x="5" y="3.5" width="16" height="2" rx="1" fill="#A7F3D0" fillOpacity="0.8" />

        {/* Photo Box */}
        <rect x="5" y="11" width="13" height="17" rx="2" fill="#e7e7e7" />
        <circle cx="11.5" cy="16.5" r="3.2" fill="#727272" />
        <path d="M7 26C7 23.5 9 22 11.5 22C14 22 16 23.5 16 26H7Z" fill="#727272" />

        {/* Chip */}
        <rect x="21" y="12" width="7" height="5" rx="1" fill="#FCD34D" />
        <line x1="24.5" y1="12" x2="24.5" y2="17" stroke="#B45309" strokeWidth="0.5" />

        {/* Info lines */}
        <rect x="21" y="20" width="26" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="21" y="24" width="20" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
        <rect x="21" y="28" width="14" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.5" />

        {/* Security Hologram Circle */}
        <circle cx="43" cy="14" r="3" fill="#34D399" fillOpacity="0.4" />
      </svg>
    </div>
  );
}

export function OtherDocumentIcon({ className = "w-12 h-12" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 54 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        {/* Card Base */}
        <rect x="1" y="1" width="52" height="38" rx="5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />

        {/* Header Band */}
        <rect x="2" y="2" width="50" height="7" rx="3" fill="#334155" />
        <rect x="6" y="4.5" width="18" height="2" rx="1" fill="#E2E8F0" />
        <circle cx="46" cy="5.5" r="1.5" fill="#1ED760" />

        {/* Portrait Box */}
        <rect x="5" y="12" width="13" height="17" rx="2" fill="#E2E8F0" />
        <circle cx="11.5" cy="17.5" r="3.1" fill="#64748B" />
        <path d="M7.2 27C7.2 24.5 9.1 23 11.5 23C13.9 23 15.8 24.5 15.8 27H7.2Z" fill="#64748B" />

        {/* Credential Lines */}
        <rect x="22" y="14" width="24" height="2.4" rx="1.2" fill="#1E293B" fillOpacity="0.85" />
        <rect x="22" y="19.5" width="18" height="2" rx="1" fill="#64748B" fillOpacity="0.7" />
        <rect x="22" y="24.5" width="21" height="2" rx="1" fill="#94A3B8" fillOpacity="0.7" />

        {/* Bottom MRZ / Card Number Strip */}
        <rect x="5" y="32" width="44" height="2.5" rx="1" fill="#CBD5E1" />
      </svg>
    </div>
  );
}

export function UploadHeroIllustration({ className = "w-44 h-36" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Soft Blue Organic Blob Background */}
      <div className="absolute inset-0 bg-neutral-100/70 rounded-full blur-xl scale-95 -z-0" />
      <svg viewBox="0 0 180 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10">
        <defs>
          <linearGradient id="blobGrad" x1="20" y1="20" x2="160" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8e8e8" />
            <stop offset="1" stopColor="#f5f5f5" />
          </linearGradient>
          <filter id="cardShadow" x="0" y="0" width="180" height="130" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#171717" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Soft decorative background shape */}
        <path
          d="M35 60C30 30 65 15 105 18C145 21 165 45 158 80C151 115 120 125 78 120C36 115 40 90 35 60Z"
          fill="url(#blobGrad)"
        />

        {/* Floating Tilted Passport (Left) */}
        <g transform="translate(38, 25) rotate(-12)" filter="url(#cardShadow)">
          <rect width="60" height="82" rx="7" fill="#3a3a3a" />
          <rect x="3" y="3" width="54" height="76" rx="5" stroke="#FDE047" strokeWidth="0.8" strokeOpacity="0.5" />
          <circle cx="30" cy="38" r="12" stroke="#FDE047" strokeWidth="1.2" fill="none" strokeOpacity="0.9" />
          <ellipse cx="30" cy="38" rx="6" ry="12" stroke="#FDE047" strokeWidth="1" fill="none" strokeOpacity="0.8" />
          <line x1="18" y1="38" x2="42" y2="38" stroke="#FDE047" strokeWidth="1" strokeOpacity="0.8" />
          <text x="30" y="58" fill="#FEF08A" fontSize="5.5" fontWeight="700" letterSpacing="1" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">
            PASSPORT
          </text>
        </g>

        {/* Floating Tilted National ID Card (Right) */}
        <g transform="translate(90, 48) rotate(8)" filter="url(#cardShadow)">
          <rect width="72" height="48" rx="6" fill="#FFFFFF" stroke="#e7e7e7" strokeWidth="1" />
          <rect x="6" y="6" width="60" height="7" rx="3" fill="#7b7b7b" fillOpacity="0.85" />
          {/* Photo frame */}
          <rect x="7" y="17" width="18" height="23" rx="3" fill="#e7e7e7" />
          <circle cx="16" cy="24" r="4" fill="#a1a1a1" />
          <path d="M10 36C10 32.5 13 31 16 31C19 31 22 32.5 22 36H10Z" fill="#a1a1a1" />
          {/* Detail lines */}
          <rect x="29" y="18" width="34" height="3" rx="1.5" fill="#171717" fillOpacity="0.75" />
          <rect x="29" y="24" width="26" height="2.5" rx="1" fill="#727272" fillOpacity="0.6" />
          <rect x="29" y="30" width="20" height="2" rx="1" fill="#a1a1a1" fillOpacity="0.5" />
          <rect x="29" y="35" width="14" height="2" rx="1" fill="#d4d4d4" />
        </g>
      </svg>
    </div>
  );
}
