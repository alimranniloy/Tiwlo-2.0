import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSensitiveGrant } from '../../components/security/SensitiveGrantContext';
import { ApiRequestError } from '../../services/apiClient';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type {
  DedicatedScreenKey,
  StaffAccessRequestRecord,
} from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatShortDateTime, getStatusTone } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicAvatar,
  MagicModalSheet,
  MagicSpinner,
  MagicSwitch,
  NumberTicker,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface OpsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onOpenChat: (chatId: string) => void;
  onNavigateSubScreen: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  routeParams?: Record<string, string | undefined>;
  onPulseSync?: () => void;
}

type ConsoleTab = 'requests' | 'roster';
type RequestStatusFilter = 'pending' | 'approved' | 'rejected';

const FALLBACK_ROLES = ['support_agent', 'support_lead', 'admin', 'super_admin'];

export const StaffAccessApprovalsScreen: React.FC<OpsScreenProps> = ({
  staffProfile,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const { requestSensitiveGrant } = useSensitiveGrant();

  const canManageStaff =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).includes('manage_staff_roles');

  const [activeTab, setActiveTab] = useState<ConsoleTab>('requests');

  // Access Requests State
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<StaffAccessRequestRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('pending');

  // Review Decision Modal
  const [decisionTarget, setDecisionTarget] = useState<{
    record: StaffAccessRequestRecord;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  // Active Staff Accounts State
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<Record<string, unknown>[]>([]);
  const [rolePresets, setRolePresets] = useState<
    Record<string, { label?: string; permissions?: string[] }>
  >({});

  // Create / Edit Staff Account Modal
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [editUserId, setEditUserId] = useState<string | undefined>(undefined);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRoleKey, setStaffRoleKey] = useState('support_agent');
  const [staffAllowedIps, setStaffAllowedIps] = useState('');
  const [staffActive, setStaffActive] = useState(true);
  const [savingStaff, setSavingStaff] = useState(false);

  const loadAccessRequests = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingRequests(true);
      try {
        const res = await opsHubService.listStaffAccessRequests('all');
        setRequests(res.requests || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label:
              err instanceof Error
                ? err.message
                : 'Unable to load staff access requests.',
          });
        }
      } finally {
        setLoadingRequests(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  const loadRoster = useCallback(
    async (silent = false) => {
      if (!canManageStaff) {
        setRosterNotice(
          'Active staff credential management requires manage_staff_roles or Super Admin permission. You can still review onboarding access requests in the Access Requests tab.'
        );
        setStaffList([]);
        setRefreshing(false);
        return;
      }

      if (!silent) setLoadingRoster(true);
      try {
        const res = await supportService.listStaffDirectory();
        setStaffList(res.staff || []);
        setRolePresets(
          (res.rolePresets as Record<
            string,
            { label?: string; permissions?: string[] }
          >) || {}
        );
        setRosterNotice(null);
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 403 || err.status === 401)) {
          setRosterNotice(
            'Your account does not hold manage_staff_roles permission to list or modify staff credentials.'
          );
          setStaffList([]);
        } else if (!silent) {
          toast.show({
            variant: 'danger',
            label:
              err instanceof Error ? err.message : 'Unable to load staff roster.',
          });
        }
      } finally {
        setLoadingRoster(false);
        setRefreshing(false);
      }
    },
    [canManageStaff, toast]
  );

  useEffect(() => {
    loadAccessRequests(false);
  }, [loadAccessRequests]);

  useEffect(() => {
    if (activeTab === 'roster') {
      loadRoster(false);
    }
  }, [activeTab, loadRoster]);

  const filteredRequests = useMemo(
    () => requests.filter((r) => r.status === statusFilter),
    [requests, statusFilter]
  );

  const handleConfirmDecision = async () => {
    if (!decisionTarget) return;
    setDeciding(true);
    try {
      const res = await opsHubService.decideStaffAccessRequest(
        decisionTarget.record.id,
        {
          decision: decisionTarget.decision,
          reviewNote: reviewNote.trim() || undefined,
        }
      );
      if (res.request) {
        setRequests((prev) =>
          prev.map((r) => (r.id === decisionTarget.record.id ? res.request : r))
        );
      } else {
        loadAccessRequests(true);
      }
      toast.show({
        variant: 'success',
        label: `Request ${decisionTarget.record.requestCode} marked ${decisionTarget.decision}.`,
      });
      setDecisionTarget(null);
      setReviewNote('');
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update request.',
      });
    } finally {
      setDeciding(false);
    }
  };

  const openStaffEditor = (
    member?: Record<string, unknown>,
    prefillApplicant?: StaffAccessRequestRecord
  ) => {
    if (member) {
      setEditUserId(String(member.userId || member.id || ''));
      setStaffName(String(member.name || ''));
      setStaffEmail(String(member.email || ''));
      setStaffPassword('');
      setStaffRoleKey(String(member.roleKey || 'support_agent'));
      setStaffAllowedIps(
        Array.isArray(member.allowedIps) ? member.allowedIps.join(', ') : ''
      );
      setStaffActive(member.isActive !== false);
    } else if (prefillApplicant) {
      setEditUserId(undefined);
      setStaffName(prefillApplicant.fullName);
      setStaffEmail(prefillApplicant.email);
      setStaffPassword('');
      setStaffRoleKey(prefillApplicant.desiredRole || 'support_agent');
      setStaffAllowedIps('');
      setStaffActive(true);
    } else {
      setEditUserId(undefined);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setStaffRoleKey('support_agent');
      setStaffAllowedIps('');
      setStaffActive(true);
    }
    setStaffModalVisible(true);
  };

  const handleSaveStaffAccount = async () => {
    if (
      !staffName.trim() ||
      (!editUserId && (!staffEmail.trim() || !staffPassword.trim()))
    ) {
      toast.show({
        variant: 'danger',
        label: 'Provide name, email, and initial password for new staff accounts.',
      });
      return;
    }

    try {
      const grant = await requestSensitiveGrant(
        editUserId
          ? `Update Staff Account (${staffName.trim()})`
          : `Create Staff Account (${staffEmail.trim()})`
      );
      setSavingStaff(true);

      const allowedIps = staffAllowedIps
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);
      const presetPermissions =
        rolePresets[staffRoleKey]?.permissions ||
        staffProfile.rolePresets?.[staffRoleKey]?.permissions;

      await supportService.saveStaffMember(
        {
          targetUserId: editUserId,
          name: staffName.trim(),
          email: staffEmail.trim() || undefined,
          password: staffPassword.trim() || undefined,
          roleKey: staffRoleKey,
          permissions: presetPermissions,
          allowedIps,
          isActive: staffActive,
        },
        grant
      );

      setStaffModalVisible(false);
      toast.show({
        variant: 'success',
        label: editUserId ? 'Staff role updated.' : 'Staff account created.',
      });
      setActiveTab('roster');
      loadRoster(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not save staff account.',
      });
    } finally {
      setSavingStaff(false);
    }
  };

  const availableRoleKeys = useMemo(() => {
    const keys = Object.keys(rolePresets);
    if (keys.length > 0) return keys;
    const profileKeys = Object.keys(staffProfile.rolePresets || {});
    if (profileKeys.length > 0) return profileKeys;
    return FALLBACK_ROLES;
  }, [rolePresets, staffProfile.rolePresets]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Borderless Top Header */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton
          name="arrow-left"
          size={20}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.text }]}>
            Staff Access & Roster
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Onboarding approvals & active specialist accounts
          </Text>
        </View>
        {activeTab === 'roster' && canManageStaff ? (
          <ShimmerButton
            label="+ Add Staff"
            size="xs"
            variant="accent"
            onPress={() => openStaffEditor()}
          />
        ) : null}
      </View>

      {/* Dual-Tab Strip */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('requests')}
          style={[
            styles.tabBtn,
            activeTab === 'requests' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: activeTab === 'requests' ? tokens.text : tokens.textMuted,
            }}
          >
            {`Access Requests (${requests.filter((r) => r.status === 'pending').length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('roster')}
          style={[
            styles.tabBtn,
            activeTab === 'roster' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: activeTab === 'roster' ? tokens.text : tokens.textMuted,
            }}
          >
            Active Staff Accounts
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'requests' ? (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadAccessRequests(true);
              }}
            />
          }
        >
          {/* KPI Strip */}
          <BlurFade delay={0} offset={5}>
            <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>PENDING</Text>
                <NumberTicker
                  value={requests.filter((r) => r.status === 'pending').length}
                  style={[styles.kpiVal, { color: tokens.warning }]}
                />
              </View>
              <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>APPROVED</Text>
                <NumberTicker
                  value={requests.filter((r) => r.status === 'approved').length}
                  style={[styles.kpiVal, { color: tokens.success }]}
                />
              </View>
              <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>REJECTED</Text>
                <NumberTicker
                  value={requests.filter((r) => r.status === 'rejected').length}
                  style={[styles.kpiVal, { color: tokens.danger }]}
                />
              </View>
            </View>
          </BlurFade>

          {/* Status Filter Chips */}
          <View style={styles.chipRow}>
            {(['pending', 'approved', 'rejected'] as const).map((st) => {
              const active = statusFilter === st;
              return (
                <TouchableOpacity
                  key={st}
                  activeOpacity={0.7}
                  onPress={() => setStatusFilter(st)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: active ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {`${st.charAt(0).toUpperCase() + st.slice(1)} (${requests.filter((r) => r.status === st).length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Hairline />

          {loadingRequests && requests.length === 0 ? (
            <MagicSpinner label="Loading onboarding requests..." />
          ) : filteredRequests.length === 0 ? (
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              {`No ${statusFilter} staff access requests.`}
            </Text>
          ) : (
            filteredRequests.map((req, idx) => (
              <AnimatedListItem key={req.id} index={idx}>
                <View style={[styles.reqRow, { borderBottomColor: tokens.hairlineStrong }]}>
                  <View style={styles.reqTop}>
                    <MagicAvatar name={req.fullName} size={36} />
                    <View style={styles.flex1}>
                      <View style={styles.nameLine}>
                        <Text
                          numberOfLines={1}
                          style={[styles.personName, { color: tokens.text }]}
                        >
                          {req.fullName}
                        </Text>
                        <FlatBadge label={req.requestCode} tone="neutral" />
                      </View>
                      <Text style={[styles.contactLine, { color: tokens.textMuted }]}>
                        {`${req.email}${req.phone ? ` · ${req.phone}` : ''}`}
                      </Text>
                    </View>

                    <FlatBadge
                      label={req.status.toUpperCase()}
                      tone={getStatusTone(req.status)}
                      withDot
                    />
                  </View>

                  <View style={styles.tagsWrap}>
                    <FlatBadge
                      label={`Role: ${req.desiredRole.replace(/_/g, ' ')}`}
                      tone="accent"
                    />
                    <FlatBadge label={`Dept: ${req.department}`} tone="neutral" />
                    {req.inviteCode ? (
                      <FlatBadge label={`Invite: ${req.inviteCode}`} tone="success" />
                    ) : null}
                  </View>

                  <Text style={[styles.reasonBody, { color: tokens.textSecondary }]}>
                    {req.reason || 'Requested access to Tiwlo Support Desk.'}
                  </Text>

                  {req.reviewNote ? (
                    <Text style={[styles.reviewNoteText, { color: tokens.textMuted }]}>
                      {`Review note (${req.reviewedByName || 'Admin'}): ${req.reviewNote}`}
                    </Text>
                  ) : null}

                  <View style={styles.reqFoot}>
                    <Text style={[styles.dateText, { color: tokens.textMuted }]}>
                      {formatShortDateTime(req.createdAt)}
                    </Text>

                    <View style={styles.decisionBtns}>
                      {req.status === 'pending' ? (
                        <>
                          <ShimmerButton
                            label="Approve"
                            size="xs"
                            variant="accent"
                            onPress={() => {
                              setReviewNote('');
                              setDecisionTarget({ record: req, decision: 'approved' });
                            }}
                          />
                          <ShimmerButton
                            label="Reject"
                            size="xs"
                            variant="danger"
                            onPress={() => {
                              setReviewNote('');
                              setDecisionTarget({ record: req, decision: 'rejected' });
                            }}
                          />
                        </>
                      ) : req.status === 'approved' && canManageStaff ? (
                        <ShimmerButton
                          label="Provision Account →"
                          size="xs"
                          variant="subtle"
                          onPress={() => openStaffEditor(undefined, req)}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              </AnimatedListItem>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadRoster(true);
              }}
            />
          }
        >
          {rosterNotice ? (
            <FlatNotice text={rosterNotice} tone="accent" icon="shield" />
          ) : null}

          {loadingRoster && staffList.length === 0 ? (
            <MagicSpinner label="Loading active staff directory..." />
          ) : canManageStaff && staffList.length === 0 && !rosterNotice ? (
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              No staff accounts returned from directory.
            </Text>
          ) : (
            staffList.map((member, idx) => {
              const nameStr = String(member.name || 'Staff Specialist');
              const emailStr = String(member.email || '');
              const roleStr = String(member.roleKey || 'support_agent').replace(
                /_/g,
                ' '
              );
              const isActive = member.isActive !== false;
              const ips = Array.isArray(member.allowedIps) ? member.allowedIps : [];

              return (
                <AnimatedListItem key={String(member.userId || member.id || idx)} index={idx}>
                  <View style={[styles.reqRow, { borderBottomColor: tokens.hairline }]}>
                    <View style={styles.reqTop}>
                      <MagicAvatar name={nameStr} size={36} online={isActive} />
                      <View style={styles.flex1}>
                        <Text
                          numberOfLines={1}
                          style={[styles.personName, { color: tokens.text }]}
                        >
                          {nameStr}
                        </Text>
                        <Text style={[styles.contactLine, { color: tokens.textMuted }]}>
                          {emailStr}
                        </Text>
                      </View>
                      <FlatBadge
                        label={isActive ? 'Active' : 'Disabled'}
                        tone={isActive ? 'success' : 'danger'}
                        withDot
                      />
                    </View>

                    <View style={styles.tagsWrap}>
                      <FlatBadge label={roleStr.toUpperCase()} tone="accent" />
                      <FlatBadge
                        label={member.hasPin ? 'PIN Configured' : 'PIN Pending'}
                        tone={member.hasPin ? 'neutral' : 'warning'}
                      />
                      {ips.length > 0 ? (
                        <FlatBadge label={`${ips.length} IP Rules`} tone="neutral" />
                      ) : null}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openStaffEditor(member)}
                      style={styles.editStaffLink}
                    >
                      <Text style={[styles.editLinkText, { color: tokens.accent }]}>
                        Edit Role, IP Allowlist & Status →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </AnimatedListItem>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Approve / Reject Access Request Modal */}
      <MagicModalSheet
        visible={Boolean(decisionTarget)}
        onClose={() => setDecisionTarget(null)}
        title={
          decisionTarget?.decision === 'approved'
            ? 'Approve Staff Access Request'
            : 'Reject Staff Access Request'
        }
        subtitle={
          decisionTarget
            ? `${decisionTarget.record.fullName} · ${decisionTarget.record.requestCode}`
            : ''
        }
      >
        <FlatInput
          label="Review Note (Visible on status check)"
          value={reviewNote}
          onChangeText={setReviewNote}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder={
            decisionTarget?.decision === 'approved'
              ? 'Welcome aboard! Your support credentials are ready...'
              : 'Reason for declining onboarding request...'
          }
        />

        <View style={styles.modalActions}>
          <ShimmerButton
            label="Cancel"
            size="sm"
            variant="subtle"
            onPress={() => setDecisionTarget(null)}
          />
          <ShimmerButton
            label={
              decisionTarget?.decision === 'approved'
                ? 'Confirm Approval'
                : 'Confirm Rejection'
            }
            size="sm"
            variant={decisionTarget?.decision === 'approved' ? 'accent' : 'danger'}
            loading={deciding}
            onPress={handleConfirmDecision}
          />
        </View>
      </MagicModalSheet>

      {/* Create / Update Staff Account Modal (PIN Protected) */}
      <MagicModalSheet
        visible={staffModalVisible}
        onClose={() => setStaffModalVisible(false)}
        title={editUserId ? 'Update Staff Role & Access' : 'Provision Staff Account'}
        subtitle="Requires Staff Security PIN authorization"
      >
        <FlatInput
          label="Full Name"
          value={staffName}
          onChangeText={setStaffName}
          autoCapitalize="words"
          placeholder="Specialist full name"
        />

        <FlatInput
          label="Staff Email"
          value={staffEmail}
          onChangeText={setStaffEmail}
          keyboardType="email-address"
          placeholder="specialist@tiwlo.com"
        />

        <FlatInput
          label={editUserId ? 'Reset Password (Optional)' : 'Initial Password'}
          value={staffPassword}
          onChangeText={setStaffPassword}
          secureTextEntry
          placeholder={editUserId ? 'Leave blank to keep existing' : 'Strong password'}
        />

        <View style={styles.roleBlock}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>
            Role Preset
          </Text>
          <View style={styles.tagsWrap}>
            {availableRoleKeys.map((rKey) => {
              const active = staffRoleKey === rKey;
              const label =
                rolePresets[rKey]?.label ||
                staffProfile.rolePresets?.[rKey]?.label ||
                rKey.replace(/_/g, ' ');
              return (
                <TouchableOpacity
                  key={rKey}
                  activeOpacity={0.7}
                  onPress={() => setStaffRoleKey(rKey)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: active ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Allowed IP Addresses (Optional, comma-separated)"
          value={staffAllowedIps}
          onChangeText={setStaffAllowedIps}
          placeholder="Leave blank for unrestricted IP access"
        />

        <View style={styles.modalFootBetween}>
          <View style={styles.activeToggle}>
            <MagicSwitch value={staffActive} onValueChange={setStaffActive} />
            <Text style={[styles.fieldLabel, { color: tokens.text }]}>Account Active</Text>
          </View>

          <ShimmerButton
            label={editUserId ? 'Update Role' : 'Create Account'}
            size="sm"
            variant="accent"
            loading={savingStaff}
            leftIcon={<Feather name="lock" size={12} color={tokens.accentText} />}
            onPress={handleSaveStaffAccount}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default StaffAccessApprovalsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11.5,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 20,
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingVertical: 10,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 11,
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  vSep: {
    width: 1,
    height: 26,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  reqRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 8,
  },
  reqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  contactLine: {
    fontSize: 11.5,
    marginTop: 1,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  reviewNoteText: {
    fontSize: 11.5,
    fontStyle: 'italic',
  },
  reqFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateText: {
    fontSize: 11,
  },
  decisionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  editStaffLink: {
    alignSelf: 'flex-start',
  },
  editLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  roleBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalFootBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
