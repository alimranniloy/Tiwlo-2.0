import AppStorage from './appStorage';

const CACHE_PREFIX = '@tiwi_screen_cache:';
const memoryCache = new Map();

export async function getScreenDataCache(key) {
  if (!key) return null;
  const fullKey = `${CACHE_PREFIX}${key}`;
  if (memoryCache.has(fullKey)) return memoryCache.get(fullKey);

  const saved = await AppStorage.getItem(fullKey);
  if (!saved) return null;

  try {
    const value = JSON.parse(saved);
    memoryCache.set(fullKey, value);
    return value;
  } catch (error) {
    console.warn('[ScreenDataCache] Ignoring invalid cached data:', error?.message || error);
    await AppStorage.removeItem(fullKey);
    return null;
  }
}

export async function setScreenDataCache(key, value) {
  if (!key) return;
  const fullKey = `${CACHE_PREFIX}${key}`;
  memoryCache.set(fullKey, value);
  try {
    await AppStorage.setItem(fullKey, JSON.stringify(value));
  } catch (error) {
    console.warn('[ScreenDataCache] Could not persist cached data:', error?.message || error);
  }
}

export async function invalidateScreenDataCache(key) {
  if (!key) return;
  const fullKey = `${CACHE_PREFIX}${key}`;
  memoryCache.delete(fullKey);
  await AppStorage.removeItem(fullKey);
}
