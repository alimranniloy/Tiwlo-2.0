import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  disableTotpAuthenticator,
  fetchTwoFactorStatus,
  regenerateRecoveryCodes,
  setupTotpAuthenticator,
  TwoFactorStatus,
  updateTwoFactorMethod,
  verifyTotpAuthenticator,
} from '../services/tiwloAccount';
import { colors } from '../theme/tokens';

interface TwoFactorAuthScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
}

export const TwoFactorAuthScreen: React.FC<TwoFactorAuthScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<TwoFactorStatus>({
    activeMethod: user?.totpEnabled ? 'totp' : user?.twoFactorEnabled ? 'email' : 'off',
    totpEnabled: Boolean(user?.totpEnabled),
    emailTwoFactorEnabled: Boolean(user?.twoFactorEnabled),
  });
  const [totpSecret, setTotpSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableInput, setDisableInput] = useState('');

  const [requireOnBilling, setRequireOnBilling] = useState(true);
  const [requireOnDropletDelete, setRequireOnDropletDelete] = useState(true);
  const [passkeyReady, setPasskeyReady] = useState(true);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const load2FA = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const data = await fetchTwoFactorStatus(sessionToken);
      setStatus(data);
    } catch {
      // ignore offline
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void load2FA();
  }, [load2FA]);

  const handleSelectMethod = async (method: 'totp' | 'email' | 'off') => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const updated = await updateTwoFactorMethod(method, sessionToken);
      setStatus(updated);
      setBannerTone('success');
      setBanner(`2FA method switched to ${method.toUpperCase()}.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not change 2FA method.');
    }
  };

  const handleStartTotp = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await setupTotpAuthenticator(sessionToken);
      setTotpSecret(res.manualKey || res.secret || '');
      setBannerTone('info');
      setBanner('Enter this key into your authenticator app and verify below.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Failed to start authenticator setup.');
    }
  };

  const handleVerifyTotp = async () => {
    if (otpCode.trim().length < 6) {
      setBannerTone('error');
      setBanner('Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      const res = await verifyTotpAuthenticator(otpCode.trim(), sessionToken);
      if (res.recoveryCodes) setRecoveryCodes(res.recoveryCodes);
      setOtpCode('');
      setTotpSecret('');
      await load2FA();
      setBannerTone('success');
      setBanner('Authenticator 2FA verified.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Invalid verification code.');
    }
  };

  const handleRegenerateCodes = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await regenerateRecoveryCodes(sessionToken);
      setRecoveryCodes(res.recoveryCodes || []);
      setBannerTone('success');
      setBanner('Recovery codes regenerated.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not regenerate backup codes.');
    }
  };

  const handleDisableTotp = async () => {
    if (!disableInput.trim()) {
      setBannerTone('error');
      setBanner('Enter password or 6-digit code to disable.');
      return;
    }
    try {
      await disableTotpAuthenticator(disableInput.trim(), sessionToken);
      setDisableInput('');
      await load2FA();
      setBannerTone('info');
      setBanner('Authenticator 2FA disabled.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not disable 2FA.');
    }
  };

  return (
    <AccountPageShell
      title="Two-Factor Auth"
      onBack={onBack}
      onRefresh={() => void load2FA()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Method Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Verification Method</Text>

        {[
          {
            key: 'totp' as const,
            title: 'Authenticator App (TOTP)',
            desc: '6-digit offline authenticator code',
            icon: <Smartphone size={18} strokeWidth={1.9} color={colors.foreground} />,
          },
          {
            key: 'email' as const,
            title: 'Email Security Code',
            desc: 'Verification code sent to account email',
            icon: <Mail size={18} strokeWidth={1.9} color={colors.foreground} />,
          },
          {
            key: 'off' as const,
            title: 'Password Only',
            desc: 'Two-factor authentication turned off',
            icon: <Lock size={18} strokeWidth={1.9} color={colors.muted} />,
          },
        ].map((opt, idx) => {
          const active = status.activeMethod === opt.key;
          return (
            <React.Fragment key={opt.key}>
              {idx > 0 ? <View style={styles.hairline} /> : null}
              <TouchableOpacity
                style={styles.methodRow}
                onPress={() => void handleSelectMethod(opt.key)}
                activeOpacity={0.8}
              >
                {opt.icon}
                <View style={styles.flexOne}>
                  <Text style={styles.rowTitle}>{opt.title}</Text>
                  <Text style={styles.rowSub}>{opt.desc}</Text>
                </View>
                {active ? (
                  <CheckCircle2 size={18} strokeWidth={2} color={colors.primaryHover} />
                ) : null}
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* TOTP Authenticator Setup */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Authenticator Configuration</Text>

        {!totpSecret ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void handleStartTotp()}
            activeOpacity={0.85}
          >
            <KeyRound size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>
              {status.totpEnabled ? 'Reconfigure Authenticator Key' : 'Setup Authenticator App'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.setupBox}>
            <Text style={styles.secretLabel}>Setup Secret Key</Text>
            <Text selectable style={styles.secretCode}>
              {totpSecret}
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleVerifyTotp()}>
              <ShieldCheck size={17} strokeWidth={2} color={colors.ink} />
              <Text style={styles.primaryBtnText}>Verify & Activate</Text>
            </TouchableOpacity>
          </View>
        )}

        {status.totpEnabled ? (
          <View style={styles.disableRow}>
            <TextInput
              style={styles.disableInput}
              value={disableInput}
              onChangeText={setDisableInput}
              placeholder="Password or 6-digit code to disable"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity style={styles.dangerBtn} onPress={() => void handleDisableTotp()}>
              <Text style={styles.dangerBtnText}>Disable</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      {/* Recovery Backup Codes */}
      <View style={styles.section}>
        <View style={styles.headerLine}>
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Recovery Backup Codes</Text>
            <Text style={styles.rowSub}>
              {typeof status.recoveryCodesRemaining === 'number'
                ? `${status.recoveryCodesRemaining} unused codes remaining`
                : 'Single-use emergency recovery codes'}
            </Text>
          </View>
          <TouchableOpacity style={styles.softPillBtn} onPress={() => void handleRegenerateCodes()}>
            <RefreshCw size={14} strokeWidth={2} color={colors.primaryHover} />
            <Text style={styles.softPillText}>Regenerate</Text>
          </TouchableOpacity>
        </View>

        {recoveryCodes.length > 0 ? (
          <View style={styles.codeGrid}>
            {recoveryCodes.map((code) => (
              <View key={code} style={styles.codeChip}>
                <Text selectable style={styles.codeText}>
                  {code}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      {/* Step-Up Rules */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Verification Policies</Text>

        <View style={styles.switchRow}>
          <Shield size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Require 2FA on Cloud Billing</Text>
            <Text style={styles.rowSub}>Confirm credits, vouchers, and plan upgrades</Text>
          </View>
          <Switch
            value={requireOnBilling}
            onValueChange={setRequireOnBilling}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <ShieldCheck size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Require 2FA to Delete Resources</Text>
            <Text style={styles.rowSub}>Extra check before deleting droplets or stores</Text>
          </View>
          <Switch
            value={requireOnDropletDelete}
            onValueChange={setRequireOnDropletDelete}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <KeyRound size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Device Passkey Prompt</Text>
            <Text style={styles.rowSub}>Allow fingerprint or hardware passkey check</Text>
          </View>
          <Switch
            value={passkeyReady}
            onValueChange={setPasskeyReady}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  setupBox: {
    gap: 10,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
  },
  secretLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  secretCode: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.foreground,
  },
  otpInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    letterSpacing: 4,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
  disableRow: {
    flexDirection: 'row',
    gap: 8,
  },
  disableInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.foreground,
  },
  dangerBtn: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  softPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  softPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  codeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  codeChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
});
