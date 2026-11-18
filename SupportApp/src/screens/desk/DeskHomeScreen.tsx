import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SITE_CONFIG, resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type {
  AuthUser,
  LiveChatCounts,
  LiveChatPresence,
  LiveChatSession,
  StaffProfileMe,
  SupportAgent,
  SupportOverview,
  SupportTabKey,
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
import { SupportLogo } from '../../components/common/SupportLogo';
import {
  AnimatedCircularProgress,
  AnimatedListItem,
  AnimatedShinyText,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  MagicSwitch,
  NumberTicker,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from '../ops/QuickPeekModal';

interface DeskHomeScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onNavigateTab: (tab: SupportTabKey, presetTicketQueue?: string) => void;
  onNavigateSubScreen?: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  onOpenTicket: (ticketId: string) => void;
  onOpenChat: (chatId: string) => void;
  onWaitingCountChange?: (count: number) => void;
  onPulseSync?: () => void;
}

function isTicketAcceptedBySomeone(t: SupportTicket): boolean {
  return String(t.assignmentStatus || '').toLowerCase() === 'accepted' && Boolean(t.assignedAgentId);
}

function isClosedTicket(t: SupportTicket): boolean {
  return t.status === 'closed' || t.status === 'resolved';
}

function getGreetingPrefix(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

export const DeskHomeScreen: React.FC<DeskHomeScreenProps> = ({
  user,
  staffProfile,
  onNavigateTab,
  onNavigateSubScreen,
  onOpenTicket,
  onOpenChat,
  onWaitingCountChange,
  onPulseSync,
}) => {
  const { theme, tokens, toggleTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [presenceBusy, setPresenceBusy] = useState(false);

  const [overview, setOverview] = useState<SupportOverview | null>(null);
  const [waitingChats, setWaitingChats] = useState<LiveChatSession[]>([]);
  const [myActiveChats, setMyActiveChats] = useState<LiveChatSession[]>([]);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [chatCounts, setChatCounts] = useState<LiveChatCounts | null>(null);
  const [presence, setPresence] = useState<LiveChatPresence | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [pendingAcceptTickets, setPendingAcceptTickets] = useState<SupportTicket[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [peekTarget, setPeekTarget] = useState<{
    kind: 'ticket' | 'livechat';
    id: string;
    ticket?: SupportTicket | null;
    chat?: LiveChatSession | null;
  } | null>(null);

  const loadPulse = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [ovRes, waitingRes, activeChatsRes, assignedRes, agentsRes] = await Promise.all([
          supportService.getOverview(),
          supportService.listLiveChats({ status: 'waiting' }),
          supportService.listLiveChats({ status: 'active', mine: true }).catch(() => ({
            chats: [] as LiveChatSession[],
          })),
          supportService.listTickets({ assignedAgentId: user.id, limit: 20 }),
          supportService.getAgents().catch(() => ({ agents: [] as SupportAgent[] })),
        ]);

        setOverview(ovRes.overview || null);
        setWaitingChats(waitingRes.chats || []);
        setChatCounts(waitingRes.counts || null);
        setPresence(waitingRes.presence || null);
        onWaitingCountChange?.(waitingRes.counts?.waiting ?? (waitingRes.chats || []).length);

        const activeMine = (activeChatsRes.chats || []).filter(
          (c) => c.status === 'active' && String(c.assignedAgentId || '') === String(user.id)
        );
        setMyActiveChats(activeMine);
        setAgents(agentsRes.agents || []);

        const allMine = assignedRes.tickets || [];
        const pending = allMine.filter(
          (t) =>
            (t.assignmentStatus === 'pending' || t.assignmentStatus === 'pending_acceptance') &&
            t.pendingAssigneeId === user.id
        );
        setPendingAcceptTickets(pending);

        const ongoingMine = allMine.filter(
          (t) =>
            !isClosedTicket(t) &&
            isTicketAcceptedBySomeone(t) &&
            String(t.assignedAgentId || '') === String(user.id)
        );
        setMyTickets(ongoingMine);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Could not load dashboard metrics.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onWaitingCountChange, toast, user.id]
  );

  useEffect(() => {
    loadPulse(false);
    const interval = setInterval(() => {
      loadPulse(true);
    }, Math.max(5000, SITE_CONFIG.livePollIntervalMs));
    return () => clearInterval(interval);
  }, [loadPulse]);

  const handleTogglePresence = async (next: boolean) => {
    setPresenceBusy(true);
    try {
      await supportService.updatePresence(next);
      setIsOnline(next);
      toast.show({
        variant: 'success',
        label: next ? 'Status set to Online' : 'Status set to Away',
      });
      loadPulse(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to update status.',
      });
    } finally {
      setPresenceBusy(false);
    }
  };

  const handleAcceptChat = async (chatId: string) => {
    setBusyId(chatId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptLiveChat(chatId);
      setWaitingChats((prev) => prev.filter((c) => c.id !== chatId));
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Live chat accepted.' });
      onOpenChat(chatId);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to accept chat.',
      });
      loadPulse(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelChat = async (chatId: string) => {
    setBusyId(chatId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelLiveChat(chatId);
      setWaitingChats((prev) => prev.filter((c) => c.id !== chatId));
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Chat removed from your queue.' });
      loadPulse(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to cancel chat.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptTicketAssignment(ticketId);
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Ticket accepted & locked to you.' });
      await loadPulse(true);
      onOpenTicket(ticketId);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept ticket.',
      });
      loadPulse(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelTicketAssignment(ticketId);
      setPendingAcceptTickets((prev) => prev.filter((t) => t.id !== ticketId));
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              recentTickets: (prev.recentTickets || []).filter((t) => t.id !== ticketId),
            }
          : prev
      );
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Ticket dismissed from your dashboard.' });
      loadPulse(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not dismiss ticket.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const csatNumeric =
    overview?.csatAverage !== null && overview?.csatAverage !== undefined
      ? Number(overview.csatAverage)
      : 0;
  const csatLabel =
    overview?.csatAverage !== null && overview?.csatAverage !== undefined
      ? csatNumeric.toFixed(1)
      : '—';
  const slaHealthPct =
    overview?.slaRatePct !== undefined
      ? Number(overview.slaRatePct)
      : overview?.totalTickets
        ? Math.max(
            0,
            Math.round(((overview.totalTickets - (overview.slaBreachedCount || 0)) / overview.totalTickets) * 100)
          )
        : 100;

  const waitingTotal = (overview?.unacceptedCount ?? 0) + (chatCounts?.waiting ?? waitingChats.length);
  const myActiveTotal =
    (overview?.myActiveCount ?? myTickets.length) + (chatCounts?.myActive ?? myActiveChats.length);

  const byStatus = overview?.byStatus || {};
  const pipelineSegments = [
    { key: 'open', label: 'Open', count: Number(byStatus.open || 0), color: '#2563EB' },
    { key: 'in_progress', label: 'In Progress', count: Number(byStatus.in_progress || 0), color: '#16A34A' },
    { key: 'waiting_customer', label: 'Waiting', count: Number(byStatus.waiting_customer || 0), color: '#D97706' },
    { key: 'escalated', label: 'Escalated', count: Number(byStatus.escalated || 0), color: '#DC2626' },
    { key: 'resolved', label: 'Resolved', count: Number(byStatus.resolved || 0), color: '#64748B' },
  ];
  const pipelineTotal = pipelineSegments.reduce((sum, s) => sum + s.count, 0);

  const firstName = (user.name || 'Specialist').trim().split(/\s+/)[0];
  const avatarUri = resolveWebsiteUrl(user.avatar);
  const shinyStatus =
    waitingTotal > 0
      ? `${waitingTotal} conversation${waitingTotal === 1 ? '' : 's'} waiting pickup now`
      : 'All live support channels operating smoothly';

  const quickShortcuts: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    color: string;
    onPress: () => void;
  }[] = [
    {
      label: 'All Stream',
      icon: 'layers',
      color: tokens.accent,
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('unified_inbox') : onNavigateTab('tickets', 'all'),
    },
    {
      label: 'New Ticket',
      icon: 'plus-circle',
      color: '#2563EB',
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('create_ticket') : onNavigateTab('tickets', 'all'),
    },
    {
      label: 'AI Lab',
      icon: 'cpu',
      color: tokens.accent,
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('ai_playground') : onNavigateTab('tools'),
    },
    {
      label: 'KB Docs',
      icon: 'book-open',
      color: '#7C3AED',
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('kb_hub') : onNavigateTab('tools'),
    },
    {
      label: 'SLA Radar',
      icon: 'clock',
      color: tokens.danger,
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('sla_command') : onNavigateTab('tickets', 'sla'),
    },
    {
      label: 'Handover',
      icon: 'repeat',
      color: '#0D9488',
      onPress: () =>
        onNavigateSubScreen ? onNavigateSubScreen('shift_handover') : onNavigateTab('tools'),
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: tokens.bg }]}
      contentContainerStyle={styles.scrollBody}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.accent}
          onRefresh={() => {
            setRefreshing(true);
            loadPulse(true);
            onPulseSync?.();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Flat Brand Header Row */}
      <BlurFade delay={0} offset={5}>
        <View style={styles.headerRow}>
          <SupportLogo variant="land" width={98} height={27} style={{ alignSelf: 'flex-start' }} />

          <View style={styles.headerRight}>
            <BorderlessIconButton
              name={theme === 'dark' ? 'sun' : 'moon'}
              size={18}
              onPress={toggleTheme}
              accessibilityLabel="Toggle theme"
            />
            <TouchableOpacity activeOpacity={0.7} onPress={() => onNavigateTab('settings')}>
              <MagicAvatar name={user.name} uri={avatarUri} size={32} online={isOnline} />
            </TouchableOpacity>
          </View>
        </View>
      </BlurFade>

      {/* Personalized Greeting + Live AnimatedShinyText Status */}
      <BlurFade delay={35} offset={6}>
        <View style={styles.identityStrip}>
          <View style={styles.identityLeft}>
            <Text numberOfLines={1} style={[styles.staffName, { color: tokens.text }]}>
              {`${getGreetingPrefix()}, ${firstName}`}
            </Text>
            <AnimatedShinyText style={styles.shinySubtitle}>{shinyStatus}</AnimatedShinyText>
            <View style={styles.presenceSub}>
              <PulsatingDot
                color={isOnline ? tokens.accent : tokens.warning}
                size={7}
                active={isOnline}
              />
              <Text style={[styles.presenceText, { color: tokens.textMuted }]}>
                {isOnline ? 'Online' : 'Away'} · {presence?.onlineAgentsCount ?? 0} online ·{' '}
                {presence?.freeAgentsCount ?? 0} available
              </Text>
            </View>
          </View>

          <MagicSwitch
            value={isOnline}
            disabled={presenceBusy}
            onValueChange={handleTogglePresence}
          />
        </View>
      </BlurFade>

      {/* Urgent Incoming Call/Alert Strip */}
      {waitingTotal > 0 ? (
        <BlurFade delay={55} offset={4}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              onNavigateTab(
                waitingChats.length > 0 ? 'livechat' : 'tickets',
                waitingChats.length > 0 ? undefined : 'unassigned'
              )
            }
            style={[styles.urgentBanner, { backgroundColor: tokens.dangerSoft || tokens.warningSoft }]}
          >
            <PulsatingDot color="#EF4444" size={8} active />
            <Text numberOfLines={1} style={[styles.urgentText, { color: tokens.danger || tokens.warning }]}>
              {`${waitingTotal} unaccepted request${waitingTotal > 1 ? 's' : ''} — rings every 5m until accepted`}
            </Text>
            <Feather name="chevron-right" size={15} color={tokens.danger || tokens.warning} />
          </TouchableOpacity>
        </BlurFade>
      ) : null}

      <Hairline />

      {loading && !overview ? (
        <MagicSpinner label="Loading desk workspace..." />
      ) : (
        <>
          {/* Borderless 4-Cell Flat Operational KPI Grid */}
          <BlurFade delay={80} offset={6}>
            <View style={styles.kpiSection}>
              <View style={styles.kpiRow}>
                <TouchableOpacity
                  style={styles.kpiCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('tickets', 'open')}
                >
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>OPEN</Text>
                  <NumberTicker
                    value={overview?.openCount ?? 0}
                    style={[styles.kpiValue, { color: tokens.text }]}
                  />
                  <Text style={[styles.kpiFoot, { color: tokens.textMuted }]}>
                    of {overview?.totalTickets ?? 0}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

                <TouchableOpacity
                  style={styles.kpiCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('tickets', 'unassigned')}
                >
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>NEEDS ACCEPT</Text>
                  <NumberTicker
                    value={overview?.unacceptedCount ?? overview?.unassignedCount ?? 0}
                    style={[
                      styles.kpiValue,
                      {
                        color:
                          (overview?.unacceptedCount ?? overview?.unassignedCount ?? 0) > 0
                            ? '#EF4444'
                            : tokens.text,
                      },
                    ]}
                  />
                  <Text style={[styles.kpiFoot, { color: tokens.textMuted }]}>Unclaimed</Text>
                </TouchableOpacity>

                <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

                <TouchableOpacity
                  style={styles.kpiCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('livechat')}
                >
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>LIVE WAIT</Text>
                  <NumberTicker
                    value={chatCounts?.waiting ?? waitingChats.length}
                    style={[
                      styles.kpiValue,
                      {
                        color:
                          (chatCounts?.waiting ?? waitingChats.length) > 0
                            ? tokens.accent
                            : tokens.text,
                      },
                    ]}
                  />
                  <Text style={[styles.kpiFoot, { color: tokens.textMuted }]}>Queue</Text>
                </TouchableOpacity>

                <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

                <TouchableOpacity
                  style={styles.kpiCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('tickets', 'mine')}
                >
                  <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>MY DESK</Text>
                  <NumberTicker
                    value={myActiveTotal}
                    style={[styles.kpiValue, { color: tokens.accent }]}
                  />
                  <Text style={[styles.kpiFoot, { color: tokens.textMuted }]}>Active</Text>
                </TouchableOpacity>
              </View>

              <Hairline />

              {/* Dual Progress Gauges: SLA Health + CSAT Score */}
              <View style={styles.kpiRowBottom}>
                <TouchableOpacity
                  style={styles.gaugeCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('tickets', 'sla')}
                >
                  <AnimatedCircularProgress
                    value={slaHealthPct}
                    max={100}
                    size={42}
                    strokeWidth={4}
                    label={`${slaHealthPct}%`}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>SLA HEALTH</Text>
                    <Text style={[styles.kpiFoot, { color: (overview?.slaBreachedCount ?? 0) > 0 ? tokens.danger : tokens.textMuted }]}>
                      {overview?.slaBreachedCount ?? 0} breached
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

                <TouchableOpacity
                  style={styles.gaugeCell}
                  activeOpacity={0.65}
                  onPress={() => onNavigateTab('tools')}
                >
                  <AnimatedCircularProgress
                    value={csatNumeric}
                    max={5}
                    size={42}
                    strokeWidth={4}
                    label={csatLabel}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>CSAT SCORE</Text>
                    <Text numberOfLines={1} style={[styles.kpiFoot, { color: tokens.textMuted }]}>
                      {overview?.csatResponses ?? 0} surveys · {staffProfile.roleKey}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </BlurFade>

          {/* Ticket Pipeline Breakdown Bar */}
          {pipelineTotal > 0 ? (
            <View style={styles.pipelineBlock}>
              <View style={styles.pipelineTrack}>
                {pipelineSegments
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <View
                      key={s.key}
                      style={{
                        flex: s.count,
                        height: 4,
                        backgroundColor: s.color,
                      }}
                    />
                  ))}
              </View>
              <View style={styles.pipelineLegend}>
                {pipelineSegments
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={[styles.legendText, { color: tokens.textMuted }]}>
                        {`${s.label} ${s.count}`}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}

          <Hairline />

          {/* Borderless Horizontal Quick Shortcuts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutRow}
          >
            {quickShortcuts.map((sc) => (
              <TouchableOpacity
                key={sc.label}
                activeOpacity={0.65}
                onPress={sc.onPress}
                style={styles.shortcutItem}
              >
                <View style={[styles.shortcutCircle, { backgroundColor: tokens.surfaceMuted }]}>
                  <Feather name={sc.icon} size={15} color={sc.color} />
                </View>
                <Text style={[styles.shortcutLabel, { color: tokens.textSecondary }]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Hairline strong />

          {/* My Active Conversations — Quick Resume */}
          {myActiveChats.length > 0 || myTickets.length > 0 ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <PulsatingDot color={tokens.accent} size={6} active />
                    <Text style={[styles.sectionTitle, { color: tokens.text }]}>
                      My Active Conversations
                    </Text>
                  </View>
                  <FlatBadge label={`${myActiveChats.length + myTickets.length}`} tone="success" />
                </View>

                {myActiveChats.slice(0, 3).map((chat, idx) => (
                  <AnimatedListItem key={`mychat-${chat.id}`} index={idx}>
                    <TouchableOpacity
                      style={[styles.listRow, { borderBottomColor: tokens.hairline }]}
                      activeOpacity={0.7}
                      onPress={() => onOpenChat(chat.id)}
                    >
                      <MagicAvatar
                        name={chat.guestName || 'Visitor'}
                        uri={resolveWebsiteUrl(chat.userAvatar)}
                        size={36}
                      />
                      <View style={styles.listRowBody}>
                        <View style={styles.rowTitleLine}>
                          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.text }]}>
                            {chat.guestName || 'Guest Visitor'}
                          </Text>
                          <FlatBadge label="Live Chat" tone="success" withDot />
                        </View>
                        <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textMuted }]}>
                          {chat.topic || chat.lastMessage || 'Active session'}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={tokens.accent} />
                    </TouchableOpacity>
                  </AnimatedListItem>
                ))}

                {myTickets.slice(0, 3).map((t, idx) => (
                  <AnimatedListItem key={`mytkt-${t.id}`} index={idx}>
                    <TouchableOpacity
                      style={[styles.listRow, { borderBottomColor: tokens.hairline }]}
                      activeOpacity={0.7}
                      onPress={() => onOpenTicket(t.id)}
                    >
                      <MagicAvatar
                        name={t.userName || t.guestName || 'Requester'}
                        uri={resolveWebsiteUrl(t.userAvatar)}
                        size={36}
                      />
                      <View style={styles.listRowBody}>
                        <View style={styles.rowTitleLine}>
                          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.text }]}>
                            {t.subject}
                          </Text>
                          <FlatBadge
                            label={getStatusLabel(t.status)}
                            tone={getStatusTone(t.status)}
                            withDot
                          />
                        </View>
                        <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textMuted }]}>
                          {`${t.userName || t.guestName || 'Requester'} · ${getTicketSerial(t)}`}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={tokens.textMuted} />
                    </TouchableOpacity>
                  </AnimatedListItem>
                ))}
              </View>
              <Hairline />
            </>
          ) : null}

          {/* Pending Direct Assignments */}
          {pendingAcceptTickets.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <PulsatingDot color={tokens.warning} size={6} />
                  <Text style={[styles.sectionTitle, { color: tokens.text }]}>
                    Assigned To You
                  </Text>
                </View>
                <FlatBadge label={`${pendingAcceptTickets.length}`} tone="warning" />
              </View>

              {pendingAcceptTickets.map((t, idx) => (
                <AnimatedListItem key={t.id} index={idx}>
                  <View style={[styles.listRow, { borderBottomColor: tokens.hairline }]}>
                    <MagicAvatar
                      name={t.userName || t.guestName || 'Requester'}
                      uri={resolveWebsiteUrl(t.userAvatar)}
                      size={36}
                    />
                    <View style={styles.listRowBody}>
                      <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                        {getTicketSerial(t)}
                      </Text>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.text }]}>
                        {t.subject}
                      </Text>
                      <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textMuted }]}>
                        {t.userName || t.guestName || 'Requester'}
                      </Text>
                    </View>
                    <View style={styles.acceptCancelPair}>
                      <ShimmerButton
                        label="Accept"
                        size="xs"
                        variant="accent"
                        loading={busyId === t.id}
                        onPress={() => handleAcceptTicket(t.id)}
                      />
                      <ShimmerButton
                        label="Cancel"
                        size="xs"
                        variant="subtle"
                        disabled={busyId === t.id}
                        onPress={() => handleCancelTicket(t.id)}
                      />
                    </View>
                  </View>
                </AnimatedListItem>
              ))}
            </View>
          ) : null}

          {/* Waiting Live Chats — Must Accept or Cancel Before Entering */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <PulsatingDot
                  color={waitingChats.length > 0 ? '#EF4444' : tokens.textMuted}
                  size={6}
                  active={waitingChats.length > 0}
                />
                <Text style={[styles.sectionTitle, { color: tokens.text }]}>
                  Waiting Live Chats
                </Text>
              </View>
              <TouchableOpacity onPress={() => onNavigateTab('livechat')} hitSlop={8}>
                <Text style={[styles.sectionAction, { color: tokens.accent }]}>View all</Text>
              </TouchableOpacity>
            </View>

            {waitingChats.length === 0 ? (
              <Text style={[styles.emptyHint, { color: tokens.textMuted }]}>
                Queue clear — no visitors waiting right now.
              </Text>
            ) : (
              waitingChats.slice(0, 4).map((chat, idx) => {
                const chatReplyAccess = evaluateLiveChatReplyAccess(chat, user, staffProfile);
                return (
                  <AnimatedListItem key={chat.id} index={idx}>
                    <TouchableOpacity
                      style={[styles.listRow, { borderBottomColor: tokens.hairline }]}
                      activeOpacity={0.75}
                      onPress={() =>
                        setPeekTarget({ kind: 'livechat', id: chat.id, chat })
                      }
                    >
                      <MagicAvatar
                        name={chat.guestName || 'Visitor'}
                        uri={resolveWebsiteUrl(chat.userAvatar)}
                        size={38}
                      />
                      <View style={styles.listRowBody}>
                        <View style={styles.rowTitleLine}>
                          <Text numberOfLines={1} style={[styles.rowTitle, { color: tokens.text }]}>
                            {chat.guestName || 'Guest Visitor'}
                          </Text>
                          <FlatBadge
                            label={chatReplyAccess.shortStatusLabel}
                            tone={chatReplyAccess.tone}
                          />
                        </View>
                        <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textMuted }]}>
                          {`${chat.topic || chat.lastMessage || 'Support chat request'} · ${formatRelativeTime(chat.createdAt || chat.lastMessageAt)}`}
                        </Text>
                      </View>
                      <BorderlessIconButton
                        name="eye"
                        size={15}
                        color={tokens.textMuted}
                        accessibilityLabel="Peek waiting chat"
                        onPress={() => setPeekTarget({ kind: 'livechat', id: chat.id, chat })}
                      />
                      <View style={styles.acceptCancelPair}>
                        <ShimmerButton
                          label="Accept"
                          size="xs"
                          variant="accent"
                          loading={busyId === chat.id}
                          onPress={() => handleAcceptChat(chat.id)}
                        />
                        <ShimmerButton
                          label="Cancel"
                          size="xs"
                          variant="subtle"
                          disabled={busyId === chat.id}
                          onPress={() => handleCancelChat(chat.id)}
                        />
                      </View>
                    </TouchableOpacity>
                  </AnimatedListItem>
                );
              })
            )}
          </View>

          <Hairline />

          {/* Recent Tickets — With Circular Profile Avatar & Accept | Cancel Gate */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: tokens.text }]}>Recent Tickets</Text>
              <TouchableOpacity onPress={() => onNavigateTab('tickets', 'all')} hitSlop={8}>
                <Text style={[styles.sectionAction, { color: tokens.accent }]}>Open queue</Text>
              </TouchableOpacity>
            </View>

            {(overview?.recentTickets || []).length === 0 ? (
              <Text style={[styles.emptyHint, { color: tokens.textMuted }]}>
                No tickets in your visible queue.
              </Text>
            ) : (
              (overview?.recentTickets || []).slice(0, 6).map((ticket, idx) => {
                const sla = formatSlaBadge(ticket);
                const accepted = isTicketAcceptedBySomeone(ticket);
                const closed = isClosedTicket(ticket);
                const needsAccept = !closed && !accepted;
                const replyAccess = evaluateTicketReplyAccess(ticket, user, staffProfile);

                return (
                  <AnimatedListItem key={ticket.id} index={idx}>
                    <TouchableOpacity
                      style={[styles.ticketRowWithAvatar, { borderBottomColor: tokens.hairline }]}
                      activeOpacity={0.7}
                      onLongPress={() => setPeekTarget({ kind: 'ticket', id: ticket.id, ticket })}
                      onPress={() => {
                        if (needsAccept) {
                          setPeekTarget({ kind: 'ticket', id: ticket.id, ticket });
                          return;
                        }
                        onOpenTicket(ticket.id);
                      }}
                    >
                      <View style={{ paddingTop: 2 }}>
                        <MagicAvatar
                          name={ticket.userName || ticket.guestName || 'Requester'}
                          uri={resolveWebsiteUrl(ticket.userAvatar)}
                          size={38}
                        />
                      </View>

                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.ticketTop}>
                          <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                            {getTicketSerial(ticket)} ·{' '}
                            {formatRelativeTime(ticket.updatedAt || ticket.createdAt)}
                          </Text>
                          <View style={styles.badgePair}>
                            <FlatBadge
                              label={replyAccess.shortStatusLabel}
                              tone={replyAccess.tone}
                            />
                            <FlatBadge
                              label={getStatusLabel(ticket.status)}
                              tone={getStatusTone(ticket.status)}
                              withDot
                            />
                            <FlatBadge
                              label={ticket.priority.toUpperCase()}
                              tone={getPriorityTone(ticket.priority)}
                            />
                          </View>
                        </View>

                        <Text numberOfLines={2} style={[styles.rowTitle, { color: tokens.text }]}>
                          {ticket.subject}
                        </Text>

                        <View style={styles.ticketFoot}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text numberOfLines={1} style={[styles.rowSub, { color: tokens.textMuted }]}>
                              {ticket.userName || ticket.guestName || 'Guest'}
                              {ticket.assignedAgentName
                                ? ` · ${ticket.assignedAgentName}`
                                : ' · Needs acceptance'}
                            </Text>
                            <View style={styles.slaRight}>
                              {sla.breached ? (
                                <Feather name="alert-circle" size={11} color={tokens.danger} />
                              ) : null}
                              <Text
                                style={[
                                  styles.slaLabel,
                                  { color: sla.breached ? tokens.danger : tokens.textMuted },
                                ]}
                              >
                                {sla.text}
                              </Text>
                            </View>
                          </View>

                          <BorderlessIconButton
                            name="eye"
                            size={15}
                            color={tokens.textMuted}
                            accessibilityLabel="Peek ticket"
                            onPress={() => setPeekTarget({ kind: 'ticket', id: ticket.id, ticket })}
                          />

                          {needsAccept ? (
                            <View style={styles.acceptCancelPair}>
                              <ShimmerButton
                                label="Accept"
                                size="xs"
                                variant="accent"
                                loading={busyId === ticket.id}
                                onPress={() => handleAcceptTicket(ticket.id)}
                              />
                              <ShimmerButton
                                label="Cancel"
                                size="xs"
                                variant="subtle"
                                disabled={busyId === ticket.id}
                                onPress={() => handleCancelTicket(ticket.id)}
                              />
                            </View>
                          ) : (
                            <Feather name="chevron-right" size={16} color={tokens.textMuted} />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </AnimatedListItem>
                );
              })
            )}
          </View>

          {/* Live Support Team Strip */}
          {agents.length > 0 ? (
            <>
              <Hairline />
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: tokens.text }]}>Support Team</Text>
                  <Text style={[styles.kpiFoot, { color: tokens.textMuted }]}>
                    {`${presence?.onlineAgentsCount ?? 0} online now`}
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.teamRow}
                >
                  {agents.slice(0, 10).map((ag) => (
                    <View key={ag.id} style={styles.teamMember}>
                      <MagicAvatar
                        name={ag.name}
                        uri={resolveWebsiteUrl(ag.avatar)}
                        size={36}
                        online={Boolean(ag.isOnline)}
                      />
                      <Text numberOfLines={1} style={[styles.teamName, { color: tokens.text }]}>
                        {ag.name.split(' ')[0]}
                      </Text>
                      <Text numberOfLines={1} style={[styles.teamRole, { color: tokens.textMuted }]}>
                        {ag.roleLabel || 'Specialist'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null}
        </>
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
        onOpenFull={(kind, id) => {
          setPeekTarget(null);
          if (kind === 'livechat') onOpenChat(id);
          else onOpenTicket(id);
        }}
        onChanged={() => {
          loadPulse(true);
          onPulseSync?.();
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityLeft: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  shinySubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  presenceSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  presenceText: {
    fontSize: 11.5,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  urgentText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiSection: {
    gap: 10,
    paddingVertical: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  kpiRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    gap: 8,
  },
  kpiCell: {
    flex: 1,
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  gaugeCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  vSep: {
    width: 1,
    marginVertical: 4,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  kpiFoot: {
    fontSize: 10.5,
  },
  pipelineBlock: {
    gap: 6,
  },
  pipelineTrack: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 2,
  },
  pipelineLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  shortcutRow: {
    gap: 18,
    paddingVertical: 2,
  },
  shortcutItem: {
    alignItems: 'center',
    gap: 5,
    minWidth: 56,
  },
  shortcutCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 12.5,
    paddingVertical: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  listRowBody: {
    flex: 1,
    gap: 2,
  },
  acceptCancelPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowSub: {
    fontSize: 12,
    flexShrink: 1,
  },
  timeText: {
    fontSize: 10.5,
  },
  serialText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ticketRowWithAvatar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  slaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slaLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  teamRow: {
    gap: 16,
    paddingVertical: 6,
  },
  teamMember: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  teamName: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  teamRole: {
    fontSize: 10,
  },
});
