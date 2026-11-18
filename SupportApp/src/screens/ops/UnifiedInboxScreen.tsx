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
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, ReplyEligibility } from '../../types/opsHub';
import type {
  AuthUser,
  LiveChatSession,
  StaffProfileMe,
  SupportTicket,
} from '../../types/support';
import {
  formatRelativeTime,
  formatSlaBadge,
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
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from './QuickPeekModal';

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

type StreamFilterTab =
  | 'all'
  | 'needs_accept'
  | 'can_reply'
  | 'unable'
  | 'livechat'
  | 'ticket';

interface UnifiedStreamItem {
  key: string;
  kind: 'ticket' | 'livechat';
  id: string;
  serialOrCode: string;
  customerName: string;
  customerSub: string;
  avatarUrl: string;
  title: string;
  snippet: string;
  status: string;
  priority?: string;
  timestamp: string;
  sortMs: number;
  eligibility: ReplyEligibility;
  ticket?: SupportTicket;
  chat?: LiveChatSession;
}

const STREAM_TABS: { id: StreamFilterTab; label: string }[] = [
  { id: 'all', label: 'All Stream' },
  { id: 'needs_accept', label: 'Needs Accept' },
  { id: 'can_reply', label: 'Can Reply' },
  { id: 'unable', label: 'Unable / Locked' },
  { id: 'livechat', label: 'Live Chats' },
  { id: 'ticket', label: 'Tickets' },
];

function getEligibilityBadgeLabel(elig: ReplyEligibility): string {
  if (elig.canReply) return 'Can Reply';
  if (elig.requiresAccept) return 'Accept to Reply';
  if (elig.shortStatusLabel.toLowerCase().includes('closed')) return 'Unable · Closed';
  return elig.shortStatusLabel.startsWith('Unable') ? elig.shortStatusLabel : 'Unable · Locked';
}

export const UnifiedInboxScreen: React.FC<OpsScreenProps> = ({
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

  const [activeTab, setActiveTab] = useState<StreamFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [chats, setChats] = useState<LiveChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [peekTarget, setPeekTarget] = useState<{
    kind: 'ticket' | 'livechat';
    id: string;
    ticket?: SupportTicket;
    chat?: LiveChatSession;
  } | null>(null);

  const loadStream = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const q = searchQuery.trim() || undefined;
        const [ticketRes, chatRes] = await Promise.all([
          supportService.listTickets({ q, limit: 60 }),
          supportService.listLiveChats({ q }),
        ]);
        setTickets(ticketRes.tickets || []);
        setChats(chatRes.chats || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load omnichannel stream.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, showToast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStream(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [loadStream]);

  const mergedStream = useMemo<UnifiedStreamItem[]>(() => {
    const ticketItems: UnifiedStreamItem[] = tickets.map((t) => {
      const elig = evaluateTicketReplyAccess(t, user, staffProfile);
      const ts = t.updatedAt || t.createdAt;
      const parsedMs = Date.parse(ts);
      return {
        key: `ticket:${t.id}`,
        kind: 'ticket',
        id: t.id,
        serialOrCode: getTicketSerial(t),
        customerName: t.userName || t.guestName || 'Customer',
        customerSub: t.userEmail || t.guestEmail || t.department || 'Support',
        avatarUrl: resolveWebsiteUrl(t.userAvatar),
        title: t.subject || 'Untitled Ticket',
        snippet: t.lastMessage || t.description || 'No message preview available.',
        status: t.status,
        priority: t.priority,
        timestamp: ts,
        sortMs: Number.isNaN(parsedMs) ? 0 : parsedMs,
        eligibility: elig,
        ticket: t,
      };
    });

    const chatItems: UnifiedStreamItem[] = chats.map((c) => {
      const elig = evaluateLiveChatReplyAccess(c, user, staffProfile);
      const ts = c.lastMessageAt || c.createdAt || '';
      const parsedMs = Date.parse(ts);
      return {
        key: `livechat:${c.id}`,
        kind: 'livechat',
        id: c.id,
        serialOrCode: c.chatNumber || `#${c.id.slice(0, 6)}`,
        customerName: c.guestName || 'Live Visitor',
        customerSub: c.guestEmail || c.department || 'Live Web',
        avatarUrl: resolveWebsiteUrl(c.userAvatar),
        title: c.topic || 'Live Chat Session',
        snippet: c.lastMessage || 'Visitor waiting in live queue.',
        status: c.status,
        timestamp: ts,
        sortMs: Number.isNaN(parsedMs) ? 0 : parsedMs,
        eligibility: elig,
        chat: c,
      };
    });

    return [...chatItems, ...ticketItems].sort((a, b) => b.sortMs - a.sortMs);
  }, [chats, staffProfile, tickets, user]);

  const tabCounts = useMemo<Record<StreamFilterTab, number>>(() => {
    let needsAccept = 0;
    let canReply = 0;
    let unable = 0;
    let livechat = 0;
    let ticket = 0;

    for (const item of mergedStream) {
      if (item.kind === 'livechat') livechat += 1;
      else ticket += 1;

      if (item.eligibility.canReply) canReply += 1;
      else if (item.eligibility.requiresAccept) needsAccept += 1;
      else unable += 1;
    }

    return {
      all: mergedStream.length,
      needs_accept: needsAccept,
      can_reply: canReply,
      unable,
      livechat,
      ticket,
    };
  }, [mergedStream]);

  const filteredStream = useMemo<UnifiedStreamItem[]>(() => {
    switch (activeTab) {
      case 'needs_accept':
        return mergedStream.filter((i) => i.eligibility.requiresAccept);
      case 'can_reply':
        return mergedStream.filter((i) => i.eligibility.canReply);
      case 'unable':
        return mergedStream.filter(
          (i) => !i.eligibility.canReply && !i.eligibility.requiresAccept
        );
      case 'livechat':
        return mergedStream.filter((i) => i.kind === 'livechat');
      case 'ticket':
        return mergedStream.filter((i) => i.kind === 'ticket');
      case 'all':
      default:
        return mergedStream;
    }
  }, [activeTab, mergedStream]);

  const handleInlineAccept = async (item: UnifiedStreamItem) => {
    setBusyKey(`${item.key}:accept`);
    try {
      await stopSupportRingtone();
      if (item.kind === 'ticket') {
        await supportService.acceptTicketAssignment(item.id);
        showToast({ variant: 'success', label: 'Ticket accepted & unlocked.' });
        onPulseSync?.();
        onOpenTicket(item.id);
      } else {
        await supportService.acceptLiveChat(item.id);
        showToast({ variant: 'success', label: 'Live chat accepted.' });
        onPulseSync?.();
        onOpenChat(item.id);
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Accept failed.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleInlineCancel = async (item: UnifiedStreamItem) => {
    setBusyKey(`${item.key}:cancel`);
    try {
      await stopSupportRingtone();
      if (item.kind === 'ticket') {
        await supportService.cancelTicketAssignment(item.id);
      } else {
        await supportService.cancelLiveChat(item.id);
      }
      showToast({ variant: 'default', label: `${item.serialOrCode} dismissed.` });
      onPulseSync?.();
      await loadStream(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Dismiss failed.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRowPress = (item: UnifiedStreamItem) => {
    if (item.eligibility.requiresAccept) {
      setPeekTarget({
        kind: item.kind,
        id: item.id,
        ticket: item.ticket,
        chat: item.chat,
      });
      return;
    }
    if (!item.eligibility.canReply && item.eligibility.unableReason) {
      showToast({ variant: 'default', label: item.eligibility.unableReason });
    }
    stopSupportRingtone().catch(() => {});
    if (item.kind === 'ticket') {
      onOpenTicket(item.id);
    } else {
      onOpenChat(item.id);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Flat Subscreen Header */}
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
              <Text style={[styles.pageTitle, { color: tokens.text }]}>Unified Inbox</Text>
              {tabCounts.needs_accept > 0 ? (
                <PulsatingDot color={tokens.warning} size={7} active />
              ) : null}
            </View>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${tabCounts.all} omnichannel · ${tabCounts.needs_accept} awaiting accept`}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <BorderlessIconButton
            name="refresh-cw"
            size={18}
            onPress={() => loadStream(false)}
            accessibilityLabel="Refresh inbox"
          />
          <ShimmerButton
            label="+ Ticket"
            size="xs"
            variant="accent"
            onPress={() => onNavigateSubScreen('create_ticket')}
          />
        </View>
      </View>

      {/* Search Field */}
      <View style={styles.searchWrap}>
        <FlatInput
          placeholder="Search customer, serial, topic, or email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
          rightSlot={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={tokens.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      {/* Segmented Filter Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {STREAM_TABS.map((tab) => {
            const active = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {`${tab.label} (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Chronological Omnichannel Stream */}
      {loading && mergedStream.length === 0 ? (
        <MagicSpinner label="Merging tickets & live chats..." />
      ) : (
        <FlatList
          data={filteredStream}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadStream(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={22} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No conversations match this triage filter.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const sla = item.ticket ? formatSlaBadge(item.ticket) : null;
            const badgeLabel = getEligibilityBadgeLabel(item.eligibility);
            const isOnlineChat =
              item.kind === 'livechat' &&
              (item.status === 'waiting' || item.status === 'active');

            return (
              <AnimatedListItem index={index}>
                <TouchableOpacity
                  activeOpacity={0.68}
                  onPress={() => handleRowPress(item)}
                  style={styles.streamRow}
                >
                  <MagicAvatar
                    name={item.customerName}
                    uri={item.avatarUrl}
                    size={38}
                    online={isOnlineChat}
                  />

                  <View style={styles.rowBody}>
                    {/* Top Row: Channel Tag + Serial + Pre-click Eligibility + Peek Eye */}
                    <View style={styles.rowTop}>
                      <View style={styles.channelCluster}>
                        <FlatBadge
                          label={item.kind === 'livechat' ? 'Live Chat' : 'Ticket'}
                          tone={item.kind === 'livechat' ? 'accent' : 'neutral'}
                        />
                        <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                          {item.serialOrCode}
                        </Text>
                        <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                          {formatRelativeTime(item.timestamp)}
                        </Text>
                      </View>

                      <View style={styles.rightTopCluster}>
                        <FlatBadge
                          label={badgeLabel}
                          tone={item.eligibility.tone}
                          withDot={item.eligibility.canReply}
                        />
                        <BorderlessIconButton
                          name="eye"
                          size={16}
                          color={tokens.textSecondary}
                          accessibilityLabel={`Quick peek ${item.serialOrCode}`}
                          onPress={() =>
                            setPeekTarget({
                              kind: item.kind,
                              id: item.id,
                              ticket: item.ticket,
                              chat: item.chat,
                            })
                          }
                        />
                      </View>
                    </View>

                    {/* Title & Customer */}
                    <Text numberOfLines={1} style={[styles.titleText, { color: tokens.text }]}>
                      {item.title}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={[styles.snippetText, { color: tokens.textSecondary }]}
                    >
                      {`${item.customerName} · ${item.snippet}`}
                    </Text>

                    {/* Bottom Meta & Inline Unclaimed Accept/Cancel */}
                    <View style={styles.rowFooter}>
                      <View style={styles.metaBadges}>
                        <FlatBadge
                          label={getStatusLabel(item.status)}
                          tone={getStatusTone(item.status)}
                        />
                        {item.priority ? (
                          <FlatBadge
                            label={getStatusLabel(item.priority)}
                            tone={getPriorityTone(item.priority)}
                          />
                        ) : null}
                        {sla ? (
                          <Text
                            style={[
                              styles.slaLabel,
                              { color: sla.breached ? tokens.danger : tokens.textMuted },
                            ]}
                          >
                            {sla.text}
                          </Text>
                        ) : null}
                      </View>

                      {item.eligibility.requiresAccept ? (
                        <View style={styles.inlineClaimActions}>
                          <ShimmerButton
                            label="Cancel"
                            variant="subtle"
                            size="xs"
                            loading={busyKey === `${item.key}:cancel`}
                            disabled={busyKey !== null}
                            onPress={() => handleInlineCancel(item)}
                          />
                          <ShimmerButton
                            label="Accept"
                            variant="accent"
                            size="xs"
                            loading={busyKey === `${item.key}:accept`}
                            disabled={busyKey !== null}
                            onPress={() => handleInlineAccept(item)}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            );
          }}
        />
      )}

      {/* Pre-Click Quick Peek Modal */}
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
          loadStream(true);
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 18,
    gap: 16,
  },
  tabItem: {
    paddingVertical: 9,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  streamRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  channelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  rightTopCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serialText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 17,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  metaBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  slaLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineClaimActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
