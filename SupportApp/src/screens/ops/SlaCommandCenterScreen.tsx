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
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { getTonePalette, useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { SupportDepartmentConfig } from '../../types/opsHub';
import type { SupportTicket } from '../../types/support';
import {
  formatSlaBadge,
  getPriorityTone,
  getStatusLabel,
  getTicketSerial,
} from '../../utils/formatters';
import { evaluateTicketReplyAccess } from '../../utils/replyGuard';
import {
  AnimatedCircularProgress,
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  NumberTicker,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from './QuickPeekModal';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type SlaQueueFilter = 'critical_queue' | 'breached' | 'at_risk' | 'all_active';

const SLA_POLICY_MATRIX: {
  priority: string;
  tone: SemanticTone;
  firstResponse: string;
  resolution: string;
}[] = [
  { priority: 'Urgent', tone: 'danger', firstResponse: '15m', resolution: '2h' },
  { priority: 'High', tone: 'warning', firstResponse: '1h', resolution: '8h' },
  { priority: 'Medium', tone: 'accent', firstResponse: '4h', resolution: '24h' },
  { priority: 'Low', tone: 'neutral', firstResponse: '12h', resolution: '48h' },
];

function isTicketClosedOrResolved(ticket: SupportTicket): boolean {
  const s = String(ticket.status || '').toLowerCase();
  return s === 'closed' || s === 'resolved';
}

function isTicketBreached(ticket: SupportTicket): boolean {
  if (ticket.slaBreached) return true;
  if (isTicketClosedOrResolved(ticket)) return false;
  if (!ticket.slaDueAt) return false;
  const dueMs = Date.parse(ticket.slaDueAt);
  if (Number.isNaN(dueMs)) return false;
  return dueMs <= Date.now();
}

function isTicketAtRiskWithin2h(ticket: SupportTicket): boolean {
  if (isTicketClosedOrResolved(ticket) || isTicketBreached(ticket)) return false;
  if (ticket.slaDueAt) {
    const dueMs = Date.parse(ticket.slaDueAt);
    if (!Number.isNaN(dueMs)) {
      const minsLeft = (dueMs - Date.now()) / 60000;
      return minsLeft > 0 && minsLeft <= 120;
    }
  }
  const p = String(ticket.priority || '').toLowerCase();
  const unaccepted =
    String(ticket.assignmentStatus || '').toLowerCase() !== 'accepted' ||
    !ticket.assignedAgentId;
  return (p === 'urgent' || p === 'high') && unaccepted;
}

export const SlaCommandCenterScreen: React.FC<OpsScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onOpenTicket,
  onOpenChat,
  onNavigateSubScreen,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [departments, setDepartments] = useState<SupportDepartmentConfig[]>([]);
  const [queueFilter, setQueueFilter] = useState<SlaQueueFilter>('critical_queue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [peekTicket, setPeekTicket] = useState<SupportTicket | null>(null);

  const loadSlaData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [ticketRes, deptRes] = await Promise.all([
          supportService.listTickets({ limit: 80 }),
          opsHubService.listDepartments().catch(() => ({ departments: [] })),
        ]);
        setTickets(ticketRes.tickets || []);
        setDepartments(deptRes.departments || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load SLA telemetry.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadSlaData(false);
  }, [loadSlaData]);

  const metrics = useMemo(() => {
    const active = tickets.filter((t) => !isTicketClosedOrResolved(t));
    const breached = active.filter((t) => isTicketBreached(t));
    const atRisk = active.filter((t) => isTicketAtRiskWithin2h(t));

    const totalEval = tickets.length;
    const totalBreachedAll = tickets.filter((t) => isTicketBreached(t)).length;
    const healthPct =
      totalEval === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round(((totalEval - totalBreachedAll) / totalEval) * 100)));

    const priorityCounts = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const t of active) {
      const p = String(t.priority || 'medium').toLowerCase();
      if (p === 'urgent') priorityCounts.urgent += 1;
      else if (p === 'high') priorityCounts.high += 1;
      else if (p === 'low') priorityCounts.low += 1;
      else priorityCounts.medium += 1;
    }

    return {
      active,
      breached,
      atRisk,
      healthPct,
      priorityCounts,
    };
  }, [tickets]);

  const queueItems = useMemo(() => {
    const sortUrgency = (list: SupportTicket[]) =>
      [...list].sort((a, b) => {
        const aBreach = isTicketBreached(a) ? 0 : isTicketAtRiskWithin2h(a) ? 1 : 2;
        const bBreach = isTicketBreached(b) ? 0 : isTicketAtRiskWithin2h(b) ? 1 : 2;
        if (aBreach !== bBreach) return aBreach - bBreach;
        const aDue = a.slaDueAt ? Date.parse(a.slaDueAt) : Number.MAX_SAFE_INTEGER;
        const bDue = b.slaDueAt ? Date.parse(b.slaDueAt) : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });

    if (queueFilter === 'breached') return sortUrgency(metrics.breached);
    if (queueFilter === 'at_risk') return sortUrgency(metrics.atRisk);
    if (queueFilter === 'all_active') return sortUrgency(metrics.active);
    const combined = [...metrics.breached, ...metrics.atRisk];
    return sortUrgency(combined);
  }, [metrics.active, metrics.atRisk, metrics.breached, queueFilter]);

  const healthColor =
    metrics.healthPct >= 90
      ? tokens.success
      : metrics.healthPct >= 70
        ? tokens.warning
        : tokens.danger;

  const handleAcceptAndOpen = async (ticket: SupportTicket) => {
    setAcceptingId(ticket.id);
    try {
      await stopSupportRingtone();
      await supportService.acceptTicketAssignment(ticket.id);
      showToast({ variant: 'success', label: 'Ticket accepted. Opening room...' });
      onPulseSync?.();
      onOpenTicket(ticket.id);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept ticket.',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.pageTitle, { color: tokens.text }]}>SLA Command Center</Text>
              {metrics.breached.length > 0 ? (
                <PulsatingDot color={tokens.danger} size={7} active />
              ) : null}
            </View>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              Real-time response & resolution compliance radar
            </Text>
          </View>
        </View>

        <BorderlessIconButton
          name="refresh-cw"
          size={18}
          onPress={() => loadSlaData(false)}
          accessibilityLabel="Refresh SLA telemetry"
        />
      </View>

      {loading && tickets.length === 0 ? (
        <MagicSpinner label="Evaluating SLA deadlines..." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadSlaData(true);
              }}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* SLA Health % + Breached + At Risk Strip */}
          <BlurFade delay={20} offset={6}>
            <View
              style={[
                styles.heroStrip,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <View style={styles.ringBox}>
                <AnimatedCircularProgress
                  value={metrics.healthPct}
                  max={100}
                  size={64}
                  strokeWidth={5.5}
                  color={healthColor}
                  label={`${metrics.healthPct}%`}
                />
                <Text style={[styles.ringCaption, { color: tokens.textMuted }]}>SLA Health</Text>
              </View>

              <View style={[styles.verticalSep, { backgroundColor: tokens.hairlineStrong }]} />

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryItem}>
                  <NumberTicker
                    value={metrics.breached.length}
                    style={[
                      styles.telemetryValue,
                      { color: metrics.breached.length > 0 ? tokens.danger : tokens.text },
                    ]}
                  />
                  <Text style={[styles.telemetryLabel, { color: tokens.textMuted }]}>
                    Breached Now
                  </Text>
                </View>

                <View style={styles.telemetryItem}>
                  <NumberTicker
                    value={metrics.atRisk.length}
                    style={[
                      styles.telemetryValue,
                      { color: metrics.atRisk.length > 0 ? tokens.warning : tokens.text },
                    ]}
                  />
                  <Text style={[styles.telemetryLabel, { color: tokens.textMuted }]}>
                    {'At Risk (< 2h)'}
                  </Text>
                </View>

                <View style={styles.telemetryItem}>
                  <NumberTicker
                    value={metrics.active.length}
                    style={[styles.telemetryValue, { color: tokens.text }]}
                  />
                  <Text style={[styles.telemetryLabel, { color: tokens.textMuted }]}>
                    Active Queue
                  </Text>
                </View>
              </View>
            </View>
          </BlurFade>

          {/* Active Priority Breakdown */}
          <BlurFade delay={50} offset={6}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                ACTIVE PRIORITY BREAKDOWN
              </Text>
              <View style={styles.priorityRow}>
                {(
                  [
                    { key: 'urgent', label: 'Urgent', count: metrics.priorityCounts.urgent, tone: 'danger' },
                    { key: 'high', label: 'High', count: metrics.priorityCounts.high, tone: 'warning' },
                    { key: 'medium', label: 'Medium', count: metrics.priorityCounts.medium, tone: 'accent' },
                    { key: 'low', label: 'Low', count: metrics.priorityCounts.low, tone: 'neutral' },
                  ] as const
                ).map((item) => {
                  const palette = getTonePalette(tokens, item.tone);
                  return (
                    <View
                      key={item.key}
                      style={[
                        styles.priorityCell,
                        {
                          backgroundColor: tokens.surfaceSubtle,
                          borderColor: tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <View style={[styles.priorityDot, { backgroundColor: palette.fg }]} />
                      <Text style={[styles.priorityCount, { color: tokens.text }]}>
                        {item.count}
                      </Text>
                      <Text style={[styles.priorityName, { color: tokens.textMuted }]}>
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </BlurFade>

          {/* SLA Policy Targets Matrix */}
          <BlurFade delay={80} offset={6}>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                  SLA POLICY TARGETS MATRIX
                </Text>
                <TouchableOpacity
                  onPress={() => onNavigateSubScreen('departments_hours')}
                  hitSlop={8}
                >
                  <Text style={[styles.linkText, { color: tokens.accent }]}>
                    {`Departments (${departments.length})`}
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.matrixTable,
                  {
                    backgroundColor: tokens.surfaceSubtle,
                    borderColor: tokens.hairlineStrong,
                  },
                ]}
              >
                <View style={styles.matrixHeader}>
                  <Text style={[styles.matrixColHead, styles.colFlex12, { color: tokens.textMuted }]}>
                    TIER
                  </Text>
                  <Text style={[styles.matrixColHead, styles.colFlex1, { color: tokens.textMuted }]}>
                    1ST RESPONSE
                  </Text>
                  <Text style={[styles.matrixColHead, styles.colFlex1, { color: tokens.textMuted }]}>
                    RESOLUTION
                  </Text>
                </View>

                {SLA_POLICY_MATRIX.map((row) => (
                  <React.Fragment key={row.priority}>
                    <Hairline />
                    <View style={styles.matrixRow}>
                      <View style={styles.colFlex12}>
                        <FlatBadge label={row.priority} tone={row.tone} withDot />
                      </View>
                      <Text style={[styles.matrixValue, styles.colFlex1, { color: tokens.text }]}>
                        {row.firstResponse}
                      </Text>
                      <Text style={[styles.matrixValue, styles.colFlex1, { color: tokens.text }]}>
                        {row.resolution}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              {departments.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.deptScroll}
                >
                  {departments.map((dept) => (
                    <View
                      key={dept.id}
                      style={[
                        styles.deptChip,
                        {
                          backgroundColor: tokens.surfaceSubtle,
                          borderColor: tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text style={[styles.deptName, { color: tokens.text }]}>{dept.name}</Text>
                      <Text style={[styles.deptMeta, { color: tokens.textMuted }]}>
                        {`${dept.slaResponseMinutes}m resp · ${Math.round(dept.slaResolveMinutes / 60)}h res`}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </BlurFade>

          <Hairline />

          {/* Actionable Breached & At-Risk Queue */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              ACTIONABLE SLA TRIAGE QUEUE
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.queueTabRow}
            >
              {(
                [
                  {
                    id: 'critical_queue',
                    label: `Breached & At Risk (${metrics.breached.length + metrics.atRisk.length})`,
                  },
                  { id: 'breached', label: `Breached (${metrics.breached.length})` },
                  { id: 'at_risk', label: `At Risk < 2h (${metrics.atRisk.length})` },
                  { id: 'all_active', label: `All Active (${metrics.active.length})` },
                ] as const
              ).map((tab) => {
                const active = queueFilter === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setQueueFilter(tab.id)}
                    style={[
                      styles.queueChip,
                      {
                        backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                        borderColor: active ? tokens.accent : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.queueChipText,
                        { color: active ? tokens.accent : tokens.textSecondary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {queueItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="shield" size={22} color={tokens.success} />
                <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                  Zero tickets breached or at immediate SLA risk in this view.
                </Text>
              </View>
            ) : (
              queueItems.map((t, index) => {
                const sla = formatSlaBadge(t);
                const breached = isTicketBreached(t);
                const elig = evaluateTicketReplyAccess(t, user, staffProfile);
                const custName = t.userName || t.guestName || 'Customer';

                return (
                  <AnimatedListItem key={t.id} index={index}>
                    {index > 0 ? <Hairline /> : null}
                    <View style={styles.ticketRow}>
                      <MagicAvatar
                        name={custName}
                        uri={resolveWebsiteUrl(t.userAvatar)}
                        size={36}
                      />

                      <View style={styles.ticketMain}>
                        <View style={styles.ticketTop}>
                          <View style={styles.badgeCluster}>
                            <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                              {getTicketSerial(t)}
                            </Text>
                            <FlatBadge
                              label={sla.text}
                              tone={breached ? 'danger' : 'warning'}
                              withDot
                            />
                            <FlatBadge
                              label={getStatusLabel(t.priority)}
                              tone={getPriorityTone(t.priority)}
                            />
                            <FlatBadge label={elig.shortStatusLabel} tone={elig.tone} />
                          </View>
                        </View>

                        <Text numberOfLines={1} style={[styles.ticketSubject, { color: tokens.text }]}>
                          {t.subject}
                        </Text>

                        <View style={styles.ticketBottom}>
                          <Text
                            numberOfLines={1}
                            style={[styles.customerMeta, { color: tokens.textSecondary }]}
                          >
                            {`${custName} · ${getStatusLabel(t.status)}`}
                          </Text>

                          <View style={styles.rowActions}>
                            <ShimmerButton
                              label="Peek"
                              size="xs"
                              variant="subtle"
                              leftIcon={<Feather name="eye" size={11} color={tokens.text} />}
                              onPress={() => setPeekTicket(t)}
                            />
                            {elig.requiresAccept ? (
                              <ShimmerButton
                                label="Accept"
                                size="xs"
                                variant="accent"
                                loading={acceptingId === t.id}
                                onPress={() => handleAcceptAndOpen(t)}
                              />
                            ) : (
                              <ShimmerButton
                                label="Open"
                                size="xs"
                                variant="primary"
                                onPress={() => onOpenTicket(t.id)}
                              />
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  </AnimatedListItem>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <QuickPeekModal
        visible={Boolean(peekTicket)}
        kind="ticket"
        targetId={peekTicket?.id || null}
        initialTicket={peekTicket}
        user={user}
        staffProfile={staffProfile}
        onClose={() => setPeekTicket(null)}
        onChanged={() => {
          onPulseSync?.();
          loadSlaData(true);
        }}
        onOpenFull={(kind, id) => {
          if (kind === 'ticket') onOpenTicket(id);
          else onOpenChat(id);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 16,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 14,
  },
  ringBox: {
    alignItems: 'center',
    gap: 4,
  },
  ringCaption: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  verticalSep: {
    width: 1,
    height: 48,
  },
  telemetryGrid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  telemetryItem: {
    alignItems: 'center',
    gap: 2,
  },
  telemetryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  telemetryLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  priorityName: {
    fontSize: 11,
    fontWeight: '500',
  },
  matrixTable: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  matrixHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  matrixColHead: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  colFlex12: {
    flex: 1.2,
  },
  colFlex1: {
    flex: 1,
  },
  matrixValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  deptScroll: {
    gap: 8,
    paddingTop: 2,
  },
  deptChip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
  },
  deptName: {
    fontSize: 12,
    fontWeight: '700',
  },
  deptMeta: {
    fontSize: 10.5,
  },
  queueTabRow: {
    gap: 7,
  },
  queueChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  queueChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  ticketMain: {
    flex: 1,
    gap: 4,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  serialText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ticketSubject: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  ticketBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  customerMeta: {
    fontSize: 11.5,
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
  },
});
