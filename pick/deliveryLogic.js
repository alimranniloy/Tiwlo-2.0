import { distanceBetweenCoordinatesMeters, findCoverageZone } from './coverage.js';

export const DEFAULT_DELIVERY_VEHICLE_POLICIES = Object.freeze([
  { vehicleType: 'walking', nameEn: 'Walking', maxCapacityKg: 10, pickupRangeMeters: 1500, deliveryRangeMeters: 6000 },
  { vehicleType: 'bicycle', nameEn: 'Bicycle', maxCapacityKg: 25, pickupRangeMeters: 4000, deliveryRangeMeters: 12000 },
  { vehicleType: 'motorbike', nameEn: 'Motorbike', maxCapacityKg: 35, pickupRangeMeters: 8000, deliveryRangeMeters: 25000 },
  { vehicleType: 'car', nameEn: 'Car', maxCapacityKg: 150, pickupRangeMeters: 12000, deliveryRangeMeters: 40000 },
  { vehicleType: 'pickup', nameEn: 'Pickup truck', maxCapacityKg: 500, pickupRangeMeters: 15000, deliveryRangeMeters: 50000 }
]);

const VEHICLE_ALIASES = new Map([
  ['walk', 'walking'],
  ['foot', 'walking'],
  ['bike', 'bicycle'],
  ['cycle', 'bicycle'],
  ['motorcycle', 'motorbike'],
  ['scooter', 'motorbike'],
  ['van', 'car'],
  ['pickup truck', 'pickup'],
  ['pickup_truck', 'pickup']
]);

const JOB_TRANSITIONS = Object.freeze({
  accepted: new Set(['picked_up', 'cancelled']),
  picked_up: new Set(['delivered']),
  delivered: new Set(),
  cancelled: new Set()
});

export function normalizeDeliveryVehicleType(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  if (VEHICLE_ALIASES.has(normalized)) return VEHICLE_ALIASES.get(normalized);
  if (['walking', 'bicycle', 'motorbike', 'car', 'pickup'].includes(normalized)) {
    return normalized;
  }
  const words = normalized.split('_');
  if (words.some((word) => ['walk', 'walking', 'foot'].includes(word))) return 'walking';
  if (words.some((word) => ['cycle', 'bicycle', 'bike'].includes(word))) return 'bicycle';
  if (words.some((word) => ['motorbike', 'motorcycle', 'scooter'].includes(word))) return 'motorbike';
  if (words.some((word) => ['pickup', 'truck'].includes(word))) return 'pickup';
  if (words.some((word) => ['car', 'van'].includes(word))) return 'car';
  return null;
}

export function isValidDriverLocation(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const accuracy = Number(location?.accuracy);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 200;
}

export function validateVehicleCapacity(value, policy) {
  const capacityKg = Number(value);
  if (!Number.isFinite(capacityKg) || capacityKg <= 0 ||
      capacityKg > Number(policy?.maxCapacityKg)) {
    throw new TypeError(`Enter a vehicle capacity up to ${policy?.maxCapacityKg} kg.`);
  }
  return capacityKg;
}

export function isDeliveryJobEligible({
  driver,
  order,
  policy,
  coverageZones,
  now = Date.now(),
  maxLocationAgeMs = 120_000
}) {
  if (!driver || !order || !policy ||
      driver.applicationStatus !== 'approved' ||
      driver.isOnDuty !== true ||
      driver.vehicleType !== policy.vehicleType ||
      !Number.isFinite(Number(driver.vehicleCapacityKg)) ||
      Number(driver.vehicleCapacityKg) <= 0 ||
      Number(driver.vehicleCapacityKg) > Number(policy.maxCapacityKg) ||
      !isValidDriverLocation(driver)) return false;

  const locationTime = Date.parse(driver.currentLocationAt);
  if (!Number.isFinite(locationTime) || now - locationTime < 0 ||
      now - locationTime > maxLocationAgeMs) return false;

  const sender = order.parcelDetails?.sender;
  const recipient = order.parcelDetails?.recipient;
  const senderLatitude = Number(sender?.latitude);
  const senderLongitude = Number(sender?.longitude);
  const recipientLatitude = Number(recipient?.latitude);
  const recipientLongitude = Number(recipient?.longitude);
  if (![senderLatitude, senderLongitude, recipientLatitude, recipientLongitude].every(Number.isFinite)) {
    return false;
  }

  const driverZone = findCoverageZone(driver.latitude, driver.longitude, coverageZones);
  const pickupZone = findCoverageZone(senderLatitude, senderLongitude, coverageZones);
  const deliveryZone = findCoverageZone(recipientLatitude, recipientLongitude, coverageZones);
  if (!driverZone.available || !pickupZone.available || !deliveryZone.available ||
      driverZone.zone.id !== pickupZone.zone.id ||
      pickupZone.zone.id !== deliveryZone.zone.id) return false;

  const pickupDistanceMeters = distanceBetweenCoordinatesMeters(
    driver.latitude,
    driver.longitude,
    senderLatitude,
    senderLongitude
  );
  const deliveryDistanceMeters = distanceBetweenCoordinatesMeters(
    senderLatitude,
    senderLongitude,
    recipientLatitude,
    recipientLongitude
  );
  const parcelWeightKg = Number(order.parcelDetails?.package?.weight);
  return Number.isFinite(parcelWeightKg) && parcelWeightKg > 0 &&
    parcelWeightKg <= Number(driver.vehicleCapacityKg) &&
    pickupDistanceMeters <= Number(policy.pickupRangeMeters) &&
    deliveryDistanceMeters <= Number(policy.deliveryRangeMeters);
}

export function isGroceryDeliveryJobEligible({
  driver,
  order,
  pickupLocation,
  policy,
  coverageZones,
  now = Date.now(),
  maxLocationAgeMs = 120_000
}) {
  if (!driver || !order || !pickupLocation || !policy ||
      driver.applicationStatus !== 'approved' ||
      driver.isOnDuty !== true ||
      driver.vehicleType !== policy.vehicleType ||
      !Number.isFinite(Number(driver.vehicleCapacityKg)) ||
      Number(driver.vehicleCapacityKg) <= 0 ||
      Number(driver.vehicleCapacityKg) > Number(policy.maxCapacityKg) ||
      !isValidDriverLocation(driver)) return false;

  const locationTime = Date.parse(driver.currentLocationAt);
  const pickupLatitude = Number(pickupLocation.latitude);
  const pickupLongitude = Number(pickupLocation.longitude);
  const recipientLatitude = Number(order.deliveryLatitude);
  const recipientLongitude = Number(order.deliveryLongitude);
  if (!Number.isFinite(locationTime) || now - locationTime < 0 ||
      now - locationTime > maxLocationAgeMs ||
      ![pickupLatitude, pickupLongitude, recipientLatitude, recipientLongitude].every(Number.isFinite)) {
    return false;
  }

  const driverZone = findCoverageZone(driver.latitude, driver.longitude, coverageZones);
  const pickupZone = findCoverageZone(pickupLatitude, pickupLongitude, coverageZones);
  const deliveryZone = findCoverageZone(recipientLatitude, recipientLongitude, coverageZones);
  if (!driverZone.available || !pickupZone.available || !deliveryZone.available ||
      driverZone.zone.id !== pickupZone.zone.id ||
      pickupZone.zone.id !== deliveryZone.zone.id) return false;

  const pickupDistanceMeters = distanceBetweenCoordinatesMeters(
    driver.latitude,
    driver.longitude,
    pickupLatitude,
    pickupLongitude
  );
  const deliveryDistanceMeters = distanceBetweenCoordinatesMeters(
    pickupLatitude,
    pickupLongitude,
    recipientLatitude,
    recipientLongitude
  );
  return pickupDistanceMeters <= Number(policy.pickupRangeMeters) &&
    deliveryDistanceMeters <= Number(policy.deliveryRangeMeters);
}

export function countAvailableGroceryDrivers({
  drivers,
  deliveryLatitude,
  deliveryLongitude,
  pickupLocation,
  coverageZones,
  now = Date.now(),
  maxLocationAgeMs = 120_000
}) {
  const order = { deliveryLatitude, deliveryLongitude };
  return drivers.filter((driver) => isGroceryDeliveryJobEligible({
    driver,
    order,
    pickupLocation,
    policy: driver,
    coverageZones,
    now,
    maxLocationAgeMs
  })).length;
}

export function canTransitionDeliveryJob(currentStatus, nextStatus) {
  return JOB_TRANSITIONS[currentStatus]?.has(nextStatus) === true;
}

export function getDeliveryOrderStatus(jobStatus) {
  if (jobStatus === 'accepted') return 'preparing';
  if (jobStatus === 'picked_up') return 'in_transit';
  if (jobStatus === 'delivered') return 'delivered';
  return null;
}
