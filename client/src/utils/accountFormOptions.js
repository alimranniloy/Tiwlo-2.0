import { all as getAllCountries } from 'country-codes-list';

export const COUNTRY_OPTIONS = [
  ...getAllCountries()
    .filter(country => /^\d{1,3}$/.test(country.countryCallingCode))
    .map(country => ({
      code: country.countryCode,
      name: country.countryNameEn,
      dial: `+${country.countryCallingCode}`,
      flag: country.flag,
      placeholder: ''
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
];

const bangladeshOption = COUNTRY_OPTIONS.find(country => country.code === 'BD');
if (bangladeshOption) {
  COUNTRY_OPTIONS.splice(COUNTRY_OPTIONS.indexOf(bangladeshOption), 1);
  COUNTRY_OPTIONS.unshift(bangladeshOption);
}

export const MONTH_OPTIONS = [
  { value: '01', name: 'January' },
  { value: '02', name: 'February' },
  { value: '03', name: 'March' },
  { value: '04', name: 'April' },
  { value: '05', name: 'May' },
  { value: '06', name: 'June' },
  { value: '07', name: 'July' },
  { value: '08', name: 'August' },
  { value: '09', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
];

export const getDaysInBirthMonth = (month, year) => {
  if (!month) return 31;
  const parsedYear = Number(year);
  return new Date(parsedYear || 2000, Number(month), 0).getDate();
};
