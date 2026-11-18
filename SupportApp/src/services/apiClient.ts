import { SITE_CONFIG, WEBSITE_ORIGIN } from '../config/siteConfig';
import { getSecureItem, STORAGE_KEYS } from './storage';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly data?: Record<string, unknown>,
    readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function parseRetryAfter(response: Response): number | null {
  const raw = response.headers.get('Retry-After');
  if (!raw) return null;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec);
  const ts = Date.parse(raw);
  return Number.isFinite(ts) && ts > Date.now() ? Math.ceil((ts - Date.now()) / 1000) : null;
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  reauthGrant?: string;
  timeoutMs?: number;
  rawText?: boolean;
}

/**
 * Unified HTTP transport targeting the website configured in `SupportApp/config.json`.
 */
export async function apiFetch<T = Record<string, unknown>>(
  pathOrFullUrl: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    skipAuth = false,
    reauthGrant,
    timeoutMs = SITE_CONFIG.requestTimeoutMs || 15000,
    rawText = false,
  } = options;

  const targetUrl = /^https?:\/\//i.test(pathOrFullUrl)
    ? pathOrFullUrl
    : `${WEBSITE_ORIGIN}${pathOrFullUrl.startsWith('/') ? '' : '/'}${pathOrFullUrl}`;

  const token = skipAuth ? null : await getSecureItem(STORAGE_KEYS.SESSION_TOKEN);
  const requestHeaders: Record<string, string> = {
    Accept: rawText ? 'text/csv, text/plain, */*' : 'application/json',
    'x-desk-strict': '1',
    ...headers,
  };

  if (token && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
  if (reauthGrant) {
    requestHeaders['x-tiwlo-reauth-grant'] = reauthGrant;
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      serializedBody = body;
    } else {
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      serializedBody = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: serializedBody,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiRequestError(
        `Request to ${WEBSITE_ORIGIN} timed out. Check your internet connection.`,
        408,
        'REQUEST_TIMEOUT'
      );
    }
    throw new ApiRequestError(
      err instanceof Error ? err.message : `Unable to reach ${WEBSITE_ORIGIN}.`,
      0,
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (rawText && response.ok) {
    return (await response.text()) as unknown as T;
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.success === false) {
    const errMsg =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      `Request failed with status ${response.status}.`;
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new ApiRequestError(errMsg, response.status, code, data, parseRetryAfter(response));
  }

  return data as T;
}
