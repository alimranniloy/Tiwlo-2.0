import * as Location from 'expo-location';
import {
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
    await setNotificationChannelAsync('pick-delivery-orders', {
      name: 'Parcel offers',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      sound: 'default',
      enableVibrate: true
    });
  }
}

async function ensureLocationPermissions(): Promise<void> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (foreground.status !== 'granted') {
    throw new Error('Allow location while using PICK Delivery before going on duty.');
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') {
    throw new Error('Allow background location (“Always”) in Settings to stay available while the app is minimized.');
  }
}

async function ensureNotificationPermission(): Promise<void> {
  let permission = await getPermissionsAsync();
  if (!permission.granted) permission = await requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Enable notifications in Settings to receive parcel offers while on duty.');
  }
}

export async function registerDeliveryPushNotifications(): Promise<string | null> {
  await ensureDeliveryNotificationChannel();
  await ensureNotificationPermission();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = await getExpoPushTokenAsync({ projectId });
  if (!token.data) throw new Error('PICK Delivery could not register for parcel notifications.');
  await saveDeliveryPushToken(token.data);
  return token.data;
}

export async function startDeliveryLocationTracking(): Promise<void> {
  await ensureLocationPermissions();
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

export async function goOnDeliveryDuty(): Promise<{ pushConfigured: boolean }> {
  const locationPermission = await Location.getForegroundPermissionsAsync();
  if (locationPermission.status !== 'granted') {
    const requestedPermission = await Location.requestForegroundPermissionsAsync();
    if (requestedPermission.status !== 'granted') {
      throw new Error('Allow location access to go on duty.');
    }
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
  await registerDeliveryPushNotifications();
  await startDeliveryLocationTracking();
  try {
    await setDeliveryDuty(true);
  } catch (error) {
    await stopDeliveryLocationTracking();
    throw error;
  }
  return { pushConfigured: Boolean(Constants.expoConfig?.extra?.eas?.projectId) };
}

export async function goOffDeliveryDuty(): Promise<void> {
  await setDeliveryDuty(false);
  await stopDeliveryLocationTracking();
}

export async function restoreDeliveryTracking(): Promise<void> {
  await ensureLocationPermissions();
  await ensureNotificationPermission();
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
}
