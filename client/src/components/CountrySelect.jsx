import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, Search } from 'lucide-react';
import { COUNTRIES, findCountry, searchCountries } from '../utils/countries';

export default function CountrySelect({
  value = 'Bangladesh',
  onChange,
  placeholder = 'Select country',
  disabled = false,
  required = false,
  id,
  name = 'country',
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedCountry = useMemo(() => findCountry(value), [value]);
  const filteredCountries = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 10);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const openDropdown = () => {
    setQuery('');
    setHighlightedIndex(0);
    setOpen(true);
  };

  const handleSelect = (country) => {
    onChange?.(country.name, country);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (!disabled) openDropdown();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((idx) => Math.min(idx + 1, Math.max(0, filteredCountries.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === 'Enter' && filteredCountries[highlightedIndex]) {
      event.preventDefault();
      handleSelect(filteredCountries[highlightedIndex]);
    }
  };

  const displayLabel = selectedCountry?.name || value || placeholder;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={value || ''}
          onChange={() => {}}
          required
          className="sr-only"
        />
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openDropdown();
        }}
        onKeyDown={handleKeyDown}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-950 outline-none transition hover:border-neutral-300 focus:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:hover:border-neutral-700"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedCountry?.flag ? (
            <span className="shrink-0 text-base leading-none" aria-hidden="true">{selectedCountry.flag}</span>
          ) : (
            <Globe className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          )}
          <span className={`truncate ${value ? 'text-neutral-950 dark:text-white' : 'text-neutral-400'}`}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select country"
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
            <Search className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${COUNTRIES.length} countries or ISO code...`}
              aria-label="Search country"
              className="min-w-0 flex-1 bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No matching country found.
              </p>
            ) : (
              filteredCountries.map((country, idx) => {
                const isSelected = selectedCountry?.code === country.code;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={country.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(country)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'bg-[#1ED760]/15 font-semibold text-neutral-950 dark:text-white'
                        : isHighlighted
                          ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white'
                          : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900/60'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-sm leading-none" aria-hidden="true">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-400">{country.code}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {country.currency && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          {country.currency}
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-[#1ED760]" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
