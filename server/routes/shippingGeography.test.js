import test from 'node:test';
import assert from 'node:assert/strict';
import { getShippingCountries, searchShippingCities } from './shippingGeography.js';

test('lists ISO countries by name and searches GeoNames cities by country', () => {
  const countries = getShippingCountries();
  assert.ok(countries.length >= 240);
  assert.deepEqual(countries, [...countries].sort((left, right) => left.name.localeCompare(right.name)));
  assert.ok(countries.some(country => country.code === 'BD' && country.name === 'Bangladesh'));
  assert.ok(searchShippingCities('bd', 'dhak').includes('Dhaka'));
});

test('validates country and minimum city-search length', () => {
  assert.throws(() => searchShippingCities('not-a-country', 'dh'), /valid country/);
  assert.throws(() => searchShippingCities('BD', 'd'), /between 2 and 100/);
});
