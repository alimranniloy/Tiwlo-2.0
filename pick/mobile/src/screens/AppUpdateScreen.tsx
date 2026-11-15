import React, { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import type { PickAppUpdate, PickMobileAppId } from '../services/appUpdates';

interface AppUpdateScreenProps {
  appId: PickMobileAppId;
  update: PickAppUpdate;
  currentVersion: string;
}

const appName = (appId: PickMobileAppId) => appId === 'pick' ? 'PICK' : 'PICK Delivery';
const APK_MIME_TYPE = 'application/vnd.android.package-archive';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AppUpdateScreen: React.FC<AppUpdateScreenProps> = ({
  appId,
  update,
  currentVersion,
}) => {
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<{
    bytesWritten: number;
    totalBytes: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [downloadedPackage, setDownloadedPackage] = useState<{
    file: File;
    version: string;
  } | null>(null);
  const targetUrl = update?.playStoreEnabled && update.playStoreUrl
    ? update.playStoreUrl
    : update?.apkUrl;

  const installUpdate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setBusyLabel('Opening update…');
      if (update.playStoreEnabled && update.playStoreUrl) {
        await Linking.openURL(update.playStoreUrl);
        return;
      }
      if (Platform.OS !== 'android') {
        throw new Error('APK installation is available only on Android.');
      }
      const updateVersion = update.version || 'latest';
      const installerFile = downloadedPackage?.version === updateVersion
        ? downloadedPackage.file
        : null;
      let fileToInstall = installerFile;
      if (!fileToInstall) {
        if (!update.apkUrl) {
          throw new Error('An Android update package is not available.');
        }
        setBusyLabel('Downloading update…');
        setDownloadProgress({ bytesWritten: 0, totalBytes: -1 });
        const file = new File(Paths.cache, `${appId}-${update.version || 'latest'}.apk`);
        const downloaded = await File.downloadFileAsync(update.apkUrl, file, {
          idempotent: true,
          onProgress: (progress) => setDownloadProgress(progress)
        });
        if (!downloaded.exists || (downloaded.size ?? 0) < 4) {
          downloaded.delete();
          throw new Error('The app update download is incomplete. Please try again.');
        }
        fileToInstall = downloaded;
        setDownloadedPackage({ file: downloaded, version: updateVersion });
      }
      setBusyLabel('Opening installer…');
      await fileToInstall.preview({ mimeType: APK_MIME_TYPE });
    } catch (installError) {
      setError(installError instanceof Error
        ? installError.message
        : 'Could not open the app installer. Please try again.');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const downloadPercent = downloadProgress && downloadProgress.totalBytes > 0
    ? Math.min(100, Math.floor(
      downloadProgress.bytesWritten / downloadProgress.totalBytes * 100
    ))
    : null;
  const downloadComplete = Boolean(
    downloadedPackage &&
    downloadedPackage.version === (update?.version || 'latest') &&
    downloadedPackage.file.exists
  );
  const actionTitle = update?.playStoreEnabled && update.playStoreUrl
    ? 'Update in Google Play'
    : downloadComplete
      ? 'Install now'
      : 'Download update';

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
          {`A better ${appName(appId)} is here. Download the update, then confirm installation in Android.`}
        </Text>
        {update.version ? <Text style={styles.version}>Version {update.version}</Text> : null}
        {downloadProgress ? (
          <View style={styles.progressSection}>
            <View style={styles.progressTitleRow}>
              <Text style={styles.progressTitle}>
                {downloadComplete ? 'Download complete' : 'Downloading update'}
              </Text>
              {downloadPercent !== null ? (
                <Text style={styles.progressPercent}>{downloadPercent}%</Text>
              ) : null}
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: downloadPercent ?? undefined
              }}
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${downloadPercent ?? (downloadComplete ? 100 : 8)}%` }
                ]}
              />
            </View>
            <Text style={styles.progressDetail}>
              {downloadComplete
                ? `${formatBytes(downloadProgress.bytesWritten)} · Ready to install`
                : downloadPercent === null
                  ? `${formatBytes(downloadProgress.bytesWritten)} downloaded`
                  : `${formatBytes(downloadProgress.bytesWritten)} of ${formatBytes(downloadProgress.totalBytes)}`}
            </Text>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy || !targetUrl}
          onPress={() => void installUpdate()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (busy || !targetUrl) && styles.buttonDisabled
          ]}
        >
          {busy ? (
            <Text style={styles.buttonText}>{busyLabel}</Text>
          ) : (
            <Text style={styles.buttonText}>{actionTitle}</Text>
          )}
        </Pressable>
        {update.playStoreEnabled && update.playStoreUrl ? (
          <Text style={styles.installNote}>
            Google Play handles the download and installation for this app.
          </Text>
        ) : update.apkUrl ? (
          <Text style={styles.installNote}>
            The APK stays in PICK&apos;s private temporary cache. Android opens its secure installer and asks you to confirm.
          </Text>
        ) : null}
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
  progressSection: {
    width: '100%',
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#F7F8F9'
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11
  },
  progressTitle: { color: '#374151', fontSize: 13, fontWeight: '700' },
  progressPercent: { color: '#138A5B', fontSize: 13, fontWeight: '800' },
  progressTrack: {
    height: 7,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: '#E5E7EB'
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#17A56B'
  },
  progressDetail: { color: '#6B7280', fontSize: 11, marginTop: 9 },
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
