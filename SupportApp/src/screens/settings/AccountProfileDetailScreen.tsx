import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  BorderlessIconButton,
  FlatBadge,
  FlatNotice,
  Hairline,
  MagicAvatar,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface AccountProfileDetailScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const CORE_PERMISSION_MATRIX: readonly {
  key: string;
  label: string;
  category: string;
}[] = [
  { key: 'support.view', label: 'View Tickets & Queue', category: 'Support' },
  { key: 'support.reply', label: 'Send Public & Internal Replies', category: 'Support' },
  { key: 'support.assign', label: 'Assign & Transfer Tickets', category: 'Support' },
  { key: 'support.manage_macros', label: 'Create & Edit Macros', category: 'Knowledge' },
  { key: 'support.export', label: 'Export Queue CSV', category: 'Data' },
  { key: 'live_chat.accept', label: 'Accept Live Visitor Chats', category: 'Live Chat' },
  { key: 'live_chat.cobrowse', label: 'Co-Browse Telemetry Guidance', category: 'Live Chat' },
  { key: 'support.manage_settings', label: 'Manage Support Switches', category: 'Admin' },
  { key: 'manage_staff_support', label: 'Manage Staff Directory', category: 'Admin' },
  { key: 'manage_system_settings', label: 'Manage Platform Settings', category: 'Admin' },
];

export const AccountProfileDetailScreen: React.FC<AccountProfileDetailScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onRefreshSession,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => backSub.remove();
  }, [onBack]);

  const avatarUri = resolveWebsiteUrl(user.avatar);
  const rolePreset = staffProfile.rolePresets?.[staffProfile.roleKey];
  const roleDisplay =
    rolePreset?.label ||
    rolePreset?.title ||
    staffProfile.roleKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const tierLabel = staffProfile.isSuperAdmin
    ? 'Tier 0 · Super Administrator'
    : staffProfile.roleKey.includes('lead') || staffProfile.roleKey.includes('admin')
      ? 'Tier 2 · Lead & Escalations'
      : 'Tier 1 · Frontline Support';

  const departmentLabel = staffProfile.isSuperAdmin
    ? 'Executive Operations & Engineering'
    : staffProfile.roleKey.includes('trust')
      ? 'Trust, Risk & Compliance'
      : staffProfile.roleKey.includes('finance')
        ? 'Billing & Merchant Finance'
        : 'Customer Support & Live Desk';

  const permissionMatrix = useMemo(() => {
    const grantedSet = new Set(staffProfile.permissions || user.permissions || []);
    const catalogMap = new Map(
      (staffProfile.permissionCatalog || []).map((item) => [item.key, item])
    );

    const combinedKeys = new Set<string>([
      ...CORE_PERMISSION_MATRIX.map((p) => p.key),
      ...(staffProfile.permissions || []),
    ]);

    return Array.from(combinedKeys).map((key) => {
      const core = CORE_PERMISSION_MATRIX.find((c) => c.key === key);
      const catItem = catalogMap.get(key);
      const isGranted =
        staffProfile.isSuperAdmin ||
        grantedSet.has('*') ||
        grantedSet.has(key) ||
        (key === 'support.view' && staffProfile.isActive) ||
        (key === 'support.reply' &&
          (grantedSet.has('reply_tickets') ||
            grantedSet.has('manage_support') ||
            staffProfile.isActive));

      return {
        key,
        label: catItem?.label || core?.label || key,
        category: catItem?.category || core?.category || 'Custom',
        granted: isGranted,
      };
    });
  }, [
    staffProfile.isActive,
    staffProfile.isSuperAdmin,
    staffProfile.permissionCatalog,
    staffProfile.permissions,
    user.permissions,
  ]);

  const grantedCount = permissionMatrix.filter((p) => p.granted).length;

  const canReplyTickets =
    staffProfile.isSuperAdmin ||
    (staffProfile.isActive && !(user.identityVerificationRequired && !user.identityVerified));

  const handleRefreshProfile = async () => {
    if (!onRefreshSession) return;
    setRefreshing(true);
    try {
      await onRefreshSession();
      toast.show({
        variant: 'success',
        label: 'Staff profile & permission grants refreshed.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to refresh session.',
      });
    } finally {
      setRefreshing(false);
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
            Staff Profile & Permissions
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            Identity credentials, RBAC matrix & reply eligibility diagnostics
          </Text>
        </View>
        {onRefreshSession ? (
          <ShimmerButton
            label="Sync"
            size="xs"
            variant="subtle"
            loading={refreshing}
            onPress={handleRefreshProfile}
            leftIcon={<Feather name="refresh-cw" size={11} color={tokens.text} />}
          />
        ) : null}
      </View>

      <Hairline />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Staff Identity Hero */}
        <View style={styles.identityHeader}>
          <MagicAvatar name={user.name || staffProfile.name} uri={avatarUri} size={58} online />
          <View style={styles.identityInfo}>
            <Text style={[styles.staffName, { color: tokens.text }]}>
              {user.name || staffProfile.name}
            </Text>
            <Text style={[styles.staffEmail, { color: tokens.textMuted }]}>{user.email}</Text>
            <View style={styles.badgesWrap}>
              <FlatBadge label={roleDisplay} tone="accent" withDot />
              {staffProfile.isSuperAdmin ? (
                <FlatBadge label="Super Admin" tone="success" />
              ) : null}
              <FlatBadge
                label={staffProfile.isActive ? 'Active Staff' : 'Inactive'}
                tone={staffProfile.isActive ? 'success' : 'danger'}
              />
            </View>
          </View>
        </View>

        <Hairline />

        {/* Structured Staff Metadata */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          STAFF IDENTITY & ASSIGNMENT TIER
        </Text>

        <View
          style={[
            styles.metaPanel,
            {
              backgroundColor: tokens.surfaceSubtle,
              borderColor: tokens.hairlineStrong,
            },
          ]}
        >
          {[
            { label: 'Staff User ID', value: user.id },
            { label: 'Tiwi ID', value: user.tiwiId || 'Internal Staff Account' },
            { label: 'Role Key', value: staffProfile.roleKey },
            { label: 'Escalation Tier', value: tierLabel },
            { label: 'Department', value: departmentLabel },
            { label: 'Phone', value: user.phone || 'Not linked' },
            {
              label: 'Identity Verification',
              value: user.identityVerified
                ? 'Verified'
                : user.identityVerificationRequired
                  ? 'Required'
                  : 'Exempt / Verified Staff',
            },
            {
              label: 'Security PIN Status',
              value: staffProfile.hasPin ? 'Configured & Armed' : 'Setup Pending',
            },
          ].map((row, index, arr) => (
            <View
              key={row.label}
              style={[
                styles.metaRow,
                index < arr.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: tokens.hairline,
                },
              ]}
            >
              <Text style={[styles.metaKey, { color: tokens.textMuted }]}>{row.label}</Text>
              <Text selectable style={[styles.metaVal, { color: tokens.text }]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Reply Eligibility Diagnostic Summary */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          REPLY ELIGIBILITY DIAGNOSTICS
        </Text>

        <View
          style={[
            styles.diagPanel,
            {
              backgroundColor: tokens.surfaceSubtle,
              borderColor: tokens.hairlineStrong,
            },
          ]}
        >
          <View style={styles.diagTopRow}>
            <Text style={[styles.diagHeading, { color: tokens.text }]}>
              Ticket & Live Chat Reply Readiness
            </Text>
            <FlatBadge
              label={canReplyTickets ? 'Eligible' : 'Restricted'}
              tone={canReplyTickets ? 'success' : 'danger'}
              withDot
            />
          </View>

          {[
            {
              title: 'Active Staff Account',
              ok: staffProfile.isActive || staffProfile.isSuperAdmin,
              detail:
                staffProfile.isActive || staffProfile.isSuperAdmin
                  ? 'Account is active and authorized for SupportApp.'
                  : 'Staff profile is marked inactive.',
            },
            {
              title: 'Identity & Session Check',
              ok: !(user.identityVerificationRequired && !user.identityVerified),
              detail:
                user.identityVerificationRequired && !user.identityVerified
                  ? 'Biometric/ID verification must finish before replying.'
                  : 'Authenticated session passed staff & identity checks.',
            },
            {
              title: 'Mandatory Accept-Before-Reply Gate',
              ok: true,
              detail:
                'Open tickets and waiting live chats require tapping "Accept" so no two agents collide on the same customer.',
            },
            {
              title: 'Sensitive Action Grant',
              ok: staffProfile.hasPin,
              detail: staffProfile.hasPin
                ? '4–8 digit Staff Security PIN ready for administrative actions.'
                : 'Using Email OTP fallback until Security PIN is set.',
            },
          ].map((check) => (
            <View key={check.title} style={styles.diagItem}>
              <Feather
                name={check.ok ? 'check-circle' : 'alert-circle'}
                size={14}
                color={check.ok ? tokens.success : tokens.warning}
                style={{ marginTop: 2 }}
              />
              <View style={styles.diagTextCol}>
                <Text style={[styles.diagItemTitle, { color: tokens.text }]}>{check.title}</Text>
                <Text style={[styles.diagItemDesc, { color: tokens.textMuted }]}>
                  {check.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Permission Chips Matrix */}
        <View style={styles.matrixHeaderRow}>
          <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
            PERMISSION CHIPS MATRIX
          </Text>
          <FlatBadge
            label={`${grantedCount}/${permissionMatrix.length} Granted`}
            tone="accent"
          />
        </View>

        {staffProfile.isSuperAdmin ? (
          <FlatNotice
            tone="success"
            icon="shield"
            text="Super Administrator wildcard active: Full read/write capability across all support queues, switches, and staff controls."
          />
        ) : null}

        <View style={styles.chipsMatrix}>
          {permissionMatrix.map((perm) => (
            <View
              key={perm.key}
              style={[
                styles.permChip,
                {
                  backgroundColor: perm.granted ? tokens.accentSoft : tokens.surfaceSubtle,
                  borderColor: perm.granted ? tokens.accent : tokens.hairlineStrong,
                },
              ]}
            >
              <Feather
                name={perm.granted ? 'check' : 'lock'}
                size={12}
                color={perm.granted ? tokens.accent : tokens.textMuted}
              />
              <View style={styles.permChipTextCol}>
                <Text
                  style={[
                    styles.permKeyText,
                    { color: perm.granted ? tokens.accent : tokens.textSecondary },
                  ]}
                >
                  {perm.key}
                </Text>
                <Text style={[styles.permLabelText, { color: tokens.textMuted }]}>
                  {perm.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default AccountProfileDetailScreen;

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
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 2,
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  staffEmail: {
    fontSize: 12.5,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 2,
  },
  metaPanel: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  metaKey: {
    fontSize: 12,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  diagPanel: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    gap: 10,
  },
  diagTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  diagHeading: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  diagItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  diagTextCol: {
    flex: 1,
    gap: 2,
  },
  diagItemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  diagItemDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipsMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  permChipTextCol: {
    gap: 1,
  },
  permKeyText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  permLabelText: {
    fontSize: 10.5,
  },
});
