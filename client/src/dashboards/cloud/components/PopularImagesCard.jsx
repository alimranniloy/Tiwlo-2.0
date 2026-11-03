import React from 'react';

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
            {images.map((img) => (
            <div
              key={img.id || img.name}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-700">
                  {(img.os || img.name || '?').slice(0, 2).toUpperCase()}
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
                onClick={() => onDeployImage?.(img.name)}
                className="px-2.5 py-1 rounded-lg bg-neutral-50/80 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-600 hover:text-white dark:hover:bg-neutral-600 dark:hover:text-white text-[11px] font-bold transition cursor-pointer"
              >
                Deploy
              </button>
            </div>
            ))}
          </div>
        ) : (
          <p className="py-5 text-center text-xs text-neutral-500">No image catalog data is available.</p>
        )}
      </div>
    </div>
  );
}
