import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceBetweenCoordinatesMeters,
  findCoverageZone,
  isGuestLoginEnabled,
  normalizeCoverageZone,
  setGuestLoginEnabled
} from './coverage.js';

const dhakaZone = {
  id: 'dhaka',
  name_en: 'Dhaka Central',
  name_bn: 'ঢাকা',
  center_latitude: 23.8103,
  center_longitude: 90.4125,
  radius_meters: 5000,
  active: true
};

test('matches locations within an enabled configured radius', () => {
  const result = findCoverageZone(23.8103, 90.4125, [dhakaZone]);
  assert.equal(result.available, true);
  assert.equal(result.zone.nameEn, 'Dhaka Central');
  assert.equal(result.distanceMeters, 0);
});

test('does not report coverage outside configured circles or in disabled zones', () => {
  assert.equal(findCoverageZone(23.9, 90.5, [dhakaZone]).available, false);
  assert.equal(findCoverageZone(23.8103, 90.4125, [{ ...dhakaZone, active: false }]).available, false);
  assert.equal(findCoverageZone(23.8103, 90.4125, []).available, false);
});

test('calculates realistic meter distances between GPS coordinates', () => {
  assert.ok(distanceBetweenCoordinatesMeters(23.8103, 90.4125, 23.8203, 90.4125) > 1000);
});

test('validates coverage areas before they are saved', () => {
  assert.deepEqual(normalizeCoverageZone({
    nameEn: 'Dhaka Central',
    nameBn: 'ঢাকা',
    centerLatitude: '23.8103',
    centerLongitude: '90.4125',
    radiusMeters: '5000'
  }), {
    nameEn: 'Dhaka Central',
    nameBn: 'ঢাকা',
    centerLatitude: 23.8103,
    centerLongitude: 90.4125,
    radiusMeters: 5000
  });
  assert.throws(() => normalizeCoverageZone({}), /coverage-area name/i);
  assert.throws(() => normalizeCoverageZone({
    nameEn: 'Dhaka',
    nameBn: 'ঢাকা',
    centerLatitude: 23.8103,
    centerLongitude: 90.4125,
    radiusMeters: 20
  }), /radius/i);
});

test('guest login setting defaults to enabled and respects persisted toggles', async () => {
  assert.equal(await isGuestLoginEnabled(), true);
  assert.equal(await isGuestLoginEnabled(async () => ({ rows: [] })), true);
  assert.equal(await isGuestLoginEnabled(async () => ({ rows: [{ value: 'true' }] })), true);
  assert.equal(await isGuestLoginEnabled(async () => ({ rows: [{ value: ' false ' }] })), false);
  assert.equal(await isGuestLoginEnabled(async () => { throw new Error('db'); }), true);

  let recordedParams = null;
  const saved = await setGuestLoginEnabled(false, 'admin-1', async (_sql, params) => {
    recordedParams = params;
    return { rows: [] };
  });
  assert.equal(saved, false);
  assert.deepEqual(recordedParams, ['false', 'admin-1']);
});
