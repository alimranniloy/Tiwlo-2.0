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

const MONTH_NAME_MAP = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

const toValidBirthParts = (yearNum, monthNum, dayNum) => {
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) return null;
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return null;
  if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) return null;
  const birthYear = String(yearNum).padStart(4, '0');
  const birthMonth = String(monthNum).padStart(2, '0');
  const maxDay = getDaysInBirthMonth(birthMonth, birthYear);
  if (dayNum > maxDay) return null;
  return {
    birthYear,
    birthMonth,
    birthDay: String(dayNum).padStart(2, '0')
  };
};

export const parseDateOfBirthParts = (rawValue) => {
  const empty = { birthYear: '', birthMonth: '', birthDay: '' };
  if (!rawValue) return empty;

  if (rawValue instanceof Date) {
    if (Number.isNaN(rawValue.getTime())) return empty;
    return (
      toValidBirthParts(rawValue.getFullYear(), rawValue.getMonth() + 1, rawValue.getDate()) || empty
    );
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) return empty;

  // 1. ISO date or ISO timestamp: YYYY-MM-DD or YYYY-M-D
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(trimmed);
  if (isoMatch) {
    return toValidBirthParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) || empty;
  }

  // 2. Day Month Year: "20 November 2000", "20 Nov, 2000"
  const dmyTextMatch = /^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/.exec(trimmed);
  if (dmyTextMatch) {
    const monthStr = MONTH_NAME_MAP[dmyTextMatch[2].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(dmyTextMatch[3]), Number(monthStr), Number(dmyTextMatch[1])) || empty;
    }
  }

  // 3. Month Day Year: "November 20, 2000", "Nov 20 2000"
  const mdyTextMatch = /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (mdyTextMatch) {
    const monthStr = MONTH_NAME_MAP[mdyTextMatch[1].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(mdyTextMatch[3]), Number(monthStr), Number(mdyTextMatch[2])) || empty;
    }
  }

  // 4. JS Date.toString() format: "Mon Nov 20 2000 00:00:00 GMT+..."
  const jsDateMatch = /^[a-zA-Z]{3}\s+([a-zA-Z]{3})\s+(\d{1,2})\s+(\d{4})\b/.exec(trimmed);
  if (jsDateMatch) {
    const monthStr = MONTH_NAME_MAP[jsDateMatch[1].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(jsDateMatch[3]), Number(monthStr), Number(jsDateMatch[2])) || empty;
    }
  }

  // 5. Numeric slash/dash: DD/MM/YYYY or MM/DD/YYYY
  const numericMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);
    if (first > 12) return toValidBirthParts(year, second, first) || empty;
    if (second > 12) return toValidBirthParts(year, first, second) || empty;
    return toValidBirthParts(year, second, first) || empty;
  }

  // 6. Fallback native parse only when a 4-digit year is explicitly present
  if (/\b\d{4}\b/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return (
        toValidBirthParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()) || empty
      );
    }
  }

  return empty;
};

export const formatIsoBirthDate = ({ birthYear = '', birthMonth = '', birthDay = '' } = {}) => {
  const year = String(birthYear || '').replace(/\D/g, '');
  const month = String(birthMonth || '').replace(/\D/g, '').padStart(2, '0');
  const day = String(birthDay || '').replace(/\D/g, '').padStart(2, '0');
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return '';
  const valid = toValidBirthParts(Number(year), Number(month), Number(day));
  return valid ? `${valid.birthYear}-${valid.birthMonth}-${valid.birthDay}` : '';
};

export const normalizeIsoDateInput = (rawValue) => {
  const parts = parseDateOfBirthParts(rawValue);
  return formatIsoBirthDate(parts);
};
