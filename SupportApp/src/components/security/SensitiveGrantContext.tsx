import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  requestEmailReauthOtp,
  requestPinForgotOtp,
  resetSecurityPinWithOtp,
  verifyEmailReauthOtp,
  verifyStaffSecurityPin,
} from '../../services/authService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StaffProfileMe } from '../../types/support';
import {
  CompactOtpInput,
  FlatInput,
  FlatNotice,
  MagicModalSheet,
  MagicSpinner,
  ShimmerButton,
  useMagicToast,
} from '../magicui';

interface SensitiveGrantContextValue {
  requestSensitiveGrant: (actionLabel?: string) => Promise<string>;
}

const SensitiveGrantContext = createContext<SensitiveGrantContextValue>({
  requestSensitiveGrant: async () => {
    throw new Error('SensitiveGrantProvider is not mounted.');
  },
});

export const useSensitiveGrant = () => useContext(SensitiveGrantContext);

interface PendingResolver {
  resolve: (grant: string) => void;
  reject: (err: Error) => void;
}

type ModalMode = 'pin' | 'forgot_pin_otp' | 'email_otp';

export const SensitiveGrantProvider: React.FC<{
  staffProfile: StaffProfileMe | null;
  children: React.ReactNode;
}> = ({ staffProfile, children }) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const resolverRef = useRef<PendingResolver | null>(null);

  const [visible, setVisible] = useState(false);
  const [actionTitle, setActionTitle] = useState('Verify Security Authorization');
  const [mode, setMode] = useState<ModalMode>('pin');
  const [pinInput, setPinInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cleanup = () => {
    setVisible(false);
    setPinInput('');
    setOtpInput('');
    setNewPin('');
    setConfirmPin('');
    setTempToken('');
    setError('');
    setBusy(false);
  };

  const handleCancel = () => {
    const pending = resolverRef.current;
    resolverRef.current = null;
    cleanup();
    pending?.reject(new Error('Verification cancelled.'));
  };

  const requestSensitiveGrant = useCallback(
    async (actionLabel = 'Confirm Sensitive Action'): Promise<string> => {
      if (resolverRef.current) {
        resolverRef.current.reject(new Error('Superseded by new confirmation request.'));
        resolverRef.current = null;
      }

      setActionTitle(actionLabel);
      setError('');
      setPinInput('');
      setOtpInput('');

      if (staffProfile?.hasPin) {
        setMode('pin');
        setVisible(true);
      } else {
        setMode('email_otp');
        setVisible(true);
        setBusy(true);
        try {
          const res = await requestEmailReauthOtp();
          setTempToken(res.tempToken);
          setEmailMasked(res.emailMasked || 'your verified email');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not dispatch confirmation OTP.');
        } finally {
          setBusy(false);
        }
      }

      return new Promise<string>((resolve, reject) => {
        resolverRef.current = { resolve, reject };
      });
    },
    [staffProfile?.hasPin]
  );

  const handlePinSubmit = async () => {
    if (!/^\d{4,8}$/.test(pinInput.trim())) {
      setError('Enter your 4 to 8 digit Staff Security PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await verifyStaffSecurityPin(pinInput.trim());
      const resolver = resolverRef.current;
      resolverRef.current = null;
      cleanup();
      resolver?.resolve(res.grant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Security PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleStartForgotPin = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await requestPinForgotOtp();
      setTempToken(res.tempToken);
      setEmailMasked(res.emailMasked || 'your email');
      setMode('forgot_pin_otp');
      toast.show({
        variant: 'accent',
        label: `Recovery code sent to ${res.emailMasked || 'your email'}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send PIN recovery code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPinSubmit = async () => {
    if (!/^\d{6}$/.test(otpInput.trim())) {
      setError('Enter the 6-digit OTP from your email.');
      return;
    }
    if (!/^\d{4,8}$/.test(newPin.trim()) || newPin.trim() !== confirmPin.trim()) {
      setError('Enter a matching 4 to 8 digit new Security PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resetSecurityPinWithOtp(tempToken, otpInput.trim(), newPin.trim(), confirmPin.trim());
      toast.show({
        variant: 'success',
        label: 'Security PIN updated. Enter your new PIN to continue.',
      });
      setPinInput('');
      setMode('pin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset Security PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailOtpSubmit = async () => {
    if (!tempToken || !/^\d{6}$/.test(otpInput.trim())) {
      setError('Enter the 6-digit email verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await verifyEmailReauthOtp(tempToken, otpInput.trim());
      const resolver = resolverRef.current;
      resolverRef.current = null;
      cleanup();
      resolver?.resolve(res.grant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification code could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === 'pin'
      ? 'Enter your 4–8 digit Staff Security PIN to authorize this action.'
      : mode === 'forgot_pin_otp'
        ? `Enter the 6-digit code sent to ${emailMasked || 'your email'} and set a new PIN.`
        : `Enter the 6-digit OTP sent to ${emailMasked || 'your email'}.`;

  return (
    <SensitiveGrantContext.Provider value={{ requestSensitiveGrant }}>
      {children}
      <MagicModalSheet
        visible={visible}
        onClose={handleCancel}
        title={actionTitle}
        subtitle={subtitle}
      >
        {error ? <FlatNotice text={error} tone="danger" icon="alert-circle" /> : null}

        {mode === 'pin' ? (
          <View style={styles.section}>
            <FlatInput
              label="Staff Security PIN"
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="••••"
              onSubmitEditing={handlePinSubmit}
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                disabled={busy}
                onPress={handleStartForgotPin}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text style={[styles.linkText, { color: tokens.accent }]}>Forgot PIN?</Text>
              </TouchableOpacity>

              <View style={styles.rightBtns}>
                <TouchableOpacity
                  onPress={handleCancel}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <ShimmerButton
                  label="Authorize"
                  size="sm"
                  loading={busy}
                  onPress={handlePinSubmit}
                />
              </View>
            </View>
          </View>
        ) : mode === 'forgot_pin_otp' ? (
          <View style={styles.section}>
            <CompactOtpInput label="6-Digit Email OTP" value={otpInput} onChange={setOtpInput} />
            <FlatInput
              label="New Security PIN"
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="4–8 digits"
            />
            <FlatInput
              label="Confirm Security PIN"
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Re-enter PIN"
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => setMode('pin')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text style={[styles.linkText, { color: tokens.textMuted }]}>Back to PIN</Text>
              </TouchableOpacity>
              <ShimmerButton
                label="Save & Continue"
                size="sm"
                loading={busy}
                onPress={handleResetPinSubmit}
              />
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            {busy && !tempToken ? (
              <MagicSpinner label="Sending security OTP..." />
            ) : (
              <>
                <CompactOtpInput label="6-Digit Confirmation OTP" value={otpInput} onChange={setOtpInput} />
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={handleCancel}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <ShimmerButton
                    label="Confirm"
                    size="sm"
                    loading={busy}
                    onPress={handleEmailOtpSubmit}
                  />
                </View>
              </>
            )}
          </View>
        )}
      </MagicModalSheet>
    </SensitiveGrantContext.Provider>
  );
};

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
