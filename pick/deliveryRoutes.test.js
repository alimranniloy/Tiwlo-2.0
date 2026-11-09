import test from 'node:test';
import assert from 'node:assert/strict';
import { createPickDeliveryRouter } from './deliveryRoutes.js';

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
