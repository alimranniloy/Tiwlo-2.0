// Only apply provider-specific alias rules to consumer Gmail addresses.
// Workspace/custom-domain dots and plus tags may identify different mailboxes.
export function normalizeSignupEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)) return null;
  const [local, domain] = email.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
      domain.split('.').some(label => !label || label.startsWith('-') || label.endsWith('-'))) return null;
  if (['gmail.com', 'googlemail.com'].includes(domain) && !/^[a-z0-9.]+(?:\+[^@]+)?$/.test(local)) return null;
  return email;
}

export function signupEmailKey(value) {
  const email = normalizeSignupEmail(value);
  if (!email) return null;
  const [local, domain] = email.split('@');
  return ['gmail.com', 'googlemail.com'].includes(domain)
    ? `${local.split('+')[0].replaceAll('.', '')}@gmail.com`
    : email;
}

export function normalizePhoneIdentifier(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[+()\d\s.-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 14 && digits.startsWith('8800')) {
    digits = `880${digits.slice(4)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) digits = `880${digits.slice(1)}`;
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isDuplicateAccountError(error) {
  return error?.code === 'DUPLICATE_ACCOUNT' ||
    (error?.code === '23505' && ['system_users_email_key', 'system_users_signup_email_unique'].includes(error.constraint));
}

export function isDuplicatePhoneError(error) {
  return error?.code === 'DUPLICATE_PHONE' ||
    (error?.code === '23505' && error.constraint === 'system_users_signup_phone_unique');
}

export function duplicateAccountError() {
  return Object.assign(new Error('An account already uses this email. Please sign in or recover your existing account.'), { code: 'DUPLICATE_ACCOUNT' });
}

export function duplicatePhoneError() {
  return Object.assign(new Error('This mobile number is already linked to an account.'), { code: 'DUPLICATE_PHONE' });
}

export function isDuplicateBrowserError(error) {
  return error?.code === '23505' && error.constraint === 'system_signup_browsers_pkey';
}
