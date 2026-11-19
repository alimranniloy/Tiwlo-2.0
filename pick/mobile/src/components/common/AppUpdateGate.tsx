import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AppUpdateScreen } from '../../screens/AppUpdateScreen';
import {
  compareAppVersions,
  getPickAppUpdate,
  type PickAppUpdate,
  type PickMobileAppId
} from '../../services/appUpdates';

interface AppUpdateGateProps {
  appId: PickMobileAppId;
  children: React.ReactNode;
}

export const AppUpdateGate: React.FC<AppUpdateGateProps> = ({ appId, children }) => {
  const currentVersion = Constants.expoConfig?.version || '0.0.0';
  const [update, setUpdate] = useState<PickAppUpdate | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const latest = await getPickAppUpdate(appId);
      const comparison = latest.version
        ? compareAppVersions(currentVersion, latest.version)
        : null;
      const installAvailable = Boolean(
        latest.playStoreEnabled && latest.playStoreUrl
      );
      setUpdate(comparison !== null && comparison < 0 && installAvailable ? latest : null);
    } catch (error) {
      console.error(`PICK ${appId} app update check failed:`, error);
    }
  }, [appId, currentVersion]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const initialCheck = setTimeout(() => void checkForUpdate(), 10_000);
    return () => {
      clearTimeout(initialCheck);
    };
  }, [checkForUpdate]);

  if (update) {
    return (
      <AppUpdateScreen
        appId={appId}
        update={update}
        currentVersion={currentVersion}
      />
    );
  }
  return <>{children}</>;
};
