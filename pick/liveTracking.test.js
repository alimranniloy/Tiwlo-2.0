import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoogleDrivingEstimate } from './liveTracking.js';

test('uses Google traffic-aware driving duration and distance for the rider route', async () => {
  let requestUrl;
  const estimate = await getGoogleDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    apiKey: 'server-only-key',
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          routes: [{
            legs: [{
              duration: { value: 500 },
              duration_in_traffic: { value: 181 },
              distance: { value: 2400 }
            }]
          }]
        })
      };
    }
  });

  assert.equal(estimate.durationSeconds, 181);
  assert.equal(estimate.etaMinutes, 4);
  assert.equal(estimate.distanceMeters, 2400);
  assert.equal(requestUrl.searchParams.get('origin'), '23.8,90.4');
  assert.equal(requestUrl.searchParams.get('destination'), '23.9,90.5');
  assert.equal(requestUrl.searchParams.get('departure_time'), 'now');
  assert.equal(requestUrl.searchParams.get('key'), 'server-only-key');
});

test('falls back to the normal driving duration when traffic duration is unavailable', async () => {
  const estimate = await getGoogleDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    apiKey: 'server-only-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        routes: [{ legs: [{ duration: { value: 120 }, distance: { value: 900 } }] }]
      })
    })
  });

  assert.deepEqual(estimate, {
    durationSeconds: 120,
    distanceMeters: 900,
    etaMinutes: 2
  });
});

test('rejects missing keys and unsuccessful Google route responses', async () => {
  await assert.rejects(getGoogleDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    apiKey: ''
  }), /API key is not configured/);

  await assert.rejects(getGoogleDrivingEstimate({
    origin: { latitude: 23.8, longitude: 90.4 },
    destination: { latitude: 23.9, longitude: 90.5 },
    apiKey: 'server-only-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED' })
    })
  }), /REQUEST_DENIED/);
});
