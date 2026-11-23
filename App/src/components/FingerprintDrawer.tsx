import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import { enrollHardwareBiometric } from '../services/tiwloIntegrity';
import { colors } from '../theme/tokens';

export interface FingerprintDrawerProps {
  visible: boolean;
  isUpdate?: boolean;
  userEmailOrId?: string;
  sessionToken?: string;
  onEnrolled: (deviceName: string) => void;
  onDismiss: () => void;
}

type EnrollStep = 0 | 1 | 2 | 3 | 4;

const STEP_META: Record<
  EnrollStep,
  { label: string; helper: string; activeRidges: number }
> = {
  0: {
    label: 'Ready to Scan',
    helper: 'Bind this device’s hardware keystore for fast, passwordless sign-in.',
    activeRidges: 0,
  },
  1: {
    label: '1. Ready Sensor',
    helper: 'Place your finger gently on the biometric sensor to begin.',
    activeRidges: 4,
  },
  2: {
    label: '2. Fine Ridge Verification',
    helper: 'Capturing fine ridge detail and verifying liveness.',
    activeRidges: 8,
  },
  3: {
    label: '3. Hardware Key Binding',
    helper: 'Signing and registering your hardware public key with Tiwlo.',
    activeRidges: 11,
  },
  4: {
    label: 'Enrolled!',
    helper: 'Fingerprint passkey is bound to this device.',
    activeRidges: 12,
  },
};

// Concentric Touch-ID style ridge paths rendered directly on clean white background.
const FINGERPRINT_RIDGES: readonly string[] = [
  // Core inner loop (1-3)
  'M 55 68 C 55 57, 65 57, 65 66 C 65 73, 62 78, 58 83',
  'M 50 72 C 48 53, 72 52, 71 67 C 71 76, 66 84, 61 90',
  'M 45 77 C 41 47, 79 46, 77 68 C 77 79, 71 89, 64 95',
  // Mid ridges (4-7)
  'M 40 81 C 34 41, 86 40, 83 69 C 83 80, 77 91, 69 98',
  'M 35 84 C 28 35, 92 34, 89 69 C 89 81, 83 92, 75 100',
  'M 31 66 C 32 30, 88 29, 93 62',
  'M 94 70 C 94 83, 88 94, 80 102',
  // Outer ridges (8-12)
  'M 26 75 C 25 26, 95 23, 98 63',
  'M 98 71 C 98 85, 92 96, 84 104',
  'M 22 61 C 25 18, 95 16, 101 56',
  'M 32 91 C 39 97, 46 101, 54 103',
  'M 27 42 C 40 14, 84 13, 97 40',
];

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const FingerprintDrawer: React.FC<FingerprintDrawerProps> = ({
  visible,
  isUpdate = false,
  userEmailOrId,
  sessionToken,
  onEnrolled,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<EnrollStep>(0);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [enrolledDevice, setEnrolledDevice] = useState('');
  const [enrolledNow, setEnrolledNow] = useState(false);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      runIdRef.current += 1;
      setStep(0);
      setBusy(false);
      setErrorText('');
      setEnrolledNow(false);
      setEnrolledDevice('');
      pulseScale.setValue(1);
    }
  }, [visible, pulseScale]);

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseScale, {
        toValue: 1.05,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(pulseScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startEnrollment = async () => {
    if (busy) return;
    const runId = ++runIdRef.current;
    const isCancelled = () => runIdRef.current !== runId;

    setErrorText('');
    setBusy(true);
    setEnrolledNow(false);

    try {
      setStep(1);
      triggerPulse();
      await waitMs(320);
      if (isCancelled()) return;

      setStep(2);
      triggerPulse();
      await waitMs(420);
      if (isCancelled()) return;

      setStep(3);
      triggerPulse();

      const enrollChallenge = `enroll:${userEmailOrId || 'tiwlo'}:${Date.now()}`;
      const nativeResult = await enrollHardwareBiometric(
        enrollChallenge,
        isUpdate ? 'Update Tiwlo Fingerprint' : 'Add Tiwlo Fingerprint',
        'Scan your finger to bind your hardware keystore'
      );
      if (isCancelled()) return;

      const publicKeySpki =
        typeof nativeResult?.publicKeySpki === 'string'
          ? nativeResult.publicKeySpki.trim()
          : '';
      if (!publicKeySpki) {
        throw new Error('Hardware biometric enrollment did not return a public key.');
      }

      const deviceName =
        (typeof nativeResult?.deviceName === 'string' && nativeResult.deviceName.trim()) ||
        (Platform.OS === 'ios' ? 'iPhone Secure Enclave' : 'Android Biometric Key');
      const signatureBase64 =
        typeof nativeResult?.signatureBase64 === 'string'
          ? nativeResult.signatureBase64
          : '';

      const ridgeSvgMap = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${FINGERPRINT_RIDGES.map(
        (d, idx) =>
          `<path d="${d}" fill="none" stroke="${idx < 8 ? '#18B953' : '#1ED760'}" stroke-width="2.6" stroke-linecap="round" />`
      ).join('')}</svg>`;

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${TIWLO_API_BASE}/user/account/biometric/register`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          publicKeySpki,
          deviceName,
          signatureBase64,
          challenge: enrollChallenge,
          ridgeSvgMap,
          deviceModel: deviceName,
          osVersion: `Android ${Platform.Version}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error || payload.message || `Biometric registration failed (${response.status})`
        );
      }
      if (isCancelled()) return;

      setStep(4);
      triggerPulse();
      setEnrolledDevice(deviceName);
      setEnrolledNow(true);
      onEnrolled(deviceName);
    } catch (err) {
      if (isCancelled()) return;
      setStep(0);
      setErrorText(
        err instanceof Error ? err.message : 'Fingerprint enrollment could not be completed.'
      );
    } finally {
      if (!isCancelled()) {
        setBusy(false);
      }
    }
  };

  const meta = STEP_META[step];
  const showUpdateLabel = isUpdate || enrolledNow;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={() => {
            if (!busy) onDismiss();
          }}
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 10 },
          ]}
        >
          <View style={styles.grabber} />

          <Text style={styles.title}>
            {enrolledNow
              ? 'Fingerprint Enrolled'
              : showUpdateLabel
              ? 'Update Fingerprint'
              : 'Fingerprint Sign-In'}
          </Text>

          {showUpdateLabel ? (
            <Text style={styles.updateCaption}>
              {enrolledNow && enrolledDevice
                ? `Update Fingerprint · Active on ${enrolledDevice}`
                : 'Update Fingerprint'}
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Touch ID style hardware passkey for instant Tiwlo sign-in
            </Text>
          )}

          {/* Custom Touch-ID Multi-Ridge SVG directly on pure #FFFFFF */}
          <Animated.View
            style={[
              styles.svgStage,
              { transform: [{ scale: pulseScale }] },
            ]}
          >
            <Svg width={128} height={128} viewBox="0 0 120 120">
              {FINGERPRINT_RIDGES.map((d, idx) => {
                const isLit = idx < meta.activeRidges;
                const strokeColor = !isLit
                  ? '#D4D4D8'
                  : step === 4 || idx >= 6
                  ? colors.primaryHover
                  : colors.primary;
                return (
                  <Path
                    key={idx}
                    d={d}
                    stroke={strokeColor}
                    strokeWidth={3.1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              })}
            </Svg>
          </Animated.View>

          {/* Progressive 4-Step Track */}
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((idx) => {
              const filled = step >= idx;
              return (
                <View
                  key={idx}
                  style={[
                    styles.progressSegment,
                    filled && styles.progressSegmentActive,
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.stepTextBlock}>
            <View style={styles.stepHeadlineRow}>
              {step === 4 ? (
                <CheckCircle2 size={16} strokeWidth={2.2} color={colors.primaryHover} />
              ) : null}
              <Text
                style={[
                  styles.stepLabel,
                  step === 4 && styles.stepLabelSuccess,
                ]}
              >
                {meta.label}
              </Text>
            </View>
            <Text style={styles.stepHelper}>{meta.helper}</Text>
          </View>

          {errorText ? (
            <View style={styles.errorBox}>
              <ShieldAlert size={16} strokeWidth={2} color={colors.danger} />
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}

          <View style={styles.controls}>
            {enrolledNow ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={onDismiss}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => void startEnrollment()}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Update Fingerprint</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.primaryBtnBusy]}
                  onPress={() => void startEnrollment()}
                  disabled={busy}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy
                      ? meta.label
                      : showUpdateLabel
                      ? 'Update Fingerprint'
                      : 'Scan & Enable Fingerprint'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={onDismiss}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.36)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  updateCaption: {
    marginTop: 6,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.primaryHover,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  svgStage: {
    marginTop: 22,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 6,
    marginBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepTextBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginBottom: 18,
  },
  stepHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  stepLabelSuccess: {
    color: colors.primaryHover,
  },
  stepHelper: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.danger,
    lineHeight: 17,
  },
  controls: {
    width: '100%',
    gap: 8,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnBusy: {
    opacity: 0.72,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
  },
  secondaryBtn: {
    width: '100%',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.muted,
  },
});
