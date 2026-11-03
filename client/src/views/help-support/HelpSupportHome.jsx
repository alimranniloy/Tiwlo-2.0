import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  FileText,
  Ticket,
  MessageSquare,
  BookOpen,
  Lightbulb,
  Headphones,
  ChevronRight
} from 'lucide-react';

export default function HelpSupportHome({ onNavigate, onContactSupport }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('help-center', { query: searchQuery.trim() });
    }
  };

  const navCards = [
    {
      id: 'help-center',
      title: 'Help Center',
      desc: 'Browse articles and find quick answers.',
      icon: FileText,
      active: false
    },
    {
      id: 'tickets',
      title: 'Tickets',
      desc: 'View your tickets or create a new one.',
      icon: Ticket,
      active: true // Highlighted active in reference design
    },
    {
      id: 'inbox',
      title: 'Support Inbox',
      desc: 'Chat with our support team directly.',
      icon: MessageSquare,
      active: false
    },
    {
      id: 'guides',
      title: 'Guides',
      desc: 'Step-by-step guides for common tasks.',
      icon: BookOpen,
      active: false
    }
  ];

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* 1. FULL-WIDTH PANORAMIC HERO SECTION (Edge-to-Edge matching reference screenshot) */}
      <div className="relative w-full rounded-3xl overflow-hidden min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] bg-[#f4f4f4] dark:bg-[#171717] border border-neutral-100/80 dark:border-gray-800 shadow-sm flex items-center">
        {/* Full-bleed background panoramic illustration on the right */}
        <div
          className="absolute inset-0 w-full h-full bg-no-repeat bg-right lg:bg-[right_center] bg-cover opacity-95 dark:opacity-40 pointer-events-none"
          style={{
            backgroundImage: "url('/help-support-panoramic-hero.jpg')"
          }}
        />

        {/* Smooth gradient scrim on the left ensuring crisp legibility of typography */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#f4f4f4] via-[#f4f4f4]/90 sm:via-[#f4f4f4]/85 to-transparent dark:from-[#171717] dark:via-[#171717]/90 dark:to-transparent pointer-events-none" />

        {/* Content container aligned on the left */}
        <div className="relative z-10 w-full px-6 sm:px-10 lg:px-12 py-10 max-w-2xl space-y-5">
          {/* Small Top Badge */}
          <div className="inline-flex items-center gap-2.5 text-neutral-800 dark:text-neutral-200">
            <div className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800 shadow-xs flex items-center justify-center text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-gray-700">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                Help & Support
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                We're here to help you
              </p>
            </div>
          </div>

          {/* Large Bold Hero Typography */}
          <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-[1.12]">
            <span>How can we</span><br />
            <span className="text-neutral-600 dark:text-neutral-400">help you today?</span>
          </h1>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 font-normal leading-relaxed max-w-lg">
            Find answers, get support, or create a ticket. Our team is always ready to help.
          </p>

          {/* Apple iOS Rounded Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2 max-w-md sm:max-w-lg">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for help articles, topics or keywords..."
                className="w-full pl-11 pr-14 py-3.5 rounded-full text-xs sm:text-sm bg-white dark:bg-gray-800/90 border border-neutral-200/80 dark:border-gray-700 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 focus:border-neutral-500 transition shadow-xs"
              />
              <button
                type="submit"
                className="w-9 h-9 rounded-full bg-neutral-600 hover:bg-neutral-500 text-white flex items-center justify-center absolute right-2 shadow-xs transition transform hover:scale-105 active:scale-95 cursor-pointer"
                title="Search"
              >
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2. 4 ACTION / NAVIGATION CARDS (Full-width grid, identical to screenshot View 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {navCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className={`rounded-2xl p-6 transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[170px] ${
                card.active
                  ? 'bg-neutral-50/80 dark:bg-neutral-950/40 border-2 border-neutral-200 dark:border-neutral-800 shadow-xs'
                  : 'bg-white dark:bg-gray-800/70 border border-neutral-200/70 dark:border-gray-700/70 hover:border-neutral-200 dark:hover:border-neutral-800 hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                {/* Soft icon box */}
                <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-950/60 text-neutral-600 dark:text-neutral-400 flex items-center justify-center border border-neutral-100/60 dark:border-neutral-900/60">
                  <Icon className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>

              {/* Clean bottom-right arrow aligned perfectly */}
              <div className="flex justify-end pt-3">
                <span className={`transition-transform duration-200 group-hover:translate-x-1 ${
                  card.active ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-400'
                }`}>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. BOTTOM BANNER: Need Urgent Help? */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-gray-800/70 border border-neutral-200/70 dark:border-gray-700/70 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
              Need urgent help?
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Our support team is available 24/7 to assist you.
            </p>
          </div>
        </div>

        <button
          onClick={onContactSupport || (() => onNavigate('inbox'))}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-gray-800 hover:bg-neutral-50 dark:hover:bg-gray-700 border border-neutral-200 dark:border-gray-600 text-neutral-700 dark:text-neutral-200 text-xs font-semibold shadow-2xs hover:shadow-xs transition cursor-pointer shrink-0"
        >
          <Headphones className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span>Contact Support</span>
        </button>
      </div>
    </div>
  );
}
