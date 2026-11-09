import type { IconName } from '../components/common/PickIcon';
import { PICK_API_URL } from '../config/api';
import { getPickAccessToken } from './auth';
import { OrderSubmission, PaymentMethod } from './orders';

export interface ParcelVehicle {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  eta: string;
  capacity: string;
  capacityEn: string;
  icon: IconName;
}

const VEHICLE_ICONS: IconName[] = ['scooter', 'car', 'pickup', 'truck'];

async function parcelRequest(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const token = await getPickAccessToken();
  if (!token) throw new Error('Sign in with Tiwlo to continue.');
  const response = await fetch(`${PICK_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The PICK server returned an invalid response.');
  }
  const result = value as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'The parcel request failed.');
  }
  return result;
}

export async function getParcelVehicles(): Promise<ParcelVehicle[]> {
  const result = await parcelRequest('/parcel/vehicles');
  if (!Array.isArray(result.vehicles)) throw new Error('The parcel vehicle response is invalid.');
  return result.vehicles.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The parcel catalog contains an invalid vehicle.');
    }
    const vehicle = value as Record<string, unknown>;
    const icon = VEHICLE_ICONS.find((candidate) => candidate === vehicle.icon) ?? 'scooter';
    const price = vehicle.price;
    const maxWeight = vehicle.maxWeightKg;
    const etaMinutes = vehicle.etaMinutes;
    if (typeof vehicle.id !== 'string' ||
        typeof vehicle.nameEn !== 'string' ||
        typeof vehicle.nameBn !== 'string' ||
        typeof price !== 'number' || !Number.isFinite(price) || price < 0 ||
        typeof maxWeight !== 'number' || !Number.isFinite(maxWeight) || maxWeight <= 0 ||
        typeof etaMinutes !== 'number' || !Number.isInteger(etaMinutes) || etaMinutes <= 0) {
      throw new Error('The parcel catalog contains incomplete vehicle details.');
    }
    return {
      id: vehicle.id,
      name: vehicle.nameBn,
      nameEn: vehicle.nameEn,
      price,
      eta: `${etaMinutes} min`,
      capacity: `${maxWeight} কেজি পর্যন্ত`,
      capacityEn: `Up to ${maxWeight} kg`,
      icon
    };
  });
}

export async function createParcelOrder(input: {
  vehicleId: string;
  paymentMethod: PaymentMethod;
  package: {
    categoryId: string;
    categoryName: string;
    weight: number;
    value: number;
    handleWithCare: boolean;
    notes: string;
  };
  recipient: {
    senderName: string;
    senderPhone: string;
    name: string;
    phone: string;
    address: string;
    floor: string;
    senderFloor: string;
    requirePin: boolean;
    whoPays: 'sender' | 'recipient';
    photoProof: boolean;
  };
}): Promise<OrderSubmission> {
  const result = await parcelRequest('/orders/parcel', {
    method: 'POST',
    body: JSON.stringify({
      vehicleId: input.vehicleId,
      paymentMethod: input.paymentMethod,
      parcel: input.package,
      recipient: input.recipient
    })
  });
  if (!result.order || typeof result.order !== 'object') {
    throw new Error('The PICK server did not confirm the parcel order.');
  }
  return {
    ...(result.order as OrderSubmission),
    ...(typeof result.checkoutUrl === 'string' ? { checkoutUrl: result.checkoutUrl } : {}),
    ...(typeof result.expiresAt === 'string' ? { expiresAt: result.expiresAt } : {})
  };
}
