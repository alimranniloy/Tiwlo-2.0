import { queryPg } from '../server/db/postgres.js';
import { getPlatformUrl } from '../server/config/platformConfig.js';

export const PICK_APP_UPDATE_TARGETS = Object.freeze({
  pick: Object.freeze({
    label: 'PICK',
    packageName: 'com.pick.tiwlo',
    settingKey: 'app_update_pick'
  }),
  delivery: Object.freeze({
    label: 'PICK Delivery',
    packageName: 'com.pick.delivery',
    settingKey: 'app_update_delivery'
  })
});

export function getPickAppUpdateTarget(appId) {
  return Object.prototype.hasOwnProperty.call(PICK_APP_UPDATE_TARGETS, appId)
    ? PICK_APP_UPDATE_TARGETS[appId]
    : null;
}

export function comparePickAppVersions(currentVersion, requiredVersion) {
  const parse = (value) => {
    if (typeof value !== 'string' || value.length > 32 ||
        !/^\d+(?:\.\d+){0,3}$/.test(value)) return null;
    const segments = value.split('.').map(Number);
    return segments.every(Number.isSafeInteger) ? segments : null;
  };
  const current = parse(currentVersion);
  const required = parse(requiredVersion);
  if (!current || !required) return null;
  const length = Math.max(current.length, required.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (current[index] || 0) - (required[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function normalizePickAppUpdateSettings(value) {
  if (value === undefined || value === null || value === '') {
    return { version: '', playStoreEnabled: false, playStoreUrl: '', apkPath: null };
  }
  const settings = typeof value === 'string' ? JSON.parse(value) : value;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('Stored PICK app update settings are invalid.');
  }
  const version = settings.version === '' ? '' : settings.version;
  if (typeof version !== 'string' || (version && comparePickAppVersions(version, version) === null) ||
      typeof settings.playStoreEnabled !== 'boolean' ||
      typeof settings.playStoreUrl !== 'string' ||
      (settings.apkPath !== null &&
        (typeof settings.apkPath !== 'string' ||
          !/^\/upload\/pick\/app-updates\/(?:pick|delivery)-[a-f0-9]{64}-[a-f0-9-]{36}\.apk$/.test(settings.apkPath))) ||
      (settings.playStoreEnabled && !validatePickPlayStoreUrl(settings.playStoreUrl, 'pick') &&
        !validatePickPlayStoreUrl(settings.playStoreUrl, 'delivery'))) {
    throw new TypeError('Stored PICK app update settings are invalid.');
  }
  return {
    version,
    playStoreEnabled: settings.playStoreEnabled,
    playStoreUrl: settings.playStoreUrl,
    apkPath: settings.apkPath
  };
}

export function validatePickPlayStoreUrl(value, appId) {
  const target = getPickAppUpdateTarget(appId);
  if (!target || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' ||
        url.hostname !== 'play.google.com' ||
        url.pathname !== '/store/apps/details' ||
        url.searchParams.get('id') !== target.packageName) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function getPickAppUpdateSettings(appId, query = queryPg) {
  const target = getPickAppUpdateTarget(appId);
  if (!target) throw new TypeError('Choose a supported PICK app.');
  const { rows } = await query(
    'SELECT value FROM pick.settings WHERE key = $1 LIMIT 1',
    [target.settingKey]
  );
  return normalizePickAppUpdateSettings(rows[0]?.value);
}

export async function getPickAppUpdatePublicInfo(appId, query = queryPg) {
  const target = getPickAppUpdateTarget(appId);
  if (!target) throw new TypeError('Choose a supported PICK app.');
  const settings = await getPickAppUpdateSettings(appId, query);
  const canInstall = Boolean(settings.apkPath || settings.playStoreEnabled);
  return {
    version: canInstall ? settings.version || null : null,
    playStoreEnabled: settings.playStoreEnabled,
    playStoreUrl: settings.playStoreEnabled ? settings.playStoreUrl : null,
    apkUrl: settings.apkPath
      ? new URL(`/api/pick/updates/${appId}/apk`, getPlatformUrl()).toString()
      : null
  };
}
