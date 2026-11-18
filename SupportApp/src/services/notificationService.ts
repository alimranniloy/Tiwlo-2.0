import { Alert, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { ADMIN_SUPPORT_API_BASE, WEBSITE_ORIGIN } from '../config/siteConfig';
import { getSecureItem, setSecureItem, STORAGE_KEYS } from './storage';
import { supportService } from './supportService';

export const ALERT_CHANNEL_ID = 'tiwlo_support_alerts';
export const RING_CHANNEL_ID = 'tiwlo_support_ring';
export const SERVICE_CHANNEL_ID = 'tiwlo_support_service';

interface SupportMonitorNative {
  startMonitor?: (apiBase: string, sessionToken: string, staffId: string) => Promise<boolean>;
  stopMonitor?: () => Promise<boolean>;
  isMonitorRunning?: () => Promise<boolean>;
  stopRingtone?: () => Promise<boolean>;
  triggerLocalRingtone?: (durationMs: number) => Promise<boolean>;
  markAlertHandled?: (kind: string, alertKey: string) => Promise<boolean>;
  isIgnoringBatteryOptimizations?: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations?: () => Promise<boolean>;
}

const monitorModule = (NativeModules.SupportMonitorModule || {}) as SupportMonitorNative;

let handlerConfigured = false;

export function configureNotificationPresentation(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Non-fatal in headless test environments
  }
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
      name: 'Live Chats & Ticket Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#EF4444',
      enableVibrate: true,
      enableLights: true,
    });
    await Notifications.setNotificationChannelAsync(RING_CHANNEL_ID, {
      name: 'Incoming Unaccepted Support Call Alerts',
      importance: Notifications.AndroidImportance.MAX,
      lightColor: '#EF4444',
      enableVibrate: false,
      enableLights: true,
      sound: null,
    });
    await Notifications.setNotificationChannelAsync(SERVICE_CHANNEL_ID, {
      name: 'Support Desk Connection',
      importance: Notifications.AndroidImportance.LOW,
      enableVibrate: false,
      showBadge: false,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Prompts OS notification permission right on app launch so staff receive real-time alerts.
 */
export async function initializeNotificationsOnLaunch(): Promise<boolean> {
  configureNotificationPresentation();
  await ensureNotificationChannels();

  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(
        () => 'denied'
      );
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  try {
    const res = await Notifications.getPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
}

export async function getBackgroundMonitorPreference(): Promise<boolean> {
  try {
    const saved = await getSecureItem(STORAGE_KEYS.BACKGROUND_MONITOR_ENABLED);
    return saved !== 'false';
  } catch {
    return true;
  }
}

export async function setBackgroundMonitorPreference(enabled: boolean): Promise<void> {
  await setSecureItem(STORAGE_KEYS.BACKGROUND_MONITOR_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Starts the Android foreground background listener service and optionally registers an Expo push token.
 */
export async function syncAuthenticatedBackgroundMonitor(staffId: string): Promise<boolean> {
  if (!staffId) return false;
  const wantBg = await getBackgroundMonitorPreference();
  const sessionToken = await getSecureItem(STORAGE_KEYS.SESSION_TOKEN);

  // Best-effort remote Expo push token registration (gracefully skipped if Firebase isn't bundled)
  try {
    const granted = await getNotificationPermissionStatus();
    if (granted && Device.isDevice) {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
      if (projectId) {
        const pushRes = await Notifications.getExpoPushTokenAsync({ projectId });
        if (pushRes?.data) {
          await supportService.registerPushToken({
            token: pushRes.data,
            platform: Platform.OS,
            deviceName: Device.modelName || 'Support Device',
          });
        }
      }
    }
  } catch {
    // Offline/local standalone APKs rely on Android native background service below
  }

  if (Platform.OS === 'android' && typeof monitorModule.startMonitor === 'function') {
    if (!wantBg || !sessionToken) {
      await monitorModule.stopMonitor?.().catch(() => false);
      return false;
    }
    try {
      const apiBase = `${WEBSITE_ORIGIN}${ADMIN_SUPPORT_API_BASE}`;
      await monitorModule.startMonitor(apiBase, sessionToken, String(staffId));
      return true;
    } catch {
      return false;
    }
  }

  return wantBg;
}

export async function stopBackgroundMonitor(): Promise<void> {
  if (Platform.OS === 'android') {
    await monitorModule.stopRingtone?.().catch(() => {});
    if (typeof monitorModule.stopMonitor === 'function') {
      await monitorModule.stopMonitor().catch(() => {});
    }
  }
  await supportService.unregisterPushToken().catch(() => {});
}

export async function stopSupportRingtone(): Promise<void> {
  if (Platform.OS === 'android' && typeof monitorModule.stopRingtone === 'function') {
    await monitorModule.stopRingtone().catch(() => false);
  }
}

export async function triggerSupportCallRingtone(durationMs = 10000): Promise<void> {
  if (Platform.OS === 'android' && typeof monitorModule.triggerLocalRingtone === 'function') {
    await monitorModule.triggerLocalRingtone(durationMs).catch(() => false);
  }
}

export async function markSupportAlertHandled(
  kind: 'livechat' | 'ticket',
  alertKey: string
): Promise<void> {
  if (Platform.OS === 'android' && alertKey && typeof monitorModule.markAlertHandled === 'function') {
    await monitorModule.markAlertHandled(kind, alertKey).catch(() => false);
  }
}

export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof monitorModule.isIgnoringBatteryOptimizations !== 'function') return true;
  try {
    return await monitorModule.isIgnoringBatteryOptimizations();
  } catch {
    return true;
  }
}

export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof monitorModule.requestIgnoreBatteryOptimizations !== 'function') return false;
  try {
    return await monitorModule.requestIgnoreBatteryOptimizations();
  } catch {
    return false;
  }
}

export async function promptAlwaysAllowBackgroundRun(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const ignored = await isBatteryOptimizationIgnored();
    if (ignored) return;
    const promptedBefore = await getSecureItem(STORAGE_KEYS.BATTERY_PROMPTED).catch(() => null);
    if (promptedBefore === '1') return;
    await setSecureItem(STORAGE_KEYS.BATTERY_PROMPTED, '1').catch(() => {});

    Alert.alert(
      'Always Allow Background Alerts',
      'Keep Tiwlo Support running reliably after app updates, screen lock, or phone reboot so you never miss incoming 10-second call alerts for new tickets or live chats.',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Allow Always',
          onPress: () => {
            requestBatteryOptimizationExemption().catch(() => {});
          },
        },
      ]
    );
  } catch {
    // Non-fatal
  }
}

export async function triggerForegroundAlertNotification(payload: {
  title: string;
  body: string;
  ring?: boolean;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const granted = await getNotificationPermissionStatus();
    if (granted) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          sound: payload.ring ? undefined : 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android'
            ? { channelId: payload.ring ? RING_CHANNEL_ID : ALERT_CHANNEL_ID }
            : {}),
        },
        trigger: null,
      });
    }
    if (payload.ring) {
      await triggerSupportCallRingtone(10000);
    }
  } catch {
    // Non-fatal
  }
}
