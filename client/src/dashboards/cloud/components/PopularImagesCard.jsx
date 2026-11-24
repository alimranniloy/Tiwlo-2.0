import React from 'react';

const OS_ICON_MAP = {
  ubuntu: '/os-icons/ubuntu.svg',
  debian: '/os-icons/debian.svg',
  almalinux: '/os-icons/almalinux.svg',
  fedora: '/os-icons/fedora.svg',
  docker: '/os-icons/docker.svg',
  lemp: '/os-icons/nginx.svg',
  nginx: '/os-icons/nginx.svg',
  nodejs: '/os-icons/nodejs.svg',
  tpanel: '/tiwlo-icon.png'
};

export default function PopularImagesCard({ images = [], onDeployImage }) {
  return (
    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#181818] border border-neutral-200/70 dark:border-gray-800 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-400 uppercase tracking-wider">
            Popular images
          </h3>
          <button
            type="button"
            onClick={() => onDeployImage?.()}
            className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-700 cursor-pointer"
          >
            View all
          </button>
        </div>

        {images.length > 0 ? (
          <div className="space-y-3">
            {images.map((img) => {
              const iconKey = String(img.icon || img.os || '').trim().toLowerCase();
              const iconSrc = img.iconUrl || OS_ICON_MAP[iconKey] || null;
              return (
                <div
                  key={img.id || img.name}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700/60 text-[10px] font-bold text-neutral-700 dark:text-neutral-200">
                      {iconSrc ? (
                        <img
                          src={iconSrc}
                          alt={img.os || img.name}
                          className={`size-5 object-contain ${iconSrc.includes('almalinux') ? 'dark:invert' : ''}`}
                        />
                      ) : (
                        (img.os || img.name || '?').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                        {img.name}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-medium">
                        {[img.os, img.version].filter(Boolean).join(' · ') || 'Operating system image'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={img.available === false}
                    onClick={() => img.available !== false && onDeployImage?.(img.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      img.available === false
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                        : 'bg-[#1ED760]/15 text-[#0f7a37] dark:text-[#1ED760] hover:bg-[#1ED760] hover:text-black cursor-pointer'
                    }`}
                  >
                    {img.available === false ? 'Unavailable' : 'Deploy'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-5 text-center text-xs text-neutral-500">No image catalog data is available.</p>
        )}
      </div>
    </div>
  );
}
