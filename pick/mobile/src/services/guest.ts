import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { PICK_API_URL } from '../config/api';
import { fetchWithTimeoutAndRetry } from './auth';
import type { DeliveryCoverage } from './location';
import type { CartEntry } from './orders';

const GUEST_SESSION_KEY = 'pick.tiwlo.guest_session';
const SAVED_CART_KEY = 'pick.tiwlo.saved_cart';

export interface PickPublicConfig {
  guestLoginEnabled: boolean;
  worldwideEnabled: boolean;
}

export interface GuestSessionData {
  active: boolean;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryArea: string;
  deliveryPostalCode: string;
  deliveryPlusCode: string;
  coverage: DeliveryCoverage | null;
}

export class GuestLoginDisabledError extends Error {
  constructor(message = 'Guest login is currently disabled.') {
    super(message);
    this.name = 'GuestLoginDisabledError';
  }
}

export function createEmptyGuestSession(): GuestSessionData {
  return {
    active: true,
    deliveryAddress: '',
    deliveryLatitude: null,
    deliveryLongitude: null,
    deliveryArea: '',
    deliveryPostalCode: '',
    deliveryPlusCode: '',
    coverage: null
  };
}

export async function fetchPickPublicConfig(): Promise<PickPublicConfig> {
  const response = await fetchWithTimeoutAndRetry(`${PICK_API_URL}/public-config`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  }, { timeoutMs: 8000, retries: 1 });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    throw new Error('Could not load PICK configuration.');
  }
  const data = result as Record<string, unknown>;
  return {
    guestLoginEnabled: data.guestLoginEnabled !== false,
    worldwideEnabled: Boolean(data.worldwideEnabled)
  };
}

export async function getGuestSession(): Promise<GuestSessionData | null> {
  try {
    const raw = await SecureStore.getItemAsync(GUEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestSessionData>;
    if (!parsed || parsed.active !== true) return null;
    return {
      active: true,
      deliveryAddress: typeof parsed.deliveryAddress === 'string' ? parsed.deliveryAddress : '',
      deliveryLatitude: typeof parsed.deliveryLatitude === 'number' && Number.isFinite(parsed.deliveryLatitude)
        ? parsed.deliveryLatitude
        : null,
      deliveryLongitude: typeof parsed.deliveryLongitude === 'number' && Number.isFinite(parsed.deliveryLongitude)
        ? parsed.deliveryLongitude
        : null,
      deliveryArea: typeof parsed.deliveryArea === 'string' ? parsed.deliveryArea : '',
      deliveryPostalCode: typeof parsed.deliveryPostalCode === 'string' ? parsed.deliveryPostalCode : '',
      deliveryPlusCode: typeof parsed.deliveryPlusCode === 'string' ? parsed.deliveryPlusCode : '',
      coverage: parsed.coverage && typeof parsed.coverage.available === 'boolean'
        ? parsed.coverage
        : null
    };
  } catch {
    return null;
  }
}

export async function saveGuestSession(data: GuestSessionData): Promise<void> {
  try {
    await SecureStore.setItemAsync(GUEST_SESSION_KEY, JSON.stringify({ ...data, active: true }));
  } catch {
    // Guest persistence is best-effort.
  }
}

export async function clearGuestSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_SESSION_KEY);
  } catch {
    // Ignore storage delete errors.
  }
}

async function getCurrentGuestPosition() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Location is taking too long. Check location services and try again.')),
          15000
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function checkGuestLocation(): Promise<GuestSessionData> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is needed to find your delivery address.');
  }

  const position = await getCurrentGuestPosition();
  const response = await fetchWithTimeoutAndRetry(`${PICK_API_URL}/guest/location-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 0
    })
  }, { timeoutMs: 12000, retries: 1 });

  const result = await response.json().catch(() => ({}));
  if (response.status === 403 && result?.code === 'GUEST_LOGIN_DISABLED') {
    throw new GuestLoginDisabledError(result.error || 'Guest login is currently disabled.');
  }
  if (!response.ok || !result?.address || !result?.coverage ||
      typeof result.coverage.available !== 'boolean') {
    throw new Error(result?.error || 'Could not resolve your delivery address.');
  }

  const nextGuest: GuestSessionData = {
    active: true,
    deliveryAddress: String(result.address.formattedAddress || ''),
    deliveryLatitude: position.coords.latitude,
    deliveryLongitude: position.coords.longitude,
    deliveryArea: String(result.address.area || ''),
    deliveryPostalCode: String(result.address.postalCode || ''),
    deliveryPlusCode: String(result.address.plusCode || ''),
    coverage: result.coverage as DeliveryCoverage
  };
  await saveGuestSession(nextGuest);
  return nextGuest;
}

export async function getSavedCartFromStorage(): Promise<CartEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(SAVED_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is CartEntry =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof entry.productId === 'string' &&
        Number.isInteger(entry.unitIndex) &&
        entry.unitIndex >= 0 &&
        Number.isInteger(entry.quantity) &&
        entry.quantity > 0
      )
    );
  } catch {
    return [];
  }
}

export async function saveCartToStorage(cart: CartEntry[]): Promise<void> {
  try {
    if (!cart.length) {
      await SecureStore.deleteItemAsync(SAVED_CART_KEY);
      return;
    }
    await SecureStore.setItemAsync(SAVED_CART_KEY, JSON.stringify(cart));
  } catch {
    // Cart persistence is best-effort.
  }
}

export async function clearSavedCartStorage(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SAVED_CART_KEY);
  } catch {
    // Ignore storage delete errors.
  }
}
