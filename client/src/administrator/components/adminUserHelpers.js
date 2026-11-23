import { applicationFetch } from '../../api/graphqlTransport.js';
import { getDeviceTrackingHeaders } from '../../utils/deviceFingerprint.js';

export const ADMIN_API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

export function getAdminAuthHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminFetch(url, options = {}) {
  try {
    return await applicationFetch(url, options);
  } catch (err) {
    if (String(err?.message || '').includes('No GraphQL operation is registered')) {
      const deviceHeaders = await getDeviceTrackingHeaders().catch(() => ({}));
      const mergedHeaders = {
        ...deviceHeaders,
        ...(options.headers instanceof Headers
          ? Object.fromEntries(options.headers.entries())
          : (options.headers || {}))
      };
      return globalThis.fetch(url, {
        ...options,
        headers: mergedHeaders
      });
    }
    throw err;
  }
}

export function isSuperAdminUser(user) {
  return (
    user?.role === 'super_admin' ||
    String(user?.email || '').trim().toLowerCase() === 'tiwloltd@gmail.com'
  );
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatUsd(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

export function compactSignalLabel(signal) {
  const map = {
    'Shared Device Fingerprint': 'Same Device',
    'Shared Device Token': 'Device Token',
    'Same Persistent Browser': 'Same Browser',
    'Shared Hardware+Browser Identity': 'Hardware+Browser',
    'Same IP Address': 'Same IP',
    'Same /24 Network Subnet': 'Same Subnet',
    'Alias/Duplicate Contact': 'Duplicate Contact',
    'Blocked Device/Network Signal': 'Blocked Signal'
  };
  return map[signal] || signal;
}

export function getRiskBadgeStyle(riskLevel) {
  switch (riskLevel) {
    case 'critical':
      return {
        pill: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
        bar: 'bg-rose-500',
        label: 'Critical'
      };
    case 'high':
      return {
        pill: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-neutral-200 dark:border-neutral-800',
        bar: 'bg-rose-400',
        label: 'High'
      };
    case 'medium':
      return {
        pill: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700',
        bar: 'bg-neutral-500 dark:bg-neutral-400',
        label: 'Medium'
      };
    default:
      return {
        pill: 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30',
        bar: 'bg-[#1ED760]',
        label: 'Clean'
      };
  }
}

export function getSeverityBadge(severity) {
  const sev = String(severity || 'info').toLowerCase();
  if (sev === 'critical') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  if (sev === 'warning') return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700';
  if (sev === 'error') return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25';
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

export function countryCodeToFlag(countryCode) {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  return String.fromCodePoint(...[...normalized].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function sanitizeRidgeSvgToDataUrl(ridgeSvgMap) {
  if (!ridgeSvgMap || typeof ridgeSvgMap !== 'string') return null;
  const trimmed = ridgeSvgMap.trim();
  if (!trimmed) return null;
  if (/^data:image\/svg\+xml/i.test(trimmed)) {
    const decoded = (() => {
      try {
        return decodeURIComponent(trimmed);
      } catch {
        return trimmed;
      }
    })();
    if (/<script|on\w+\s*=|javascript:|<foreignObject/i.test(decoded)) return null;
    return trimmed;
  }
  if (!/<svg[\s>]/i.test(trimmed)) return null;
  const cleaned = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

export function getBiometricRidgeDataUrl(bio) {
  const stored = sanitizeRidgeSvgToDataUrl(bio?.ridgeSvgMap);
  if (stored) return { url: stored, isStoredSvg: true };
  return { url: null, isStoredSvg: false };
}
