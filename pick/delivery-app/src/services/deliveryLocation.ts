import * as Location from 'expo-location';
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync
} from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  DeliveryApiError,
  saveDeliveryLocation,
  saveDeliveryPushToken,
  setDeliveryDuty
} from './deliveryApi';

export const DELIVERY_LOCATION_TASK = 'pick-delivery-background-location';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  DELIVERY_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error('PICK Delivery background location failed:', error);
      return;
    }
    const location = data?.locations.at(-1);
    if (!location) {
      console.error('PICK Delivery received an empty background location update.');
      return;
    }
    const { latitude, longitude, accuracy } = location.coords;
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy > 200) {
      console.warn('PICK Delivery skipped an inaccurate background GPS fix.');
      return;
    }
    try {
      const result = await saveDeliveryLocation({ latitude, longitude, accuracy });
      if (!result.coverageAvailable || !result.isOnDuty) {
        await stopDeliveryLocationTracking();
      }
    } catch (locationError) {
      console.error('PICK Delivery could not save a background location:', locationError);
      if (locationError instanceof DeliveryApiError &&
          [401, 403].includes(locationError.status)) {
        await stopDeliveryLocationTracking();
      }
    }
  }
);

export async function ensureDeliveryNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('pick-delivery-orders-v2', {
      name: 'Parcel offers',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      sound: 'default',
      audioAttributes: {
        usage: AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: AndroidAudioContentType.SONIFICATION
      },
      enableVibrate: true
    });
  }
}

function getDeliveryPushProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function permissionMessage(permission: { canAskAgain: boolean }, message: string): string {
  return permission.canAskAgain
    ? message
    : `${message} Open PICK Delivery’s app permissions in Settings, then tap Go on duty again.`;
}

async function ensureLocationPermissions(request: boolean): Promise<void> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted' && request && foreground.canAskAgain) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (foreground.status !== 'granted') {
    throw new Error(permissionMessage(
      foreground,
      'Allow location while using PICK Delivery before going on duty.'
    ));
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted' && request && background.canAskAgain) {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') {
    throw new Error(permissionMessage(
      background,
      'Allow background location (“Always”) to stay available while the app is minimized.'
    ));
  }
}

async function ensureNotificationPermission(request: boolean): Promise<boolean> {
  let permission = await getPermissionsAsync();
  if (!permission.granted && request && permission.canAskAgain) {
    permission = await requestPermissionsAsync();
  }
  return permission.granted;
}

export async function registerDeliveryPushNotifications(
  requestPermission = true
): Promise<string | null> {
  const projectId = getDeliveryPushProjectId();
  if (!projectId) return null;
  await ensureDeliveryNotificationChannel();
  if (!(await ensureNotificationPermission(requestPermission))) return null;
  const token = await getExpoPushTokenAsync({ projectId });
  if (!token.data) return null;
  await saveDeliveryPushToken(token.data);
  return token.data;
}

export async function startDeliveryLocationTracking(): Promise<void> {
  await ensureLocationPermissions(false);
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
  if (alreadyStarted) return;
  await Location.startLocationUpdatesAsync(DELIVERY_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 30_000,
    distanceInterval: 100,
    deferredUpdatesInterval: 30_000,
    deferredUpdatesDistance: 100,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'PICK Delivery is on duty',
      notificationBody: 'Live location is active while you receive parcel offers.',
      notificationColor: '#17A56B'
    }
  });
}

export async function stopDeliveryLocationTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
  }
}

export async function goOnDeliveryDuty(): Promise<void> {
  await ensureLocationPermissions(true);
  try {
    await registerDeliveryPushNotifications(true);
  } catch (notificationError) {
    console.warn('PICK Delivery push alerts are unavailable; continuing without them:', notificationError);
  }
  const currentLocation = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High
  });
  const accuracy = currentLocation.coords.accuracy;
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy > 200) {
    throw new Error('GPS accuracy is too low. Move to an open area and try again.');
  }
  const savedLocation = await saveDeliveryLocation({
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
    accuracy
  });
  if (!savedLocation.coverageAvailable) {
    throw new Error('PICK Delivery is not available in your current coverage area.');
  }
  await startDeliveryLocationTracking();
  try {
    await setDeliveryDuty(true);
  } catch (error) {
    await stopDeliveryLocationTracking();
    throw error;
  }
}

export async function goOffDeliveryDuty(): Promise<void> {
  await setDeliveryDuty(false);
  await stopDeliveryLocationTracking();
}

export async function restoreDeliveryTracking(): Promise<void> {
  try {
    await ensureLocationPermissions(false);
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const accuracy = location.coords.accuracy;
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy > 200) {
      throw new Error('GPS accuracy is too low to resume delivery tracking.');
    }
    const savedLocation = await saveDeliveryLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy
    });
    if (!savedLocation.coverageAvailable) {
      throw new Error('PICK Delivery is no longer available at your current location.');
    }
    await startDeliveryLocationTracking();
  } catch (error) {
    try {
      await setDeliveryDuty(false);
    } catch (dutyError) {
      console.error('PICK Delivery could not turn off duty after background prerequisites failed:', dutyError);
      await stopDeliveryLocationTracking();
      throw new Error('PICK Delivery could not confirm that duty is off. Check your connection and try again.');
    }
    await stopDeliveryLocationTracking();
    throw error;
  }
}
