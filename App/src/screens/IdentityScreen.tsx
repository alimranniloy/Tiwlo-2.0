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
  Camera,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  IdCard,
  ScanFace,
  ShieldCheck,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import { CountryPickerField } from '../components/CountryPickerModal';
import type { TiwloUser } from '../services/tiwloAuth';
import { AccountProfilePayload, fetchAccountDetails } from '../services/tiwloAccount';
import { colors } from '../theme/tokens';

interface IdentityScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
}

const DOCUMENT_TYPES = [
  { id: 'nid', label: 'National ID' },
  { id: 'passport', label: 'Passport' },
  { id: 'license', label: 'Driver License' },
];

export const IdentityScreen: React.FC<IdentityScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<AccountProfilePayload | null>(null);
  const [docType, setDocType] = useState('nid');
  const [legalName, setLegalName] = useState(user?.name || '');
  const [country, setCountry] = useState('Bangladesh');
  const [docNumber, setDocNumber] = useState('');
  const [stepIndex, setStepIndex] = useState<1 | 2 | 3>(1);
  const [biometricQuickCheck, setBiometricQuickCheck] = useState(true);
  const [hideIdOnReceipts, setHideIdOnReceipts] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const loadIdentity = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const res = await fetchAccountDetails(sessionToken);
      const profile = res.user || res.account;
      if (profile) {
        setAccount(profile);
        if (profile.name && !legalName) setLegalName(profile.name);
      }
    } catch {
      // ignore offline
    } finally {
      setRefreshing(false);
    }
  }, [legalName, sessionToken, user]);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  const isVerified = account?.identityVerified === true;
  const tiwiId = account?.tiwiId || user?.tiwiId || 'Not signed in';

  const handleContinueStep = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (stepIndex === 1) {
      if (!legalName.trim() || !docNumber.trim()) {
        setBannerTone('error');
        setBanner('Enter your legal name and document number.');
        return;
      }
      setStepIndex(2);
      setBannerTone('info');
      setBanner('Document details saved. Ready for selfie verification.');
      return;
    }
    if (stepIndex === 2) {
      setStepIndex(3);
      setBannerTone('success');
      setBanner('Identity verification submitted.');
      return;
    }
    setBannerTone('success');
    setBanner('Identity verification is already submitted.');
  };

  return (
    <AccountPageShell
      title="Identity"
      onBack={onBack}
      onRefresh={() => void loadIdentity()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Status Row */}
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <ShieldCheck
            size={20}
            strokeWidth={1.9}
            color={isVerified ? colors.primaryHover : colors.muted}
          />
          <View style={styles.flexOne}>
            <Text style={styles.statusTitle}>
              {isVerified ? 'Verified' : user ? 'Not verified' : 'Guest account'}
            </Text>
            <View style={styles.inlineMeta}>
              <Fingerprint size={13} strokeWidth={1.9} color={colors.muted} />
              <Text style={styles.statusSub}>{tiwiId}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.badgePill, isVerified && styles.badgePillGreen]}>
          <Text style={[styles.badgeText, isVerified && styles.badgeTextGreen]}>
            {isVerified ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Steps */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Verification Steps</Text>

        <View style={styles.stepItem}>
          <IdCard size={18} strokeWidth={1.9} color={stepIndex >= 1 ? colors.primaryHover : colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>1. Document Details</Text>
            <Text style={styles.rowSub}>National ID, Passport, or Driver License</Text>
          </View>
          {stepIndex > 1 ? <CheckCircle2 size={17} strokeWidth={2} color={colors.primaryHover} /> : null}
        </View>

        <View style={styles.hairline} />

        <View style={styles.stepItem}>
          <Camera size={18} strokeWidth={1.9} color={stepIndex >= 2 ? colors.primaryHover : colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>2. Live Selfie</Text>
            <Text style={styles.rowSub}>Face match with submitted document photo</Text>
          </View>
          {stepIndex > 2 ? <CheckCircle2 size={17} strokeWidth={2} color={colors.primaryHover} /> : null}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Document Form */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Document Information</Text>

        <View style={styles.chipRow}>
          {DOCUMENT_TYPES.map((dt) => {
            const active = docType === dt.id;
            return (
              <TouchableOpacity
                key={dt.id}
                style={[styles.choicePill, active && styles.choicePillActive]}
                onPress={() => setDocType(dt.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                  {dt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Legal Full Name</Text>
          <TextInput
            style={styles.inputBox}
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Full name on document"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.twoColRow}>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Country</Text>
            <CountryPickerField
              value={country}
              onChange={(countryName) => setCountry(countryName)}
              placeholder="Select country"
              title="Select country"
            />
          </View>
          <View style={styles.halfCol}>
            <Text style={styles.fieldLabel}>Document Number</Text>
            <View style={styles.inputWithIcon}>
              <FileCheck2 size={15} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={docNumber}
                onChangeText={setDocNumber}
                placeholder="ID / Passport #"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleContinueStep} activeOpacity={0.85}>
          <ScanFace size={18} strokeWidth={2} color={colors.ink} />
          <Text style={styles.primaryBtnText}>
            {!user
              ? 'Sign in to Verify'
              : stepIndex === 1
              ? 'Continue Verification'
              : stepIndex === 2
              ? 'Submit Verification'
              : 'Verification Submitted'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Privacy Options</Text>

        <View style={styles.switchRow}>
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Biometric Payout Check</Text>
            <Text style={styles.rowSub}>Require device unlock before wallet withdrawals</Text>
          </View>
          <Switch
            value={biometricQuickCheck}
            onValueChange={setBiometricQuickCheck}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <View style={styles.flexOne}>
            <Text style={styles.rowTitle}>Mask Tiwi ID on Invoices</Text>
            <Text style={styles.rowSub}>Hide full Tiwi ID digits on exported receipts</Text>
          </View>
          <Switch
            value={hideIdOnReceipts}
            onValueChange={setHideIdOnReceipts}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusSub: {
    fontSize: 12.5,
    color: colors.muted,
  },
  badgePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgePillGreen: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  badgeTextGreen: {
    color: colors.primaryHover,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
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
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  choiceTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.foreground,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
    gap: 6,
  },
  inputWithIcon: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
});
