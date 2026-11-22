import Constants from 'expo-constants';
import { Platform } from 'react-native';

let cachedHeaders: Record<string, string> | null = null;

function sanitizeHeaderValue(value: unknown, maxLen = 80): string {
  return String(value || '')
    .replace(/[\r\n\t;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Deterministic device identification headers so every session in Tiwlo/PICK
 * displays the real mobile brand/model and keeps User-Agent consistent for session checks.
 */
export function getPickDeviceHeaders(): Record<string, string> {
  if (cachedHeaders) return cachedHeaders;

  const appVersion = sanitizeHeaderValue(Constants.expoConfig?.version || '1.0.2', 20) || '1.0.2';
  const constantsRecord = (Platform.constants || {}) as Record<string, unknown>;
  const rawBrand = sanitizeHeaderValue(constantsRecord.Brand || constantsRecord.Manufacturer || '', 32);
  const rawModel = sanitizeHeaderValue(
    constantsRecord.Model || Constants.deviceName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device'),
    48
  );

  const osLabel = Platform.OS === 'ios'
    ? `iOS ${sanitizeHeaderValue(Platform.Version, 16)}`
    : Platform.OS === 'android'
      ? `Android ${sanitizeHeaderValue(constantsRecord.Release || Platform.Version, 16)}`
      : sanitizeHeaderValue(Platform.OS, 16);

  const combinedModel = rawBrand && rawModel && !rawModel.toLowerCase().startsWith(rawBrand.toLowerCase())
    ? `${rawBrand} ${rawModel}`
    : (rawModel || rawBrand || 'Mobile Device');

  const userAgent = `PICK/${appVersion} (${osLabel}; ${combinedModel}) Mobile`;
  cachedHeaders = {
    'User-Agent': userAgent,
    'X-Device-Name': combinedModel,
    'X-App-Name': 'PICK App'
  };
  return cachedHeaders;
}
