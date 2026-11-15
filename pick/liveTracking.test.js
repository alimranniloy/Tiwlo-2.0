import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpenDrivingEstimate } from './liveTracking.js';

test('uses OSRM driving duration, distance, and encoded route geometry', async () => {
  let requestUrl;
  let requestOptions;
  const estimate = await getOpenDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    fetchImpl: async (url, options) => {
      requestUrl = new URL(url);
      requestOptions = options;
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ duration: 181, distance: 2400, geometry: 'encoded-route' }]
        })
      };
    }
  });

  assert.equal(estimate.durationSeconds, 181);
  assert.equal(estimate.etaMinutes, 4);
  assert.equal(estimate.distanceMeters, 2400);
  assert.equal(estimate.encodedPolyline, 'encoded-route');
  assert.equal(
    requestUrl.pathname,
    '/route/v1/driving/90.4,23.8;90.5,23.9'
  );
  assert.equal(requestUrl.searchParams.get('overview'), 'full');
  assert.equal(requestUrl.searchParams.get('geometries'), 'polyline');
  assert.equal(requestUrl.searchParams.has('key'), false);
  assert.equal(requestOptions.headers['User-Agent'], 'Tiwlo-PICK/1.0 (delivery routing)');
});

test('rejects invalid coordinates and unsuccessful OSRM route responses', async () => {
  await assert.rejects(getOpenDrivingEstimate({
    origin: { latitude: 91, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 }
  }), /coordinates are invalid/);

  await assert.rejects(getOpenDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ code: 'NoRoute', routes: [] })
    })
  }), /NoRoute/);
});

test('supports a configured OSRM base URL', async () => {
  let requestUrl;
  await getOpenDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    baseUrl: 'https://routing.example/custom/',
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ duration: 60, distance: 300, geometry: 'route' }]
        })
      };
    }
  });

  assert.equal(requestUrl.origin, 'https://routing.example');
  assert.equal(requestUrl.pathname, '/custom/route/v1/driving/90.4,23.8;90.5,23.9');
});
