import { Alert, Vibration } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { TIWLO_API_BASE } from './tiwloAuth';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');
const NOTIF_PREFS_FILE_NAME = 'tiwlo_notif_prefs.json';
const NOTIF_READ_IDS_FILE_NAME = 'tiwlo_notif_read_ids.json';
const MAX_PERSISTED_READ_IDS = 200;

export type TiwloNotificationCategory = 'security' | 'billing' | 'store' | 'system';

export interface TiwloNotificationItem {
  id: string;
  title: string;
  body: string;
  category: TiwloNotificationCategory;
  createdAt: string;
  read: boolean;
  targetRoute?: string;
}

export interface TiwloNotificationPrefs {
  pollingSyncEnabled: boolean;
  securityVibrateAlert: boolean;
  billingInvoiceNotices: boolean;
  storeOrderAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: TiwloNotificationPrefs = {
  pollingSyncEnabled: true,
  securityVibrateAlert: true,
  billingInvoiceNotices: true,
  storeOrderAlerts: true,
};

export type TiwloInAppBannerDispatcher = (item: TiwloNotificationItem) => void;

let activeBannerDispatcher: TiwloInAppBannerDispatcher | null = null;

export function registerInAppBannerDispatcher(
  dispatcher: TiwloInAppBannerDispatcher | null
): () => void {
  activeBannerDispatcher = dispatcher;
  return () => {
    if (activeBannerDispatcher === dispatcher) {
      activeBannerDispatcher = null;
    }
  };
}

export interface TriggerNativeAlertOptions {
  vibrate?: boolean;
  showSystemAlert?: boolean;
  onInAppBanner?: TiwloInAppBannerDispatcher;
}

/**
 * Pure Tiwlo native alert + haptic vibration delivery (Zero Firebase).
 */
export function triggerNativeLocalAlert(
  item: TiwloNotificationItem,
  options: TriggerNativeAlertOptions = {}
): void {
  try {
    if (options.vibrate !== false) {
      Vibration.vibrate(120);
    }

    const dispatcher = options.onInAppBanner ?? activeBannerDispatcher;
    if (dispatcher) {
      dispatcher(item);
    }

    if (options.showSystemAlert || (!dispatcher && options.showSystemAlert !== false)) {
      Alert.alert(item.title, item.body);
    }
  } catch {
    // Native alert/vibration must never crash callers.
  }
}

function getDocumentFile(fileName: string): File | null {
  try {
    return new File(Paths.document, fileName);
  } catch {
    return null;
  }
}

export async function loadNotificationPrefs(): Promise<TiwloNotificationPrefs> {
  try {
    const file = getDocumentFile(NOTIF_PREFS_FILE_NAME);
    if (!file || !file.exists) {
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }

    const raw = await file.text();
    if (!raw || !raw.trim()) {
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }

    const parsed = JSON.parse(raw) as Partial<Record<keyof TiwloNotificationPrefs, unknown>>;
    return {
      pollingSyncEnabled:
        typeof parsed.pollingSyncEnabled === 'boolean'
          ? parsed.pollingSyncEnabled
          : DEFAULT_NOTIFICATION_PREFS.pollingSyncEnabled,
      securityVibrateAlert:
        typeof parsed.securityVibrateAlert === 'boolean'
          ? parsed.securityVibrateAlert
          : DEFAULT_NOTIFICATION_PREFS.securityVibrateAlert,
      billingInvoiceNotices:
        typeof parsed.billingInvoiceNotices === 'boolean'
          ? parsed.billingInvoiceNotices
          : DEFAULT_NOTIFICATION_PREFS.billingInvoiceNotices,
      storeOrderAlerts:
        typeof parsed.storeOrderAlerts === 'boolean'
          ? parsed.storeOrderAlerts
          : DEFAULT_NOTIFICATION_PREFS.storeOrderAlerts,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function saveNotificationPrefs(
  prefs: TiwloNotificationPrefs
): Promise<void> {
  try {
    const file = getDocumentFile(NOTIF_PREFS_FILE_NAME);
    if (!file) {
      return;
    }

    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }

    await file.write(JSON.stringify(prefs));
  } catch {
    // Ignore persistence errors so preference toggles remain responsive.
  }
}

export async function loadReadNotificationIds(): Promise<string[]> {
  try {
    const file = getDocumentFile(NOTIF_READ_IDS_FILE_NAME);
    if (!file || !file.exists) {
      return [];
    }

    const raw = await file.text();
    if (!raw || !raw.trim()) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export async function saveReadNotificationIds(ids: string[]): Promise<void> {
  try {
    const file = getDocumentFile(NOTIF_READ_IDS_FILE_NAME);
    if (!file) {
      return;
    }

    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }

    const uniqueTrimmed = Array.from(new Set(ids)).slice(-MAX_PERSISTED_READ_IDS);
    await file.write(JSON.stringify(uniqueTrimmed));
  } catch {
    // Ignore read-state persistence failures.
  }
}

function classifyNotificationCategory(
  rawCategory: unknown,
  searchText: string
): TiwloNotificationCategory {
  if (
    rawCategory === 'security' ||
    rawCategory === 'billing' ||
    rawCategory === 'store' ||
    rawCategory === 'system'
  ) {
    return rawCategory;
  }

  const lower = searchText.toLowerCase();
  if (
    /(login|sign[\s-]?in|2fa|totp|pin|password|session|device|security|auth|verify|kyc|identity)/.test(
      lower
    )
  ) {
    return 'security';
  }
  if (/(billing|invoice|wallet|payment|plan|subscription|credit|charge|topup|top-up)/.test(lower)) {
    return 'billing';
  }
  if (/(store|order|product|shop|checkout|catalog|cart)/.test(lower)) {
    return 'store';
  }
  return 'system';
}

function resolveTargetRoute(
  explicitRoute: unknown,
  category: TiwloNotificationCategory,
  searchText: string
): string | undefined {
  if (typeof explicitRoute === 'string' && explicitRoute.trim()) {
    return explicitRoute.trim();
  }

  const lower = searchText.toLowerCase();
  if (/(2fa|totp|two-factor)/.test(lower)) return 'two-factor-auth';
  if (/(session|login|sign[\s-]?in|device)/.test(lower)) return 'active-sessions';
  if (/(identity|kyc|verification)/.test(lower)) return 'identity';
  if (/(password|pin|profile|settings)/.test(lower)) return 'profile-settings';
  if (/(team|member|invite)/.test(lower)) return 'team-management';
  if (/(support|ticket|help)/.test(lower)) return 'help-support';
  if (category === 'billing') return 'billing';
  if (category === 'store') return 'my-online-store';
  if (category === 'security') return 'active-sessions';
  return 'dashboard';
}

function normalizeNotificationItem(
  raw: Record<string, unknown>,
  index: number,
  readSet: Set<string>
): TiwloNotificationItem {
  const action = typeof raw.action === 'string' ? raw.action.trim() : '';
  const rawTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  const title = rawTitle || action || 'Tiwlo Account Activity';

  const details = typeof raw.details === 'string' ? raw.details.trim() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  const bodyField = typeof raw.body === 'string' ? raw.body.trim() : '';
  const ip = typeof raw.ip === 'string' ? raw.ip.trim() : '';

  const bodyParts = [bodyField || message || details, ip ? `IP ${ip}` : ''].filter(Boolean);
  const body =
    bodyParts.length > 0
      ? bodyParts.join(' · ')
      : 'Synced directly from your Tiwlo account activity feed.';

  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim()
      ? raw.createdAt.trim()
      : new Date().toISOString();

  const rawId = raw.id ?? raw._id;
  const id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : typeof rawId === 'number'
      ? String(rawId)
      : `${title}-${createdAt}-${index}`;

  const combinedText = `${title} ${body} ${action}`;
  const category = classifyNotificationCategory(raw.category, combinedText);
  const targetRoute = resolveTargetRoute(
    raw.targetRoute ?? raw.route,
    category,
    combinedText
  );

  return {
    id,
    title,
    body,
    category,
    createdAt,
    read: Boolean(raw.read) || readSet.has(id),
    targetRoute,
  };
}

export async function fetchTiwloNotifications(
  token?: string
): Promise<TiwloNotificationItem[]> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${TIWLO_ORIGIN}/api/user/account/activity-log`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `Unable to fetch notifications (${res.status})`;
      throw new Error(msg);
    }

    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data.notifications)
      ? data.notifications
      : Array.isArray(data.logs)
      ? data.logs
      : Array.isArray(data.activities)
      ? data.activities
      : [];

    const readIds = await loadReadNotificationIds();
    const readSet = new Set(readIds);

    return rawList
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, idx) => normalizeNotificationItem(entry, idx, readSet));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Notification sync timed out. Check your connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
