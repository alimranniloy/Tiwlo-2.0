import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Proactively requests all necessary runtime permissions on app launch:
 * - Camera (Photos, Stories, Shorts/Reels)
 * - Media & Storage (Gallery photo/video picker)
 * - Microphone / Audio (Shorts recording, voice notes)
 * - Location (Post geotagging, nearby discoverability)
 * - Notifications (Push alerts, mentions, messages)
 * - SMS (Automated 2FA OTP verification)
 */
export async function requestInitialAppPermissions() {
  if (Platform.OS !== 'android') return;

  try {
    const permissionsToRequest = [];

    // 1. Camera
    if (PermissionsAndroid.PERMISSIONS.CAMERA) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    // 2. Microphone / Audio
    if (PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }

    // 3. Location (Fine & Coarse)
    if (PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    if (PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    }

    // 4. Media & Storage (Android 13+ API 33+ granular media vs legacy external storage)
    if (Platform.Version >= 33) {
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
      }
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO);
      }
      if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
      }
      if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
    } else {
      if (PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      }
      if (PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      }
    }

    // 5. SMS (For automated 2FA / OTP verification)
    if (PermissionsAndroid.PERMISSIONS.READ_SMS) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_SMS);
    }
    if (PermissionsAndroid.PERMISSIONS.RECEIVE_SMS) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    }

    if (permissionsToRequest.length > 0) {
      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      console.log('[TiwiPermissions] Startup permission results:', results);
      return results;
    }
  } catch (err) {
    console.warn('[TiwiPermissions] Permission request encountered an error:', err);
  }
}
