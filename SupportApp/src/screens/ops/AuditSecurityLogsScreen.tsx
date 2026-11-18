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
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSensitiveGrant } from '../../components/security/SensitiveGrantContext';
import { ApiRequestError } from '../../services/apiClient';
import { supportService } from '../../services/supportService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicSpinner,
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

type AuditTab = 'staff_audits' | 'forensic_alerts' | 'session_revocation';

function getLogSeverityTone(raw?: unknown): SemanticTone {
  const s = String(raw || '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'danger') return 'danger';
  if (s === 'medium' || s === 'warning') return 'warning';
  if (s === 'low' || s === 'info') return 'accent';
  return 'neutral';
}

export const AuditSecurityLogsScreen: React.FC<OpsScreenProps> = ({
  staffProfile,
  onBack,
  onOpenChat,
  routeParams,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const { requestSensitiveGrant } = useSensitiveGrant();

  const [activeTab, setActiveTab] = useState<AuditTab>('staff_audits');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [staffAudits, setStaffAudits] = useState<Record<string, unknown>[]>([]);
  const [forensicLogs, setForensicLogs] = useState<Record<string, unknown>[]>([]);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [severity, setSeverity] = useState('all');

  // Session Revocation State
  const [targetUserId, setTargetUserId] = useState(routeParams?.userId || '');
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [recentRevocations, setRecentRevocations] = useState<
    { targetUserId: string; reason: string; at: string }[]
  >([]);

  const canViewAudit =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).includes('view_audit_logs') ||
    (staffProfile.permissions || []).includes('manage_users_security');

  const loadAuditStreams = useCallback(
    async (silent = false) => {
      if (!canViewAudit) {
        setPermissionNotice(
          'Security audit stream requires view_audit_logs, manage_users_security, or Super Admin access.'
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!silent) setLoading(true);
      try {
        const [auditRes, forensicRes] = await Promise.all([
          supportService.getStaffAuditLogs(70),
          supportService.getForensicLogs(severity, 70),
        ]);
        setStaffAudits(auditRes.logs || []);
        setForensicLogs(forensicRes.logs || []);
        setPermissionNotice(null);
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 403 || err.status === 401)) {
          setPermissionNotice(
            'Your current staff role does not have clearance to read raw security audit logs.'
          );
        } else if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load security logs.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewAudit, severity, toast]
  );

  useEffect(() => {
    loadAuditStreams(false);
  }, [loadAuditStreams]);

  useEffect(() => {
    if (routeParams?.userId) {
      setTargetUserId(routeParams.userId);
      setActiveTab('session_revocation');
    }
  }, [routeParams?.userId]);

  const filteredStaffAudits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffAudits;
    return staffAudits.filter((log) =>
      JSON.stringify(log).toLowerCase().includes(q)
    );
  }, [searchQuery, staffAudits]);

  const filteredForensics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forensicLogs;
    return forensicLogs.filter((log) =>
      JSON.stringify(log).toLowerCase().includes(q)
    );
  }, [forensicLogs, searchQuery]);

  const handleTerminateSessions = async () => {
    const cleanTarget = targetUserId.trim();
    const cleanReason = revokeReason.trim();
    if (!cleanTarget || !cleanReason) {
      toast.show({
        variant: 'danger',
        label: 'Enter Target User/Staff ID and mandatory audit reason.',
      });
      return;
    }

    try {
      await requestSensitiveGrant(`Terminate Sessions (${cleanTarget})`);
      setRevoking(true);
      await supportService.terminateUserSessions(cleanTarget, cleanReason);
      setRecentRevocations((prev) => [
        {
          targetUserId: cleanTarget,
          reason: cleanReason,
          at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTargetUserId('');
      setRevokeReason('');
      toast.show({
        variant: 'success',
        label: `All active sessions revoked for ${cleanTarget}.`,
      });
      loadAuditStreams(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label:
          err instanceof Error
            ? err.message
            : 'Session revocation cancelled or failed.',
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: tokens.bg }]}
    >
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
            Audit & Security Logs
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Staff permission events, forensic alerts & session revocation
          </Text>
        </View>
        <BorderlessIconButton
          name="refresh-cw"
          size={17}
          onPress={() => loadAuditStreams(false)}
          accessibilityLabel="Refresh security logs"
        />
      </View>

      {/* Segmented Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {(
            [
              {
                key: 'staff_audits',
                label: `Permission & Staff Audits (${staffAudits.length})`,
              },
              {
                key: 'forensic_alerts',
                label: `Forensic Alerts (${forensicLogs.length})`,
              },
              { key: 'session_revocation', label: 'Session Revocation' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: active ? tokens.text : tokens.textMuted,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={tokens.accent}
            onRefresh={() => {
              setRefreshing(true);
              loadAuditStreams(true);
            }}
          />
        }
      >
        {permissionNotice ? (
          <FlatNotice text={permissionNotice} tone="warning" icon="shield" />
        ) : null}

        {activeTab !== 'session_revocation' ? (
          <>
            {/* KPI Summary */}
            <BlurFade delay={0} offset={5}>
              <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
                <View style={styles.kpiCell}>
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>
                    STAFF AUDITS
                  </Text>
                  <NumberTicker
                    value={staffAudits.length}
                    style={[styles.kpiVal, { color: tokens.text }]}
                  />
                </View>
                <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
                <View style={styles.kpiCell}>
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>
                    FORENSIC ALERTS
                  </Text>
                  <NumberTicker
                    value={forensicLogs.length}
                    style={[
                      styles.kpiVal,
                      {
                        color:
                          forensicLogs.length > 0 ? tokens.warning : tokens.text,
                      },
                    ]}
                  />
                </View>
              </View>
            </BlurFade>

            {/* Search Bar */}
            <FlatInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search actor, action, IP address, user ID or details..."
              leftIcon={<Feather name="search" size={14} color={tokens.textMuted} />}
              rightSlot={
                searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Feather name="x" size={14} color={tokens.textMuted} />
                  </TouchableOpacity>
                ) : undefined
              }
            />

            {activeTab === 'forensic_alerts' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sevRow}
              >
                {['all', 'critical', 'high', 'medium', 'low'].map((sev) => {
                  const active = severity === sev;
                  return (
                    <TouchableOpacity
                      key={sev}
                      activeOpacity={0.7}
                      onPress={() => setSeverity(sev)}
                      style={[
                        styles.sevChip,
                        {
                          backgroundColor: active
                            ? tokens.accentSoft
                            : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: active ? tokens.accent : tokens.textSecondary,
                        }}
                      >
                        {sev.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <Hairline />

            {loading && staffAudits.length === 0 && forensicLogs.length === 0 ? (
              <MagicSpinner label="Fetching security audit trail..." />
            ) : (activeTab === 'staff_audits'
                ? filteredStaffAudits
                : filteredForensics
              ).length === 0 ? (
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No matching audit events recorded.
              </Text>
            ) : (
              (activeTab === 'staff_audits'
                ? filteredStaffAudits
                : filteredForensics
              ).map((log, idx) => {
                const actionTitle = String(
                  log.action || log.eventType || log.type || 'Security Event'
                );
                const detail = String(
                  log.description || log.details || log.reason || 'Recorded audit entry'
                );
                const actor = String(
                  log.actorName || log.actorEmail || log.agentName || 'System'
                );
                const ip = log.ip || log.ipAddress || log.visitorIp;
                const chatId = log.chatId ? String(log.chatId) : null;
                const ts = String(log.createdAt || log.timestamp || '');

                return (
                  <AnimatedListItem key={String(log.id || idx)} index={idx}>
                    <View style={[styles.logRow, { borderBottomColor: tokens.hairline }]}>
                      <View style={styles.logTop}>
                        <Text
                          numberOfLines={1}
                          style={[styles.logTitle, { color: tokens.text, flex: 1 }]}
                        >
                          {actionTitle}
                        </Text>
                        {log.severity ? (
                          <FlatBadge
                            label={String(log.severity).toUpperCase()}
                            tone={getLogSeverityTone(log.severity)}
                            withDot
                          />
                        ) : (
                          <FlatBadge label="AUDIT" tone="neutral" />
                        )}
                      </View>

                      <Text style={[styles.logDetail, { color: tokens.textSecondary }]}>
                        {detail}
                      </Text>

                      <View style={styles.logMetaRow}>
                        <Text style={[styles.logMeta, { color: tokens.textMuted }]}>
                          {`${actor}${ip ? ` · IP ${String(ip)}` : ''} · ${formatShortDateTime(ts)}`}
                        </Text>
                        {chatId ? (
                          <TouchableOpacity onPress={() => onOpenChat(chatId)} hitSlop={8}>
                            <Text style={[styles.chatLink, { color: tokens.accent }]}>
                              Open Chat →
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </AnimatedListItem>
                );
              })
            )}
          </>
        ) : (
          /* PIN-Protected Terminate User/Staff Sessions Panel */
          <BlurFade delay={0} offset={5}>
            <View style={styles.revokeSection}>
              <FlatNotice
                text="Protected by Staff Security PIN. Terminating sessions immediately invalidates active web & mobile tokens for the target account and writes an immutable security audit entry."
                tone="danger"
                icon="lock"
              />

              <FlatInput
                label="Target User or Staff ID"
                value={targetUserId}
                onChangeText={setTargetUserId}
                placeholder="Enter userId or staff account ID..."
              />

              <FlatInput
                label="Mandatory Security Audit Reason"
                value={revokeReason}
                onChangeText={setRevokeReason}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                placeholder="e.g. Compromised credentials reported; forced token rotation..."
              />

              <View style={styles.revokeActionRow}>
                <ShimmerButton
                  label="Terminate User/Staff Sessions"
                  size="sm"
                  variant="danger"
                  loading={revoking}
                  leftIcon={<Feather name="shield" size={13} color="#FFFFFF" />}
                  onPress={handleTerminateSessions}
                />
              </View>

              {recentRevocations.length > 0 ? (
                <View style={styles.recentRevokesBlock}>
                  <Hairline strong />
                  <Text style={[styles.secHeading, { color: tokens.text }]}>
                    Revoked in This Session
                  </Text>
                  {recentRevocations.map((item, idx) => (
                    <View
                      key={`${item.targetUserId}-${idx}`}
                      style={[styles.logRow, { borderBottomColor: tokens.hairline }]}
                    >
                      <View style={styles.logTop}>
                        <Text style={[styles.logTitle, { color: tokens.text }]}>
                          {`Target: ${item.targetUserId}`}
                        </Text>
                        <FlatBadge label="REVOKED" tone="danger" withDot />
                      </View>
                      <Text style={[styles.logDetail, { color: tokens.textSecondary }]}>
                        {item.reason}
                      </Text>
                      <Text style={[styles.logMeta, { color: tokens.textMuted }]}>
                        {formatShortDateTime(item.at)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </BlurFade>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AuditSecurityLogsScreen;

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
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 18,
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
  sevRow: {
    gap: 7,
    paddingVertical: 2,
  },
  sevChip: {
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
  logRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    gap: 5,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  logDetail: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logMeta: {
    flex: 1,
    fontSize: 11,
  },
  chatLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  revokeSection: {
    gap: 13,
    paddingTop: 4,
  },
  revokeActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  recentRevokesBlock: {
    gap: 10,
    marginTop: 8,
  },
  secHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
});
