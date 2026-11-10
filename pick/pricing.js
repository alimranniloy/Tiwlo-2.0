import { queryPg } from '../server/db/postgres.js';

export function parseGroceryDeliveryFee(rawFee) {
  if (rawFee === null || rawFee === undefined || !/^\d+(\.\d{1,2})?$/.test(String(rawFee))) {
    return null;
  }
  const fee = Number(rawFee);
  return Number.isFinite(fee) && fee <= 1000000 ? fee : null;
}

export async function getPickGroceryDeliveryFee() {
  const { rows } = await queryPg(
    'SELECT value FROM pick.settings WHERE key = $1 LIMIT 1',
    ['grocery_delivery_fee']
  );
  return parseGroceryDeliveryFee(
    rows[0]?.value ?? process.env.PICK_GROCERY_DELIVERY_FEE
  );
}

export function parsePickGroceryPickupLocation(rawLocation) {
  if (rawLocation === null || rawLocation === undefined) return null;

  let location = rawLocation;
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch {
      throw new Error('The saved PICK grocery pickup location is invalid.');
    }
  }
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new Error('The saved PICK grocery pickup location is invalid.');
  }

  const address = typeof location.address === 'string' ? location.address.trim() : '';
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!address || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('The saved PICK grocery pickup location is incomplete.');
  }
  return { address, latitude, longitude };
}

export async function getPickGroceryPickupLocation(executor = queryPg) {
  const { rows } = await executor(
    'SELECT value FROM pick.settings WHERE key = $1 LIMIT 1',
    ['grocery_pickup_location']
  );
  return parsePickGroceryPickupLocation(rows[0]?.value);
}
