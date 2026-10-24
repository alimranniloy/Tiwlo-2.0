import { useEffect, useState } from 'react';
import { STORE_DOMAIN } from '../../../config/platformConfig';

export function normalizeStoreSubdomainInput(value) {
  const candidate = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[/?#]/, 1)[0]
    .replace(/\.$/, '');
  const suffix = `.${STORE_DOMAIN}`;
  return candidate.endsWith(suffix) ? candidate.slice(0, -suffix.length) : candidate;
}

export default function useStoreSubdomainAvailability(subdomain) {
  const [availability, setAvailability] = useState({ candidate: '', status: 'idle', message: '' });

  useEffect(() => {
    const candidate = String(subdomain || '').trim();
    if (!candidate) return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAvailability({ candidate, status: 'checking', message: 'Checking availability…' });
      try {
        const response = await fetch(
          `/api/stores/subdomain-availability?subdomain=${encodeURIComponent(candidate)}`,
          { credentials: 'include', signal: controller.signal }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const status = response.status === 400 ? 'invalid' : 'error';
          setAvailability({ candidate, status, message: payload.error || 'This subdomain could not be checked.' });
          return;
        }
        setAvailability(payload.available
          ? { candidate, status: 'available', message: `${payload.subdomain} is available.` }
          : { candidate, status: 'unavailable', message: `${payload.subdomain} is already in use.` });
      } catch (error) {
        if (error.name !== 'AbortError') {
          setAvailability({ candidate, status: 'error', message: 'Could not check subdomain availability. Try again.' });
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [subdomain]);

  const candidate = String(subdomain || '').trim();
  if (!candidate) return { status: 'idle', message: '' };
  if (availability.candidate !== candidate) {
    return { status: 'checking', message: 'Checking availability…' };
  }
  return availability;
}
