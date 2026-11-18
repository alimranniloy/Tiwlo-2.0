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
import { ApiRequestError } from '../../services/apiClient';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, SupportBlocklistRule } from '../../types/opsHub';
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
  MagicModalSheet,
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

const KIND_FILTERS: { key: 'all' | SupportBlocklistRule['kind']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'ip', label: 'IP' },
  { key: 'domain', label: 'Domain' },
  { key: 'keyword', label: 'Keyword' },
  { key: 'phone', label: 'Phone' },
];

function getSeverityTone(raw?: unknown): SemanticTone {
  const s = String(raw || '').toLowerCase();
  if (s === 'critical' || s === 'high') return 'danger';
  if (s === 'medium' || s === 'warning') return 'warning';
  if (s === 'low') return 'accent';
  return 'neutral';
}

export const SpamAbuseShieldScreen: React.FC<OpsScreenProps> = ({
  staffProfile,
  onBack,
  onOpenChat,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [activeTab, setActiveTab] = useState<'blocklist' | 'forensics'>('blocklist');

  // Blocklist state
  const [loadingRules, setLoadingRules] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<SupportBlocklistRule[]>([]);
  const [kindFilter, setKindFilter] = useState<'all' | SupportBlocklistRule['kind']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add Blocklist Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [blockKind, setBlockKind] = useState<SupportBlocklistRule['kind']>('email');
  const [blockValue, setBlockValue] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [addingRule, setAddingRule] = useState(false);

  // Forensics state
  const [loadingForensics, setLoadingForensics] = useState(false);
  const [forensicLogs, setForensicLogs] = useState<Record<string, unknown>[]>([]);
  const [forensicNotice, setForensicNotice] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('all');

  const canInspectForensics =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).includes('view_audit_logs') ||
    (staffProfile.permissions || []).includes('manage_users_security') ||
    (staffProfile.permissions || []).includes('support.view');

  const loadBlocklist = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingRules(true);
      try {
        const res = await opsHubService.listBlocklist();
        setRules(res.rules || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load blocklist rules.',
          });
        }
      } finally {
        setLoadingRules(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  const loadForensics = useCallback(
    async (silent = false) => {
      if (!canInspectForensics) {
        setForensicNotice(
          'Security audit permission is required to inspect live-chat collusion forensics.'
        );
        setForensicLogs([]);
        setRefreshing(false);
        return;
      }
      if (!silent) setLoadingForensics(true);
      try {
        const res = await supportService.getForensicLogs('all', 60);
        setForensicLogs(res.logs || []);
        setForensicNotice(null);
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 403 || err.status === 401)) {
          setForensicNotice(
            'Collusion forensics requires view_audit_logs or Super Admin clearance.'
          );
          setForensicLogs([]);
        } else if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load forensic logs.',
          });
        }
      } finally {
        setLoadingForensics(false);
        setRefreshing(false);
      }
    },
    [canInspectForensics, toast]
  );

  useEffect(() => {
    loadBlocklist(false);
  }, [loadBlocklist]);

  useEffect(() => {
    if (activeTab === 'forensics') {
      loadForensics(false);
    }
  }, [activeTab, loadForensics]);

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rules.filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        r.value.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q)
      );
    });
  }, [kindFilter, rules, searchQuery]);

  const filteredForensics = useMemo(() => {
    if (severityFilter === 'all') return forensicLogs;
    return forensicLogs.filter(
      (log) => String(log.severity || '').toLowerCase() === severityFilter
    );
  }, [forensicLogs, severityFilter]);

  const handleAddRule = async () => {
    if (!blockValue.trim() || !blockReason.trim()) {
      toast.show({
        variant: 'danger',
        label: 'Enter sender/pattern value and reason for blocking.',
      });
      return;
    }

    setAddingRule(true);
    try {
      const res = await opsHubService.addBlocklistRule({
        kind: blockKind,
        value: blockValue.trim(),
        reason: blockReason.trim(),
      });
      if (res.rule) {
        setRules((prev) => [res.rule, ...prev]);
      } else {
        loadBlocklist(true);
      }
      setModalVisible(false);
      setBlockValue('');
      setBlockReason('');
      toast.show({ variant: 'success', label: 'Sender / pattern added to Spam Shield.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not add blocklist rule.',
      });
    } finally {
      setAddingRule(false);
    }
  };

  const handleUnblock = async (id: string) => {
    setDeletingId(id);
    try {
      await opsHubService.deleteBlocklistRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.show({ variant: 'accent', label: 'Rule removed from blocklist.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to unblock entry.',
      });
    } finally {
      setDeletingId(null);
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
            Spam & Abuse Shield
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Intake blocklist filters & collusion anomaly forensics
          </Text>
        </View>
        {activeTab === 'blocklist' ? (
          <ShimmerButton
            label="+ Block"
            size="xs"
            variant="danger"
            onPress={() => setModalVisible(true)}
          />
        ) : null}
      </View>

      {/* Dual-Tab Strip */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('blocklist')}
          style={[
            styles.tabBtn,
            activeTab === 'blocklist' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'blocklist' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Blocklist Rules (${rules.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('forensics')}
          style={[
            styles.tabBtn,
            activeTab === 'forensics' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'forensics' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Collusion Forensics (${forensicLogs.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'blocklist' ? (
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
                loadBlocklist(true);
              }}
            />
          }
        >
          {/* KPI Strip */}
          <BlurFade delay={0} offset={5}>
            <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>
                  ACTIVE FILTERS
                </Text>
                <NumberTicker
                  value={rules.length}
                  style={[styles.kpiVal, { color: tokens.text }]}
                />
              </View>
              <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>
                  BLOCKED ATTEMPTS
                </Text>
                <NumberTicker
                  value={rules.reduce((sum, r) => sum + Number(r.hitsCount || 0), 0)}
                  style={[styles.kpiVal, { color: tokens.danger }]}
                />
              </View>
            </View>
          </BlurFade>

          {/* Search + Kind Filter */}
          <FlatInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Filter blocked emails, IPs, domains or keywords..."
            leftIcon={<Feather name="search" size={14} color={tokens.textMuted} />}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {KIND_FILTERS.map((item) => {
              const active = kindFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.7}
                  onPress={() => setKindFilter(item.key)}
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
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Hairline />

          {loadingRules && rules.length === 0 ? (
            <MagicSpinner label="Loading spam shield rules..." />
          ) : filteredRules.length === 0 ? (
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              No blocked senders or patterns match this filter.
            </Text>
          ) : (
            filteredRules.map((rule, idx) => (
              <AnimatedListItem key={rule.id} index={idx}>
                <View style={[styles.listRow, { borderBottomColor: tokens.hairline }]}>
                  <View style={styles.rowTop}>
                    <View style={styles.badgePair}>
                      <FlatBadge label={rule.kind.toUpperCase()} tone="danger" />
                      <Text
                        numberOfLines={1}
                        style={[styles.ruleValue, { color: tokens.text }]}
                      >
                        {rule.value}
                      </Text>
                    </View>
                    <FlatBadge label={`${rule.hitsCount || 0} blocked`} tone="neutral" />
                  </View>

                  <Text style={[styles.reasonText, { color: tokens.textSecondary }]}>
                    {rule.reason || 'Spam / abuse policy enforcement'}
                  </Text>

                  <View style={styles.rowFoot}>
                    <Text style={[styles.metaText, { color: tokens.textMuted }]}>
                      {`Added by ${rule.createdByName || 'Staff'} · ${formatShortDateTime(rule.createdAt)}`}
                    </Text>
                    <ShimmerButton
                      label="Unblock"
                      size="xs"
                      variant="subtle"
                      loading={deletingId === rule.id}
                      onPress={() => handleUnblock(rule.id)}
                    />
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
                loadForensics(true);
              }}
            />
          }
        >
          {forensicNotice ? (
            <FlatNotice text={forensicNotice} tone="warning" icon="shield" />
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {['all', 'critical', 'high', 'medium', 'low'].map((sev) => {
              const active = severityFilter === sev;
              return (
                <TouchableOpacity
                  key={sev}
                  activeOpacity={0.7}
                  onPress={() => setSeverityFilter(sev)}
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
                    {sev.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingForensics && forensicLogs.length === 0 ? (
            <MagicSpinner label="Scanning collusion & self-chat telemetry..." />
          ) : filteredForensics.length === 0 ? (
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              No flagged self-chat or rapid ping-pong anomalies detected.
            </Text>
          ) : (
            filteredForensics.map((log, idx) => {
              const title = String(
                log.eventType || log.action || log.type || 'Collusion Anomaly'
              );
              const detail = String(
                log.description ||
                  log.details ||
                  log.reason ||
                  'Flagged live-chat telemetry anomaly'
              );
              const chatId = log.chatId ? String(log.chatId) : null;
              const score =
                log.collusionScore !== undefined ? Number(log.collusionScore) : null;

              return (
                <AnimatedListItem key={String(log.id || idx)} index={idx}>
                  <View style={[styles.listRow, { borderBottomColor: tokens.hairline }]}>
                    <View style={styles.rowTop}>
                      <Text
                        numberOfLines={1}
                        style={[styles.ruleValue, { color: tokens.text, flex: 1 }]}
                      >
                        {title}
                      </Text>
                      <View style={styles.badgePair}>
                        {score !== null && Number.isFinite(score) ? (
                          <FlatBadge label={`Score ${score}`} tone="warning" />
                        ) : null}
                        {log.severity ? (
                          <FlatBadge
                            label={String(log.severity).toUpperCase()}
                            tone={getSeverityTone(log.severity)}
                            withDot
                          />
                        ) : null}
                      </View>
                    </View>

                    <Text style={[styles.reasonText, { color: tokens.textSecondary }]}>
                      {detail}
                    </Text>

                    <View style={styles.rowFoot}>
                      <Text style={[styles.metaText, { color: tokens.textMuted }]}>
                        {`${String(log.agentName || log.actorName || 'Telemetry')} · ${formatShortDateTime(String(log.createdAt || log.timestamp || ''))}`}
                      </Text>
                      {chatId ? (
                        <TouchableOpacity onPress={() => onOpenChat(chatId)} hitSlop={8}>
                          <Text style={[styles.openChatLink, { color: tokens.accent }]}>
                            Inspect Chat →
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </AnimatedListItem>
              );
            })
          )}
        </ScrollView>
      )}

      {/* + Block Sender / Pattern Modal */}
      <MagicModalSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Block Sender or Pattern"
        subtitle="Immediately reject matching tickets & visitor chats at intake"
      >
        <View style={styles.kindBlock}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Pattern Type</Text>
          <View style={styles.kindGrid}>
            {(['email', 'ip', 'domain', 'keyword', 'phone'] as const).map((k) => {
              const active = blockKind === k;
              return (
                <TouchableOpacity
                  key={k}
                  activeOpacity={0.7}
                  onPress={() => setBlockKind(k)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? tokens.dangerSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.danger : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: active ? tokens.danger : tokens.textSecondary,
                    }}
                  >
                    {k.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Blocked Value / Pattern"
          value={blockValue}
          onChangeText={setBlockValue}
          placeholder={
            blockKind === 'email'
              ? 'spammer@example.com'
              : blockKind === 'ip'
                ? '203.0.113.42'
                : blockKind === 'domain'
                  ? 'disposablemail.org'
                  : blockKind === 'phone'
                    ? '+8801...'
                    : 'abusive phrase'
          }
        />

        <FlatInput
          label="Audit Reason"
          value={blockReason}
          onChangeText={setBlockReason}
          autoCapitalize="sentences"
          multiline
          placeholder="Document spam campaign, abuse pattern, or bot flood..."
        />

        <View style={styles.modalBtns}>
          <ShimmerButton
            label="Cancel"
            size="sm"
            variant="subtle"
            onPress={() => setModalVisible(false)}
          />
          <ShimmerButton
            label="Enforce Block"
            size="sm"
            variant="danger"
            loading={addingRule}
            onPress={handleAddRule}
          />
        </View>
      </MagicModalSheet>
    </KeyboardAvoidingView>
  );
};

export default SpamAbuseShieldScreen;

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
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
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
    gap: 7,
    paddingVertical: 2,
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
  listRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  ruleValue: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  reasonText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
  },
  openChatLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  kindBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
});
