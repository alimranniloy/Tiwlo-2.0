import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorefrontAddress, normalizeShippingZones, quoteShipping } from './shippingHelpers.js';

test('normalizes shipping zones and validates country coverage and charges', () => {
  const zones = normalizeShippingZones([{
    id: 'bangladesh',
    name: 'Bangladesh',
    countries: ['Bangladesh'],
    rate: '80',
    freeShippingThreshold: '2000',
    minDeliveryDays: '1',
    maxDeliveryDays: '3',
    codEnabled: true
  }]);
  const settings = { shippingZones: zones };
  assert.equal(quoteShipping(settings, 'BANGLADESH', 500).amount, 80);
  assert.equal(quoteShipping(settings, 'Bangladesh', 2000).amount, 0);
  assert.equal(quoteShipping(settings, 'United States', 500).available, false);
  assert.throws(() => normalizeShippingZones([{
    id: 'bad', name: 'Invalid', countries: ['Bangladesh'], rate: -1
  }]), /non-negative/);
});

test('retains flat-rate shipping when zones are not configured', () => {
  assert.equal(quoteShipping({ shippingFlatRate: 10, freeShippingThreshold: 100 }, '', 40).amount, 10);
  assert.equal(quoteShipping({ shippingFlatRate: 10, freeShippingThreshold: 100 }, '', 100).amount, 0);
});

test('uses a wildcard zone only as fallback and preserves zone COD restrictions', () => {
  const zones = normalizeShippingZones([
    { id: 'all', name: 'Other countries', countries: ['*'], rate: 30 },
    { id: 'local', name: 'Bangladesh', countries: ['Bangladesh'], rate: 5, codEnabled: false }
  ]);
  assert.equal(quoteShipping({ shippingZones: zones }, 'Bangladesh', 10).zoneId, 'local');
  assert.equal(quoteShipping({ shippingZones: zones }, 'Bangladesh', 10).codEnabled, false);
  assert.equal(quoteShipping({ shippingZones: zones }, 'Canada', 10).zoneId, 'all');
  assert.throws(() => normalizeShippingZones([
    { id: 'one', name: 'First', countries: ['Bangladesh'], rate: 10 },
    { id: 'two', name: 'Second', countries: ['Bangladesh'], rate: 20 }
  ]), /only belong to one/);
});

test('builds one canonical destination for both the saved address and zone quote', () => {
  const address = normalizeStorefrontAddress({
    street: '  25 Main Road ',
    city: 'Dhaka',
    country: ' Bangladesh ',
    postalCode: '1207'
  });

  assert.equal(address.country, 'Bangladesh');
  assert.equal(address.deliveryAddress, '25 Main Road, Dhaka, 1207, Bangladesh');
  const zone = normalizeShippingZones([
    { id: 'bd', name: 'Bangladesh', countries: ['Bangladesh'], rate: 80, codEnabled: false },
    { id: 'global', name: 'Everywhere else', countries: ['*'], rate: 500 }
  ]);
  const quote = quoteShipping({ shippingZones: zone }, address.country, 100);
  assert.equal(quote.zoneId, 'bd');
  assert.equal(quote.amount, 80);
  assert.equal(quote.codEnabled, false);
  assert.throws(() => normalizeStorefrontAddress({
    street: '25 Main Road',
    country: ''
  }), /country are required/);
  assert.throws(() => normalizeStorefrontAddress({
    street: '25 Main Road',
    country: 'A'.repeat(101)
  }), /field lengths/);
});

test('quotes enabled country and city destinations with weight rates, tax overrides, and delivery labels', () => {
  const zones = normalizeShippingZones([{
    id: 'south-asia-express',
    name: 'South Asia Express',
    destinations: [{
      countryCode: 'BD',
      countryName: 'Bangladesh',
      cities: ['Dhaka', 'Chattogram']
    }],
    shippingMethod: 'Express courier',
    rate: 100,
    perKgRate: 40,
    taxRate: 5,
    minDeliveryDays: 2,
    maxDeliveryDays: 5
  }]);
  const settings = { shippingZones: zones, taxRate: 15 };
  const quote = quoteShipping(settings, 'Bangladesh', 500, {
    countryCode: 'BD',
    city: 'Dhaka',
    weightKg: 2.5
  });
  assert.equal(quote.available, true);
  assert.equal(quote.amount, 200);
  assert.equal(quote.shippingMethod, 'Express courier');
  assert.equal(quote.taxRate, 5);
  assert.equal(quote.weightKg, 2.5);
  assert.equal(quote.minDeliveryDays, 2);
  assert.equal(quote.maxDeliveryDays, 5);
  assert.equal(quoteShipping(settings, 'Bangladesh', 500, {
    countryCode: 'BD',
    city: 'Sylhet',
    weightKg: 1
  }).available, false);
  assert.equal(quoteShipping(settings, 'Bangladesh', 500, {
    countryCode: 'BD',
    city: 'Dhaka',
    weightKg: 1,
    weightComplete: false
  }).available, false);
});

test('disables one country destination without letting a fallback zone override it', () => {
  const zones = normalizeShippingZones([
    {
      id: 'local',
      name: 'Bangladesh',
      destinations: [{
        countryCode: 'BD',
        countryName: 'Bangladesh',
        enabled: false
      }],
      rate: 20
    },
    { id: 'fallback', name: 'International', countries: ['*'], rate: 500 }
  ]);
  assert.equal(quoteShipping({ shippingZones: zones }, 'Bangladesh', 100, {
    countryCode: 'BD',
    city: 'Dhaka'
  }).available, false);
  assert.equal(quoteShipping({ shippingZones: zones }, 'India', 100, {
    countryCode: 'IN',
    city: 'Mumbai'
  }).zoneId, 'fallback');
});
