import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { opsHubService } from '../../services/opsHubService';
import { getTonePalette, useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { Customer360Detail, Customer360Summary } from '../../types/opsHub';
import type { LiveChatSession, SupportTicket } from '../../types/support';
import {
  formatRelativeTime,
  formatShortDateTime,
  getPriorityTone,
  getStatusLabel,
  getStatusTone,
  getTicketSerial,
} from '../../utils/formatters';
import {
  evaluateLiveChatReplyAccess,
  evaluateTicketReplyAccess,
} from '../../utils/replyGuard';
import {
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  NumberTicker,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from './QuickPeekModal';
import type { OpsScreenProps } from './UnifiedInboxScreen';

const SEGMENTS: {
  id: Customer360Summary['segment'];
  label: string;
  tone: SemanticTone;
}[] = [
  { id: 'standard', label: 'Standard', tone: 'neutral' },
  { id: 'vip', label: 'VIP', tone: 'accent' },
  { id: 'watchlist', label: 'Watchlist', tone: 'danger' },
];

export const CustomerProfile360Screen: React.FC<OpsScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onOpenTicket,
  onOpenChat,
  onNavigateSubScreen,
  routeParams,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const customerKey = routeParams?.customerKey || '';

  const [detail, setDetail] = useState<Customer360Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingSegment, setUpdatingSegment] = useState<string | null>(null);

  const [peekTarget, setPeekTarget] = useState<{
    kind: 'ticket' | 'livechat';
    id: string;
    ticket?: SupportTicket;
    chat?: LiveChatSession;
  } | null>(null);

  const loadCustomer = useCallback(
    async (silent = false) => {
      if (!customerKey) {
        setErrorMsg('No customer key specified.');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setErrorMsg('');
      try {
        const res = await opsHubService.getCustomer360(customerKey);
        setDetail(res);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load Customer 360 profile.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerKey]
  );

  useEffect(() => {
    loadCustomer(false);
  }, [loadCustomer]);

  const handleSelectSegment = async (nextSegment: Customer360Summary['segment']) => {
    if (!detail || detail.customer.segment === nextSegment) return;
    setUpdatingSegment(nextSegment);
    try {
      const updated = await opsHubService.updateCustomerProfileNote(detail.customer.key, {
        segment: nextSegment,
      });
      setDetail(updated);
      showToast({
        variant: 'success',
        label: `Customer segment updated to ${nextSegment.toUpperCase()}.`,
      });
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update segment.',
      });
    } finally {
      setUpdatingSegment(null);
    }
  };

  const handleAddStaffNote = async () => {
    if (!detail) return;
    const cleanNote = noteDraft.trim();
    if (!cleanNote) {
      showToast({ variant: 'danger', label: 'Write an internal note before saving.' });
      return;
    }
    setSavingNote(true);
    try {
      const updated = await opsHubService.updateCustomerProfileNote(detail.customer.key, {
        note: cleanNote,
      });
      setDetail(updated);
      setNoteDraft('');
      showToast({ variant: 'success', label: 'Internal customer note saved.' });
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to save note.',
      });
    } finally {
      setSavingNote(false);
    }
  };

  const customer = detail?.customer;
  const tickets = detail?.tickets || [];
  const chats = detail?.chats || [];
  const notes = detail?.notes || [];

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Top Bar */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View style={styles.flex1}>
            <Text numberOfLines={1} style={[styles.pageTitle, { color: tokens.text }]}>
              Customer 360
            </Text>
            <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.textMuted }]}>
              {customer?.email || customerKey || 'Unified customer dossier'}
            </Text>
          </View>
        </View>

        {customer ? (
          <ShimmerButton
            label="+ Open Ticket for Customer"
            size="xs"
            variant="accent"
            onPress={() =>
              onNavigateSubScreen('create_ticket', {
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone || undefined,
              })
            }
          />
        ) : null}
      </View>

      {loading && !detail ? (
        <MagicSpinner label="Loading Customer 360 dossier..." />
      ) : !customer ? (
        <View style={styles.errorWrap}>
          <FlatNotice
            text={errorMsg || 'Customer profile could not be found.'}
            tone="danger"
            icon="alert-circle"
          />
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={72}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadCustomer(true);
              }}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Identity Block with Circular Avatar size 48 */}
          <BlurFade delay={20} offset={6}>
            <View style={styles.identityRow}>
              <MagicAvatar
                name={customer.name || customer.email || 'Customer'}
                uri={resolveWebsiteUrl(customer.avatar)}
                size={48}
              />
              <View style={styles.identityMeta}>
                <View style={styles.nameRow}>
                  <Text style={[styles.customerName, { color: tokens.text }]}>
                    {customer.name || 'Guest Customer'}
                  </Text>
                  <FlatBadge
                    label={customer.isRegistered ? 'Registered' : 'Guest'}
                    tone={customer.isRegistered ? 'success' : 'neutral'}
                    withDot={customer.isRegistered}
                  />
                </View>
                <Text style={[styles.contactLine, { color: tokens.textSecondary }]}>
                  {customer.email || 'No email recorded'}
                </Text>
                {customer.phone ? (
                  <Text style={[styles.contactLine, { color: tokens.textMuted }]}>
                    {customer.phone}
                  </Text>
                ) : null}
                <Text style={[styles.activityMeta, { color: tokens.textMuted }]}>
                  {`Last active ${formatRelativeTime(customer.lastActivityAt) || formatShortDateTime(customer.lastActivityAt)}`}
                </Text>
              </View>
            </View>
          </BlurFade>

          {/* Segment Selector (Standard | VIP | Watchlist) */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              ACCOUNT SEGMENT
            </Text>
            <View style={styles.segmentRow}>
              {SEGMENTS.map((seg) => {
                const active = customer.segment === seg.id;
                const palette = getTonePalette(tokens, seg.tone);
                return (
                  <TouchableOpacity
                    key={seg.id}
                    disabled={updatingSegment !== null}
                    onPress={() => handleSelectSegment(seg.id)}
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: active ? palette.bg : tokens.surfaceSubtle,
                        borderColor: active ? palette.fg : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        { color: active ? palette.fg : tokens.textSecondary },
                      ]}
                    >
                      {updatingSegment === seg.id ? `${seg.label}...` : seg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* KPI Strip */}
          <View
            style={[
              styles.kpiStrip,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.kpiItem}>
              <NumberTicker
                value={customer.ticketsCount}
                style={[styles.kpiNum, { color: tokens.text }]}
              />
              <Text style={[styles.kpiText, { color: tokens.textMuted }]}>Total Tickets</Text>
            </View>
            <View style={[styles.kpiSep, { backgroundColor: tokens.hairlineStrong }]} />
            <View style={styles.kpiItem}>
              <NumberTicker
                value={customer.openTicketsCount}
                style={[
                  styles.kpiNum,
                  { color: customer.openTicketsCount > 0 ? tokens.warning : tokens.text },
                ]}
              />
              <Text style={[styles.kpiText, { color: tokens.textMuted }]}>Open</Text>
            </View>
            <View style={[styles.kpiSep, { backgroundColor: tokens.hairlineStrong }]} />
            <View style={styles.kpiItem}>
              <NumberTicker
                value={customer.chatsCount}
                style={[styles.kpiNum, { color: tokens.accent }]}
              />
              <Text style={[styles.kpiText, { color: tokens.textMuted }]}>Live Chats</Text>
            </View>
          </View>

          <Hairline />

          {/* Internal Staff Notes on Customer */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              {`INTERNAL STAFF NOTES (${notes.length})`}
            </Text>

            <View style={styles.noteComposer}>
              <FlatInput
                placeholder="Add private staff context (billing nuances, preferences, verification notes)..."
                value={noteDraft}
                onChangeText={setNoteDraft}
                multiline
                numberOfLines={3}
                autoCapitalize="sentences"
              />
              <View style={styles.noteBtnRow}>
                <ShimmerButton
                  label="Add Staff Note"
                  size="xs"
                  variant="primary"
                  loading={savingNote}
                  leftIcon={<Feather name="plus" size={12} color={tokens.inkButtonText} />}
                  onPress={handleAddStaffNote}
                />
              </View>
            </View>

            {notes.length === 0 ? (
              <Text style={[styles.emptyInline, { color: tokens.textMuted }]}>
                No internal notes recorded for this customer yet.
              </Text>
            ) : (
              <View
                style={[
                  styles.notesList,
                  {
                    backgroundColor: tokens.surfaceSubtle,
                    borderColor: tokens.hairlineStrong,
                  },
                ]}
              >
                {notes.map((n, idx) => (
                  <React.Fragment key={n.id || `note-${idx}`}>
                    {idx > 0 ? <Hairline /> : null}
                    <View style={styles.noteItem}>
                      <View style={styles.noteItemTop}>
                        <Text style={[styles.noteAuthor, { color: tokens.text }]}>
                          {n.authorName || 'Staff'}
                        </Text>
                        <Text style={[styles.noteTime, { color: tokens.textMuted }]}>
                          {formatShortDateTime(n.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.noteBody, { color: tokens.textSecondary }]}>
                        {n.body}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>

          <Hairline />

          {/* Clickable Ticket History */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                {`TICKET HISTORY (${tickets.length})`}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  onNavigateSubScreen('create_ticket', {
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone || undefined,
                  })
                }
                hitSlop={8}
              >
                <Text style={[styles.inlineActionLink, { color: tokens.accent }]}>
                  + Create Ticket
                </Text>
              </TouchableOpacity>
            </View>

            {tickets.length === 0 ? (
              <Text style={[styles.emptyInline, { color: tokens.textMuted }]}>
                No support tickets associated with this customer.
              </Text>
            ) : (
              tickets.map((t, idx) => {
                const elig = evaluateTicketReplyAccess(t, user, staffProfile);
                return (
                  <React.Fragment key={t.id}>
                    {idx > 0 ? <Hairline /> : null}
                    <TouchableOpacity
                      activeOpacity={0.68}
                      onPress={() => onOpenTicket(t.id)}
                      style={styles.historyRow}
                    >
                      <View style={styles.historyMain}>
                        <View style={styles.historyTop}>
                          <Text style={[styles.serialCode, { color: tokens.textMuted }]}>
                            {getTicketSerial(t)}
                          </Text>
                          <FlatBadge
                            label={getStatusLabel(t.status)}
                            tone={getStatusTone(t.status)}
                          />
                          <FlatBadge
                            label={getStatusLabel(t.priority)}
                            tone={getPriorityTone(t.priority)}
                          />
                          <FlatBadge label={elig.shortStatusLabel} tone={elig.tone} />
                        </View>
                        <Text numberOfLines={1} style={[styles.historyTitle, { color: tokens.text }]}>
                          {t.subject}
                        </Text>
                        <Text style={[styles.historyTime, { color: tokens.textMuted }]}>
                          {formatShortDateTime(t.updatedAt || t.createdAt)}
                        </Text>
                      </View>
                      <BorderlessIconButton
                        name="eye"
                        size={16}
                        color={tokens.textSecondary}
                        accessibilityLabel={`Peek ${getTicketSerial(t)}`}
                        onPress={() =>
                          setPeekTarget({ kind: 'ticket', id: t.id, ticket: t })
                        }
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })
            )}
          </View>

          <Hairline />

          {/* Clickable Live Chat History */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              {`LIVE CHAT HISTORY (${chats.length})`}
            </Text>

            {chats.length === 0 ? (
              <Text style={[styles.emptyInline, { color: tokens.textMuted }]}>
                No live chat sessions recorded for this customer.
              </Text>
            ) : (
              chats.map((c, idx) => {
                const elig = evaluateLiveChatReplyAccess(c, user, staffProfile);
                return (
                  <React.Fragment key={c.id}>
                    {idx > 0 ? <Hairline /> : null}
                    <TouchableOpacity
                      activeOpacity={0.68}
                      onPress={() => onOpenChat(c.id)}
                      style={styles.historyRow}
                    >
                      <View style={styles.historyMain}>
                        <View style={styles.historyTop}>
                          <Text style={[styles.serialCode, { color: tokens.textMuted }]}>
                            {c.chatNumber || `#${c.id.slice(0, 6)}`}
                          </Text>
                          <FlatBadge
                            label={getStatusLabel(c.status)}
                            tone={getStatusTone(c.status)}
                          />
                          <FlatBadge label={elig.shortStatusLabel} tone={elig.tone} />
                        </View>
                        <Text numberOfLines={1} style={[styles.historyTitle, { color: tokens.text }]}>
                          {c.topic || c.lastMessage || 'Live Chat Session'}
                        </Text>
                        <Text style={[styles.historyTime, { color: tokens.textMuted }]}>
                          {formatShortDateTime(c.lastMessageAt || c.createdAt)}
                        </Text>
                      </View>
                      <BorderlessIconButton
                        name="eye"
                        size={16}
                        color={tokens.textSecondary}
                        accessibilityLabel={`Peek chat ${c.chatNumber || c.id}`}
                        onPress={() =>
                          setPeekTarget({ kind: 'livechat', id: c.id, chat: c })
                        }
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })
            )}
          </View>
        </KeyboardAwareScrollView>
      )}

      <QuickPeekModal
        visible={Boolean(peekTarget)}
        kind={peekTarget?.kind || 'ticket'}
        targetId={peekTarget?.id || null}
        initialTicket={peekTarget?.ticket || null}
        initialChat={peekTarget?.chat || null}
        user={user}
        staffProfile={staffProfile}
        onClose={() => setPeekTarget(null)}
        onChanged={() => {
          onPulseSync?.();
          loadCustomer(true);
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
  flex1: {
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
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  errorWrap: {
    padding: 18,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  identityMeta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  contactLine: {
    fontSize: 12.5,
  },
  activityMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  segmentBlock: {
    gap: 7,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  kpiSep: {
    width: 1,
    height: 26,
  },
  kpiNum: {
    fontSize: 17,
    fontWeight: '700',
  },
  kpiText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineActionLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteComposer: {
    gap: 8,
  },
  noteBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  notesList: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  noteItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  noteItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteTime: {
    fontSize: 11,
  },
  noteBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  emptyInline: {
    fontSize: 12.5,
    paddingVertical: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
  },
  historyMain: {
    flex: 1,
    gap: 4,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  serialCode: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  historyTime: {
    fontSize: 11,
  },
});
