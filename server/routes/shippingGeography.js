import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const isoCountries = require('i18n-iso-countries');
isoCountries.registerLocale(require('i18n-iso-countries/langs/en.json'));
let citiesByCountryCode = null;

export function getShippingCountries() {
  return Object.entries(isoCountries.getNames('en'))
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function searchShippingCities(countryCodeInput, queryInput) {
  const countryCode = String(countryCodeInput || '').trim().toUpperCase();
  const query = String(queryInput || '').trim();
  if (!/^[A-Z]{2}$/.test(countryCode) || !isoCountries.getName(countryCode, 'en')) {
    throw new TypeError('Choose a valid country before searching cities.');
  }
  if (query.length < 2 || query.length > 100) {
    throw new TypeError('Enter between 2 and 100 characters to search cities.');
  }
  if (!citiesByCountryCode) {
    const cityRows = require('cities.json');
    citiesByCountryCode = new Map();
    for (const row of cityRows) {
      if (!citiesByCountryCode.has(row.country)) citiesByCountryCode.set(row.country, []);
      citiesByCountryCode.get(row.country).push(row.name);
    }
    for (const [code, cityNames] of citiesByCountryCode) {
      citiesByCountryCode.set(code, [...new Set(cityNames)].sort((left, right) => left.localeCompare(right)));
    }
  }
  const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return (citiesByCountryCode.get(countryCode) || [])
    .filter(name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedQuery))
    .slice(0, 100);
}
