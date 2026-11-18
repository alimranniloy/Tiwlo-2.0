import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  logoutAccount,
  requestPinForgotOtp,
  resetSecurityPinWithOtp,
} from '../../services/authService';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  getWorkspacePreferences,
  subscribeWorkspacePreferences,
  updateWorkspacePreferences,
} from '../../services/preferencesService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StaffWorkspacePreferences } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { useSensitiveGrant } from '../../components/security/SensitiveGrantContext';
import {
  BorderlessIconButton,
  CompactOtpInput,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicModalSheet,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface SecurityPinSessionScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const AUTO_LOCK_OPTIONS: readonly { minutes: 0 | 1 | 5 | 15; label: string }[] = [
  { minutes: 0, label: 'Immediate (0m)' },
  { minutes: 1, label: '1 min' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
];

export const SecurityPinSessionScreen: React.FC<SecurityPinSessionScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onRefreshSession,
  onLockNow,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const { requestSensitiveGrant } = useSensitiveGrant();

  const [prefs, setPrefs] = useState<StaffWorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  // PIN Change / Reset via Email OTP modal state
  const [pinResetVisible, setPinResetVisible] = useState(false);
  const [pinTempToken, setPinTempToken] = useState('');
  const [pinEmailMasked, setPinEmailMasked] = useState('');
  const [pinOtp, setPinOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [revokingSessions, setRevokingSessions] = useState(false);

  useEffect(() => {
    let active = true;
    getWorkspacePreferences().then((loaded) => {
      if (active) setPrefs(loaded);
    });
    const unsub = subscribeWorkspacePreferences(setPrefs);
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      active = false;
      unsub();
      backSub.remove();
    };
  }, [onBack]);

  const handleToggleRequirePin = async (enabled: boolean) => {
    await updateWorkspacePreferences({ requirePinOnLaunch: enabled });
    toast.show({
      variant: enabled ? 'success' : 'accent',
      label: enabled
        ? 'App-launch Security PIN lock enabled.'
        : 'App-launch PIN prompt disabled.',
    });
  };

  const handleSelectAutoLock = async (minutes: 0 | 1 | 5 | 15) => {
    Haptics.selectionAsync().catch(() => {});
    await updateWorkspacePreferences({ autoLockMinutes: minutes });
    toast.show({
      variant: 'success',
      label:
        minutes === 0
          ? 'Auto-lock set to Immediate on background.'
          : `Auto-lock set to ${minutes} min inactivity.`,
    });
  };

  const handleLockRightNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (onLockNow) {
      onLockNow();
      return;
    }
    toast.show({
      variant: 'accent',
      label: 'Security PIN gate is armed for next workspace launch.',
    });
  };

  const handleVerifyCurrentPin = async () => {
    try {
      await requestSensitiveGrant('Verify Current Staff Security PIN');
      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastVerifiedAt(nowTime);
      toast.show({
        variant: 'success',
        label: 'Security PIN verified successfully.',
      });
    } catch (err) {
      toast.show({
        variant: 'accent',
        label: err instanceof Error ? err.message : 'PIN verification cancelled.',
      });
    }
  };

  const handleStartPinResetFlow = async () => {
    setPinOtp('');
    setNewPin('');
    setConfirmPin('');
    setPinResetVisible(true);
    setPinBusy(true);
    try {
      const res = await requestPinForgotOtp();
      setPinTempToken(res.tempToken);
      setPinEmailMasked(res.emailMasked || user.email);
      toast.show({
        variant: 'accent',
        label: `Verification code sent to ${res.emailMasked || user.email}.`,
      });
    } catch (err) {
      setPinResetVisible(false);
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not request PIN OTP.',
      });
    } finally {
      setPinBusy(false);
    }
  };

  const handleSubmitPinReset = async () => {
    if (!/^\d{6}$/.test(pinOtp.trim())) {
      toast.show({ variant: 'danger', label: 'Enter the 6-digit email OTP.' });
      return;
    }
    if (!/^\d{4,8}$/.test(newPin.trim()) || newPin.trim() !== confirmPin.trim()) {
      toast.show({ variant: 'danger', label: 'Enter matching 4 to 8 digit PINs.' });
      return;
    }

    setPinBusy(true);
    try {
      await resetSecurityPinWithOtp(
        pinTempToken,
        pinOtp.trim(),
        newPin.trim(),
        confirmPin.trim()
      );
      setPinResetVisible(false);
      toast.show({ variant: 'success', label: 'Staff Security PIN updated.' });
      await onRefreshSession?.();
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to update Security PIN.',
      });
    } finally {
      setPinBusy(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    try {
      await requestSensitiveGrant('Sign Out All Active Devices');
      setRevokingSessions(true);
      await supportService.terminateUserSessions(
        user.id,
        'Staff self-service sign out all active sessions'
      );
      await logoutAccount();
      toast.show({
        variant: 'success',
        label: 'All active sessions terminated.',
      });
      await onRefreshSession?.();
    } catch (err) {
      if (err instanceof Error && err.message === 'Verification cancelled.') {
        return;
      }
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not revoke all sessions.',
      });
    } finally {
      setRevokingSessions(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.topBar}>
        <BorderlessIconButton
          name="arrow-left"
          size={19}
          onPress={onBack}
          accessibilityLabel="Back to settings"
        />
        <View style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: tokens.text }]}>
            App Lock, PIN & Security
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            Launch gate, inactivity auto-lock, PIN management & sessions
          </Text>
        </View>
        <FlatBadge
          label={staffProfile.hasPin ? 'PIN Active' : 'No PIN'}
          tone={staffProfile.hasPin ? 'success' : 'warning'}
          withDot
        />
      </View>

      <Hairline />

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Launch & Inactivity Lock */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          APP LAUNCH & AUTO-LOCK
        </Text>

        <View style={styles.rowsGroup}>
          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="lock" size={17} color={tokens.accent} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Require PIN on App Launch
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Prompt your 4–8 digit Security PIN immediately whenever SupportApp opens
              </Text>
            </View>
            <MagicSwitch
              value={prefs.requirePinOnLaunch}
              onValueChange={handleToggleRequirePin}
            />
          </View>
        </View>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>
              Auto-Lock After Background Inactivity
            </Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Re-lock the support desk when app stays minimized beyond threshold
            </Text>
          </View>

          <View style={styles.autoLockGrid}>
            {AUTO_LOCK_OPTIONS.map((opt) => {
              const selected = prefs.autoLockMinutes === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  activeOpacity={0.75}
                  onPress={() => handleSelectAutoLock(opt.minutes)}
                  style={[
                    styles.lockChip,
                    {
                      backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.lockChipText,
                      {
                        color: selected ? tokens.accent : tokens.text,
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lock App Right Now Action */}
          <View
            style={[
              styles.actionStrip,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>Lock App Right Now</Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Immediately engage the PIN unlock gate before stepping away
              </Text>
            </View>
            <ShimmerButton
              label="Lock Now"
              size="sm"
              onPress={handleLockRightNow}
              leftIcon={<Feather name="shield" size={12} color={tokens.inkButtonText} />}
            />
          </View>
        </View>

        {/* PIN Verification & Change/Reset */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          SECURITY PIN AUTHORIZATION
        </Text>

        <View style={styles.rowsGroup}>
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={handleVerifyCurrentPin}
            style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}
          >
            <Feather name="check-circle" size={17} color={tokens.accent} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>Verify Current PIN</Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                {lastVerifiedAt
                  ? `Last verified at ${lastVerifiedAt} — tap to test PIN authorization`
                  : 'Test your 4–8 digit sensitive action grant prompt'}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={tokens.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.65}
            onPress={handleStartPinResetFlow}
            style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}
          >
            <Feather name="key" size={17} color={tokens.text} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Change / Reset PIN via Email OTP
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Send a 6-digit OTP to {user.email} and configure a new PIN
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={tokens.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Network IP Allowlist & Session Control */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          NETWORK ALLOWLIST & ACTIVE SESSIONS
        </Text>

        <View
          style={[
            styles.ipSummaryBox,
            {
              backgroundColor: tokens.surfaceSubtle,
              borderColor: tokens.hairlineStrong,
            },
          ]}
        >
          <View style={styles.ipTopLine}>
            <View style={styles.ipTitleCluster}>
              <Feather name="globe" size={15} color={tokens.accent} />
              <Text style={[styles.rowTitle, { color: tokens.text }]}>IP Allowlist Policy</Text>
            </View>
            <FlatBadge
              label={
                staffProfile.allowedIpsConfigured
                  ? `${staffProfile.allowedIpsCount || 0} Rules Active`
                  : 'Unrestricted'
              }
              tone={staffProfile.allowedIpsConfigured ? 'success' : 'neutral'}
            />
          </View>
          <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
            {staffProfile.allowedIpsConfigured
              ? `Your staff profile enforces ${staffProfile.allowedIpsCount || 0} whitelisted network IP rule(s). Requests from unauthorized networks are rejected automatically.`
              : 'Your staff profile allows authenticated connections from any verified network with valid session & PIN credentials.'}
          </Text>
          {typeof staffProfile.failedAttempts === 'number' && staffProfile.failedAttempts > 0 ? (
            <FlatNotice
              tone="warning"
              icon="alert-triangle"
              text={`Recent failed PIN attempts recorded: ${staffProfile.failedAttempts}`}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.actionStrip,
            {
              backgroundColor: tokens.surfaceSubtle,
              borderColor: tokens.hairlineStrong,
            },
          ]}
        >
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: tokens.danger }]}>
              Sign Out All Devices
            </Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Revoke every active web and mobile session for {user.email} (PIN required)
            </Text>
          </View>
          <ShimmerButton
            label="Revoke All"
            size="sm"
            variant="danger"
            loading={revokingSessions}
            onPress={handleSignOutAllDevices}
          />
        </View>
      </ScrollView>

      {/* Change / Reset PIN Modal Sheet */}
      <MagicModalSheet
        visible={pinResetVisible}
        onClose={() => setPinResetVisible(false)}
        title="Change / Reset Security PIN"
        subtitle={`Enter the 6-digit OTP sent to ${pinEmailMasked || user.email}`}
      >
        <CompactOtpInput label="6-Digit Email OTP" value={pinOtp} onChange={setPinOtp} />
        <FlatInput
          label="New Security PIN (4–8 digits)"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          placeholder="••••"
          value={newPin}
          onChangeText={(txt) => setNewPin(txt.replace(/\D/g, '').slice(0, 8))}
        />
        <FlatInput
          label="Confirm Security PIN"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          placeholder="••••"
          value={confirmPin}
          onChangeText={(txt) => setConfirmPin(txt.replace(/\D/g, '').slice(0, 8))}
          onSubmitEditing={handleSubmitPinReset}
        />
        <ShimmerButton
          label="Save Security PIN"
          size="md"
          variant="accent"
          loading={pinBusy}
          onPress={handleSubmitPinReset}
        />
      </MagicModalSheet>
    </View>
  );
};

export default SecurityPinSessionScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topTitleWrap: {
    flex: 1,
    gap: 1,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  topSubtitle: {
    fontSize: 11.5,
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 14,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  rowsGroup: {},
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowTextCol: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  blockStack: {
    gap: 11,
  },
  subLabelGroup: {
    gap: 2,
  },
  autoLockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  lockChipText: {
    fontSize: 12,
  },
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
  },
  ipSummaryBox: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    gap: 8,
  },
  ipTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ipTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
});
