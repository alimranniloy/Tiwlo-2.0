import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryPushMessages, createPickDeliveryRouter } from './deliveryRoutes.js';
import { parsePickGroceryPickupLocation } from './pricing.js';

test('parcel offers use a high-priority system notification and Android ringtone audio stream', () => {
  assert.deepEqual(createDeliveryPushMessages(['ExpoPushToken[device-token-123]'], 'order-1'), [{
    to: 'ExpoPushToken[device-token-123]',
    title: 'New PICK parcel nearby',
    body: 'A parcel that matches your vehicle is ready to accept.',
    sound: 'default',
    priority: 'high',
    channelId: 'pick-delivery-orders-v2',
    ttl: 30,
    data: { type: 'parcel_offer', orderId: 'order-1' }
  }]);
});

test('grocery delivery offers notify partners with a grocery-specific message', () => {
  assert.deepEqual(createDeliveryPushMessages(
    ['ExpoPushToken[device-token-123]'],
    'order-2',
    'grocery'
  ), [{
    to: 'ExpoPushToken[device-token-123]',
    title: 'New PICK grocery delivery nearby',
    body: 'A grocery order in your area is ready to accept.',
    sound: 'default',
    priority: 'high',
    channelId: 'pick-delivery-orders-v2',
    ttl: 30,
    data: { type: 'grocery_offer', orderId: 'order-2' }
  }]);
});

test('grocery pickup locations require an address and valid coordinates', () => {
  assert.deepEqual(parsePickGroceryPickupLocation(JSON.stringify({
    address: 'PICK Hub',
    latitude: 23.8,
    longitude: 90.4
  })), {
    address: 'PICK Hub',
    latitude: 23.8,
    longitude: 90.4
  });
  assert.equal(parsePickGroceryPickupLocation(null), null);
  assert.throws(() => parsePickGroceryPickupLocation('not-json'), /location is invalid/);
  assert.throws(() => parsePickGroceryPickupLocation({
    address: '',
    latitude: 23.8,
    longitude: 90.4
  }), /location is incomplete/);
});

test('delivery vehicle options include the authenticated user address status', async () => {
  const router = createPickDeliveryRouter({
    requireUser: (_req, _res, next) => next(),
    query: async () => ({
      rows: [{
        vehicleType: 'bicycle',
        nameEn: 'Bicycle',
        maxCapacityKg: 25,
        pickupRangeMeters: 4000,
        deliveryRangeMeters: 12000
      }]
    })
  });
  const optionsRoute = router.stack.find((layer) => layer.route?.path === '/options')?.route;
  assert.ok(optionsRoute, 'the options route is registered');

  const handler = optionsRoute.stack[optionsRoute.stack.length - 1].handle;
  const req = { tiwloSession: { user: { addressVerified: true } } };
  let responseBody;
  const res = {
    json(body) {
      responseBody = body;
      return body;
    }
  };
  let routeError;

  await handler(req, res, (error) => {
    routeError = error;
  });

  assert.equal(routeError, undefined);
  assert.deepEqual(responseBody, {
    vehicles: [{
      vehicleType: 'bicycle',
      nameEn: 'Bicycle',
      maxCapacityKg: 25,
      pickupRangeMeters: 4000,
      deliveryRangeMeters: 12000
    }],
    addressVerified: true
  });
});

test('delivery duty stays off until a push token is registered', async () => {
  const statements = [];
  const router = createPickDeliveryRouter({
    requireUser: (_req, _res, next) => next(),
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('FROM pick.delivery_profiles d')) {
        return {
          rows: [{
            vehicleType: 'bicycle',
            vehicleName: 'Bicycle',
            vehicleCapacityKg: 10,
            applicationStatus: 'approved',
            applicationNote: '',
            isOnDuty: false,
            currentLatitude: 23.78,
            currentLongitude: 90.41,
            currentAccuracy: 10,
            currentLocationAt: new Date().toISOString(),
            maxCapacityKg: 25,
            pickupRangeMeters: 4000,
            deliveryRangeMeters: 12000
          }]
        };
      }
      if (sql.includes('SELECT expo_push_token')) return { rows: [{ pushToken: null }] };
      throw new Error(`Unexpected query: ${sql}`);
    }
  });
  const dutyRoute = router.stack.find((layer) => layer.route?.path === '/duty')?.route;
  assert.ok(dutyRoute, 'the duty route is registered');

  const handler = dutyRoute.stack[dutyRoute.stack.length - 1].handle;
  const req = {
    body: { isOnDuty: true },
    tiwloSession: { user: { id: 'rider-1', addressVerified: true } }
  };
  let statusCode = 200;
  let responseBody;
  let routeError;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    }
  };

  await handler(req, res, (error) => {
    routeError = error;
  });

  assert.equal(routeError, undefined);
  assert.equal(statusCode, 409);
  assert.match(responseBody.error, /Register parcel notifications/);
  assert.equal(statements.some((sql) => sql.includes('SET is_on_duty = $2')), false);
});
