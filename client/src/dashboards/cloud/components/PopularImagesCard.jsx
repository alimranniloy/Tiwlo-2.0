import React from 'react';

export default function PopularImagesCard({ onDeployImage }) {
  const images = [
    {
      id: 'ubuntu',
      name: 'Ubuntu 22.04 LTS',
      os: 'Ubuntu',
      color: '#E95420',
      svg: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#E95420]">
          <circle cx="12" cy="12" r="10" fill="#E95420" />
          <circle cx="12" cy="5" r="2" fill="white" />
          <circle cx="6" cy="16" r="2" fill="white" />
          <circle cx="18" cy="16" r="2" fill="white" />
        </svg>
      )
    },
    {
      id: 'debian',
      name: 'Debian 12',
      os: 'Debian',
      color: '#A81D33',
      svg: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" fill="#D70A53" />
          <path d="M12 7c-2.76 0-5 2.24-5 5 0 2.21 1.44 4.09 3.44 4.74.28.09.56-.12.56-.41v-1.1c0-.21-.13-.39-.33-.47-1.1-.44-1.89-1.52-1.89-2.76 0-1.65 1.35-3 3-3s3 1.35 3 3c0 .83-.34 1.58-.88 2.12-.15.15-.15.4 0 .55l.78.78c.15.15.4.15.55 0C16.32 14.65 17 13.41 17 12c0-2.76-2.24-5-5-5z" fill="white" />
        </svg>
      )
    },
    {
      id: 'centos',
      name: 'CentOS 8',
      os: 'CentOS',
      color: '#93227F',
      svg: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" fill="#262577" />
          <rect x="7" y="7" width="4" height="4" fill="#E54E27" />
          <rect x="13" y="7" width="4" height="4" fill="#93227F" />
          <rect x="7" y="13" width="4" height="4" fill="#4B9038" />
          <rect x="13" y="13" width="4" height="4" fill="#ECB018" />
        </svg>
      )
    },
    {
      id: 'almalinux',
      name: 'AlmaLinux 9',
      os: 'AlmaLinux',
      color: '#0F2D6B',
      svg: (
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" fill="#0F2D6B" />
          <path d="M8 8h3v8H8zm5 0h3v8h-3z" fill="#00C9FF" />
        </svg>
      )
    }
  ];

  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-gray-800 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Popular images
          </h3>
          <button
            onClick={() => onDeployImage?.('Ubuntu 22.04 LTS')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer"
          >
            View all
          </button>
        </div>

        <div className="space-y-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                  {img.svg}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {img.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {img.os}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDeployImage?.(img.name)}
                className="px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white text-[11px] font-bold transition cursor-pointer"
              >
                Deploy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
