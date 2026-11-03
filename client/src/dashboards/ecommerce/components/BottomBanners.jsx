import React from 'react';
import { ArrowRight, BarChart3, Boxes, Sparkles } from 'lucide-react';

const banners = [
  {
    title: 'Manage your inventory',
    body: 'Review stock levels and keep your product catalog organized.',
    cta: 'Explore inventory',
    icon: Boxes,
    tone: 'ink',
    action: 'onExploreFeatures',
  },
  {
    title: 'Review store reports',
    body: 'Open your store reports and review the available business data.',
    cta: 'View reports',
    icon: BarChart3,
    tone: 'muted',
    action: 'onViewReport',
  },
  {
    title: 'Explore available plans',
    body: 'See the subscription options and features available to your store.',
    cta: 'View plans',
    icon: Sparkles,
    tone: 'primary',
    action: 'onUpgrade',
  },
];

export default function BottomBanners({ onExploreFeatures, onViewReport, onUpgrade }) {
  const actions = { onExploreFeatures, onViewReport, onUpgrade };

  return (
    <section aria-label="Store shortcuts" className="grid gap-4 md:grid-cols-3">
      {banners.map(({ title, body, cta, icon: Icon, tone, action }) => (
        <article
          key={title}
          className={`flex min-h-44 flex-col justify-between gap-6 rounded-3xl p-5 sm:p-6 ${
            tone === 'ink'
              ? 'bg-[#121212] text-white'
              : tone === 'primary'
                ? 'bg-[#1ed760] text-black'
                : 'bg-white text-neutral-950 ring-1 ring-neutral-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              <p className={`mt-1 text-sm ${tone === 'muted' ? 'text-neutral-600' : 'opacity-70'}`}>{body}</p>
            </div>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              tone === 'ink' ? 'bg-white/10' : tone === 'primary' ? 'bg-black/10' : 'bg-[#f1f1f1]'
            }`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </div>
          <button
            type="button"
            onClick={actions[action]}
            className={`inline-flex h-9 w-fit items-center gap-2 rounded-full px-4 text-xs font-bold transition ${
              tone === 'muted'
                ? 'bg-[#121212] text-white hover:bg-neutral-800'
                : tone === 'ink'
                  ? 'bg-[#1ed760] text-black hover:bg-[#18c755]'
                  : 'bg-[#121212] text-white hover:bg-neutral-800'
            }`}
          >
            {cta}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </article>
      ))}
    </section>
  );
}
