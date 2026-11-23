import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CloudOff,
  DownloadCloud,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
  WifiOff,
  Wrench,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPlayStoreUpdate, triggerHardSecurityTerminate } from '../services/tiwloIntegrity';
import { colors } from '../theme/tokens';

export type SystemErrorMode =
  | 'no_internet'
  | 'no_wifi'
  | 'server_error'
  | 'maintenance'
  | 'update_required';

interface SystemStateScreenProps {
  mode: SystemErrorMode;
  detailMessage?: string;
  retrying?: boolean;
  onRetry?: () => void;
}

const STATE_CONFIG: Record<
  SystemErrorMode,
  {
    title: string;
    description: string;
    buttonLabel: string;
    renderIcon: () => React.ReactNode;
    bg: string;
  }
> = {
  no_internet: {
    title: 'No Internet Connection',
    description:
      'Your device is offline. Check mobile data or network access and try again.',
    buttonLabel: 'Retry Connection',
    bg: colors.surface,
    renderIcon: () => <CloudOff size={34} strokeWidth={1.9} color={colors.foreground} />,
  },
  no_wifi: {
    title: 'Wi-Fi Disconnected',
    description:
      'Wi-Fi connection is unavailable or unstable. Reconnect Wi-Fi or switch to mobile data.',
    buttonLabel: 'Check Network Again',
    bg: colors.surface,
    renderIcon: () => <WifiOff size={34} strokeWidth={1.9} color={colors.foreground} />,
  },
  server_error: {
    title: 'Server Unavailable',
    description:
      'Tiwlo servers returned an unexpected error. Retry in a few moments.',
    buttonLabel: 'Retry Now',
    bg: colors.dangerSoft,
    renderIcon: () => <ServerCrash size={34} strokeWidth={1.9} color={colors.danger} />,
  },
  maintenance: {
    title: 'Scheduled Maintenance',
    description:
      'Tiwlo Cloud systems are undergoing planned maintenance. Access will resume shortly.',
    buttonLabel: 'Check Status',
    bg: colors.warningSoft,
    renderIcon: () => <Wrench size={34} strokeWidth={1.9} color={colors.warning} />,
  },
  update_required: {
    title: 'Security & Update Required',
    description:
      'This build failed integrity verification or requires an official Google Play update to continue safely.',
    buttonLabel: 'Update on Google Play',
    bg: colors.dangerSoft,
    renderIcon: () => <ShieldAlert size={34} strokeWidth={1.9} color={colors.danger} />,
  },
};

export const SystemStateScreen: React.FC<SystemStateScreenProps> = ({
  mode,
  detailMessage,
  retrying = false,
  onRetry,
}) => {
  const insets = useSafeAreaInsets();
  const cfg = STATE_CONFIG[mode];
  const isLock = mode === 'update_required';

  return (
    <View
      style={[
        styles.page,
        {
          paddingTop: Math.max(insets.top, 20) + 24,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        },
      ]}
    >
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
          {cfg.renderIcon()}
        </View>
        <Text style={styles.title}>{cfg.title}</Text>
        <Text style={styles.desc}>{detailMessage || cfg.description}</Text>
      </View>

      <View style={styles.actions}>
        {isLock ? (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void openPlayStoreUpdate()}
              activeOpacity={0.85}
            >
              <DownloadCloud size={18} strokeWidth={2} color={colors.ink} />
              <Text style={styles.primaryBtnText}>Update on Google Play</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={triggerHardSecurityTerminate}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Close App</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onRetry}
            disabled={retrying}
            activeOpacity={0.85}
          >
            {retrying ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <RefreshCw size={17} strokeWidth={2} color={colors.ink} />
            )}
            <Text style={styles.primaryBtnText}>
              {retrying ? 'Checking...' : cfg.buttonLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
});
