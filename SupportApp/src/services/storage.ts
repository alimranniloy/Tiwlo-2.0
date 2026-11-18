import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  SESSION_TOKEN: 'tiwlo.support.session_token',
  PENDING_CHALLENGE: 'tiwlo.support.pending_challenge',
  SAVED_PRESETS: 'tiwlo.support.saved_presets',
  BACKGROUND_MONITOR_ENABLED: 'tiwlo.support.bg_monitor_enabled',
  BATTERY_PROMPTED: 'tiwlo.support.battery_opt_prompted',
} as const;

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage?.setItem(key, value);
    } catch {
      // Ignore web storage unavailability
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // Ignore web storage unavailability
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
