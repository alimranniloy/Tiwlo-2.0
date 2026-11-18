import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import {
  requestPinForgotOtp,
  resetSecurityPinWithOtp,
  verifyStaffSecurityPin,
} from '../../services/authService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import {
  BorderlessIconButton,
  CompactOtpInput,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicAvatar,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface PinUnlockGateScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onUnlocked: () => void;
  onLogout: () => void;
  onPinResetComplete?: () => Promise<void>;
}

const KEYPAD_ROWS: readonly (readonly ('1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'Clear' | '0' | '⌫')[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['Clear', '0', '⌫'],
];

export const PinUnlockGateScreen: React.FC<PinUnlockGateScreenProps> = ({
  user,
  staffProfile,
  onUnlocked,
  onLogout,
  onPinResetComplete,
}) => {
  const { theme, tokens, toggleTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Forgot PIN via Email OTP inline mode
  const [resetMode, setResetMode] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  const [shakeAnim] = useState(() => new Animated.Value(0));

  const triggerErrorShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 48, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 48, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 48, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 48, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 48, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  const handleKeyPress = (key: (typeof KEYPAD_ROWS)[number][number]) => {
    if (busy) return;
    if (error) setError('');
    Haptics.selectionAsync().catch(() => {});

    if (key === 'Clear') {
      setPin('');
      return;
    }
    if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    setPin((prev) => (prev.length < 8 ? `${prev}${key}` : prev));
  };

  const handleUnlock = async () => {
    if (pin.length < 4 || pin.length > 8) {
      setError('Enter your 4 to 8 digit Staff Security PIN.');
      triggerErrorShake();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyStaffSecurityPin(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPin('');
      onUnlocked();
    } catch (err) {
      setPin('');
      setError(err instanceof Error ? err.message : 'Incorrect Security PIN. Try again.');
      triggerErrorShake();
    } finally {
      setBusy(false);
    }
  };

  const handleStartForgotPin = async () => {
    setResetError('');
    setOtpCode('');
    setNewPin('');
    setConfirmPin('');
    setResetBusy(true);
    try {
      const res = await requestPinForgotOtp();
      setTempToken(res.tempToken);
      setEmailMasked(res.emailMasked || user.email);
      setResetMode(true);
      toast.show({
        variant: 'accent',
        label: `Verification OTP sent to ${res.emailMasked || user.email}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send PIN recovery OTP.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleCompletePinReset = async () => {
    setResetError('');
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setResetError('Enter the 6-digit email OTP code.');
      return;
    }
    if (!/^\d{4,8}$/.test(newPin.trim())) {
      setResetError('New Security PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setResetError('New PIN and confirmation do not match.');
      return;
    }

    setResetBusy(true);
    try {
      await resetSecurityPinWithOtp(tempToken, otpCode.trim(), newPin.trim(), confirmPin.trim());
      if (onPinResetComplete) {
        await onPinResetComplete();
      }
      setResetMode(false);
      setPin('');
      setError('');
      toast.show({
        variant: 'success',
        label: 'Security PIN updated. Enter your new PIN to unlock.',
      });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Unable to reset Security PIN.');
    } finally {
      setResetBusy(false);
    }
  };

  const avatarUri = resolveWebsiteUrl(user.avatar);
  const roleLabel = (staffProfile.roleKey || user.role || 'staff')
    .replace(/_/g, ' ')
    .toUpperCase();
  const visibleDotSlots = Math.max(4, Math.min(8, pin.length));

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={[styles.root, { backgroundColor: tokens.bg }]}>
        {/* Minimal Top Utility Bar — Zero Background Animation */}
        <View style={styles.topBar}>
          <FlatBadge label="Workspace Locked" tone="warning" withDot />
          <BorderlessIconButton
            name={theme === 'dark' ? 'sun' : 'moon'}
            size={18}
            onPress={toggleTheme}
            accessibilityLabel="Toggle color theme"
          />
        </View>

        {resetMode ? (
          <KeyboardAwareScrollView
            style={styles.flex1}
            bottomOffset={64}
            contentContainerStyle={styles.resetScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.identityCenter}>
              <MagicAvatar name={user.name || staffProfile.name} uri={avatarUri} size={52} />
              <Text style={[styles.staffName, { color: tokens.text }]}>
                {user.name || staffProfile.name}
              </Text>
              <FlatBadge label={roleLabel} tone="accent" />
            </View>

            <View style={styles.resetTitleBlock}>
              <Text style={[styles.unlockTitle, { color: tokens.text }]}>
                Reset Security PIN
              </Text>
              <Text style={[styles.unlockSub, { color: tokens.textMuted }]}>
                Enter the 6-digit OTP sent to {emailMasked || user.email} and set a new 4–8 digit PIN.
              </Text>
            </View>

            <Hairline />

            {resetError ? (
              <FlatNotice text={resetError} tone="danger" icon="alert-circle" />
            ) : null}

            <View style={styles.resetForm}>
              <CompactOtpInput
                label="6-Digit Email OTP"
                value={otpCode}
                onChange={setOtpCode}
              />
              <FlatInput
                label="New Security PIN (4–8 digits)"
                value={newPin}
                onChangeText={(txt) => setNewPin(txt.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                placeholder="••••"
              />
              <FlatInput
                label="Confirm New Security PIN"
                value={confirmPin}
                onChangeText={(txt) => setConfirmPin(txt.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                placeholder="••••"
                onSubmitEditing={handleCompletePinReset}
              />

              <View style={styles.resetActionsRow}>
                <ShimmerButton
                  label="Save New PIN"
                  size="md"
                  variant="accent"
                  loading={resetBusy}
                  onPress={handleCompletePinReset}
                />
                <TouchableOpacity
                  disabled={resetBusy}
                  onPress={() => {
                    setResetMode(false);
                    setResetError('');
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.linkMuted, { color: tokens.textMuted }]}>
                    Back to keypad
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAwareScrollView>
        ) : (
          <View style={styles.unlockContainer}>
            {/* Centered Staff Identity */}
            <View style={styles.identityCenter}>
              <MagicAvatar name={user.name || staffProfile.name} uri={avatarUri} size={56} />
              <Text numberOfLines={1} style={[styles.staffName, { color: tokens.text }]}>
                {user.name || staffProfile.name}
              </Text>
              <View style={styles.badgeCluster}>
                <FlatBadge label={roleLabel} tone="accent" withDot />
                {staffProfile.isSuperAdmin ? (
                  <FlatBadge label="Super Admin" tone="success" />
                ) : null}
              </View>
            </View>

            {/* Title & Masked PIN Dots */}
            <View style={styles.pinHeaderCenter}>
              <Text style={[styles.unlockTitle, { color: tokens.text }]}>
                Enter Security PIN
              </Text>
              <Text style={[styles.unlockSub, { color: tokens.textMuted }]}>
                4–8 digit staff PIN required to unlock desk
              </Text>

              <Animated.View
                style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
              >
                {Array.from({ length: visibleDotSlots }).map((_, idx) => {
                  const filled = idx < pin.length;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.pinDot,
                        {
                          backgroundColor: filled ? tokens.accent : 'transparent',
                          borderColor: filled ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    />
                  );
                })}
              </Animated.View>
            </View>

            {error ? (
              <View style={styles.errorWrap}>
                <FlatNotice text={error} tone="danger" icon="alert-circle" />
              </View>
            ) : null}

            {/* Tactile 3x4 Numeric Keypad with Subtle 1px Structural Key Borders */}
            <View style={styles.keypadWrap}>
              {KEYPAD_ROWS.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.keypadRow}>
                  {row.map((key) => {
                    const isUtility = key === 'Clear' || key === '⌫';
                    return (
                      <Pressable
                        key={key}
                        disabled={busy || resetBusy}
                        onPress={() => handleKeyPress(key)}
                        style={({ pressed }) => [
                          styles.keypadKey,
                          {
                            backgroundColor: pressed
                              ? tokens.surfaceMuted
                              : tokens.surfaceSubtle,
                            borderColor: pressed ? tokens.accent : tokens.hairlineStrong,
                          },
                        ]}
                      >
                        {key === '⌫' ? (
                          <Feather name="delete" size={18} color={tokens.textSecondary} />
                        ) : (
                          <Text
                            style={[
                              isUtility ? styles.utilityKeyLabel : styles.digitKeyLabel,
                              { color: isUtility ? tokens.textSecondary : tokens.text },
                            ]}
                          >
                            {key}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Compact Unlock Button + Secondary Links */}
            <View style={styles.bottomActions}>
              <ShimmerButton
                label="Unlock Desk"
                size="md"
                loading={busy}
                disabled={pin.length < 4 || busy}
                onPress={handleUnlock}
                leftIcon={<Feather name="unlock" size={14} color={tokens.inkButtonText} />}
              />

              <View style={styles.footerLinksRow}>
                <TouchableOpacity
                  disabled={busy || resetBusy}
                  onPress={handleStartForgotPin}
                  hitSlop={8}
                >
                  <Text style={[styles.forgotLink, { color: tokens.accent }]}>
                    {resetBusy ? 'Sending OTP...' : 'Forgot PIN? Reset via Email OTP'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity disabled={busy} onPress={onLogout} hitSlop={8}>
                  <Text style={[styles.logoutLink, { color: tokens.danger }]}>
                    Sign out / Switch account
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
};

export default PinUnlockGateScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  unlockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 16,
  },
  identityCenter: {
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinHeaderCenter: {
    alignItems: 'center',
    gap: 5,
  },
  unlockTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  unlockSub: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    marginTop: 8,
    minHeight: 20,
  },
  pinDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.2,
  },
  errorWrap: {
    width: '100%',
    maxWidth: 310,
  },
  keypadWrap: {
    gap: 10,
    marginTop: 2,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  keypadKey: {
    width: 72,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitKeyLabel: {
    fontSize: 20,
    fontWeight: '600',
  },
  utilityKeyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomActions: {
    alignItems: 'center',
    gap: 13,
    marginTop: 4,
  },
  footerLinksRow: {
    alignItems: 'center',
    gap: 10,
  },
  forgotLink: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  logoutLink: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  resetScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 15,
  },
  resetTitleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  resetForm: {
    gap: 14,
  },
  resetActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  linkMuted: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
