import React from 'react';

/**
 * Authentic SVG Illustrations matching the reference design for:
 * 1. Passport (Navy blue cover with gold crest & PASSPORT title)
 * 2. National ID Card (Emerald green card with photo, chip & credentials)
 * 3. Aadhaar Card (Indian Aadhaar card with red/orange sunburst emblem)
 * 4. Upload Hero Graphic (Passport + ID card with soft blue backdrop)
 */

export function PassportIcon({ className = "w-12 h-12" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        {/* Passport booklet body */}
        <rect x="2" y="2" width="44" height="52" rx="5" fill="#142850" />
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
        <rect x="5" y="11" width="13" height="17" rx="2" fill="#E2E8F0" />
        <circle cx="11.5" cy="16.5" r="3.2" fill="#64748B" />
        <path d="M7 26C7 23.5 9 22 11.5 22C14 22 16 23.5 16 26H7Z" fill="#64748B" />

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

export function AadhaarIcon({ className = "w-12 h-12" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 54 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        {/* Card Base */}
        <rect x="1" y="1" width="52" height="38" rx="5" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1" />

        {/* Top Tricolor Strip */}
        <rect x="2" y="2" width="50" height="3" rx="2" fill="#F97316" />
        <rect x="2" y="5" width="50" height="2" fill="#FFFFFF" />
        <rect x="2" y="7" width="50" height="3" fill="#16A34A" />

        {/* Aadhaar Sunburst Graphic */}
        <g transform="translate(14, 23)">
          {/* Central circle */}
          <circle cx="0" cy="0" r="3.2" fill="#EA580C" />
          {/* Sun Rays */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
            <line
              key={i}
              x1="0"
              y1="-4"
              x2="0"
              y2="-6"
              stroke="#EA580C"
              strokeWidth="1"
              strokeLinecap="round"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>

        {/* Text lines simulating Aadhaar number & name */}
        <rect x="23" y="16" width="24" height="2.2" rx="1" fill="#1E293B" fillOpacity="0.8" />
        <rect x="23" y="21" width="18" height="2" rx="1" fill="#64748B" fillOpacity="0.7" />

        {/* Barcode representation */}
        <g transform="translate(23, 27)">
          <rect x="0" y="0" width="1" height="5" fill="#334155" />
          <rect x="2" y="0" width="1.5" height="5" fill="#334155" />
          <rect x="5" y="0" width="0.8" height="5" fill="#334155" />
          <rect x="7" y="0" width="2" height="5" fill="#334155" />
          <rect x="10.5" y="0" width="1" height="5" fill="#334155" />
          <rect x="13" y="0" width="1.8" height="5" fill="#334155" />
          <rect x="16" y="0" width="0.8" height="5" fill="#334155" />
          <rect x="18" y="0" width="1.5" height="5" fill="#334155" />
          <rect x="21" y="0" width="1" height="5" fill="#334155" />
        </g>
      </svg>
    </div>
  );
}

export function UploadHeroIllustration({ className = "w-44 h-36" }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Soft Blue Organic Blob Background */}
      <div className="absolute inset-0 bg-blue-100/70 rounded-full blur-xl scale-95 -z-0" />
      <svg viewBox="0 0 180 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10">
        <defs>
          <linearGradient id="blobGrad" x1="20" y1="20" x2="160" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#DBEAFE" />
            <stop offset="1" stopColor="#EFF6FF" />
          </linearGradient>
          <filter id="cardShadow" x="0" y="0" width="180" height="130" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Soft decorative background shape */}
        <path
          d="M35 60C30 30 65 15 105 18C145 21 165 45 158 80C151 115 120 125 78 120C36 115 40 90 35 60Z"
          fill="url(#blobGrad)"
        />

        {/* Floating Tilted Passport (Left) */}
        <g transform="translate(38, 25) rotate(-12)" filter="url(#cardShadow)">
          <rect width="60" height="82" rx="7" fill="#1E3A8A" />
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
          <rect width="72" height="48" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          <rect x="6" y="6" width="60" height="7" rx="3" fill="#3B82F6" fillOpacity="0.85" />
          {/* Photo frame */}
          <rect x="7" y="17" width="18" height="23" rx="3" fill="#E2E8F0" />
          <circle cx="16" cy="24" r="4" fill="#94A3B8" />
          <path d="M10 36C10 32.5 13 31 16 31C19 31 22 32.5 22 36H10Z" fill="#94A3B8" />
          {/* Detail lines */}
          <rect x="29" y="18" width="34" height="3" rx="1.5" fill="#0F172A" fillOpacity="0.75" />
          <rect x="29" y="24" width="26" height="2.5" rx="1" fill="#64748B" fillOpacity="0.6" />
          <rect x="29" y="30" width="20" height="2" rx="1" fill="#94A3B8" fillOpacity="0.5" />
          <rect x="29" y="35" width="14" height="2" rx="1" fill="#CBD5E1" />
        </g>
      </svg>
    </div>
  );
}
