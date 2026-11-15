import { all as getAllCountries } from 'country-codes-list';

const NAME_OVERRIDES = {
  US: 'United States',
  GB: 'United Kingdom',
  AE: 'United Arab Emirates',
  KR: 'South Korea',
  TW: 'Taiwan',
  VN: 'Vietnam',
  RU: 'Russia',
  TZ: 'Tanzania',
  BO: 'Bolivia',
  VE: 'Venezuela',
  IR: 'Iran',
  SY: 'Syria',
  LA: 'Laos',
  MD: 'Moldova',
  CD: 'Congo (DRC)',
  CG: 'Congo (Republic)',
  BN: 'Brunei',
  PS: 'Palestine'
};

const SEARCH_ALIASES = {
  US: 'usa united states of america america',
  GB: 'uk great britain england britain',
  AE: 'uae dubai abu dhabi',
  SA: 'ksa kingdom of saudi arabia',
  BD: 'bangladesh bd dhaka',
  IN: 'bharat india',
  KR: 'korea republic of korea',
  DE: 'deutschland germany'
};

const rawCountries = getAllCountries()
  .filter((entry) => entry?.countryCode && entry?.countryNameEn)
  .map((entry) => {
    const code = String(entry.countryCode).toUpperCase();
    const name = NAME_OVERRIDES[code] || String(entry.countryNameEn).trim();
    const dialDigits = String(entry.countryCallingCode || '').replace(/[^\d]/g, '');
    return {
      code,
      name,
      dialCode: dialDigits ? `+${dialDigits}` : '',
      currency: String(entry.currencyCode || '').toUpperCase(),
      flag: entry.flag || '',
      searchText: `${name} ${code} ${entry.countryNameEn} ${dialDigits ? `+${dialDigits}` : ''} ${entry.currencyCode || ''} ${SEARCH_ALIASES[code] || ''}`.toLowerCase()
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const bangladeshIndex = rawCountries.findIndex((c) => c.code === 'BD');
if (bangladeshIndex > 0) {
  const [bangladesh] = rawCountries.splice(bangladeshIndex, 1);
  rawCountries.unshift(bangladesh);
}

export const COUNTRIES = Object.freeze(rawCountries);

export function findCountry(value) {
  if (!value) return null;
  const clean = String(value).trim().toLowerCase();
  if (!clean) return null;
  return (
    COUNTRIES.find((country) => country.name.toLowerCase() === clean) ||
    COUNTRIES.find((country) => country.code.toLowerCase() === clean) ||
    COUNTRIES.find((country) => country.searchText.includes(clean)) ||
    null
  );
}

export function searchCountries(query = '') {
  const clean = String(query || '').trim().toLowerCase();
  if (!clean) return COUNTRIES;
  return COUNTRIES.filter((country) => country.searchText.includes(clean));
}
