import { Platform } from 'react-native';

export const TIWLO_API_BASE = 'https://tiwlo.com/api';

export interface TiwloUser {
  id: string;
  tiwiId?: string;
  storeId?: string;
  name?: string;
  storeName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: string;
  identityVerified?: boolean;
  twoFactorEnabled?: boolean;
  totpEnabled?: boolean;
}

export interface AuthChallengeResponse {
  success?: boolean;
  requiresEmailVerification?: boolean;
  requires2FA?: boolean;
  requires2FASetup?: boolean;
  tempToken?: string;
  email?: string;
  emailMasked?: string;
  message?: string;
  sessionToken?: string;
  user?: TiwloUser;
}

function getDeviceHeaders(): Record<string, string> {
  const os = Platform.OS === 'ios' ? 'iOS' : 'Android';
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Device-Platform': os,
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${TIWLO_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...getDeviceHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `Request failed (${response.status})`;
      throw new Error(msg);
    }
    return (payload || {}) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizePhoneIdentifier(value: string, dialCode: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/^[\d\s().+-]+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2).replace(/\D/g, '')}`;
  let digits = trimmed.replace(/\D/g, '');
  const countryDigits = dialCode.replace(/\D/g, '');
  if (digits.startsWith(countryDigits)) return `+${digits}`;
  digits = digits.replace(/^0+/, '');
  return digits ? `${dialCode}${digits}` : trimmed;
}

export async function loginWithTiwlo(identifier: string, password: string): Promise<AuthChallengeResponse> {
  return requestJson<AuthChallengeResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function verifyEmailCode(tempToken: string, otpCode: string): Promise<AuthChallengeResponse> {
  return requestJson<AuthChallengeResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ tempToken, otpCode }),
  });
}

export async function resendEmailCode(tempToken: string): Promise<{ newTempToken: string; emailMasked?: string; message?: string }> {
  return requestJson('/auth/resend-email-verification', {
    method: 'POST',
    body: JSON.stringify({ tempToken }),
  });
}

export async function verifyTwoFactorCode(tempToken: string, otpCode: string): Promise<AuthChallengeResponse> {
  return requestJson<AuthChallengeResponse>('/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({ tempToken, otpCode }),
  });
}

export async function resendTwoFactorCode(tempToken: string): Promise<{ newTempToken: string; emailMasked?: string; message?: string }> {
  return requestJson('/auth/resend-2fa', {
    method: 'POST',
    body: JSON.stringify({ tempToken }),
  });
}

export async function setupTwoFactorCode(tempToken: string, otpCode: string): Promise<AuthChallengeResponse> {
  return requestJson<AuthChallengeResponse>('/auth/setup-2fa', {
    method: 'POST',
    body: JSON.stringify({ tempToken, otpCode }),
  });
}

export async function resendSetupTwoFactorCode(tempToken: string): Promise<{ newTempToken: string; emailMasked?: string; message?: string }> {
  return requestJson('/auth/resend-setup-2fa', {
    method: 'POST',
    body: JSON.stringify({ tempToken }),
  });
}

export async function checkAvailability(params: { email?: string; handle?: string }): Promise<{
  emailAvailable?: boolean;
  emailError?: string;
  handleAvailable?: boolean;
  handleError?: string;
}> {
  const search = new URLSearchParams();
  if (params.email) search.set('email', params.email);
  if (params.handle) search.set('handle', params.handle);
  return requestJson(`/auth/check-availability?${search.toString()}`, { method: 'GET' });
}

export async function checkPhoneAvailability(phone: string): Promise<{ available: boolean; error?: string }> {
  return requestJson('/auth/check-phone', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export interface RegisterPayload {
  email: string;
  handle: string;
  password: string;
  accountType: 'personal' | 'business';
  name: string;
  businessName?: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  billingDetails: {
    address: string;
    city: string;
    country: string;
    phone: string;
    postalCode: string;
  };
}

export async function registerTiwloAccount(payload: RegisterPayload): Promise<AuthChallengeResponse> {
  return requestJson<AuthChallengeResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      storeName: payload.accountType === 'business' ? (payload.businessName || payload.name) : payload.name,
      signupSource: 'tiwlo',
    }),
  });
}

export async function requestPasswordReset(identifier: string): Promise<{
  resetToken: string;
  emailMasked: string;
  message?: string;
}> {
  return requestJson('/auth/forgot-password/request', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function verifyPasswordResetCode(resetToken: string, otpCode: string): Promise<{
  valid: boolean;
  resetToken: string;
}> {
  return requestJson('/auth/forgot-password/verify-code', {
    method: 'POST',
    body: JSON.stringify({ resetToken, otpCode }),
  });
}

export async function completePasswordReset(resetToken: string, newPassword: string): Promise<{
  success: boolean;
  message?: string;
}> {
  return requestJson('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify({ resetToken, newPassword }),
  });
}
