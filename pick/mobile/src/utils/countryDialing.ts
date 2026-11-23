import { all as getAllCountries } from 'country-codes-list';

export interface CountryDialingOption {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const NAME_OVERRIDES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  AE: 'United Arab Emirates',
  KR: 'South Korea',
  TW: 'Taiwan',
  VN: 'Vietnam',
  RU: 'Russia'
};

const rawDialingOptions: CountryDialingOption[] = getAllCountries()
  .filter((country) => /^\d{1,3}$/.test(country.countryCallingCode))
  .map((country) => {
    const code = String(country.countryCode).toUpperCase();
    return {
      code,
      name: NAME_OVERRIDES[code] || country.countryNameEn,
      dial: `+${country.countryCallingCode}`,
      flag: country.flag
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const bangladeshIndex = rawDialingOptions.findIndex((country) => country.code === 'BD');
if (bangladeshIndex > 0) {
  const [bangladesh] = rawDialingOptions.splice(bangladeshIndex, 1);
  rawDialingOptions.unshift(bangladesh);
}

export const COUNTRY_DIALING_OPTIONS: CountryDialingOption[] = rawDialingOptions;

export const DEFAULT_COUNTRY_DIALING_OPTION =
  COUNTRY_DIALING_OPTIONS.find((country) => country.code === 'BD') ??
  COUNTRY_DIALING_OPTIONS[0] ??
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' };
