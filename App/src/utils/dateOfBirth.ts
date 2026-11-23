export interface MonthOption {
  value: string;
  name: string;
}

export const MONTH_OPTIONS: MonthOption[] = [
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

export const getDaysInBirthMonth = (month: string, year: string): number => {
  if (!month) return 31;
  const parsedYear = Number(year);
  return new Date(parsedYear || 2000, Number(month), 0).getDate();
};

const MONTH_NAME_MAP: Record<string, string> = {
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
  dec: '12', december: '12',
};

const toValidBirthParts = (yearNum: number, monthNum: number, dayNum: number) => {
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
    birthDay: String(dayNum).padStart(2, '0'),
  };
};

export function parseDateOfBirthParts(rawValue?: string | Date | null): {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
} {
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

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(trimmed);
  if (isoMatch) {
    return toValidBirthParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) || empty;
  }

  const dmyTextMatch = /^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/.exec(trimmed);
  if (dmyTextMatch) {
    const monthStr = MONTH_NAME_MAP[dmyTextMatch[2].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(dmyTextMatch[3]), Number(monthStr), Number(dmyTextMatch[1])) || empty;
    }
  }

  const mdyTextMatch = /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (mdyTextMatch) {
    const monthStr = MONTH_NAME_MAP[mdyTextMatch[1].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(mdyTextMatch[3]), Number(monthStr), Number(mdyTextMatch[2])) || empty;
    }
  }

  const jsDateMatch = /^[a-zA-Z]{3}\s+([a-zA-Z]{3})\s+(\d{1,2})\s+(\d{4})\b/.exec(trimmed);
  if (jsDateMatch) {
    const monthStr = MONTH_NAME_MAP[jsDateMatch[1].toLowerCase()];
    if (monthStr) {
      return toValidBirthParts(Number(jsDateMatch[3]), Number(monthStr), Number(jsDateMatch[2])) || empty;
    }
  }

  return empty;
}

export function formatIsoBirthDate(parts: {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
}): string {
  const year = String(parts.birthYear || '').replace(/\D/g, '');
  const month = String(parts.birthMonth || '').replace(/\D/g, '').padStart(2, '0');
  const day = String(parts.birthDay || '').replace(/\D/g, '').padStart(2, '0');
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return '';
  const valid = toValidBirthParts(Number(year), Number(month), Number(day));
  return valid ? `${valid.birthYear}-${valid.birthMonth}-${valid.birthDay}` : '';
}
