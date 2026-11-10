import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DELIVERY_VEHICLE_POLICIES,
  canTransitionDeliveryJob,
  getDeliveryOrderStatus,
  isGroceryDeliveryJobEligible,
  isDeliveryJobEligible,
  normalizeDeliveryVehicleType,
  validateVehicleCapacity
} from './deliveryLogic.js';

const policy = DEFAULT_DELIVERY_VEHICLE_POLICIES.find((item) => item.vehicleType === 'bicycle');
const zones = [{
  id: 'zone-1',
  active: true,
  centerLatitude: 23.8103,
  centerLongitude: 90.4125,
  radiusMeters: 10000
}];
const driver = {
  applicationStatus: 'approved',
  isOnDuty: true,
  vehicleType: 'bicycle',
  vehicleCapacityKg: 20,
  latitude: 23.8103,
  longitude: 90.4125,
  accuracy: 10,
  currentLocationAt: new Date().toISOString()
};
const order = {
  parcelDetails: {
    sender: { latitude: 23.811, longitude: 90.413 },
    recipient: { latitude: 23.812, longitude: 90.414 },
    package: { weight: 5 }
  }
};

test('normalizes PICK parcel vehicle labels to delivery categories', () => {
  assert.equal(normalizeDeliveryVehicleType('Mountain Bike'), 'bicycle');
  assert.equal(normalizeDeliveryVehicleType('Pickup Truck'), 'pickup');
  assert.equal(normalizeDeliveryVehicleType('unknown'), null);
});

test('validates a registered capacity against its vehicle policy', () => {
  assert.equal(validateVehicleCapacity('15', policy), 15);
  assert.throws(() => validateVehicleCapacity('30', policy), /up to 25 kg/);
});

test('offers jobs only to approved, on-duty, nearby, in-coverage drivers with capacity', () => {
  assert.equal(isDeliveryJobEligible({ driver, order, policy, coverageZones: zones }), true);
  assert.equal(isDeliveryJobEligible({
    driver: { ...driver, applicationStatus: 'pending' },
    order,
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isDeliveryJobEligible({
    driver: { ...driver, vehicleCapacityKg: 2 },
    order,
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isDeliveryJobEligible({
    driver: { ...driver, vehicleCapacityKg: 30 },
    order,
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isDeliveryJobEligible({
    driver: { ...driver, currentLocationAt: '2000-01-01T00:00:00Z' },
    order,
    policy,
    coverageZones: zones
  }), false);
});

test('offers grocery jobs only when the hub, customer, and available rider share a valid delivery route', () => {
  const pickupLocation = { address: 'PICK Hub', latitude: 23.811, longitude: 90.413 };
  const groceryOrder = { deliveryLatitude: 23.812, deliveryLongitude: 90.414 };
  assert.equal(isGroceryDeliveryJobEligible({
    driver,
    order: groceryOrder,
    pickupLocation,
    policy,
    coverageZones: zones
  }), true);
  assert.equal(isGroceryDeliveryJobEligible({
    driver: { ...driver, applicationStatus: 'pending' },
    order: groceryOrder,
    pickupLocation,
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isGroceryDeliveryJobEligible({
    driver,
    order: groceryOrder,
    pickupLocation: { ...pickupLocation, latitude: 24 },
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isGroceryDeliveryJobEligible({
    driver,
    order: { deliveryLatitude: null, deliveryLongitude: null },
    pickupLocation,
    policy,
    coverageZones: zones
  }), false);
  assert.equal(isGroceryDeliveryJobEligible({
    driver: { ...driver, vehicleCapacityKg: 0 },
    order: groceryOrder,
    pickupLocation,
    policy,
    coverageZones: zones
  }), false);
});

test('enforces delivery-job transitions and mirrors progress to customer order status', () => {
  assert.equal(canTransitionDeliveryJob('accepted', 'picked_up'), true);
  assert.equal(canTransitionDeliveryJob('accepted', 'delivered'), false);
  assert.equal(canTransitionDeliveryJob('picked_up', 'delivered'), true);
  assert.equal(getDeliveryOrderStatus('picked_up'), 'in_transit');
});
