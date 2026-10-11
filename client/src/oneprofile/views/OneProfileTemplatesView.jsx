import React, { useState } from 'react';
import { LayoutGrid, Check, Eye, Sparkles } from 'lucide-react';

export default function OneProfileTemplatesView({ onNavigateTab }) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const templates = [
    {
      id: 'minimal',
      name: 'Minimal Clean',
      desc: 'Simple typography-driven layout ideal for developers and technical founders.',
      category: 'minimal',
      color: 'bg-slate-950 text-white',
      badge: 'Active'
    },
    {
      id: 'creative',
      name: 'Creative Portfolio',
      desc: 'Visual-first presentation for designers, photographers, and architects.',
      category: 'portfolio',
      color: 'bg-emerald-800 text-white',
      badge: 'Popular'
    },
    {
      id: 'modern-dark',
      name: 'Modern Studio',
      desc: 'High contrast dark theme with animated glass cards and link aggregators.',
      category: 'modern',
      color: 'bg-indigo-950 text-white',
      badge: 'Trending'
    },
    {
      id: 'business',
      name: 'Executive Business',
      desc: 'Formal corporate layout with services, contact form, and client testimonials.',
      category: 'business',
      color: 'bg-blue-900 text-white',
      badge: 'Corporate'
    },
    {
      id: 'nfc-badge',
      name: 'NFC Tap Card Profile',
      desc: 'Optimized mobile micro-landing page designed for physical NFC tap cards.',
      category: 'minimal',
      color: 'bg-purple-950 text-white',
      badge: 'NFC Ready'
    },
    {
      id: 'startup-mvp',
      name: 'Startup MVP Landing',
      desc: 'Clean product showcase with feature bullets, early access CTA, and roadmap.',
      category: 'business',
      color: 'bg-slate-900 text-white',
      badge: 'New'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'minimal', label: 'Minimalist' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'business', label: 'Business' },
  ];

  const filtered = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Website Templates</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Select and switch themes for your live UIDis website with one click.</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              selectedCategory === c.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
            <div>
              {/* Preview header thumbnail */}
              <div className={`h-36 ${t.color} p-4 flex flex-col justify-between relative`}>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                    {t.badge}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    ★
                  </div>
                </div>
                <div className="font-extrabold text-sm opacity-90">{t.name}</div>
              </div>

              {/* Template Meta */}
              <div className="p-4">
                <h3 className="font-extrabold text-sm text-slate-900 mb-1">{t.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
              </div>
            </div>

            <div className="p-4 pt-0 border-t border-slate-100 flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('website')}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
              >
                Apply to My Site
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center gap-1 transition"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Preview</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
