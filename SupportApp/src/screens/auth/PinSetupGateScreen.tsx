import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { setupStaffSecurityPin } from '../../services/authService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StaffProfileMe } from '../../types/support';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { SupportLogo } from '../../components/common/SupportLogo';
import {
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface PinSetupGateScreenProps {
  staffProfile: StaffProfileMe;
  onCompleted: () => void;
  onLogout: () => void;
}

export const PinSetupGateScreen: React.FC<PinSetupGateScreenProps> = ({
  staffProfile,
  onCompleted,
  onLogout,
}) => {
  const { theme, tokens, toggleTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [secondConfirmation, setSecondConfirmation] = useState('');
  const [showDigits, setShowDigits] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    setError('');
    if (!/^\d{4,8}$/.test(pin.trim())) {
      setError('Security PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (pin.trim() !== confirmPin.trim()) {
      setError('PIN and confirmation do not match.');
      return;
    }
    setSecondConfirmation('');
    setStep(2);
  };

  const handleFinish = async () => {
    setError('');
    if (secondConfirmation.trim() !== pin.trim()) {
      setError('Final confirmation PIN does not match.');
      return;
    }
    setBusy(true);
    try {
      await setupStaffSecurityPin(pin, confirmPin, secondConfirmation);
      toast.show({
        variant: 'success',
        label: 'Staff Security PIN activated.',
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Security PIN.');
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (staffProfile.roleKey || 'staff').replace(/_/g, ' ').toUpperCase();

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={[styles.root, { backgroundColor: tokens.bg }]}>
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={64}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Brand & Step Status Row — Zero Background Animation */}
          <View style={styles.topRow}>
            <SupportLogo
              variant="land"
              width={110}
              height={30}
              style={{ alignSelf: 'flex-start' }}
            />
            <View style={styles.topBadges}>
              <FlatBadge label={`Step ${step} of 2`} tone="accent" withDot />
              <FlatBadge label={roleLabel} tone="neutral" />
              <BorderlessIconButton
                name={theme === 'dark' ? 'sun' : 'moon'}
                size={18}
                onPress={toggleTheme}
                accessibilityLabel="Toggle color theme"
              />
            </View>
          </View>

          {/* Crisp 2-Segment Step Bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressSegment, { backgroundColor: tokens.accent }]} />
            <View
              style={[
                styles.progressSegment,
                { backgroundColor: step === 2 ? tokens.accent : tokens.hairlineStrong },
              ]}
            />
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: tokens.text }]}>
              {step === 1 ? 'Create Staff Security PIN' : 'Confirm Security PIN'}
            </Text>
            <Text style={[styles.desc, { color: tokens.textMuted }]}>
              {step === 1
                ? 'Choose a 4–8 digit numeric PIN used to unlock the app on launch and authorize sensitive support actions.'
                : 'Re-enter your chosen PIN one final time to activate desk protection.'}
            </Text>
          </View>

          <Hairline />

          {error ? <FlatNotice text={error} tone="danger" icon="alert-circle" /> : null}

          {step === 1 ? (
            <View style={styles.formStack}>
              <FlatInput
                label="New Security PIN (4–8 digits)"
                value={pin}
                onChangeText={(txt) => setPin(txt.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry={!showDigits}
                maxLength={8}
                placeholder="Enter 4–8 digits"
                leftIcon={<Feather name="shield" size={15} color={tokens.textMuted} />}
                rightSlot={
                  <Pressable onPress={() => setShowDigits((v) => !v)} hitSlop={10}>
                    <Feather
                      name={showDigits ? 'eye-off' : 'eye'}
                      size={16}
                      color={tokens.textMuted}
                    />
                  </Pressable>
                }
              />
              <FlatInput
                label="Confirm Security PIN"
                value={confirmPin}
                onChangeText={(txt) => setConfirmPin(txt.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry={!showDigits}
                maxLength={8}
                placeholder="Re-enter PIN"
                onSubmitEditing={handleNext}
                leftIcon={<Feather name="lock" size={15} color={tokens.textMuted} />}
              />
              <View style={styles.actionRow}>
                <ShimmerButton
                  label="Continue"
                  size="md"
                  onPress={handleNext}
                  rightIcon={<Feather name="arrow-right" size={14} color={tokens.inkButtonText} />}
                />
                <TouchableOpacity onPress={onLogout} hitSlop={8}>
                  <Text style={[styles.signOutLink, { color: tokens.danger }]}>Sign out</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.formStack}>
              <FlatInput
                label="Final Confirmation PIN"
                value={secondConfirmation}
                onChangeText={(txt) => setSecondConfirmation(txt.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry={!showDigits}
                maxLength={8}
                placeholder="Re-enter PIN once more"
                onSubmitEditing={handleFinish}
                leftIcon={<Feather name="check-circle" size={15} color={tokens.textMuted} />}
                rightSlot={
                  <Pressable onPress={() => setShowDigits((v) => !v)} hitSlop={10}>
                    <Feather
                      name={showDigits ? 'eye-off' : 'eye'}
                      size={16}
                      color={tokens.textMuted}
                    />
                  </Pressable>
                }
              />
              <View style={styles.actionRow}>
                <ShimmerButton
                  label="Activate Security PIN"
                  size="md"
                  variant="accent"
                  loading={busy}
                  onPress={handleFinish}
                />
                <TouchableOpacity disabled={busy} onPress={() => setStep(1)} hitSlop={8}>
                  <Text style={[styles.linkMuted, { color: tokens.textMuted }]}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAwareScrollView>
      </View>
    </ScreenContainer>
  );
};

export default PinSetupGateScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  titleBlock: { gap: 5 },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
  },
  formStack: { gap: 14 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  signOutLink: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  linkMuted: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
