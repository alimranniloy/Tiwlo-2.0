import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../../../mobile/src/context/LanguageContext';
import { DeliveryEntryScreen } from './DeliveryEntryScreen';
import { ensureDeliveryNotificationChannel } from '../services/deliveryLocation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function DeliveryRoot() {
  useEffect(() => {
    ensureDeliveryNotificationChannel().catch((error: unknown) => {
      console.error('PICK Delivery notification channel setup failed:', error);
    });
  }, []);

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <DeliveryEntryScreen />
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
