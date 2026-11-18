import { ADMIN_SUPPORT_API_BASE } from '../config/siteConfig';
import type { StaffWorkspacePreferences } from '../types/opsHub';
import { apiFetch } from './apiClient';
import { getSecureItem, setSecureItem } from './storage';

const PREFS_STORAGE_KEY = 'tiwlo.support.workspace_preferences_v2';

export const DEFAULT_WORKSPACE_PREFERENCES: StaffWorkspacePreferences = {
  ringDurationSeconds: 10,
  vibrationEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  requirePinOnLaunch: true,
  autoLockMinutes: 5,
  signatureText: 'Best regards,\nTiwlo Support Team',
  autoAppendSignature: false,
  defaultReplyMode: 'public',
  aiPreferredTone: 'warm_brand',
  preClickPreviewEnabled: true,
  uiDensity: 'comfortable',
  selectiveBorders: true,
  defaultLandingTab: 'home',
  dailyResolvedGoal: 15,
};

let cachedPrefs: StaffWorkspacePreferences | null = null;
const listeners = new Set<(prefs: StaffWorkspacePreferences) => void>();

export function subscribeWorkspacePreferences(
  fn: (prefs: StaffWorkspacePreferences) => void
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitChange(next: StaffWorkspacePreferences) {
  cachedPrefs = next;
  for (const fn of listeners) {
    try {
      fn(next);
    } catch {
      // Ignore subscriber error
    }
  }
}

export async function getWorkspacePreferences(): Promise<StaffWorkspacePreferences> {
  if (cachedPrefs) return cachedPrefs;
  try {
    const raw = await getSecureItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaffWorkspacePreferences>;
      cachedPrefs = { ...DEFAULT_WORKSPACE_PREFERENCES, ...parsed };
      return cachedPrefs;
    }
  } catch {
    // Fallback to defaults
  }
  cachedPrefs = { ...DEFAULT_WORKSPACE_PREFERENCES };
  return cachedPrefs;
}

export async function syncWorkspacePreferencesFromServer(): Promise<StaffWorkspacePreferences> {
  const local = await getWorkspacePreferences();
  try {
    const res = await apiFetch<{ preferences?: Partial<StaffWorkspacePreferences> }>(
      `${ADMIN_SUPPORT_API_BASE}/preferences/me`
    );
    if (res?.preferences && typeof res.preferences === 'object') {
      const merged: StaffWorkspacePreferences = {
        ...DEFAULT_WORKSPACE_PREFERENCES,
        ...local,
        ...res.preferences,
      };
      await setSecureItem(PREFS_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      emitChange(merged);
      return merged;
    }
  } catch {
    // Offline or server not yet updated — keep local preferences
  }
  return local;
}

export async function updateWorkspacePreferences(
  patch: Partial<StaffWorkspacePreferences>
): Promise<StaffWorkspacePreferences> {
  const current = await getWorkspacePreferences();
  const next: StaffWorkspacePreferences = {
    ...current,
    ...patch,
  };
  await setSecureItem(PREFS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  emitChange(next);

  try {
    await apiFetch(`${ADMIN_SUPPORT_API_BASE}/preferences/me`, {
      method: 'PUT',
      body: next,
    });
  } catch {
    // Local persistence succeeded; server sync is best-effort
  }

  return next;
}
