import { PICK_API_URL } from '../config/api';
import {
  buildBannedPickUser,
  fetchWithTimeoutAndRetry,
  getPickAccessToken,
  isAccountDisabledResponse,
  PickAccountDisabledError
} from './auth';

export interface PickSessionItem {
  id: string;
  ip: string;
  userAgent: string;
  device: string;
  deviceName: string;
  appName: string;
  os: string;
  browser: string;
  platform: 'mobile' | 'desktop' | 'api';
  createdAt: string | null;
  lastActiveAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
}

export interface PickSessionsSummary {
  total: number;
  mobileCount: number;
  desktopCount: number;
  uniqueIpCount: number;
}

export interface PickSessionsResponse {
  sessions: PickSessionItem[];
  summary: PickSessionsSummary;
}

async function callSessionsEndpoint(
  path: string,
  method: 'GET' | 'DELETE'
): Promise<PickSessionsResponse> {
  const token = await getPickAccessToken();
  if (!token) {
    throw new Error('Sign in to PICK to view active sessions.');
  }
  const response = await fetchWithTimeoutAndRetry(`${PICK_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (isAccountDisabledResponse(response.status, payload)) {
    throw new PickAccountDisabledError(
      token,
      buildBannedPickUser(payload),
      payload.reason || payload.error || 'This Tiwlo account is disabled.'
    );
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Could not load active device sessions.');
  }
  const sessions = Array.isArray(payload.sessions) ? (payload.sessions as PickSessionItem[]) : [];
  return {
    sessions,
    summary: payload.summary || {
      total: sessions.length,
      mobileCount: sessions.filter((item) => item.platform === 'mobile').length,
      desktopCount: sessions.filter((item) => item.platform === 'desktop').length,
      uniqueIpCount: new Set(sessions.map((item) => item.ip).filter(Boolean)).size
    }
  };
}

export function fetchPickSessions(): Promise<PickSessionsResponse> {
  return callSessionsEndpoint('/sessions', 'GET');
}

export function revokePickSession(sessionId: string): Promise<PickSessionsResponse> {
  return callSessionsEndpoint(`/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
}

export function revokeOtherPickSessions(): Promise<PickSessionsResponse> {
  return callSessionsEndpoint('/sessions', 'DELETE');
}
