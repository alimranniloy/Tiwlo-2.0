import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { SupportApprovalRequest } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe, SupportTicket } from '../../types/support';
import {
  formatRelativeTime,
  formatShortDateTime,
  formatSlaBadge,
  getPriorityTone,
  getStatusLabel,
  getTicketSerial,
} from '../../utils/formatters';
import { evaluateTicketReplyAccess } from '../../utils/replyGuard';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicModalSheet,
  MagicSpinner,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from './QuickPeekModal';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type CommandTab = 'escalated' | 'approvals';
type ApprovalStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const REQUEST_TYPES: {
  id: SupportApprovalRequest['requestType'];
  label: string;
}[] = [
  { id: 'refund', label: 'Refund' },
  { id: 'credit', label: 'Store Credit' },
  { id: 'account_unlock', label: 'Account Unlock' },
  { id: 'sla_override', label: 'SLA Override' },
  { id: 'tier2_escalation', label: 'Tier-2 Escalation' },
];

function getRequestTypeLabel(type: SupportApprovalRequest['requestType']): string {
  const found = REQUEST_TYPES.find((r) => r.id === type);
  return found ? found.label : getStatusLabel(type);
}

function getApprovalStatusTone(status: SupportApprovalRequest['status']): SemanticTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function canDecideApprovals(user: AuthUser, staffProfile: StaffProfileMe): boolean {
  if (staffProfile.isSuperAdmin) return true;
  const roleStr = `${staffProfile.roleKey || ''} ${user.role || ''}`.toLowerCase();
  if (
    roleStr.includes('admin') ||
    roleStr.includes('lead') ||
    roleStr.includes('manager') ||
    roleStr.includes('supervisor') ||
    roleStr.includes('senior')
  ) {
    return true;
  }
  const perms = staffProfile.permissions || [];
  return perms.some(
    (p) =>
      p.includes('approve') ||
      p.includes('manage') ||
      p.includes('escalat') ||
      p === 'support.admin'
  );
}

export const EscalationQueueScreen: React.FC<OpsScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onOpenTicket,
  onOpenChat,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const isApprover = useMemo(
    () => canDecideApprovals(user, staffProfile),
    [staffProfile, user]
  );

  const [activeTab, setActiveTab] = useState<CommandTab>('escalated');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatusFilter>('all');

  const [escalatedTickets, setEscalatedTickets] = useState<SupportTicket[]>([]);
  const [approvals, setApprovals] = useState<SupportApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [peekTicket, setPeekTicket] = useState<SupportTicket | null>(null);

  // + Request Approval Sheet State
  const [requestSheetVisible, setRequestSheetVisible] = useState(false);
  const [reqType, setReqType] = useState<SupportApprovalRequest['requestType']>('refund');
  const [reqCustomerName, setReqCustomerName] = useState('');
  const [reqTicketSerial, setReqTicketSerial] = useState('');
  const [reqAmountLabel, setReqAmountLabel] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Lead/Admin Decision Sheet State
  const [decisionTarget, setDecisionTarget] = useState<{
    approval: SupportApprovalRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decidingBusy, setDecidingBusy] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [tRes, aRes] = await Promise.all([
          supportService.listTickets({ status: 'escalated', limit: 60 }),
          opsHubService.listApprovals('all'),
        ]);
        setEscalatedTickets(tRes.tickets || []);
        setApprovals(aRes.approvals || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load escalations & approvals.',
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
    loadData(false);
  }, [loadData]);

  const pendingApprovalsCount = useMemo(
    () => approvals.filter((a) => a.status === 'pending').length,
    [approvals]
  );

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return approvals;
    return approvals.filter((a) => a.status === approvalFilter);
  }, [approvalFilter, approvals]);

  const handleAcceptEscalated = async (ticket: SupportTicket) => {
    setAcceptingId(ticket.id);
    try {
      await stopSupportRingtone();
      await supportService.acceptTicketAssignment(ticket.id);
      showToast({ variant: 'success', label: 'Escalated ticket claimed.' });
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

  const handleCreateApproval = async () => {
    const cleanCustomer = reqCustomerName.trim();
    const cleanReason = reqReason.trim();
    if (!cleanCustomer || !cleanReason) {
      showToast({
        variant: 'danger',
        label: 'Customer name and detailed justification are required.',
      });
      return;
    }

    setSubmittingRequest(true);
    try {
      const cleanSerial = reqTicketSerial.trim();
      await opsHubService.createApprovalRequest({
        requestType: reqType,
        customerName: cleanCustomer,
        ticketSerial: cleanSerial || undefined,
        ticketId: cleanSerial ? cleanSerial.replace(/^#/, '') : undefined,
        amountLabel: reqAmountLabel.trim() || undefined,
        reason: cleanReason,
      });
      setRequestSheetVisible(false);
      setReqCustomerName('');
      setReqTicketSerial('');
      setReqAmountLabel('');
      setReqReason('');
      setActiveTab('approvals');
      showToast({ variant: 'success', label: 'Approval request submitted to leads.' });
      await loadData(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not submit approval request.',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleConfirmDecision = async () => {
    if (!decisionTarget) return;
    setDecidingBusy(true);
    try {
      await opsHubService.decideApprovalRequest(decisionTarget.approval.id, {
        decision: decisionTarget.decision,
        decisionNote: decisionNote.trim() || undefined,
      });
      showToast({
        variant: decisionTarget.decision === 'approved' ? 'success' : 'default',
        label: `Request ${decisionTarget.decision}.`,
      });
      setDecisionTarget(null);
      setDecisionNote('');
      await loadData(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not record decision.',
      });
    } finally {
      setDecidingBusy(false);
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
              <Text style={[styles.pageTitle, { color: tokens.text }]}>
                Escalations & Approvals
              </Text>
              {escalatedTickets.length > 0 || pendingApprovalsCount > 0 ? (
                <PulsatingDot color={tokens.warning} size={7} active />
              ) : null}
            </View>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${escalatedTickets.length} escalated · ${pendingApprovalsCount} pending approval`}
            </Text>
          </View>
        </View>

        <ShimmerButton
          label="+ Request Approval"
          size="xs"
          variant="accent"
          onPress={() => setRequestSheetVisible(true)}
        />
      </View>

      {/* Dual Command Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('escalated')}
          style={[
            styles.tabBtn,
            activeTab === 'escalated' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'escalated' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Escalated Tickets (${escalatedTickets.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('approvals')}
          style={[
            styles.tabBtn,
            activeTab === 'approvals' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'approvals' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Staff Approval Requests (${approvals.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Approval Sub-Filter Bar when on Tab 2 */}
      {activeTab === 'approvals' ? (
        <View style={[styles.subFilterBar, { borderBottomColor: tokens.hairline }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subFilterScroll}
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: `Pending (${pendingApprovalsCount})` },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
              ] as const
            ).map((f) => {
              const active = approvalFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setApprovalFilter(f.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? tokens.accent : tokens.textSecondary },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {loading && escalatedTickets.length === 0 && approvals.length === 0 ? (
        <MagicSpinner label="Loading escalation command queue..." />
      ) : activeTab === 'escalated' ? (
        <FlatList
          data={escalatedTickets}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadData(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="check-circle" size={22} color={tokens.success} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No escalated tickets waiting right now.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const elig = evaluateTicketReplyAccess(item, user, staffProfile);
            const sla = formatSlaBadge(item);
            const custName = item.userName || item.guestName || 'Customer';

            return (
              <AnimatedListItem index={index}>
                <View style={styles.rowWrap}>
                  <MagicAvatar
                    name={custName}
                    uri={resolveWebsiteUrl(item.userAvatar)}
                    size={38}
                  />
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <View style={styles.badgeCluster}>
                        <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                          {getTicketSerial(item)}
                        </Text>
                        <FlatBadge
                          label={`Tier ${item.escalationTier || 2}`}
                          tone="danger"
                          withDot
                        />
                        <FlatBadge
                          label={getStatusLabel(item.priority)}
                          tone={getPriorityTone(item.priority)}
                        />
                        <FlatBadge label={elig.shortStatusLabel} tone={elig.tone} />
                      </View>
                    </View>

                    <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.text }]}>
                      {item.subject}
                    </Text>

                    <View style={styles.rowFoot}>
                      <Text
                        numberOfLines={1}
                        style={[styles.metaLine, { color: tokens.textSecondary }]}
                      >
                        {`${custName} · ${sla.text} · ${formatRelativeTime(item.updatedAt)}`}
                      </Text>

                      <View style={styles.actionCluster}>
                        <ShimmerButton
                          label="Peek"
                          size="xs"
                          variant="subtle"
                          leftIcon={<Feather name="eye" size={11} color={tokens.text} />}
                          onPress={() => setPeekTicket(item)}
                        />
                        {elig.requiresAccept ? (
                          <ShimmerButton
                            label="Accept"
                            size="xs"
                            variant="accent"
                            loading={acceptingId === item.id}
                            onPress={() => handleAcceptEscalated(item)}
                          />
                        ) : (
                          <ShimmerButton
                            label="Open"
                            size="xs"
                            variant="primary"
                            onPress={() => onOpenTicket(item.id)}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </AnimatedListItem>
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredApprovals}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadData(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="shield" size={22} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No staff approval requests match this filter.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <View style={styles.approvalRow}>
                <View style={styles.rowTop}>
                  <View style={styles.badgeCluster}>
                    <FlatBadge
                      label={getRequestTypeLabel(item.requestType)}
                      tone="accent"
                    />
                    <FlatBadge
                      label={getStatusLabel(item.status)}
                      tone={getApprovalStatusTone(item.status)}
                      withDot={item.status === 'pending'}
                    />
                    {item.amountLabel ? (
                      <FlatBadge label={item.amountLabel} tone="neutral" />
                    ) : null}
                    {item.ticketSerial ? (
                      <TouchableOpacity
                        disabled={!item.ticketId}
                        onPress={() => {
                          if (item.ticketId) onOpenTicket(item.ticketId);
                        }}
                      >
                        <FlatBadge label={item.ticketSerial} tone="neutral" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>

                <Text style={[styles.rowTitle, { color: tokens.text }]}>
                  {`Customer: ${item.customerName}`}
                </Text>

                <Text style={[styles.reasonBody, { color: tokens.textSecondary }]}>
                  {item.reason}
                </Text>

                <Text style={[styles.requesterMeta, { color: tokens.textMuted }]}>
                  {`Requested by ${item.requestedByName} · ${formatShortDateTime(item.createdAt)}`}
                </Text>

                {item.status !== 'pending' && item.decidedByName ? (
                  <View
                    style={[
                      styles.decisionOutcomeStrip,
                      {
                        backgroundColor: tokens.surfaceSubtle,
                        borderColor: tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.decisionMeta, { color: tokens.text }]}>
                      {`${getStatusLabel(item.status)} by ${item.decidedByName}`}
                    </Text>
                    {item.decisionNote ? (
                      <Text style={[styles.decisionNoteText, { color: tokens.textSecondary }]}>
                        {item.decisionNote}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {item.status === 'pending' ? (
                  isApprover ? (
                    <View style={styles.decisionBtnRow}>
                      <ShimmerButton
                        label="Reject"
                        size="xs"
                        variant="danger"
                        onPress={() => {
                          setDecisionNote('');
                          setDecisionTarget({ approval: item, decision: 'rejected' });
                        }}
                      />
                      <ShimmerButton
                        label="Approve"
                        size="xs"
                        variant="accent"
                        onPress={() => {
                          setDecisionNote('');
                          setDecisionTarget({ approval: item, decision: 'approved' });
                        }}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.awaitingLeadHint, { color: tokens.warning }]}>
                      Awaiting Support Lead or Admin authorization
                    </Text>
                  )
                ) : null}
              </View>
            </AnimatedListItem>
          )}
        />
      )}

      {/* Pre-click Quick Peek Modal */}
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
          loadData(true);
        }}
        onOpenFull={(kind, id) => {
          if (kind === 'ticket') onOpenTicket(id);
          else onOpenChat(id);
        }}
      />

      {/* + Request Approval Sheet */}
      <MagicModalSheet
        visible={requestSheetVisible}
        onClose={() => setRequestSheetVisible(false)}
        title="Request Lead / Admin Approval"
        subtitle="Submit sensitive actions for supervisor sign-off"
      >
        <View style={styles.modalField}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Request Type</Text>
          <View style={styles.typeChipsWrap}>
            {REQUEST_TYPES.map((rt) => {
              const active = reqType === rt.id;
              return (
                <TouchableOpacity
                  key={rt.id}
                  onPress={() => setReqType(rt.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? tokens.accent : tokens.textSecondary },
                    ]}
                  >
                    {rt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Customer Name *"
          placeholder="e.g. Nadia Islam"
          value={reqCustomerName}
          onChangeText={setReqCustomerName}
          autoCapitalize="words"
        />

        <FlatInput
          label="Ticket Serial / ID (Optional)"
          placeholder="#TWTK-1042"
          value={reqTicketSerial}
          onChangeText={setReqTicketSerial}
        />

        {reqType === 'refund' || reqType === 'credit' ? (
          <FlatInput
            label="Amount / Credit Value"
            placeholder="e.g. $49.00 USD or ৳2,500"
            value={reqAmountLabel}
            onChangeText={setReqAmountLabel}
          />
        ) : null}

        <FlatInput
          label="Reason & Verification Notes *"
          placeholder="Summarize customer situation, order/invoice verification, and why approval is warranted..."
          value={reqReason}
          onChangeText={setReqReason}
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
        />

        <View style={styles.modalFooter}>
          <TouchableOpacity onPress={() => setRequestSheetVisible(false)} hitSlop={8}>
            <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label="Submit Approval Request"
            size="sm"
            variant="accent"
            loading={submittingRequest}
            onPress={handleCreateApproval}
          />
        </View>
      </MagicModalSheet>

      {/* Lead / Admin Approve or Reject Sheet */}
      <MagicModalSheet
        visible={Boolean(decisionTarget)}
        onClose={() => setDecisionTarget(null)}
        title={
          decisionTarget?.decision === 'approved'
            ? 'Approve Staff Request'
            : 'Reject Staff Request'
        }
        subtitle={
          decisionTarget
            ? `${getRequestTypeLabel(decisionTarget.approval.requestType)} · ${decisionTarget.approval.customerName}`
            : undefined
        }
      >
        <FlatInput
          label="Decision Note (Optional)"
          placeholder={
            decisionTarget?.decision === 'approved'
              ? 'e.g. Verified invoice #8921 — proceed with refund.'
              : 'e.g. Outside 14-day refund policy; offer store credit instead.'
          }
          value={decisionNote}
          onChangeText={setDecisionNote}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
        />

        <View style={styles.modalFooter}>
          <TouchableOpacity onPress={() => setDecisionTarget(null)} hitSlop={8}>
            <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label={
              decisionTarget?.decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'
            }
            size="sm"
            variant={decisionTarget?.decision === 'approved' ? 'accent' : 'danger'}
            loading={decidingBusy}
            onPress={handleConfirmDecision}
          />
        </View>
      </MagicModalSheet>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
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
  subFilterBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  subFilterScroll: {
    paddingHorizontal: 18,
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  serialText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  metaLine: {
    fontSize: 11.5,
    flex: 1,
  },
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalRow: {
    paddingVertical: 13,
    gap: 6,
  },
  reasonBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  requesterMeta: {
    fontSize: 11,
  },
  decisionOutcomeStrip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    marginTop: 2,
  },
  decisionMeta: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  decisionNoteText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  decisionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  awaitingLeadHint: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
