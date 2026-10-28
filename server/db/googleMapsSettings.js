import { queryPg } from './postgres.js';

const GOOGLE_MAPS_SETTING_KEY = 'google_maps';

export function normalizeGoogleMapsApiKey(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Enter a Google Maps API key.');
  }
  const apiKey = value.trim();
  if (!apiKey || apiKey.length > 512 || /[\u0000-\u001f\u007f]/.test(apiKey)) {
    throw new TypeError('Enter a valid Google Maps API key.');
  }
  return apiKey;
}

export async function getGoogleMapsApiKey() {
  const result = await queryPg(
    'SELECT settings FROM system_settings WHERE setting_key = $1',
    [GOOGLE_MAPS_SETTING_KEY]
  );
  const apiKey = result.rows[0]?.settings?.apiKey;
  return typeof apiKey === 'string' ? apiKey : '';
}

export async function getGoogleMapsSettingsStatus() {
  const apiKey = await getGoogleMapsApiKey();
  return {
    configured: Boolean(apiKey),
    keyHint: apiKey
      ? `${apiKey.slice(0, 4)}${'•'.repeat(8)}${apiKey.slice(-4)}`
      : ''
  };
}

export async function saveGoogleMapsApiKey(apiKey) {
  const result = await queryPg(
    `INSERT INTO system_settings (setting_key, settings, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key) DO UPDATE
     SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
     RETURNING settings`,
    [GOOGLE_MAPS_SETTING_KEY, JSON.stringify({ apiKey })]
  );
  if (!result.rows[0]) throw new Error('Google Maps API settings could not be saved.');
  return getGoogleMapsSettingsStatus();
}
