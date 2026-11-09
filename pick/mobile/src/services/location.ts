import * as Location from 'expo-location';
import { getPickAccessToken, PickUser } from './auth';
import { API_ORIGIN, PICK_API_URL } from '../config/api';

async function getCurrentLocationPosition() {
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

export interface DeliveryCoverage {
  available: boolean;
  zone: {
    id: string;
    nameEn: string;
    nameBn: string;
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
  } | null;
  distanceMeters: number | null;
}

export interface SavedDeliveryCoverage {
  hasLocation: boolean;
  address?: string;
  coverage: DeliveryCoverage | null;
}

export async function getSavedDeliveryCoverage(): Promise<SavedDeliveryCoverage> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Sign in to PICK before checking delivery coverage.');
  const response = await fetch(`${PICK_API_URL}/coverage/status`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.hasLocation !== 'boolean') {
    throw new Error(result.error || 'Could not refresh your delivery coverage.');
  }
  if (result.hasLocation && (!result.coverage || typeof result.coverage.available !== 'boolean')) {
    throw new Error('The saved delivery coverage response was invalid.');
  }
  return result as SavedDeliveryCoverage;
}

export async function verifyPreAuthPickAddress(tempToken: string): Promise<void> {
  if (!tempToken) throw new Error('Your sign-in verification expired. Start again.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is needed to verify your address.');
  }
  const position = await getCurrentLocationPosition();
  const response = await fetch(`${API_ORIGIN}/api/auth/pick-address-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 0
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.verified !== true) {
    throw new Error(result.error || 'Tiwlo could not verify your current location.');
  }
}

export async function verifyAndSaveCurrentDeliveryAddress(): Promise<{
  user: PickUser;
  coverage: DeliveryCoverage;
}> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is needed to verify your delivery address.');
  }

  const position = await getCurrentLocationPosition();
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Tiwlo sign-in is required to verify your address.');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`
  };
  const location = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0
  };

  const verificationResponse = await fetch(`${API_ORIGIN}/api/address-verification`, {
    method: 'POST',
    headers,
    body: JSON.stringify(location)
  });
  const verification = await verificationResponse.json().catch(() => ({}));
  if (!verificationResponse.ok || verification.verified !== true) {
    throw new Error(verification.error || 'Tiwlo could not verify your current location.');
  }

  const saveResponse = await fetch(`${PICK_API_URL}/address-verification`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const saved = await saveResponse.json().catch(() => ({}));
  if (!saveResponse.ok || !saved.user || !saved.coverage ||
      typeof saved.coverage.available !== 'boolean') {
    throw new Error(saved.error || 'Could not save your verified PICK address.');
  }

  return {
    user: saved.user as PickUser,
    coverage: saved.coverage as DeliveryCoverage
  };
}

export async function setCurrentDeliveryLocation(): Promise<Pick<PickUser,
  'deliveryAddress' | 'deliveryLatitude' | 'deliveryLongitude' |
  'deliveryArea' | 'deliveryPostalCode' | 'deliveryPlusCode'> & {
    deliveryAddressVerified: true;
    coverage: DeliveryCoverage;
  }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is needed to find your delivery address.');
  }

  const position = await getCurrentLocationPosition();
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Tiwlo sign-in is required to save your location.');

  const response = await fetch(`${PICK_API_URL}/location/reverse-geocode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 0
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.address || !result.coverage ||
      typeof result.coverage.available !== 'boolean') {
    throw new Error(result.error || 'Could not resolve your delivery address.');
  }

  return {
    deliveryAddress: result.address.formattedAddress,
    deliveryAddressVerified: true,
    deliveryLatitude: position.coords.latitude,
    deliveryLongitude: position.coords.longitude,
    deliveryArea: result.address.area,
    deliveryPostalCode: result.address.postalCode,
    deliveryPlusCode: result.address.plusCode,
    coverage: result.coverage as DeliveryCoverage
  };
}

export async function joinCoverageWaitlist(): Promise<void> {
  const sessionToken = await getPickAccessToken();
  if (!sessionToken) throw new Error('Tiwlo sign-in is required to join the waitlist.');
  const response = await fetch(`${PICK_API_URL}/coverage/waitlist`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.joined !== true) {
    throw new Error(result.error || 'Could not join the coverage waitlist.');
  }
}
