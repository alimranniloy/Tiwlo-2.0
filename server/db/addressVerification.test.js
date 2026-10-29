import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidLiveLocation, reverseGeocodeAddress } from './addressVerification.js';

const googleResponse = {
  status: 'OK',
  plus_code: { global_code: '7MMG+JX Dhaka', compound_code: '7MMG+JX Dhaka, Bangladesh' },
  results: [{
    formatted_address: 'Dhaka 1212, Bangladesh',
    place_id: 'google-place-1',
    address_components: [
      { long_name: 'Dhaka', types: ['locality', 'political'] },
      { long_name: '1212', types: ['postal_code'] }
    ]
  }]
};

test('Google reverse geocoding returns all required address fields', async () => {
  let fetchCount = 0;
  const result = await reverseGeocodeAddress({
    latitude: 23.8103,
    longitude: 90.4125,
    apiKey: 'test-key',
    fetchImpl: async () => {
      fetchCount += 1;
      return Response.json(googleResponse);
    }
  });

  assert.equal(fetchCount, 1);
  assert.deepEqual(result, {
    formattedAddress: 'Dhaka 1212, Bangladesh',
    area: 'Dhaka',
    postalCode: '1212',
    plusCode: '7MMG+JX Dhaka',
    compoundPlusCode: '7MMG+JX Dhaka, Bangladesh',
    placeId: 'google-place-1'
  });
});

test('valid GPS fixes are accepted with rural-area accuracy estimates', () => {
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: 90, accuracy: 50 }), true);
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: 90, accuracy: 500 }), true);
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: 90, accuracy: 5000 }), true);
  assert.equal(isValidLiveLocation({ latitude: 91, longitude: 90, accuracy: 10 }), false);
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: -181, accuracy: 10 }), false);
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: 90, accuracy: -1 }), false);
  assert.equal(isValidLiveLocation({ latitude: 23, longitude: 90, accuracy: Infinity }), false);
});

test('Google failure is retried once and never uses an offline fallback', async () => {
  let fetchCount = 0;
  await assert.rejects(reverseGeocodeAddress({
    latitude: 23.8103,
    longitude: 90.4125,
    apiKey: 'test-key',
    fetchImpl: async () => {
      fetchCount += 1;
      return Response.json({ status: 'OVER_QUERY_LIMIT', results: [] });
    }
  }), /Google Geocoding API status: OVER_QUERY_LIMIT/);

  assert.equal(fetchCount, 2);
});

test('incomplete Google results fail verification', async () => {
  await assert.rejects(reverseGeocodeAddress({
    latitude: 23.8103,
    longitude: 90.4125,
    apiKey: 'test-key',
    fetchImpl: async () => Response.json({
      status: 'OK',
      results: [{ formatted_address: 'Dhaka, Bangladesh', address_components: [] }]
    })
  }), /complete address, area, postcode, and Plus Code/);
});

test('missing Google API key fails without requesting a non-Google fallback', async () => {
  let fetchCount = 0;
  await assert.rejects(reverseGeocodeAddress({
    latitude: 23.8103,
    longitude: 90.4125,
    apiKey: '',
    fetchImpl: async () => {
      fetchCount += 1;
      return Response.json(googleResponse);
    }
  }), /Google Maps API key is not configured/);
  assert.equal(fetchCount, 0);
});
