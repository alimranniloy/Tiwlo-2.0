import { all as getAllCountries } from 'country-codes-list';

export interface CountryDialingOption {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRY_DIALING_OPTIONS: CountryDialingOption[] = getAllCountries()
  .filter((country) => /^\d{1,3}$/.test(country.countryCallingCode))
  .map((country) => ({
    code: country.countryCode,
    name: country.countryNameEn,
    dial: `+${country.countryCallingCode}`,
    flag: country.flag
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY_DIALING_OPTION =
  COUNTRY_DIALING_OPTIONS.find((country) => country.code === 'BD') ??
  COUNTRY_DIALING_OPTIONS[0] ??
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' };
