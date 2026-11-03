import React from 'react';

/**
 * UidsPopularChips Component
 * Compact, Google-inspired example pills with quick fill
 */
export default function UidsPopularChips({ onSelectExample }) {
  const examples = [
    { name: 'ai', domain: 'ai.uids.app', dotColor: 'bg-emerald-500' },
    { name: 'dev', domain: 'dev.uids.app', dotColor: 'bg-neutral-500' },
    { name: 'shop', domain: 'shop.uids.app', dotColor: 'bg-purple-500' },
    { name: 'studio', domain: 'studio.uids.app', dotColor: 'bg-amber-500' },
    { name: 'blog', domain: 'blog.uids.app', dotColor: 'bg-pink-500' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-3.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs">
      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-0.5">
        POPULAR:
      </span>

      {examples.map((item) => (
        <button
          key={item.domain}
          type="button"
          onClick={() => onSelectExample && onSelectExample(item.name, '.uids.app')}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/95 hover:bg-white border border-neutral-200 hover:border-neutral-300 shadow-2xs hover:shadow-xs transition-all duration-150 hover:-translate-y-0.5 active:scale-95"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${item.dotColor} shrink-0`} />
          <span className="font-medium text-neutral-700 group-hover:text-neutral-900 font-mono text-[11px]">
            {item.domain}
          </span>
        </button>
      ))}
    </div>
  );
}
