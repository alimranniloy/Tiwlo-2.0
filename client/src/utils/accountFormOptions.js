export const COUNTRY_OPTIONS = [
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩', placeholder: '1700-000000' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', placeholder: '(555) 000-0000' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', placeholder: '(555) 000-0000' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', placeholder: '412 345 678' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', placeholder: '50 123 4567' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', placeholder: '8123 4567' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', placeholder: '12-345 6789' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰', placeholder: '300 1234567' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', placeholder: '312 345 6789' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', placeholder: '612 34 56 78' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', placeholder: '11 91234-5678' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', placeholder: '90-1234-5678' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷', placeholder: '10-1234-5678' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷', placeholder: '512 345 67 89' }
];

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
