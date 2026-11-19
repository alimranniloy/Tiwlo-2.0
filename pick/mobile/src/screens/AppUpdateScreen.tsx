import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import type { PickAppUpdate, PickMobileAppId } from '../services/appUpdates';

interface AppUpdateScreenProps {
  appId: PickMobileAppId;
  update: PickAppUpdate;
  currentVersion: string;
}

const appName = (appId: PickMobileAppId) => appId === 'pick' ? 'PICK' : 'PICK Delivery';

export const AppUpdateScreen: React.FC<AppUpdateScreenProps> = ({
  appId,
  update,
  currentVersion,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const playStoreUrl = update?.playStoreUrl ||
    `https://play.google.com/store/apps/details?id=${appId === 'pick' ? 'com.pick.tiwlo' : 'com.pick.delivery'}`;

  const openPlayStoreUpdate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await Linking.openURL(playStoreUrl);
    } catch (openError) {
      setError(openError instanceof Error
        ? openError.message
        : 'Could not open Google Play Store. Please update the app from Google Play.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer applyTopInset style={styles.screen}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/parcel-animation.gif')}
          contentFit="contain"
          autoplay
          style={styles.animation}
          accessibilityLabel="Animated PICK delivery update illustration"
        />
        <Text style={styles.eyebrow}>A FRESH PICK EXPERIENCE</Text>
        <Text style={styles.title}>
          A new update is ready
        </Text>
        <Text style={styles.description}>
          {`A better ${appName(appId)} is available on Google Play. Update to continue using the latest version.`}
        </Text>
        {update.version ? <Text style={styles.version}>Version {update.version}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void openPlayStoreUpdate()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            busy && styles.buttonDisabled
          ]}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Opening Google Play…' : 'Update in Google Play'}
          </Text>
        </Pressable>
        <Text style={styles.installNote}>
          Google Play handles the download and installation for this app.
        </Text>
        <Text style={styles.currentVersion}>Current version {currentVersion}</Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: SYSTEM_INSETS.bottom
  },
  animation: { width: 250, height: 230, marginBottom: 8 },
  eyebrow: {
    color: '#17A56B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center'
  },
  description: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 330,
    textAlign: 'center'
  },
  version: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20
  },
  error: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    textAlign: 'center'
  },
  button: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    borderRadius: 16,
    backgroundColor: '#111827'
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  installNote: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    maxWidth: 300,
    textAlign: 'center'
  },
  currentVersion: { color: '#9CA3AF', fontSize: 11, marginTop: 24 }
});
