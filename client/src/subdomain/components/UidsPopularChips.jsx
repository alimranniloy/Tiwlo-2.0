import React from 'react';

/**
 * UidsPopularChips Component
 * Google-inspired clean example pills with fast interaction
 */
export default function UidsPopularChips({ onSelectExample }) {
  const examples = [
    { name: 'ai', domain: 'ai.uids.app', dotColor: 'bg-emerald-500' },
    { name: 'dev', domain: 'dev.uids.app', dotColor: 'bg-blue-500' },
    { name: 'shop', domain: 'shop.uids.app', dotColor: 'bg-purple-500' },
    { name: 'studio', domain: 'studio.uids.app', dotColor: 'bg-amber-500' },
    { name: 'blog', domain: 'blog.uids.app', dotColor: 'bg-pink-500' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 text-xs">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
        POPULAR EXAMPLES
      </span>

      {examples.map((item) => (
        <button
          key={item.domain}
          type="button"
          onClick={() => onSelectExample && onSelectExample(item.name, '.uids.app')}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all duration-150 hover:-translate-y-0.5 active:scale-95"
        >
          <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0`} />
          <span className="font-medium text-slate-700 group-hover:text-slate-900 font-mono text-[12px]">
            {item.domain}
          </span>
        </button>
      ))}
    </div>
  );
}
