import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const STORAGE_KEY = 'tiwlo_admin_display_currency';

const CURRENCY_LABELS = {
  USD: 'USD ($)',
  BDT: 'BDT (৳ বাংলা টাকা)',
  EUR: 'EUR (€)',
  GBP: 'GBP (£)',
  INR: 'INR (₹)',
  AED: 'AED (د.إ)',
  SAR: 'SAR (﷼)',
  CAD: 'CAD (C$)',
  AUD: 'AUD (A$)',
  SGD: 'SGD (S$)',
  JPY: 'JPY (¥)'
};

const CURRENCY_SYMBOLS = {
  USD: '$',
  BDT: '৳',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥'
};

const AdminCurrencyContext = createContext(null);

function normalizeRatesMap(rawRates) {
  const normalized = { USD: 1 };
  if (rawRates && typeof rawRates === 'object' && !Array.isArray(rawRates)) {
    for (const [rawCode, rawValue] of Object.entries(rawRates)) {
      const code = String(rawCode || '').trim().toUpperCase();
      const val = Number(rawValue);
      if (/^[A-Z]{3}$/.test(code) && Number.isFinite(val) && val > 0) {
        normalized[code] = code === 'USD' ? 1 : val;
      }
    }
  }
  return normalized;
}

function formatNumberWithSymbol(amount, code, { compact = false, decimals } = {}) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (code === 'BDT') {
    const formatted = compact
      ? new Intl.NumberFormat('en-US', {
          notation: 'compact',
          maximumFractionDigits: 1
        }).format(abs)
      : new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals ?? 2,
          maximumFractionDigits: decimals ?? 2
        }).format(abs);
    return `${sign}৳${formatted}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      ...(compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : {
            minimumFractionDigits: decimals ?? (code === 'JPY' ? 0 : 2),
            maximumFractionDigits: decimals ?? (code === 'JPY' ? 0 : 2)
          })
    }).format(num);
  } catch {
    const sym = CURRENCY_SYMBOLS[code] || `${code} `;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals ?? 2,
      maximumFractionDigits: decimals ?? 2
    }).format(abs);
    return `${sign}${sym}${formatted}`;
  }
}

export function AdminCurrencyProvider({ children, onIpBlocked }) {
  const [currency, setCurrencyState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^[A-Z]{3}$/.test(saved)) return saved;
    } catch {
      // Ignore storage access failures
    }
    return 'USD';
  });
  const [rates, setRates] = useState({ USD: 1 });
  const [rateSource, setRateSource] = useState(null);
  const [observedAt, setObservedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const refreshRates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/currency-rates`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json().catch(() => ({}));
      if (
        res.status === 403 &&
        (json?.code === 'ADMIN_IP_NOT_ALLOWED' || /your ip is not whitelisted/i.test(json?.error || ''))
      ) {
        const msg = json?.error || 'Your IP is not whitelisted';
        onIpBlocked?.(msg);
        window.dispatchEvent(new CustomEvent('tiwlo-admin-ip-blocked', { detail: { message: msg } }));
        throw new Error(msg);
      }
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Currency rates request failed (${res.status}).`);
      }

      const payload = json.data || json;
      const nextRates = normalizeRatesMap(payload.rates || payload.usdRates || {});
      setRates(nextRates);
      setRateSource(payload.rateSource || payload.source || null);
      setObservedAt(payload.observedAt || payload.updatedAt || null);
      setWarning(payload.warning || '');
    } catch (err) {
      setError(err.message || 'Live exchange rates are currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, [onIpBlocked]);

  useEffect(() => {
    refreshRates();
  }, [refreshRates]);

  const setDisplayCurrency = useCallback((code) => {
    const normalized = String(code || 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) return;
    setCurrencyState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage access failures
    }
  }, []);

  const convertUsd = useCallback(
    (usdAmount) => {
      if (usdAmount === null || usdAmount === undefined || usdAmount === '') return null;
      const num = Number(usdAmount);
      if (!Number.isFinite(num)) return null;
      if (currency === 'USD') return num;
      const rate = rates[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        return null;
      }
      return num * rate;
    },
    [currency, rates]
  );

  const formatMoneyParts = useCallback(
    (usdAmount, options = {}) => {
      const { compact = false, decimals } = options;
      if (usdAmount === null || usdAmount === undefined || usdAmount === '') {
        return {
          primary: '—',
          usdReference: null,
          converted: null,
          rateAvailable: false,
          currency
        };
      }
      const numUsd = Number(usdAmount);
      if (!Number.isFinite(numUsd)) {
        return {
          primary: '—',
          usdReference: null,
          converted: null,
          rateAvailable: false,
          currency
        };
      }

      const usdFormatted = formatNumberWithSymbol(numUsd, 'USD', { compact, decimals });
      if (currency === 'USD') {
        return {
          primary: usdFormatted,
          usdReference: null,
          converted: numUsd,
          rateAvailable: true,
          currency: 'USD'
        };
      }

      const converted = convertUsd(numUsd);
      if (converted === null) {
        return {
          primary: usdFormatted,
          usdReference: `${currency} rate unavailable`,
          converted: null,
          rateAvailable: false,
          currency
        };
      }

      return {
        primary: formatNumberWithSymbol(converted, currency, { compact, decimals }),
        usdReference: usdFormatted,
        converted,
        rateAvailable: true,
        currency
      };
    },
    [convertUsd, currency]
  );

  const formatMoney = useCallback(
    (usdAmount, options = {}) => {
      const { includeUsdFallback = false } = options;
      const parts = formatMoneyParts(usdAmount, options);
      if (parts.primary === '—') return '—';
      if (includeUsdFallback && currency !== 'USD' && parts.usdReference) {
        return parts.rateAvailable
          ? `${parts.primary} (${parts.usdReference})`
          : `${parts.primary} · ${parts.usdReference}`;
      }
      return parts.primary;
    },
    [currency, formatMoneyParts]
  );

  const availableCurrencies = useMemo(() => {
    const codes = new Set(['USD', ...Object.keys(rates)]);
    const prioritized = ['USD', 'BDT', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'SGD'];
    const ordered = [
      ...prioritized.filter((c) => codes.has(c)),
      ...[...codes].filter((c) => !prioritized.includes(c)).sort()
    ];
    return ordered.map((code) => ({
      code,
      label: CURRENCY_LABELS[code] || code,
      symbol: CURRENCY_SYMBOLS[code] || code,
      rate: rates[code] ?? null
    }));
  }, [rates]);

  const activeRate = currency === 'USD' ? 1 : (rates[currency] ?? null);

  const value = useMemo(
    () => ({
      currency,
      rates,
      activeRate,
      rateSource,
      observedAt,
      loading,
      warning,
      error,
      availableCurrencies,
      refreshRates,
      setDisplayCurrency,
      convertUsd,
      formatMoney,
      formatMoneyParts
    }),
    [
      currency,
      rates,
      activeRate,
      rateSource,
      observedAt,
      loading,
      warning,
      error,
      availableCurrencies,
      refreshRates,
      setDisplayCurrency,
      convertUsd,
      formatMoney,
      formatMoneyParts
    ]
  );

  return <AdminCurrencyContext.Provider value={value}>{children}</AdminCurrencyContext.Provider>;
}

export function useAdminCurrency() {
  const ctx = useContext(AdminCurrencyContext);
  if (!ctx) {
    throw new Error('useAdminCurrency must be used within an AdminCurrencyProvider.');
  }
  return ctx;
}

export default AdminCurrencyContext;
