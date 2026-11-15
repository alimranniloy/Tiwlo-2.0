import { PICK_API_URL } from '../config/api';

export type PickMobileAppId = 'pick' | 'delivery';

export interface PickAppUpdate {
  version: string | null;
  playStoreEnabled: boolean;
  playStoreUrl: string | null;
  apkUrl: string | null;
}

export async function getPickAppUpdate(appId: PickMobileAppId): Promise<PickAppUpdate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`${PICK_API_URL}/updates/${appId}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('App update check timed out. Check your internet connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === 'object' &&
      'error' in value && typeof value.error === 'string'
      ? value.error
      : `App update check failed (${response.status}).`;
    throw new Error(message);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The PICK update service returned an invalid response.');
  }
  const result = value as Record<string, unknown>;
  if ((result.version !== null && typeof result.version !== 'string') ||
      typeof result.playStoreEnabled !== 'boolean' ||
      (result.playStoreUrl !== null && typeof result.playStoreUrl !== 'string') ||
      (result.apkUrl !== null && typeof result.apkUrl !== 'string')) {
    throw new Error('The PICK update service returned invalid app details.');
  }
  return {
    version: result.version as string | null,
    playStoreEnabled: result.playStoreEnabled,
    playStoreUrl: result.playStoreUrl as string | null,
    apkUrl: result.apkUrl as string | null
  };
}

export function compareAppVersions(currentVersion: string, requiredVersion: string): number | null {
  const parse = (value: string) => {
    if (value.length > 32 || !/^\d+(?:\.\d+){0,3}$/.test(value)) return null;
    const segments = value.split('.').map(Number);
    return segments.every(Number.isSafeInteger) ? segments : null;
  };
  const current = parse(currentVersion);
  const required = parse(requiredVersion);
  if (!current || !required) return null;
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    const difference = (current[index] || 0) - (required[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}
