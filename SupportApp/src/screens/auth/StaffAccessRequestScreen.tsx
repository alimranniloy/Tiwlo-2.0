import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StaffAccessRequestRecord } from '../../types/opsHub';
import { formatShortDateTime } from '../../utils/formatters';
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

export interface StaffAccessRequestScreenProps {
  onBackToLogin: () => void;
}

type OnboardingTab = 'request' | 'status';

const DEPARTMENTS = [
  'Customer Support',
  'Technical',
  'Billing',
  'Trust & Safety',
  'Operations',
] as const;

const ROLE_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'support_agent', label: 'Support Agent', hint: 'Tickets & live chat triage' },
  { key: 'support_lead', label: 'Support Lead', hint: 'Escalations, QA & queue ops' },
  { key: 'trust_safety', label: 'Trust & Safety', hint: 'Risk, appeals & compliance' },
  { key: 'finance_analyst', label: 'Finance Analyst', hint: 'Billing, payouts & refunds' },
];

export const StaffAccessRequestScreen: React.FC<StaffAccessRequestScreenProps> = ({
  onBackToLogin,
}) => {
  const { theme, tokens, toggleTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [activeTab, setActiveTab] = useState<OnboardingTab>('request');

  // Request Access form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<string>('Customer Support');
  const [desiredRole, setDesiredRole] = useState<string>('support_agent');
  const [inviteCode, setInviteCode] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedRecord, setSubmittedRecord] = useState<StaffAccessRequestRecord | null>(null);

  // Check Status form state
  const [statusEmail, setStatusEmail] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusResult, setStatusResult] = useState<StaffAccessRequestRecord | null>(null);

  const handleSubmitRequest = async () => {
    setSubmitError('');
    if (!fullName.trim()) {
      setSubmitError('Enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setSubmitError('Enter a valid work email address.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setSubmitError('Enter a valid phone number.');
      return;
    }
    if (!reason.trim()) {
      setSubmitError('Add a short onboarding note for your team lead or administrator.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await opsHubService.submitPublicStaffAccessRequest({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        desiredRole,
        ...(inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {}),
        reason: reason.trim(),
      });
      setSubmittedRecord(res.request);
      setStatusEmail(res.request.email || email.trim());
      setStatusCode(res.request.requestCode || '');
      toast.show({
        variant: 'success',
        label: `Request ${res.request.requestCode} submitted for review.`,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to submit staff access request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (overrideEmail?: string, overrideCode?: string) => {
    const targetEmail = (overrideEmail ?? statusEmail).trim();
    const targetCode = (overrideCode ?? statusCode).trim();
    setStatusError('');

    if (!targetEmail || !targetEmail.includes('@')) {
      setStatusError('Enter the work email used on your request.');
      return;
    }
    if (!targetCode) {
      setStatusError('Enter your request code (e.g. REQ-...).');
      return;
    }

    setCheckingStatus(true);
    try {
      const res = await opsHubService.checkPublicStaffAccessStatus(targetEmail, targetCode);
      setStatusResult(res.request);
    } catch (err) {
      setStatusResult(null);
      setStatusError(
        err instanceof Error ? err.message : 'No matching access request was found.'
      );
    } finally {
      setCheckingStatus(false);
    }
  };

  const getApprovalMeta = (status: StaffAccessRequestRecord['status']) => {
    if (status === 'approved') {
      return { label: 'Approved', tone: 'success' as const, icon: 'check-circle' as const };
    }
    if (status === 'rejected') {
      return { label: 'Rejected', tone: 'danger' as const, icon: 'x-circle' as const };
    }
    return { label: 'Pending Review', tone: 'warning' as const, icon: 'clock' as const };
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={[styles.root, { backgroundColor: tokens.bg }]}>
        {/* Crisp Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <BorderlessIconButton
              name="arrow-left"
              size={19}
              onPress={onBackToLogin}
              accessibilityLabel="Back to sign in"
            />
            <SupportLogo variant="land" width={104} height={28} />
          </View>
          <View style={styles.topRight}>
            <FlatBadge label="Staff Onboarding" tone="accent" withDot />
            <BorderlessIconButton
              name={theme === 'dark' ? 'sun' : 'moon'}
              size={18}
              onPress={toggleTheme}
              accessibilityLabel="Toggle color theme"
            />
          </View>
        </View>

        <Hairline />

        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={64}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: tokens.text }]}>Staff Access Desk</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              Request authorized Tiwlo Support workspace credentials or track administrator review.
            </Text>
          </View>

          {/* Segmented 2-Tab Switch with Crisp 1px Structural Border */}
          <View
            style={[
              styles.segmentedTabs,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                setActiveTab('request');
                setSubmitError('');
              }}
              style={[
                styles.segmentBtn,
                activeTab === 'request' && {
                  backgroundColor: tokens.bg,
                  borderColor: tokens.hairlineStrong,
                  borderWidth: 1,
                },
              ]}
            >
              <Feather
                name="user-plus"
                size={13}
                color={activeTab === 'request' ? tokens.accent : tokens.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: activeTab === 'request' ? tokens.text : tokens.textMuted,
                    fontWeight: activeTab === 'request' ? '700' : '500',
                  },
                ]}
              >
                Request Access
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                setActiveTab('status');
                setStatusError('');
              }}
              style={[
                styles.segmentBtn,
                activeTab === 'status' && {
                  backgroundColor: tokens.bg,
                  borderColor: tokens.hairlineStrong,
                  borderWidth: 1,
                },
              ]}
            >
              <Feather
                name="search"
                size={13}
                color={activeTab === 'status' ? tokens.accent : tokens.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: activeTab === 'status' ? tokens.text : tokens.textMuted,
                    fontWeight: activeTab === 'status' ? '700' : '500',
                  },
                ]}
              >
                Check Status
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'request' ? (
            submittedRecord ? (
              <View style={styles.sectionStack}>
                <FlatNotice
                  tone="success"
                  icon="check-circle"
                  text="Your staff onboarding request has been logged. Save your tracking code below."
                />

                <View
                  style={[
                    styles.codePanel,
                    {
                      backgroundColor: tokens.surfaceSubtle,
                      borderColor: tokens.hairlineStrong,
                    },
                  ]}
                >
                  <View style={styles.codeHeaderRow}>
                    <Text style={[styles.codeMetaLabel, { color: tokens.textMuted }]}>
                      GENERATED REQUEST CODE
                    </Text>
                    <FlatBadge label="Pending Review" tone="warning" withDot />
                  </View>

                  <Text selectable style={[styles.requestCodeValue, { color: tokens.accent }]}>
                    {submittedRecord.requestCode}
                  </Text>

                  <Hairline />

                  <View style={styles.metaGrid}>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Applicant</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {submittedRecord.fullName}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Work Email</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {submittedRecord.email}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Department</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {submittedRecord.department}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Role</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {submittedRecord.desiredRole}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <ShimmerButton
                    label="Track Live Status"
                    size="md"
                    variant="accent"
                    onPress={() => {
                      const targetMail = submittedRecord.email;
                      const targetReqCode = submittedRecord.requestCode;
                      setStatusEmail(targetMail);
                      setStatusCode(targetReqCode);
                      setActiveTab('status');
                      handleCheckStatus(targetMail, targetReqCode);
                    }}
                    rightIcon={<Feather name="arrow-right" size={14} color={tokens.accentText} />}
                  />

                  <View style={styles.inlineActionLinks}>
                    <TouchableOpacity
                      onPress={() => {
                        setSubmittedRecord(null);
                        setReason('');
                        setInviteCode('');
                      }}
                      hitSlop={8}
                    >
                      <Text style={[styles.linkText, { color: tokens.textSecondary }]}>
                        New request
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onBackToLogin} hitSlop={8}>
                      <Text style={[styles.linkText, { color: tokens.accent }]}>Sign in</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.sectionStack}>
                {submitError ? (
                  <FlatNotice text={submitError} tone="danger" icon="alert-circle" />
                ) : null}

                <FlatInput
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  placeholder="Alex Rahman"
                  leftIcon={<Feather name="user" size={14} color={tokens.textMuted} />}
                />

                <FlatInput
                  label="Work Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="alex@tiwlo.com"
                  leftIcon={<Feather name="mail" size={14} color={tokens.textMuted} />}
                />

                <FlatInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+1 555 010 2400"
                  leftIcon={<Feather name="phone" size={14} color={tokens.textMuted} />}
                />

                {/* Department Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>
                    Department
                  </Text>
                  <View style={styles.chipsWrap}>
                    {DEPARTMENTS.map((dept) => {
                      const selected = department === dept;
                      return (
                        <TouchableOpacity
                          key={dept}
                          activeOpacity={0.7}
                          onPress={() => setDepartment(dept)}
                          style={[
                            styles.selectorChip,
                            {
                              backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                              borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              {
                                color: selected ? tokens.accent : tokens.textSecondary,
                                fontWeight: selected ? '700' : '500',
                              },
                            ]}
                          >
                            {dept}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Role Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>
                    Requested Role
                  </Text>
                  <View style={styles.roleGrid}>
                    {ROLE_OPTIONS.map((role) => {
                      const selected = desiredRole === role.key;
                      return (
                        <TouchableOpacity
                          key={role.key}
                          activeOpacity={0.7}
                          onPress={() => setDesiredRole(role.key)}
                          style={[
                            styles.roleItem,
                            {
                              backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                              borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                            },
                          ]}
                        >
                          <View style={styles.roleTitleRow}>
                            <Text
                              style={[
                                styles.roleTitle,
                                { color: selected ? tokens.accent : tokens.text },
                              ]}
                            >
                              {role.label}
                            </Text>
                            {selected ? (
                              <Feather name="check" size={13} color={tokens.accent} />
                            ) : null}
                          </View>
                          <Text style={[styles.roleCode, { color: tokens.textMuted }]}>
                            {role.key} · {role.hint}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <FlatInput
                  label="Invite Code (Optional)"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                  placeholder="TIWLO-INV-2026"
                  leftIcon={<Feather name="key" size={14} color={tokens.textMuted} />}
                />

                <FlatInput
                  label="Short Note"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                  autoCapitalize="sentences"
                  placeholder="Mention your team lead, shift, or support queue assignment..."
                />

                <View style={styles.actionRow}>
                  <ShimmerButton
                    label="Submit Access Request"
                    size="md"
                    loading={submitting}
                    onPress={handleSubmitRequest}
                    rightIcon={<Feather name="send" size={13} color={tokens.inkButtonText} />}
                  />

                  <TouchableOpacity onPress={onBackToLogin} hitSlop={8}>
                    <Text style={[styles.linkText, { color: tokens.textMuted }]}>
                      Back to sign in
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          ) : (
            <View style={styles.sectionStack}>
              {statusError ? (
                <FlatNotice text={statusError} tone="danger" icon="alert-circle" />
              ) : null}

              <FlatInput
                label="Work Email"
                value={statusEmail}
                onChangeText={setStatusEmail}
                keyboardType="email-address"
                placeholder="alex@tiwlo.com"
                leftIcon={<Feather name="mail" size={14} color={tokens.textMuted} />}
              />

              <FlatInput
                label="Request Code"
                value={statusCode}
                onChangeText={setStatusCode}
                autoCapitalize="characters"
                placeholder="REQ-849201"
                onSubmitEditing={() => handleCheckStatus()}
                leftIcon={<Feather name="hash" size={14} color={tokens.textMuted} />}
              />

              <View style={styles.actionRow}>
                <ShimmerButton
                  label="Check Approval Status"
                  size="md"
                  loading={checkingStatus}
                  onPress={() => handleCheckStatus()}
                  rightIcon={<Feather name="arrow-right" size={14} color={tokens.inkButtonText} />}
                />

                <TouchableOpacity onPress={onBackToLogin} hitSlop={8}>
                  <Text style={[styles.linkText, { color: tokens.textMuted }]}>
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              </View>

              {statusResult ? (
                <View
                  style={[
                    styles.codePanel,
                    {
                      backgroundColor: tokens.surfaceSubtle,
                      borderColor: tokens.hairlineStrong,
                    },
                  ]}
                >
                  {(() => {
                    const meta = getApprovalMeta(statusResult.status);
                    return (
                      <View style={styles.codeHeaderRow}>
                        <View style={styles.statusTitleCluster}>
                          <Feather
                            name={meta.icon}
                            size={15}
                            color={
                              meta.tone === 'success'
                                ? tokens.success
                                : meta.tone === 'danger'
                                  ? tokens.danger
                                  : tokens.warning
                            }
                          />
                          <Text style={[styles.statusCodeHeading, { color: tokens.text }]}>
                            {statusResult.requestCode}
                          </Text>
                        </View>
                        <FlatBadge label={meta.label} tone={meta.tone} withDot />
                      </View>
                    );
                  })()}

                  <Hairline />

                  <View style={styles.metaGrid}>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Staff Name</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {statusResult.fullName}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Department</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {statusResult.department}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Role</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {statusResult.desiredRole}
                      </Text>
                    </View>
                    <View style={styles.metaLine}>
                      <Text style={[styles.metaKey, { color: tokens.textMuted }]}>Submitted</Text>
                      <Text style={[styles.metaVal, { color: tokens.text }]}>
                        {formatShortDateTime(statusResult.createdAt)}
                      </Text>
                    </View>
                    {statusResult.reviewedByName ? (
                      <View style={styles.metaLine}>
                        <Text style={[styles.metaKey, { color: tokens.textMuted }]}>
                          Reviewed By
                        </Text>
                        <Text style={[styles.metaVal, { color: tokens.text }]}>
                          {statusResult.reviewedByName}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.reviewerNoteBox,
                      {
                        backgroundColor: tokens.bg,
                        borderColor: tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.reviewerNoteLabel, { color: tokens.textMuted }]}>
                      REVIEWER NOTE
                    </Text>
                    <Text style={[styles.reviewerNoteBody, { color: tokens.textSecondary }]}>
                      {statusResult.reviewNote && statusResult.reviewNote.trim().length > 0
                        ? statusResult.reviewNote
                        : statusResult.status === 'pending'
                          ? 'Awaiting Super Admin or Support Lead verification. Check back shortly.'
                          : 'No additional reviewer remarks provided.'}
                    </Text>
                  </View>

                  {statusResult.status === 'approved' ? (
                    <ShimmerButton
                      label="Proceed to Staff Sign In"
                      size="sm"
                      variant="accent"
                      onPress={onBackToLogin}
                      rightIcon={<Feather name="log-in" size={13} color={tokens.accentText} />}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
        </KeyboardAwareScrollView>
      </View>
    </ScreenContainer>
  );
};

export default StaffAccessRequestScreen;

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
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  segmentedTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 9,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12.5,
  },
  sectionStack: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectorChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  selectorChipText: {
    fontSize: 12,
  },
  roleGrid: {
    gap: 7,
  },
  roleItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  roleCode: {
    fontSize: 11.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 12,
  },
  inlineActionLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  codePanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 11,
  },
  codeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeMetaLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  requestCodeValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusTitleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusCodeHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaGrid: {
    gap: 6,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  reviewerNoteBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 4,
  },
  reviewerNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  reviewerNoteBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
