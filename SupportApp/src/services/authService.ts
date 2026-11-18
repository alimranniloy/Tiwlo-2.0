import {
  ADMIN_API_BASE,
  AUTH_API_BASE,
  VERIFICATION_API_BASE,
} from '../config/siteConfig';
import type { AuthChallenge, AuthUser, StaffProfileMe } from '../types/support';
import { apiFetch, ApiRequestError } from './apiClient';
import { deleteSecureItem, getSecureItem, setSecureItem, STORAGE_KEYS } from './storage';

export class StaffAccessRestrictedError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'StaffAccessRestrictedError';
  }
}

export interface VerifiedStaffSession {
  sessionToken: string;
  user: AuthUser;
  staffProfile: StaffProfileMe;
}

export async function savePendingChallenge(challenge: AuthChallenge): Promise<void> {
  if (!challenge.tempToken) return;
  await setSecureItem(STORAGE_KEYS.PENDING_CHALLENGE, JSON.stringify(challenge));
}

export async function getPendingChallenge(): Promise<AuthChallenge | null> {
  const raw = await getSecureItem(STORAGE_KEYS.PENDING_CHALLENGE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthChallenge;
    if (parsed && typeof parsed === 'object' && parsed.tempToken) {
      return parsed;
    }
  } catch {
    // Discard malformed pending state
  }
  await deleteSecureItem(STORAGE_KEYS.PENDING_CHALLENGE);
  return null;
}

export async function clearPendingChallenge(): Promise<void> {
  await deleteSecureItem(STORAGE_KEYS.PENDING_CHALLENGE);
}

export async function getStoredSessionToken(): Promise<string | null> {
  return getSecureItem(STORAGE_KEYS.SESSION_TOKEN);
}

export async function saveSessionToken(token: string): Promise<void> {
  await setSecureItem(STORAGE_KEYS.SESSION_TOKEN, token);
}

export async function clearAllAuthStorage(): Promise<void> {
  await Promise.all([
    deleteSecureItem(STORAGE_KEYS.SESSION_TOKEN),
    clearPendingChallenge(),
  ]);
}

function isAllowedAdminOrStaffRole(user: AuthUser | null | undefined, staffMe?: StaffProfileMe | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const isRoleAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'staff' ||
    role === 'support_agent' ||
    role === 'support_lead';
  if (staffMe && staffMe.isActive === false && !staffMe.isSuperAdmin) {
    return false;
  }
  return Boolean(isRoleAdmin || staffMe?.isSuperAdmin || (staffMe?.userId && staffMe.isActive));
}

/**
 * Verifies the active session belongs strictly to an active Staff Member or Administrator.
 * Regular customer / merchant accounts are rejected immediately and wiped from device storage.
 */
export async function verifyStaffAdminSession(): Promise<VerifiedStaffSession | null> {
  const token = await getStoredSessionToken();
  if (!token) return null;

  let meRes: { authenticated?: boolean; user?: AuthUser; isBanned?: boolean; banReason?: string };
  try {
    meRes = await apiFetch(`${AUTH_API_BASE}/me`);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      await clearAllAuthStorage();
      return null;
    }
    throw err;
  }

  if (meRes.isBanned) {
    await logoutAccount();
    throw new StaffAccessRestrictedError(
      meRes.banReason || 'This account has been disabled.',
      'ACCOUNT_DISABLED'
    );
  }

  if (!meRes.authenticated || !meRes.user) {
    await clearAllAuthStorage();
    return null;
  }

  let staffMe: StaffProfileMe;
  try {
    staffMe = await apiFetch<StaffProfileMe>(`${ADMIN_API_BASE}/staff-support/me`);
  } catch (err) {
    if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
      await logoutAccount().catch(() => clearAllAuthStorage());
      if (err.code === 'ADMIN_IP_NOT_ALLOWED') {
        throw new StaffAccessRestrictedError(err.message || 'Your network IP is not whitelisted for staff access.', err.code);
      }
      if (err.code === 'ADMIN_STAFF_DISABLED') {
        throw new StaffAccessRestrictedError(err.message || 'Your staff support profile is deactivated.', err.code);
      }
      throw new StaffAccessRestrictedError(
        'Access denied. Only authorized Tiwlo Support Staff and Administrators can sign in to SupportApp.',
        err.code || 'STAFF_OR_ADMIN_ONLY'
      );
    }
    throw err;
  }

  if (!isAllowedAdminOrStaffRole(meRes.user, staffMe)) {
    await logoutAccount().catch(() => clearAllAuthStorage());
    throw new StaffAccessRestrictedError(
      'Access denied. Only authorized Tiwlo Support Staff and Administrators can sign in to SupportApp.',
      'STAFF_OR_ADMIN_ONLY'
    );
  }

  return {
    sessionToken: token,
    user: meRes.user,
    staffProfile: staffMe,
  };
}

export async function loginStaffOrAdmin(identifier: string, password: string): Promise<AuthChallenge> {
  await clearPendingChallenge();
  const res = await apiFetch<AuthChallenge>(`${AUTH_API_BASE}/login`, {
    method: 'POST',
    skipAuth: true,
    body: {
      identifier: identifier.trim(),
      password,
    },
  });

  if (res.sessionToken) {
    await saveSessionToken(res.sessionToken);
    await clearPendingChallenge();
  } else if (res.tempToken) {
    await savePendingChallenge(res);
  }

  return res;
}

export async function verifyEmailVerificationOtp(tempToken: string, otpCode: string): Promise<AuthChallenge> {
  const res = await apiFetch<AuthChallenge>(`${AUTH_API_BASE}/verify-email`, {
    method: 'POST',
    skipAuth: true,
    body: { tempToken, otpCode: otpCode.trim() },
  });
  if (res.tempToken) {
    await savePendingChallenge(res);
  }
  return res;
}

export async function resendEmailVerificationOtp(tempToken: string): Promise<AuthChallenge> {
  const res = await apiFetch<AuthChallenge>(`${AUTH_API_BASE}/resend-email-verification`, {
    method: 'POST',
    skipAuth: true,
    body: { tempToken },
  });
  const next: AuthChallenge = {
    ...res,
    tempToken: res.newTempToken || res.tempToken || tempToken,
  };
  await savePendingChallenge(next);
  return next;
}

export async function verifyTwoFactorCode(
  tempToken: string,
  code: string,
  options: { setup?: boolean; isRecovery?: boolean } = {}
): Promise<AuthChallenge> {
  const endpoint = options.setup ? 'setup-2fa' : 'verify-2fa';
  const payload = options.setup
    ? { tempToken, otpCode: code.trim() }
    : options.isRecovery
      ? { tempToken, recoveryCode: code.trim(), otpCode: code.trim() }
      : { tempToken, otpCode: code.trim() };

  const res = await apiFetch<AuthChallenge>(`${AUTH_API_BASE}/${endpoint}`, {
    method: 'POST',
    skipAuth: true,
    body: payload,
  });

  if (res.sessionToken) {
    await saveSessionToken(res.sessionToken);
    await clearPendingChallenge();
  }
  return res;
}

export async function resendTwoFactorCode(tempToken: string, setup: boolean): Promise<AuthChallenge> {
  const endpoint = setup ? 'resend-setup-2fa' : 'resend-2fa';
  const res = await apiFetch<AuthChallenge>(`${AUTH_API_BASE}/${endpoint}`, {
    method: 'POST',
    skipAuth: true,
    body: { tempToken },
  });
  const next: AuthChallenge = {
    ...res,
    tempToken: res.newTempToken || res.tempToken || tempToken,
  };
  await savePendingChallenge(next);
  return next;
}

export async function requestPasswordRecovery(identifier: string): Promise<{ resetToken: string; emailMasked: string; message?: string }> {
  return apiFetch(`${AUTH_API_BASE}/forgot-password/request`, {
    method: 'POST',
    skipAuth: true,
    body: { identifier: identifier.trim() },
  });
}

export async function verifyPasswordRecoveryOtp(resetToken: string, otpCode: string): Promise<{ resetToken: string }> {
  return apiFetch(`${AUTH_API_BASE}/forgot-password/verify-code`, {
    method: 'POST',
    skipAuth: true,
    body: { resetToken, otpCode: otpCode.trim() },
  });
}

export async function completePasswordRecovery(resetToken: string, newPassword: string): Promise<{ message?: string }> {
  return apiFetch(`${AUTH_API_BASE}/forgot-password/reset`, {
    method: 'POST',
    skipAuth: true,
    body: { resetToken, newPassword },
  });
}

export async function setupStaffSecurityPin(
  pin: string,
  confirmPin: string,
  secondConfirmation: string
): Promise<{ success: boolean }> {
  return apiFetch(`${ADMIN_API_BASE}/security-pin/setup`, {
    method: 'POST',
    body: {
      pin: pin.trim(),
      confirmPin: confirmPin.trim(),
      secondConfirmation: secondConfirmation.trim(),
      confirmedTwice: true,
    },
  });
}

export async function verifyStaffSecurityPin(pin: string): Promise<{ grant: string; expiresInSeconds: number }> {
  return apiFetch(`${ADMIN_API_BASE}/security-pin/verify`, {
    method: 'POST',
    body: { pin: pin.trim() },
  });
}

export async function requestPinForgotOtp(): Promise<{ tempToken: string; emailMasked: string; message?: string }> {
  return apiFetch(`${ADMIN_API_BASE}/security-pin/forgot-request`, {
    method: 'POST',
    body: {},
  });
}

export async function resetSecurityPinWithOtp(
  tempToken: string,
  otpCode: string,
  newPin: string,
  confirmPin: string
): Promise<{ message?: string }> {
  return apiFetch(`${ADMIN_API_BASE}/security-pin/reset`, {
    method: 'POST',
    body: { tempToken, otpCode: otpCode.trim(), newPin: newPin.trim(), confirmPin: confirmPin.trim() },
  });
}

export async function requestEmailReauthOtp(): Promise<{ tempToken: string; emailMasked: string; message?: string }> {
  return apiFetch(`${AUTH_API_BASE}/reauth/request`, {
    method: 'POST',
    body: {},
  });
}

export async function verifyEmailReauthOtp(tempToken: string, otpCode: string): Promise<{ grant: string }> {
  return apiFetch(`${AUTH_API_BASE}/reauth/verify`, {
    method: 'POST',
    body: { tempToken, otpCode: otpCode.trim() },
  });
}

export async function getIdentityReviewStatus(): Promise<{
  identityVerified: boolean;
  identityVerificationRequired: boolean;
  reviewStatus: string | null;
  reviewId: string | null;
  reviewReason?: string | null;
}> {
  return apiFetch(`${VERIFICATION_API_BASE}/review-status`);
}

export async function logoutAccount(): Promise<void> {
  try {
    const token = await getStoredSessionToken();
    if (token) {
      await apiFetch(`${AUTH_API_BASE}/logout`, { method: 'POST', body: {} });
    }
  } catch {
    // Always wipe local credentials even if network call fails
  } finally {
    await clearAllAuthStorage();
  }
}
