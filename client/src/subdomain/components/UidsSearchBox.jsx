import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ArrowRight } from 'lucide-react';

/**
 * UidsSearchBox Component
 * Enhanced per user feedback:
 * - Animated dynamic placeholder that cycles through project types:
 *   'e.g. startup-mvp', 'e.g. dev-portfolio', 'e.g. ai-agent', 'e.g. indie-saas'
 * - Compact, sleek Google-style rounded container
 * - Responsive suffix selector (.uids.app ⌄)
 * - Black rounded submit arrow button
 */
export default function UidsSearchBox({
  subdomain,
  setSubdomain,
  selectedSuffix,
  setSelectedSuffix,
  onSearch,
  availability,
  setAvailability
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const placeholderExamples = [
    'startup-mvp',
    'dev-portfolio',
    'ai-project',
    'indie-saas',
    'creator-hub',
    'my-brand'
  ];

  const [pIndex, setPIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState('');
  const [pDeleting, setPDeleting] = useState(false);

  // Animated placeholder typewriter effect
  useEffect(() => {
    // Only animate placeholder when input is empty
    if (subdomain) return;

    const current = placeholderExamples[pIndex];
    const speed = pDeleting ? 35 : 70;

    const timer = setTimeout(() => {
      if (!pDeleting) {
        const next = current.substring(0, placeholderText.length + 1);
        setPlaceholderText(next);
        if (next === current) {
          setTimeout(() => setPDeleting(true), 1900);
        }
      } else {
        const prev = current.substring(0, placeholderText.length - 1);
        setPlaceholderText(prev);
        if (prev === '') {
          setPDeleting(false);
          setPIndex((idx) => (idx + 1) % placeholderExamples.length);
        }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [placeholderText, pDeleting, pIndex, subdomain]);

  useEffect(() => {
    if (!subdomain) {
      setAvailability?.(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/subdomains/check?name=${encodeURIComponent(subdomain)}`, {
          credentials: 'include',
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Availability check failed.');
        setAvailability?.(payload);
      } catch (error) {
        if (error.name !== 'AbortError') setAvailability?.({ error: error.message });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [subdomain, setAvailability]);

  const availableSuffixes = ['.uids.app'];

  const handleInputChange = (e) => {
    const clean = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');
    setSubdomain(clean);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(subdomain || placeholderExamples[pIndex], availability);
    }
  };

  return (
    <div className="relative w-full max-w-xl sm:max-w-2xl mx-auto px-3.5 sm:px-0 mt-4 sm:mt-5 z-30">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white rounded-full border border-slate-200 hover:border-slate-300 focus-within:border-emerald-500 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/15 p-1.5 sm:p-2 transition-all duration-150"
      >
        {/* Left Search Icon */}
        <div className="pl-3 pr-2 text-slate-400 shrink-0">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
        </div>

        {/* Subdomain Input with Dynamic Animated Placeholder */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={subdomain}
            onChange={handleInputChange}
            placeholder={subdomain ? '' : placeholderText || 'yourname'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none tracking-normal truncate"
          />
        </div>

        {/* Dropdown Selector (.uids.app ⌄) */}
        <div className="relative shrink-0 border-l border-slate-200 pl-2.5 pr-1.5 sm:px-3">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 py-1 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors select-none"
            aria-expanded={dropdownOpen}
          >
            <span>{selectedSuffix}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Suffix Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50 animate-in fade-in duration-100">
              <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Select Suffix
              </div>
              {availableSuffixes.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => {
                    setSelectedSuffix(suffix);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedSuffix === suffix
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{suffix}</span>
                  {selectedSuffix === suffix && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C261]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Black Right Arrow Submit Button */}
        <button
          type="submit"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white flex items-center justify-center transition-all duration-150 shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
          aria-label="Search and claim subdomain"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </button>
      </form>
      {subdomain && availability && !availability.error && (
        <div className="mt-2 px-5 text-xs">
          <span className={availability.available ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
            {availability.available ? 'Available to register' : 'Already registered or reserved'}
          </span>
          {availability.suggestions?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500">Recommended:</span>
              {availability.suggestions.map((suggestion) => (
                <button
                  key={suggestion.name}
                  type="button"
                  onClick={() => setSubdomain(suggestion.name)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                >
                  {suggestion.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {availability?.error && (
        <div className="mt-2 px-5 text-xs text-rose-600">{availability.error}</div>
      )}
    </div>
  );
}
