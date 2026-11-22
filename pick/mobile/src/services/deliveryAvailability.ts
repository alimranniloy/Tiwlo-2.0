import { fetchWithTimeoutAndRetry, getPickAccessToken } from './auth';
import { PICK_API_URL } from '../config/api';

export interface DeliveryAvailability {
  status: 'available' | 'unavailable' | 'unknown';
  count: number;
}

export async function getDeliveryAvailability(): Promise<DeliveryAvailability> {
  const token = await getPickAccessToken();
  if (!token) throw new Error('Sign in to check nearby delivery partners.');

  const response = await fetchWithTimeoutAndRetry(`${PICK_API_URL}/delivery/availability`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
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
