import { fetchWithTimeoutAndRetry, getPickAccessToken } from '../../../mobile/src/services/auth';
import { getPickDeviceHeaders } from '../../../mobile/src/utils/deviceHeaders';
import { PICK_API_URL } from '../../../mobile/src/config/api';
import type { DeliveryRouteEstimate } from '../../../mobile/src/services/orders';

export interface DeliveryPolicy {
  vehicleType: string;
  nameEn: string;
  maxCapacityKg: number;
  pickupRangeMeters: number;
  deliveryRangeMeters: number;
}

export interface DeliveryProfile {
  vehicleType: string;
  vehicleName: string;
  vehicleCapacityKg: number;
  vehicleRegistration: string;
  applicationStatus: 'pending' | 'approved' | 'rejected';
  applicationNote: string;
  reviewedAt: string | null;
  isOnDuty: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAccuracy: number | null;
  currentLocationAt: string | null;
  lastSeenAt: string | null;
  policy: {
    maxCapacityKg: number;
    pickupRangeMeters: number;
    deliveryRangeMeters: number;
  };
}

export interface DeliveryOffer {
  id: string;
  orderType: 'grocery' | 'parcel';
  status: string;
  createdAt: string;
  total: number;
  deliveryAddress: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  recipientAddress: string;
  recipientLatitude: number;
  recipientLongitude: number;
  recipientName: string;
  weightKg: number | null;
  category: string;
  vehicleName: string;
  items: { name: string; quantity: number; unit: string }[];
}

export interface DeliveryJob {
  assignmentId: string;
  orderId: string;
  orderType: 'grocery' | 'parcel';
  status: 'accepted' | 'picked_up';
  acceptedAt: string;
  pickedUpAt: string | null;
  updatedAt: string;
  total: number;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  items: { name: string; quantity: number; unit: string }[];
  parcelDetails: {
    sender?: { address?: string; latitude?: number; longitude?: number; name?: string; phone?: string };
    recipient?: { address?: string; latitude?: number; longitude?: number; name?: string; phone?: string };
    package?: { weight?: number; categoryNameEn?: string };
  };
}

export async function getDeliveryJobRouteEstimate(
  assignmentId: string
): Promise<DeliveryRouteEstimate> {
  const result = await request<DeliveryRouteEstimate>(
    `/jobs/${encodeURIComponent(assignmentId)}/tracking-route`
  );
  if (!Number.isFinite(result.durationSeconds) || result.durationSeconds < 0 ||
      !Number.isFinite(result.distanceMeters) || result.distanceMeters < 0 ||
      !Number.isInteger(result.etaMinutes) || result.etaMinutes < 0 ||
      typeof result.encodedPolyline !== 'string') {
    throw new Error('PICK Delivery returned an invalid route estimate.');
  }
  return result;
}

export interface DeliveryOptions {
  vehicles: DeliveryPolicy[];
  addressVerified: boolean;
}

export class DeliveryApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'DeliveryApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getPickAccessToken();
  if (!token) throw new Error('Sign in with your Tiwlo account to continue.');
  const method = (init.method || 'GET').toUpperCase();
  const deviceHeaders = getPickDeviceHeaders();
  const response = await fetchWithTimeoutAndRetry(`${PICK_API_URL}/delivery${path}`, {
    ...init,
    headers: {
      ...deviceHeaders,
      'X-App-Name': 'PICK Delivery',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  }, { timeoutMs: 15000, retries: method === 'GET' ? 2 : 0 });
  if (response.status === 204) return undefined as T;
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null &&
      'error' in result && typeof result.error === 'string'
      ? result.error
      : `PICK Delivery request failed (${response.status}).`;
    throw new DeliveryApiError(message, response.status);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('PICK Delivery returned an invalid response.');
  }
  return result as T;
}

export async function getDeliveryOptions(): Promise<DeliveryOptions> {
  const result = await request<DeliveryOptions>('/options');
  if (!Array.isArray(result.vehicles) || typeof result.addressVerified !== 'boolean') {
    throw new Error('PICK Delivery returned invalid vehicle options.');
  }
  return result;
}

export async function getDeliveryProfile(): Promise<{
  profile: DeliveryProfile | null;
  addressVerified: boolean;
}> {
  const result = await request<{ profile: DeliveryProfile | null; addressVerified: boolean }>('/profile');
  if (typeof result.addressVerified !== 'boolean' ||
      (result.profile !== null && typeof result.profile !== 'object')) {
    throw new Error('PICK Delivery returned an invalid partner profile.');
  }
  return result;
}

export async function submitDeliveryApplication(input: {
  vehicleType: string;
  vehicleCapacityKg: number;
  vehicleRegistration: string;
}): Promise<DeliveryProfile> {
  const result = await request<{ profile: DeliveryProfile }>('/profile', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (!result.profile) throw new Error('PICK Delivery did not save your application.');
  return result.profile;
}

export async function setDeliveryDuty(isOnDuty: boolean): Promise<void> {
  await request('/duty', {
    method: 'PATCH',
    body: JSON.stringify({ isOnDuty })
  });
}

export async function saveDeliveryLocation(location: {
  latitude: number;
  longitude: number;
  accuracy: number;
}): Promise<{ isOnDuty: boolean; coverageAvailable: boolean; coverageArea: string | null }> {
  return request('/location', {
    method: 'POST',
    body: JSON.stringify(location)
  });
}

export async function saveDeliveryPushToken(token: string): Promise<void> {
  await request('/push-token', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export async function removeDeliveryPushToken(): Promise<void> {
  await request('/push-token', { method: 'DELETE' });
}

export async function getDeliveryOffers(): Promise<DeliveryOffer[]> {
  const result = await request<{ offers: DeliveryOffer[] }>('/offers');
  if (!Array.isArray(result.offers)) throw new Error('PICK Delivery returned an invalid offers list.');
  return result.offers;
}

export async function getDeliveryJobs(): Promise<DeliveryJob[]> {
  const result = await request<{ jobs: DeliveryJob[] }>('/jobs');
  if (!Array.isArray(result.jobs)) throw new Error('PICK Delivery returned an invalid jobs list.');
  return result.jobs;
}

export async function acceptDeliveryOffer(orderId: string): Promise<DeliveryJob> {
  const result = await request<{ job: DeliveryJob }>(`/offers/${encodeURIComponent(orderId)}/accept`, {
    method: 'POST'
  });
  if (!result.job) throw new Error('PICK Delivery did not confirm the parcel assignment.');
  return result.job;
}

export async function updateDeliveryJob(
  assignmentId: string,
  status: 'picked_up' | 'delivered' | 'cancelled'
): Promise<void> {
  await request(`/jobs/${encodeURIComponent(assignmentId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}
