import React, { useState } from 'react';
import { Search, ChevronDown, ArrowRight } from 'lucide-react';

/**
 * Subdomain Search Box Component
 * Matches screenshot:
 * - Magnifying glass icon on left
 * - "yourname" placeholder input
 * - Dropdown suffix selector: .uids.app ⌄
 * - Black button on right with white arrow: [ -> ]
 */
export default function UidsSearchBox({
  subdomain,
  setSubdomain,
  selectedSuffix,
  setSelectedSuffix,
  onSearch,
  loading = false
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const availableSuffixes = [
    '.uids.app',
    '.uids.dev',
    '.uids.is',
    '.uids.me'
  ];

  const handleInputChange = (e) => {
    // Sanitize subdomain input: lowercase, letters, numbers, hyphens only
    const clean = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '');
    setSubdomain(clean);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(subdomain);
    }
  };

  return (
    <div className="relative w-full max-w-2xl sm:max-w-3xl mx-auto px-4 sm:px-0 mt-6 sm:mt-8 z-30">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-full border border-slate-200/90 shadow-xl shadow-slate-200/50 p-2 sm:p-2.5 transition-all duration-200 focus-within:border-emerald-500/80 focus-within:ring-4 focus-within:ring-emerald-500/10"
      >
        {/* Left Search Icon */}
        <div className="pl-3 sm:pl-4 pr-2 text-slate-400 shrink-0">
          <Search className="w-5 h-5 sm:w-5 sm:h-5 text-slate-400" />
        </div>

        {/* Subdomain Name Input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={subdomain}
            onChange={handleInputChange}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none tracking-normal truncate"
          />
        </div>

        {/* Dropdown Selector (.uids.app ⌄) */}
        <div className="relative shrink-0 border-l border-slate-200/90 pl-3 pr-2 sm:px-4">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 py-1 text-sm sm:text-base font-semibold text-slate-700 hover:text-slate-900 transition-colors select-none"
            aria-expanded={dropdownOpen}
          >
            <span>{selectedSuffix}</span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Suffix Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  className={`w-full text-left px-3.5 py-2 text-sm font-medium transition-colors flex items-center justify-between ${
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
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white flex items-center justify-center transition-all duration-150 shadow-sm hover:shadow active:scale-95 shrink-0"
          aria-label="Search and claim subdomain"
        >
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
      </form>
    </div>
  );
}
