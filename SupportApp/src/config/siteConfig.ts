import rawConfig from '../../config.json';

export interface AppSiteConfig {
  appName: string;
  websiteDomain: string;
  protocol: 'https' | 'http';
  apiPathPrefix: string;
  appScheme: string;
  supportEmail: string;
  requestTimeoutMs: number;
  livePollIntervalMs: number;
}

const DEFAULT_CONFIG: AppSiteConfig = {
  appName: 'Tiwlo Support',
  websiteDomain: 'tiwlo.com',
  protocol: 'https',
  apiPathPrefix: '/api',
  appScheme: 'tiwlosupport',
  supportEmail: 'support@tiwlo.com',
  requestTimeoutMs: 15000,
  livePollIntervalMs: 6000,
};

const merged: AppSiteConfig = {
  ...DEFAULT_CONFIG,
  ...(rawConfig as Partial<AppSiteConfig>),
};

/**
 * Normalizes any domain or URL configured in `SupportApp/config.json`
 * (for example `"tiwlo.com"`, `"https://custom.com"`, or `"http://10.0.2.2:5000"`).
 */
export function buildWebsiteOrigin(domainOrUrl: string, defaultProtocol: 'https' | 'http' = 'https'): string {
  const envOverride = process.env.EXPO_PUBLIC_API_ORIGIN;
  const source = (typeof envOverride === 'string' && envOverride.trim()) || domainOrUrl || DEFAULT_CONFIG.websiteDomain;
  const trimmed = source.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const cleanHost = trimmed.replace(/^\/+/, '');
  const protocol = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/i.test(cleanHost) ? 'http' : defaultProtocol;
  return `${protocol}://${cleanHost}`;
}

export const SITE_CONFIG: AppSiteConfig = merged;
export const WEBSITE_ORIGIN: string = buildWebsiteOrigin(merged.websiteDomain, merged.protocol);
export const WEBSITE_DOMAIN: string = WEBSITE_ORIGIN.replace(/^https?:\/\//i, '');
export const API_PATH_PREFIX: string = `/${String(merged.apiPathPrefix || '/api').replace(/^\/+|\/+$/g, '')}`;

export const API_BASE = `${WEBSITE_ORIGIN}${API_PATH_PREFIX}`;
export const AUTH_API_BASE = `${API_BASE}/auth`;
export const ADMIN_API_BASE = `${API_BASE}/admin`;
export const ADMIN_SUPPORT_API_BASE = `${API_BASE}/admin/support`;
export const SUPPORT_API_BASE = `${API_BASE}/support`;
export const VERIFICATION_API_BASE = `${API_BASE}/verification`;

export function resolveWebsiteUrl(pathOrUrl: string | null | undefined): string {
  const value = String(pathOrUrl || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${WEBSITE_ORIGIN}${normalizedPath}`;
}
