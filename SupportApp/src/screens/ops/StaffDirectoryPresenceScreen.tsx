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
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type {
  AuthUser,
  LiveChatCounts,
  LiveChatPresence,
  StaffMetricRow,
  StaffProfileMe,
  SupportAgent,
} from '../../types/support';
import { formatDurationMs } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  MagicSwitch,
  NumberTicker,
  PulsatingDot,
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

const MAX_CHAT_CAPACITY = 5;

function formatRoleTag(raw?: string | null): string {
  if (!raw) return 'Support Specialist';
  return raw
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StaffDirectoryPresenceScreen: React.FC<OpsScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onNavigateSubScreen,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [selfOnline, setSelfOnline] = useState(true);

  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [metrics, setMetrics] = useState<StaffMetricRow[]>([]);
  const [presence, setPresence] = useState<LiveChatPresence | null>(null);
  const [chatCounts, setChatCounts] = useState<LiveChatCounts | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadDirectory = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [agentsRes, liveRes, metricsRes] = await Promise.all([
          supportService.getAgents(),
          supportService.listLiveChats({ status: 'waiting' }),
          supportService.getStaffMetrics('all'),
        ]);

        const nextAgents = agentsRes.agents || [];
        const nextMetrics = metricsRes.staffMetrics || [];
        setAgents(nextAgents);
        setMetrics(nextMetrics);
        setPresence(liveRes.presence || null);
        setChatCounts(liveRes.counts || null);

        const meAgent = nextAgents.find((a) => String(a.id) === String(user.id));
        const meMetric = nextMetrics.find((m) => String(m.staffId) === String(user.id));
        if (meAgent?.isOnline !== undefined) {
          setSelfOnline(Boolean(meAgent.isOnline));
        } else if (meMetric?.isOnline !== undefined) {
          setSelfOnline(Boolean(meMetric.isOnline));
        }
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load staff presence.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, user.id]
  );

  useEffect(() => {
    loadDirectory(false);
  }, [loadDirectory]);

  const handleToggleSelfPresence = async (next: boolean) => {
    const prev = selfOnline;
    setSelfOnline(next);
    setPresenceBusy(true);
    try {
      await supportService.updatePresence(next);
      onPulseSync?.();
      toast.show({
        variant: 'success',
        label: next ? 'You are now Online for routing' : 'Status switched to Away',
      });
      loadDirectory(true);
    } catch (err) {
      setSelfOnline(prev);
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update presence.',
      });
    } finally {
      setPresenceBusy(false);
    }
  };

  const mergedRoster = useMemo(() => {
    const metricById = new Map<string, StaffMetricRow>();
    for (const row of metrics) {
      metricById.set(String(row.staffId), row);
    }

    const seen = new Set<string>();
    const list: {
      id: string;
      name: string;
      email: string;
      avatar: string | null | undefined;
      roleKey: string;
      roleLabel: string;
      department: string;
      isOnline: boolean;
      activeChats: number;
      closedChats: number;
      firstResponseAvgMs?: number;
      csatAverage?: number | null;
    }[] = [];

    for (const agent of agents) {
      const id = String(agent.id);
      seen.add(id);
      const metric = metricById.get(id);
      const isMe = id === String(user.id);
      const online = isMe
        ? selfOnline
        : Boolean(agent.isOnline ?? metric?.isOnline ?? false);
      const rawRole = agent.roleKey || agent.role || (isMe ? staffProfile.roleKey : 'support_agent');
      list.push({
        id,
        name: agent.name || metric?.staffName || 'Specialist',
        email: agent.email || (isMe ? user.email : ''),
        avatar: agent.avatar ?? (isMe ? user.avatar : null),
        roleKey: String(rawRole).toLowerCase(),
        roleLabel: agent.roleLabel || formatRoleTag(rawRole),
        department: formatRoleTag(metric?.category || 'General Support'),
        isOnline: online,
        activeChats: Number(metric?.activeChats ?? 0),
        closedChats: Number(metric?.closedChats ?? 0),
        firstResponseAvgMs: metric?.firstResponseAvgMs,
        csatAverage: metric?.csatAverage,
      });
    }

    for (const metric of metrics) {
      const id = String(metric.staffId);
      if (seen.has(id)) continue;
      const isMe = id === String(user.id);
      list.push({
        id,
        name: metric.staffName || 'Specialist',
        email: isMe ? user.email : '',
        avatar: isMe ? user.avatar : null,
        roleKey: isMe ? staffProfile.roleKey.toLowerCase() : 'support_agent',
        roleLabel: isMe ? formatRoleTag(staffProfile.roleKey) : 'Support Specialist',
        department: formatRoleTag(metric.category || 'General Support'),
        isOnline: isMe ? selfOnline : Boolean(metric.isOnline),
        activeChats: Number(metric.activeChats ?? 0),
        closedChats: Number(metric.closedChats ?? 0),
        firstResponseAvgMs: metric.firstResponseAvgMs,
        csatAverage: metric.csatAverage,
      });
    }

    return list.sort((a, b) => {
      if (a.id === String(user.id)) return -1;
      if (b.id === String(user.id)) return 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.activeChats - a.activeChats;
    });
  }, [agents, metrics, selfOnline, staffProfile.roleKey, user.avatar, user.email, user.id]);

  const roleTabs = useMemo(() => {
    const uniqueRoles = new Map<string, string>();
    for (const member of mergedRoster) {
      if (!uniqueRoles.has(member.roleKey)) {
        uniqueRoles.set(member.roleKey, member.roleLabel);
      }
    }
    return [
      { key: 'all', label: `All (${mergedRoster.length})` },
      {
        key: 'online_only',
        label: `Online (${mergedRoster.filter((m) => m.isOnline).length})`,
      },
      ...Array.from(uniqueRoles.entries()).map(([key, label]) => ({ key, label })),
    ];
  }, [mergedRoster]);

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedRoster.filter((item) => {
      if (roleFilter === 'online_only' && !item.isOnline) return false;
      if (roleFilter !== 'all' && roleFilter !== 'online_only' && item.roleKey !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.roleLabel.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q)
      );
    });
  }, [mergedRoster, roleFilter, searchQuery]);

  const computedOnline =
    presence?.onlineAgentsCount ?? mergedRoster.filter((m) => m.isOnline).length;
  const computedAvailable =
    presence?.freeAgentsCount ??
    mergedRoster.filter((m) => m.isOnline && m.activeChats < MAX_CHAT_CAPACITY).length;
  const computedBusy =
    presence?.busyAgentsCount ??
    mergedRoster.filter((m) => m.isOnline && m.activeChats > 0).length;
  const waitingQueue = chatCounts?.waiting ?? 0;

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
            Team Directory & Presence
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Live specialist availability & active desk load
          </Text>
        </View>
        <ShimmerButton
          label="Leaderboard"
          size="xs"
          variant="subtle"
          onPress={() => onNavigateSubScreen('agent_leaderboard')}
        />
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
              loadDirectory(true);
            }}
          />
        }
      >
        {/* Self Online / Away Quick Strip */}
        <BlurFade delay={0} offset={5}>
          <View
            style={[
              styles.selfStrip,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <MagicAvatar
              name={user.name}
              uri={resolveWebsiteUrl(user.avatar)}
              size={36}
              online={selfOnline}
            />
            <View style={styles.flex1}>
              <View style={styles.selfTitleRow}>
                <Text numberOfLines={1} style={[styles.selfName, { color: tokens.text }]}>
                  {user.name}
                </Text>
                <FlatBadge
                  label={selfOnline ? 'Online' : 'Away'}
                  tone={selfOnline ? 'success' : 'warning'}
                  withDot
                />
              </View>
              <Text numberOfLines={1} style={[styles.selfHint, { color: tokens.textMuted }]}>
                {selfOnline
                  ? 'Receiving live chat & ticket routing alerts'
                  : 'Paused from automatic live chat queue'}
              </Text>
            </View>
            <MagicSwitch
              value={selfOnline}
              disabled={presenceBusy}
              onValueChange={handleToggleSelfPresence}
            />
          </View>
        </BlurFade>

        {/* Online / Available / Busy / Queue KPI Strip */}
        <BlurFade delay={40} offset={6}>
          <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
            <View style={styles.kpiCell}>
              <View style={styles.kpiLabelRow}>
                <PulsatingDot color={tokens.success} size={6} active={computedOnline > 0} />
                <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>ONLINE</Text>
              </View>
              <NumberTicker
                value={computedOnline}
                style={[styles.kpiNum, { color: tokens.text }]}
              />
            </View>

            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>AVAILABLE</Text>
              <NumberTicker
                value={computedAvailable}
                style={[styles.kpiNum, { color: tokens.accent }]}
              />
            </View>

            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>BUSY</Text>
              <NumberTicker
                value={computedBusy}
                style={[styles.kpiNum, { color: tokens.warning }]}
              />
            </View>

            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />

            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>WAITING</Text>
              <NumberTicker
                value={waitingQueue}
                style={[
                  styles.kpiNum,
                  { color: waitingQueue > 0 ? tokens.danger : tokens.text },
                ]}
              />
            </View>
          </View>
        </BlurFade>

        {/* Search & Role Filter */}
        <View style={styles.filterBlock}>
          <FlatInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search specialist name, email, role or desk..."
            leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
            rightSlot={
              searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Feather name="x" size={14} color={tokens.textMuted} />
                </TouchableOpacity>
              ) : undefined
            }
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roleTabRow}
          >
            {roleTabs.map((tab) => {
              const active = roleFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.7}
                  onPress={() => setRoleFilter(tab.key)}
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
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Hairline />

        {/* Specialist Roster */}
        {loading && mergedRoster.length === 0 ? (
          <MagicSpinner label="Syncing specialist presence..." />
        ) : filteredRoster.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No specialists match the current search or role filter.
          </Text>
        ) : (
          <View style={styles.rosterList}>
            {filteredRoster.map((member, idx) => {
              const isMe = member.id === String(user.id);
              const loadRatio = Math.min(1, member.activeChats / MAX_CHAT_CAPACITY);
              const barColor =
                loadRatio >= 0.8
                  ? tokens.danger
                  : loadRatio >= 0.5
                    ? tokens.warning
                    : tokens.accent;

              return (
                <AnimatedListItem key={member.id} index={idx}>
                  <View style={[styles.memberRow, { borderBottomColor: tokens.hairline }]}>
                    <View style={styles.memberTop}>
                      <MagicAvatar
                        name={member.name}
                        uri={resolveWebsiteUrl(member.avatar)}
                        size={38}
                        online={member.isOnline}
                      />

                      <View style={styles.flex1}>
                        <View style={styles.nameLine}>
                          <Text
                            numberOfLines={1}
                            style={[styles.memberName, { color: tokens.text }]}
                          >
                            {member.name}
                          </Text>
                          {isMe ? <FlatBadge label="You" tone="accent" /> : null}
                        </View>
                        {member.email ? (
                          <Text
                            numberOfLines={1}
                            style={[styles.memberEmail, { color: tokens.textMuted }]}
                          >
                            {member.email}
                          </Text>
                        ) : null}

                        <View style={styles.tagRow}>
                          <FlatBadge label={member.roleLabel} tone="accent" />
                          <FlatBadge label={member.department} tone="neutral" />
                          {member.csatAverage !== null && member.csatAverage !== undefined ? (
                            <FlatBadge
                              label={`${Number(member.csatAverage).toFixed(1)}★`}
                              tone="success"
                            />
                          ) : null}
                        </View>
                      </View>

                      <FlatBadge
                        label={member.isOnline ? 'Online' : 'Offline'}
                        tone={member.isOnline ? 'success' : 'neutral'}
                        withDot
                      />
                    </View>

                    {/* Active Workload Bar */}
                    <View style={styles.workloadWrap}>
                      <View style={styles.workloadLabels}>
                        <Text style={[styles.workloadMeta, { color: tokens.textSecondary }]}>
                          {`Active load: ${member.activeChats} / ${MAX_CHAT_CAPACITY} chats`}
                        </Text>
                        <Text style={[styles.workloadMeta, { color: tokens.textMuted }]}>
                          {`${member.closedChats} closed · FRT ${formatDurationMs(member.firstResponseAvgMs)}`}
                        </Text>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: tokens.surfaceMuted }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(member.activeChats > 0 ? 12 : 0, Math.round(loadRatio * 100))}%`,
                              backgroundColor: barColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                </AnimatedListItem>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default StaffDirectoryPresenceScreen;

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
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  selfStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  selfTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  selfName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  selfHint: {
    fontSize: 11.5,
    marginTop: 2,
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
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiNum: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  vSep: {
    width: 1,
    height: 28,
  },
  filterBlock: {
    gap: 9,
  },
  roleTabRow: {
    gap: 7,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 28,
  },
  rosterList: {
    gap: 2,
  },
  memberRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 9,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  memberEmail: {
    fontSize: 11.5,
    marginTop: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  workloadWrap: {
    gap: 5,
    paddingLeft: 49,
  },
  workloadLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  workloadMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
