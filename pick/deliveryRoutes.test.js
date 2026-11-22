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

test('delivery availability counts only currently eligible nearby on-duty partners', async () => {
  const now = new Date();
  const statements = [];
  const drivers = [23.8103, 23.84].map((latitude) => ({
    vehicleType: 'bicycle',
    vehicleCapacityKg: 20,
    applicationStatus: 'approved',
    isOnDuty: true,
    latitude,
    longitude: 90.4125,
    accuracy: 10,
    currentLocationAt: now,
    maxCapacityKg: 25,
    pickupRangeMeters: 1000,
    deliveryRangeMeters: 12000
  }));
  const router = createPickDeliveryRouter({
    requireUser: (_req, _res, next) => next(),
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('FROM pick.profiles')) {
        return { rows: [{ latitude: 23.812, longitude: 90.414 }] };
      }
      if (sql.includes('FROM pick.settings')) {
        return {
          rows: [{
            value: JSON.stringify({
              address: 'PICK Hub',
              latitude: 23.811,
              longitude: 90.413
            })
          }]
        };
      }
      if (sql.includes('FROM pick.coverage_zones')) {
        return {
          rows: [{
            id: 'zone-1',
            active: true,
            centerLatitude: 23.8103,
            centerLongitude: 90.4125,
            radiusMeters: 10000
          }]
        };
      }
      if (sql.includes('FROM pick.delivery_profiles d')) return { rows: drivers };
      throw new Error(`Unexpected query: ${sql}`);
    }
  });
  const availabilityRoute = router.stack
    .find((layer) => layer.route?.path === '/availability')?.route;
  assert.ok(availabilityRoute, 'the availability route is registered');

  const handler = availabilityRoute.stack[availabilityRoute.stack.length - 1].handle;
  let responseBody;
  let routeError;
  await handler(
    { tiwloSession: { user: { id: 'customer-1' } } },
    { json(body) { responseBody = body; return body; } },
    (error) => { routeError = error; }
  );

  assert.equal(routeError, undefined);
  assert.deepEqual(responseBody, { status: 'available', count: 1 });
  const driverQuery = statements.find((sql) => sql.includes('FROM pick.delivery_profiles d'));
  assert.ok(driverQuery.includes("a.status IN ('accepted', 'picked_up')"));
  assert.equal(driverQuery.includes('expo_push_token IS NOT NULL'), false);
});

test('delivery duty can start without push notification registration', async () => {
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
      if (sql.includes('FROM pick.coverage_zones')) {
        return {
          rows: [{
            id: 'zone-1',
            nameEn: 'Dhaka',
            nameBn: 'ঢাকা',
            centerLatitude: 23.78,
            centerLongitude: 90.41,
            radiusMeters: 5000,
            active: true
          }]
        };
      }
      if (sql.includes('SET is_on_duty = $2')) return { rows: [] };
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
  assert.equal(statusCode, 200);
  assert.deepEqual(responseBody, { isOnDuty: true });
  assert.equal(statements.some((sql) => sql.includes('expo_push_token')), false);
  assert.equal(statements.some((sql) => sql.includes('SET is_on_duty = $2')), true);
});

test('active parcel route is calculated only for the assigned delivery partner', async () => {
  let routeInput;
  const router = createPickDeliveryRouter({
    requireUser: (_req, _res, next) => next(),
    query: async (sql) => {
      assert.match(sql, /a\.rider_user_id = \$2/);
      assert.match(sql, /a\.status IN \('accepted', 'picked_up'\)/);
      return {
        rows: [{
          status: 'accepted',
          orderType: 'parcel',
          riderLatitude: 23.8,
          riderLongitude: 90.4,
          locationUpdatedAt: new Date().toISOString(),
          senderLatitude: '23.81',
          senderLongitude: '90.41',
          deliveryLatitude: 23.82,
          deliveryLongitude: 90.42
        }]
      };
    },
    estimateDrivingRoute: async (input) => {
      routeInput = input;
      return {
        durationSeconds: 600,
        distanceMeters: 2400,
        etaMinutes: 10,
        encodedPolyline: 'route'
      };
    }
  });
  const route = router.stack
    .find((layer) => layer.route?.path === '/jobs/:assignmentId/tracking-route')?.route;
  assert.ok(route, 'the active delivery route endpoint is registered');

  const handler = route.stack[route.stack.length - 1].handle;
  let responseBody;
  let routeError;
  await handler(
    {
      params: { assignmentId: 'assignment-1' },
      tiwloSession: { user: { id: 'rider-1' } }
    },
    {
      json(body) {
        responseBody = body;
        return body;
      },
      status() {
        return this;
      }
    },
    (error) => { routeError = error; }
  );

  assert.equal(routeError, undefined);
  assert.deepEqual(routeInput, {
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.81, longitude: 90.41 }
  });
  assert.deepEqual(responseBody, {
    durationSeconds: 600,
    distanceMeters: 2400,
    etaMinutes: 10,
    encodedPolyline: 'route'
  });
});

test('delivery availability supports guest coordinate queries when allowed', async () => {
  const now = new Date();
  const router = createPickDeliveryRouter({
    requireUser: (_req, res) => res.status(401).json({ error: 'Sign in required' }),
    requireAvailabilityAccess: (req, _res, next) => {
      req.tiwloSession = null;
      req.isPickGuest = true;
      return next();
    },
    query: async (sql) => {
      if (sql.includes('grocery_pickup_location')) {
        return { rows: [{ value: JSON.stringify({ address: 'PICK Hub', latitude: 23.81, longitude: 90.41 }) }] };
      }
      if (sql.includes('pick.coverage_zones')) {
        return {
          rows: [{
            id: 'dhaka',
            nameEn: 'Dhaka',
            nameBn: 'ঢাকা',
            centerLatitude: 23.81,
            centerLongitude: 90.41,
            radiusMeters: 5000,
            active: true
          }]
        };
      }
      if (sql.includes('coverage_worldwide')) {
        return { rows: [{ value: 'false' }] };
      }
      return {
        rows: [{
          vehicleType: 'bicycle',
          vehicleCapacityKg: 20,
          applicationStatus: 'approved',
          isOnDuty: true,
          latitude: 23.811,
          longitude: 90.411,
          accuracy: 15,
          currentLocationAt: now.toISOString(),
          maxCapacityKg: 25,
          pickupRangeMeters: 4000,
          deliveryRangeMeters: 12000
        }]
      };
    }
  });
  const availabilityRoute = router.stack.find((layer) => layer.route?.path === '/availability')?.route;
  const handler = availabilityRoute.stack[availabilityRoute.stack.length - 1].handle;
  const runRequest = async (query) => {
    let body;
    let routeError;
    await handler(
      { query, tiwloSession: null, isPickGuest: true },
      { json(payload) { body = payload; return payload; } },
      (error) => { routeError = error; }
    );
    assert.equal(routeError, undefined);
    return body;
  };

  assert.deepEqual(await runRequest({}), { status: 'unknown', count: 0 });
  assert.deepEqual(await runRequest({ latitude: '23.8105', longitude: '90.4105' }), {
    status: 'available',
    count: 1
  });
});
