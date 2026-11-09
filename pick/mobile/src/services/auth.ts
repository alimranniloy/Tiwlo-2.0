import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { API_ORIGIN, PICK_API_URL, PICK_AUTH_CALLBACK } from '../config/api';

const SESSION_KEY = 'pick.tiwlo.session';
const APPEAL_SESSION_KEY = 'pick.tiwlo.appeal_session';
const PENDING_VERIFIER_KEY = 'pick.auth.pending_verifier';
const PENDING_STATE_KEY = 'pick.auth.pending_state';
const PENDING_CHALLENGE_KEY = 'pick.auth.pending_challenge';

export interface PickUser {
  id: string;
  tiwiId: string;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  deliveryAddress: string;
  deliveryAddressVerified: boolean;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryArea: string;
  deliveryPostalCode: string;
  deliveryPlusCode: string;
  isBanned?: boolean;
  banReason?: string;
}

interface AuthResult {
  sessionToken: string;
  user: PickUser;
}

export class PickAccountDisabledError extends Error {
  constructor(
    readonly sessionToken: string,
    readonly user: PickUser,
    message: string
  ) {
    super(message);
    this.name = 'PickAccountDisabledError';
  }
}

export class PickAccountRestoredError extends Error {
  constructor(readonly user: PickUser) {
    super('Your Tiwlo account has been restored. Please sign in again.');
    this.name = 'PickAccountRestoredError';
  }
}

export interface AuthChallenge {
  success: boolean;
  isBanned?: boolean;
  requiresAddressVerification?: boolean;
  requiresEmailVerification?: boolean;
  requires2FA?: boolean;
  requires2FASetup?: boolean;
  tempToken?: string;
  email?: string;
  emailMasked?: string;
  delivered?: boolean;
  message?: string;
  newTempToken?: string;
  sessionToken?: string;
  user?: PickUser;
}

export class AuthRateLimitError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number | null) {
    super(message);
    this.name = 'AuthRateLimitError';
  }
}

export interface PickAccountAppeal {
  id: string;
  ticketId: string;
  subject: string;
  description: string;
  status: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VerifiedPickAddress {
  formattedAddress: string;
  area: string;
  postalCode: string;
  plusCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export interface PickCoverageZone {
  id: string;
  nameEn: string;
  nameBn: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

function isAuthChallenge(value: unknown): value is AuthChallenge {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'success' in value &&
    typeof value.success === 'boolean' &&
    'tempToken' in value &&
    typeof value.tempToken === 'string'
  );
}

export async function savePendingAuthChallenge(challenge: AuthChallenge): Promise<void> {
  if (!challenge.tempToken) return;
  await SecureStore.setItemAsync(PENDING_CHALLENGE_KEY, JSON.stringify(challenge));
}

export async function getPendingAuthChallenge(): Promise<AuthChallenge | null> {
  const storedChallenge = await SecureStore.getItemAsync(PENDING_CHALLENGE_KEY);
  if (!storedChallenge) return null;
  try {
    const challenge: unknown = JSON.parse(storedChallenge);
    if (isAuthChallenge(challenge) && challenge.tempToken) return challenge;
  } catch {
    await SecureStore.deleteItemAsync(PENDING_CHALLENGE_KEY);
    return null;
  }
  await SecureStore.deleteItemAsync(PENDING_CHALLENGE_KEY);
  return null;
}

export async function clearPendingAuthChallenge(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_CHALLENGE_KEY);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function exchangeCallbackUrl(callbackUrl: string): Promise<AuthResult> {
  const callback = new URL(callbackUrl);
  if (`${callback.protocol}//${callback.host}${callback.pathname}` !== PICK_AUTH_CALLBACK) {
    throw new Error('The sign-in return link is invalid.');
  }

  const code = callback.searchParams.get('code');
  const receivedState = callback.searchParams.get('state');
  const [expectedState, codeVerifier] = await Promise.all([
    SecureStore.getItemAsync(PENDING_STATE_KEY),
    SecureStore.getItemAsync(PENDING_VERIFIER_KEY)
  ]);
  if (!code || !receivedState || !expectedState || receivedState !== expectedState || !codeVerifier) {
    throw new Error('The sign-in request expired. Please try again.');
  }

  const response = await fetch(`${PICK_API_URL}/auth/mobile-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || !result.user) {
    throw new Error(result.error || 'Could not complete PICK sign-in.');
  }

  if (result.isBanned && result.appealSessionToken) {
    await saveAppealSession(result.appealSessionToken);
    await clearPendingAuthChallenge();
    await Promise.all([
      SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY),
      SecureStore.deleteItemAsync(PENDING_STATE_KEY)
    ]);
    return { sessionToken: result.appealSessionToken, user: result.user as PickUser };
  }
  if (!result.sessionToken) throw new Error('Could not complete PICK sign-in.');

  await savePickSession(result.sessionToken);
  let session: AuthResult | null;
  try {
    session = await getStoredPickSession();
  } catch (error) {
    if (!(error instanceof PickAccountDisabledError)) throw error;
    session = { sessionToken: error.sessionToken, user: error.user };
  }
  if (!session) throw new Error('The PICK account could not be loaded after sign-in.');
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY),
    SecureStore.deleteItemAsync(PENDING_STATE_KEY)
  ]);
  return session;
}

async function createPendingAuthRequest() {
  const verifier = bytesToHex(await Crypto.getRandomBytesAsync(32));
  const state = bytesToHex(await Crypto.getRandomBytesAsync(32));
  const codeChallenge = toBase64Url(await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  ));
  await Promise.all([
    SecureStore.setItemAsync(PENDING_VERIFIER_KEY, verifier),
    SecureStore.setItemAsync(PENDING_STATE_KEY, state)
  ]);
  const callbackUrl = Linking.createURL('auth/callback', { scheme: 'pick' });
  if (callbackUrl !== PICK_AUTH_CALLBACK) {
    await Promise.all([
      SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY),
      SecureStore.deleteItemAsync(PENDING_STATE_KEY)
    ]);
    throw new Error('PICK sign-in is unavailable in this app environment. Use a development or production build.');
  }
  return { codeChallenge, callbackUrl };
}

async function clearPendingAuthRequest() {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY),
    SecureStore.deleteItemAsync(PENDING_STATE_KEY)
  ]);
}

export async function startTiwloSignIn(mode: 'login' | 'signup' = 'login'): Promise<AuthResult | null> {
  const { codeChallenge, callbackUrl } = await createPendingAuthRequest();
  const state = await SecureStore.getItemAsync(PENDING_STATE_KEY);
  if (!state) throw new Error('The sign-in request could not be prepared. Please try again.');
  const startUrl = new URL(`${PICK_API_URL}/auth/mobile-start`);
  startUrl.searchParams.set('code_challenge', codeChallenge);
  startUrl.searchParams.set('state', state);
  startUrl.searchParams.set('mode', mode);

  try {
    const result = await WebBrowser.openAuthSessionAsync(startUrl.toString(), callbackUrl);
    if (result.type !== 'success') {
      await clearPendingAuthRequest();
      return null;
    }
    return await exchangeCallbackUrl(result.url);
  } catch (error) {
    await clearPendingAuthRequest();
    throw error;
  }
}

export async function startPickSocialSignIn(
  provider: 'google' | 'github'
): Promise<AuthResult | AuthChallenge | null> {
  await clearPendingAuthChallenge();
  const { codeChallenge, callbackUrl } = await createPendingAuthRequest();
  const state = await SecureStore.getItemAsync(PENDING_STATE_KEY);
  try {
    if (!state) throw new Error('The sign-in request could not be prepared. Please try again.');
    const startUrl = new URL(`${API_ORIGIN}/api/auth/${provider}`);
    startUrl.searchParams.set('return_to', PICK_AUTH_CALLBACK);
    startUrl.searchParams.set('pick_code_challenge', codeChallenge);
    startUrl.searchParams.set('pick_state', state);
    const result = await WebBrowser.openAuthSessionAsync(startUrl.toString(), callbackUrl);
    if (result.type !== 'success') {
      await clearPendingAuthRequest();
      return null;
    }

    const callback = new URL(result.url);
    if (`${callback.protocol}//${callback.host}${callback.pathname}` !== PICK_AUTH_CALLBACK) {
      throw new Error('The sign-in return link is invalid.');
    }
    const callbackData = new URLSearchParams(callback.hash.slice(1));
    const challengeType = callbackData.get('auth_challenge');
    const tempToken = callbackData.get('temp_token');
    if (challengeType && tempToken) {
      if (callbackData.get('state') !== state) {
        throw new Error('The sign-in request could not be verified. Please try again.');
      }
      await clearPendingAuthRequest();
      const challenge: AuthChallenge = {
        success: true,
        requires2FA: challengeType === '2fa',
        requires2FASetup: challengeType === 'setup2fa',
        requiresAddressVerification: callbackData.get('requires_address_verification') === 'true',
        tempToken,
        emailMasked: callbackData.get('email_masked') || '',
        message: callbackData.get('message') || ''
      };
      await savePendingAuthChallenge(challenge);
      return challenge;
    }
    return await exchangeCallbackUrl(result.url);
  } catch (error) {
    await clearPendingAuthRequest();
    throw error;
  }
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<AuthChallenge> {
  const response = await fetch(`${API_ORIGIN}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (result.isBanned && result.appealSessionToken) {
    await saveAppealSession(result.appealSessionToken);
    try {
      await getStoredPickSession();
    } catch (error) {
      if (error instanceof PickAccountDisabledError) {
        return {
          ...result,
          success: true,
          isBanned: true,
          user: error.user
        } as AuthChallenge;
      }
      throw error;
    }
  }
  if (!response.ok || !result.success) {
    if (response.status === 429) {
      throw new AuthRateLimitError(
        result.error || 'Too many requests. Please wait before trying again.',
        getRetryAfterSeconds(response)
      );
    }
    throw new Error(result.error || 'PICK authentication could not be completed.');
  }
  const challenge = result as AuthChallenge;
  await savePendingAuthChallenge(challenge);
  return challenge;
}

function getRetryAfterSeconds(response: Response): number | null {
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) && retryAt > Date.now()
    ? Math.ceil((retryAt - Date.now()) / 1000)
    : null;
}

async function postPasswordRecovery(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_ORIGIN}/api/auth/forgot-password/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    if (response.status === 429) {
      throw new AuthRateLimitError(
        result.error || 'Too many requests. Please wait before trying again.',
        getRetryAfterSeconds(response)
      );
    }
    throw new Error(result.error || 'Could not complete password recovery.');
  }
  return result as Record<string, unknown>;
}

export async function requestPickPasswordReset(identifier: string): Promise<{
  resetToken: string;
  emailMasked: string;
}> {
  const result = await postPasswordRecovery('request', { identifier });
  if (typeof result.resetToken !== 'string' || typeof result.emailMasked !== 'string') {
    throw new Error('The password recovery response was invalid.');
  }
  return { resetToken: result.resetToken, emailMasked: result.emailMasked };
}

export async function verifyPickPasswordResetCode(
  resetToken: string,
  otpCode: string
): Promise<string> {
  const result = await postPasswordRecovery('verify-code', { resetToken, otpCode });
  if (typeof result.resetToken !== 'string') {
    throw new Error('The password reset verification response was invalid.');
  }
  return result.resetToken;
}

export async function resetPickPassword(
  resetToken: string,
  newPassword: string
): Promise<void> {
  await postPasswordRecovery('reset', { resetToken, newPassword });
}

async function savePickSession(sessionToken: string): Promise<void> {
  await SecureStore.deleteItemAsync(APPEAL_SESSION_KEY);
  await SecureStore.setItemAsync(SESSION_KEY, sessionToken);
}

async function saveAppealSession(sessionToken: string): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.setItemAsync(APPEAL_SESSION_KEY, sessionToken);
}

async function completePickAuthentication(result: AuthChallenge): Promise<AuthChallenge> {
  if (!result.sessionToken) return result;
  await savePickSession(result.sessionToken);
  try {
    const session = await getStoredPickSession();
    if (!session) throw new Error('The PICK account could not be loaded after sign-in.');
    await clearPendingAuthChallenge();
    return { ...result, user: session.user };
  } catch (error) {
    if (error instanceof PickAccountDisabledError) {
      await clearPendingAuthChallenge();
      return { ...result, isBanned: true, user: error.user };
    }
    throw error;
  }
}

export async function verifyPickAddress(address: string): Promise<{
  verificationToken: string;
  address: VerifiedPickAddress;
}> {
  const response = await fetch(`${PICK_API_URL}/auth/verify-address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.verified !== true || !result.verificationToken || !result.address) {
    throw new Error(result.error || 'Google could not verify this delivery address.');
  }
  return result as { verificationToken: string; address: VerifiedPickAddress };
}

export async function saveVerifiedPickAddress(verificationToken: string): Promise<{
  user: PickUser;
  coverage: {
    available: boolean;
    zone: PickCoverageZone | null;
    distanceMeters: number | null;
  };
}> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Sign in to PICK before verifying your delivery address.');
  const response = await fetch(`${PICK_API_URL}/address-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ verificationToken })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.user || !result.coverage) {
    throw new Error(result.error || 'Could not save your verified PICK address.');
  }
  return result as {
    user: PickUser;
    coverage: {
      available: boolean;
      zone: PickCoverageZone | null;
      distanceMeters: number | null;
    };
  };
}

export async function checkPickPhoneAvailability(phone: string): Promise<boolean> {
  const response = await fetch(`${API_ORIGIN}/api/auth/check-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.available !== 'boolean') {
    throw new Error(result.error || 'Could not check mobile number availability.');
  }
  return result.available;
}

export async function registerPickAccount(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthChallenge> {
  await clearPendingAuthChallenge();
  const phoneDigits = input.phone.replace(/\D/g, '');
  const nationalDigits = phoneDigits.startsWith('880')
    ? phoneDigits.slice(3)
    : phoneDigits.startsWith('0')
      ? phoneDigits.slice(1)
      : phoneDigits;
  const handle = `pick${nationalDigits.slice(-10)}`;
  return postAuth('register', {
    signupSource: 'pick_app',
    accountType: 'personal',
    name: input.name,
    storeName: input.name,
    handle,
    email: input.email,
    phone: input.phone,
    billingDetails: {
      address: '',
      city: '',
      country: 'Bangladesh',
      phone: input.phone
    },
    password: input.password
  });
}

export async function loginPickAccount(identifier: string, password: string): Promise<AuthChallenge> {
  await clearPendingAuthChallenge();
  return postAuth('login', { identifier, password, clientSource: 'pick_app' });
}

export async function getPickAccountAppeal(): Promise<PickAccountAppeal | null> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Sign in to PICK to view your account review request.');
  const response = await fetch(`${PICK_API_URL}/account-appeals`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Could not load your account review request.');
  }
  return (result.appeal || null) as PickAccountAppeal | null;
}

export async function submitPickAccountAppeal(message: string): Promise<PickAccountAppeal> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Sign in to PICK before contacting support.');
  const response = await fetch(`${PICK_API_URL}/account-appeals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ message })
  });
  const result = await response.json().catch(() => ({}));
  if ((!response.ok && response.status !== 409) || !result.appeal) {
    throw new Error(result.error || 'Could not submit your account review request.');
  }
  return result.appeal as PickAccountAppeal;
}

export async function verifyPickEmail(tempToken: string, otpCode: string): Promise<AuthChallenge> {
  return postAuth('verify-email', { tempToken, otpCode });
}

export async function resendPickEmailVerification(tempToken: string): Promise<AuthChallenge> {
  const result = await postAuth('resend-email-verification', { tempToken });
  const challenge = {
    ...result,
    tempToken: result.newTempToken || tempToken
  };
  await savePendingAuthChallenge(challenge);
  return challenge;
}

export async function verifyPickTwoFactor(
  tempToken: string,
  otpCode: string,
  setup: boolean
): Promise<AuthChallenge> {
  const result = await postAuth(setup ? 'setup-2fa' : 'verify-2fa', { tempToken, otpCode });
  return completePickAuthentication(result);
}

export async function resendPickTwoFactor(
  tempToken: string,
  setup: boolean
): Promise<AuthChallenge> {
  const result = await postAuth(setup ? 'resend-setup-2fa' : 'resend-2fa', { tempToken });
  const challenge = {
    ...result,
    tempToken: result.tempToken || result.newTempToken || tempToken
  };
  await savePendingAuthChallenge(challenge);
  return challenge;
}

export async function getStoredPickSession(): Promise<AuthResult | null> {
  const sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
  if (!sessionToken) {
    const appealToken = await SecureStore.getItemAsync(APPEAL_SESSION_KEY);
    if (!appealToken) return null;
    const response = await fetch(`${PICK_API_URL}/account-status`, {
      headers: { Authorization: `Bearer ${appealToken}` }
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await SecureStore.deleteItemAsync(APPEAL_SESSION_KEY);
      return null;
    }
    if (!response.ok || !result.user) {
      throw new Error(result.error || 'Could not load your account status.');
    }
    if (result.status === 'active' && typeof result.sessionToken === 'string') {
      await savePickSession(result.sessionToken);
      return { sessionToken: result.sessionToken, user: result.user as PickUser };
    }
    if (result.status === 'disabled') {
      throw new PickAccountDisabledError(
        appealToken,
        result.user as PickUser,
        result.user.banReason || 'This Tiwlo account is disabled.'
      );
    }
    if (result.status === 'restored') {
      await SecureStore.deleteItemAsync(APPEAL_SESSION_KEY);
      throw new PickAccountRestoredError(result.user as PickUser);
    }
    throw new Error('The Tiwlo account status response was invalid.');
  }

  const response = await fetch(`${PICK_API_URL}/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  if (response.status === 401) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  const result = await response.json().catch(() => ({}));
  if (response.status === 403 && result.isBanned && result.user) {
    throw new PickAccountDisabledError(
      sessionToken,
      result.user as PickUser,
      result.banReason || result.error || 'This Tiwlo account is disabled.'
    );
  }
  if (!response.ok || !result.user) {
    throw new Error(result.error || 'Could not load your PICK profile.');
  }
  return { sessionToken, user: result.user as PickUser };
}

export async function clearStoredPickSession(): Promise<void> {
  const sessionTokens = await Promise.all([
    SecureStore.getItemAsync(SESSION_KEY),
    SecureStore.getItemAsync(APPEAL_SESSION_KEY)
  ]);
  try {
    for (const sessionToken of new Set(sessionTokens.filter((token): token is string => Boolean(token)))) {
      const response = await fetch(`${PICK_API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      if (!response.ok) throw new Error('Could not sign out from PICK.');
    }
  } finally {
    await Promise.all([
      SecureStore.deleteItemAsync(SESSION_KEY),
      SecureStore.deleteItemAsync(APPEAL_SESSION_KEY),
      clearPendingAuthChallenge()
    ]);
  }
}

export async function getPickAccessToken(): Promise<string | null> {
  const sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
  return sessionToken || await SecureStore.getItemAsync(APPEAL_SESSION_KEY);
}

export async function updatePickProfile(
  updates: Partial<Pick<PickUser, 'name' | 'phone' | 'deliveryAddress'>>
): Promise<PickUser> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('PICK sign-in is required to update your profile.');

  const response = await fetch(`${PICK_API_URL}/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(updates)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.user) {
    throw new Error(result.error || 'Could not update your PICK profile.');
  }
  return result.user as PickUser;
}
