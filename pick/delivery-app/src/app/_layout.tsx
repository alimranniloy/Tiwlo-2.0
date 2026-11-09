import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../../../mobile/src/context/LanguageContext';
import { ensureDeliveryNotificationChannel } from '../services/deliveryLocation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export default function RootLayout() {
  useEffect(() => {
    ensureDeliveryNotificationChannel().catch((error: unknown) => {
      console.error('PICK Delivery notification channel setup failed:', error);
    });
  }, []);

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
