import { fetchWithTimeoutAndRetry, getPickAccessToken } from './auth';
import { getGuestSession } from './guest';
import { PICK_API_URL } from '../config/api';

export interface DeliveryAvailability {
  status: 'available' | 'unavailable' | 'unknown';
  count: number;
}

export async function getDeliveryAvailability(): Promise<DeliveryAvailability> {
  const token = await getPickAccessToken();
  let url = `${PICK_API_URL}/delivery/availability`;
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const guest = await getGuestSession();
    if (!guest?.active || guest.deliveryLatitude === null || guest.deliveryLongitude === null) {
      return { status: 'unknown', count: 0 };
    }
    url = `${url}?latitude=${encodeURIComponent(String(guest.deliveryLatitude))}&longitude=${encodeURIComponent(String(guest.deliveryLongitude))}`;
  }

  const response = await fetchWithTimeoutAndRetry(url, {
    headers,
    cache: 'no-store'
  }, { timeoutMs: 12000, retries: 1 });

  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === 'object' &&
      'error' in value && typeof value.error === 'string'
      ? value.error
      : `Delivery partner availability check failed (${response.status}).`;
    throw new Error(message);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PICK returned an invalid delivery availability response.');
  }

  const result = value as Record<string, unknown>;
  if (
    !['available', 'unavailable', 'unknown'].includes(String(result.status)) ||
    !Number.isInteger(result.count) ||
    Number(result.count) < 0
  ) {
    throw new Error('PICK returned invalid delivery availability details.');
  }
  return {
    status: result.status as DeliveryAvailability['status'],
    count: Number(result.count)
  };
}
