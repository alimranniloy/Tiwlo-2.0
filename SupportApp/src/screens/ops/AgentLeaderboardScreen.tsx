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
import {
  getWorkspacePreferences,
  updateWorkspacePreferences,
} from '../../services/preferencesService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type {
  AuthUser,
  StaffMetricRow,
  StaffProfileMe,
  SupportAgent,
} from '../../types/support';
import { formatDurationMs } from '../../utils/formatters';
import {
  AnimatedCircularProgress,
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  MagicAvatar,
  MagicSpinner,
  NumberTicker,
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

type SortKey = 'resolved' | 'speed' | 'csat';

export const AgentLeaderboardScreen: React.FC<OpsScreenProps> = ({
  user,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<StaffMetricRow[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [dailyGoal, setDailyGoal] = useState(15);
  const [sortBy, setSortBy] = useState<SortKey>('resolved');

  const loadLeaderboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [metricsRes, prefs, agentsRes] = await Promise.all([
          supportService.getStaffMetrics('all'),
          getWorkspacePreferences(),
          supportService.getAgents().catch(() => ({ agents: [] as SupportAgent[] })),
        ]);
        setMetrics(metricsRes.staffMetrics || []);
        setDailyGoal(Math.max(1, Number(prefs.dailyResolvedGoal || 15)));
        setAgents(agentsRes.agents || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load leaderboard.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadLeaderboard(false);
  }, [loadLeaderboard]);

  const adjustDailyGoal = async (delta: number) => {
    const next = Math.max(5, Math.min(100, dailyGoal + delta));
    setDailyGoal(next);
    await updateWorkspacePreferences({ dailyResolvedGoal: next }).catch(() => {});
  };

  const avatarByStaffId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const ag of agents) {
      map.set(String(ag.id), ag.avatar || null);
    }
    return map;
  }, [agents]);

  const rankedList = useMemo(() => {
    return [...metrics].sort((a, b) => {
      if (sortBy === 'speed') {
        const aMs = Number(a.avgResponseMs ?? a.firstResponseAvgMs ?? 999999999);
        const bMs = Number(b.avgResponseMs ?? b.firstResponseAvgMs ?? 999999999);
        return aMs - bMs;
      }
      if (sortBy === 'csat') {
        const aCsat = Number(a.csatAverage ?? -1);
        const bCsat = Number(b.csatAverage ?? -1);
        if (bCsat !== aCsat) return bCsat - aCsat;
      }
      const aHandled = Number(a.closedChats ?? 0) + Number(a.chatsAccepted ?? 0);
      const bHandled = Number(b.closedChats ?? 0) + Number(b.chatsAccepted ?? 0);
      return bHandled - aHandled;
    });
  }, [metrics, sortBy]);

  const myMetric = useMemo(
    () => metrics.find((m) => String(m.staffId) === String(user.id)) || null,
    [metrics, user.id]
  );

  const myHandled = Number(myMetric?.closedChats ?? myMetric?.chatsAccepted ?? 0);
  const goalPct = Math.min(100, Math.round((myHandled / Math.max(1, dailyGoal)) * 100));

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
            Specialist Leaderboard
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Personal daily target, response velocity & CSAT rank
          </Text>
        </View>
        <BorderlessIconButton
          name="refresh-cw"
          size={17}
          onPress={() => loadLeaderboard(false)}
          accessibilityLabel="Refresh leaderboard"
        />
      </View>

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
              loadLeaderboard(true);
            }}
          />
        }
      >
        {/* Personal Daily Goal Progress Ring */}
        <BlurFade delay={0} offset={6}>
          <View
            style={[
              styles.goalHero,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <AnimatedCircularProgress
              value={myHandled}
              max={Math.max(1, dailyGoal)}
              size={64}
              strokeWidth={6}
              label={`${goalPct}%`}
            />

            <View style={styles.flex1}>
              <Text style={[styles.goalTitle, { color: tokens.text }]}>
                Personal Daily Goal
              </Text>
              <View style={styles.goalStatRow}>
                <NumberTicker
                  value={myHandled}
                  style={[styles.goalBigNum, { color: tokens.accent }]}
                />
                <Text style={[styles.goalSlash, { color: tokens.textMuted }]}>
                  {`/ ${dailyGoal} resolved`}
                </Text>
              </View>
              <Text style={[styles.goalHint, { color: tokens.textMuted }]}>
                {myHandled >= dailyGoal
                  ? 'Daily resolution target achieved!'
                  : `${Math.max(0, dailyGoal - myHandled)} more to hit today's target`}
              </Text>
            </View>

            <View style={styles.goalStepper}>
              <TouchableOpacity
                onPress={() => adjustDailyGoal(-5)}
                style={[styles.stepBtn, { borderColor: tokens.hairlineStrong }]}
                hitSlop={6}
              >
                <Text style={[styles.stepText, { color: tokens.text }]}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustDailyGoal(5)}
                style={[styles.stepBtn, { borderColor: tokens.hairlineStrong }]}
                hitSlop={6}
              >
                <Text style={[styles.stepText, { color: tokens.text }]}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurFade>

        {/* Sort Selector */}
        <View style={[styles.sortBar, { borderBottomColor: tokens.hairline }]}>
          {(
            [
              { key: 'resolved', label: 'Most Handled' },
              { key: 'speed', label: 'Fastest Reply' },
              { key: 'csat', label: 'Highest CSAT' },
            ] as const
          ).map((tab) => {
            const active = sortBy === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSortBy(tab.key)}
                style={[
                  styles.sortTab,
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
        </View>

        {/* Ranked Specialist Leaderboard */}
        {loading && rankedList.length === 0 ? (
          <MagicSpinner label="Ranking specialist metrics..." />
        ) : rankedList.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No specialist performance telemetry recorded yet.
          </Text>
        ) : (
          rankedList.map((row, idx) => {
            const rank = idx + 1;
            const isMe = String(row.staffId) === String(user.id);
            const rawAvatar =
              avatarByStaffId.get(String(row.staffId)) ?? (isMe ? user.avatar : null);
            const handledCount =
              Number(row.closedChats ?? 0) + Number(row.activeChats ?? 0);
            const medianReplyMs = row.avgResponseMs ?? row.firstResponseAvgMs;
            const flagged = Number(row.flaggedSamplesCount ?? 0);

            return (
              <AnimatedListItem key={row.staffId} index={idx}>
                <View style={[styles.rankRow, { borderBottomColor: tokens.hairline }]}>
                  <View
                    style={[
                      styles.rankBadge,
                      {
                        backgroundColor:
                          rank <= 3 ? tokens.accentSoft : tokens.surfaceMuted,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: rank <= 3 ? tokens.accent : tokens.textMuted,
                      }}
                    >
                      {`#${rank}`}
                    </Text>
                  </View>

                  <MagicAvatar
                    name={row.staffName || 'Specialist'}
                    uri={resolveWebsiteUrl(rawAvatar)}
                    size={38}
                    online={Boolean(row.isOnline)}
                  />

                  <View style={styles.flex1}>
                    <View style={styles.nameLine}>
                      <Text
                        numberOfLines={1}
                        style={[styles.staffName, { color: tokens.text }]}
                      >
                        {row.staffName}
                      </Text>
                      {isMe ? <FlatBadge label="You" tone="accent" /> : null}
                      {rank === 1 ? (
                        <Feather name="award" size={13} color={tokens.accent} />
                      ) : null}
                    </View>

                    <View style={styles.statsStrip}>
                      <Text style={[styles.statItem, { color: tokens.textSecondary }]}>
                        {`${row.closedChats ?? 0} closed · ${handledCount} handled`}
                      </Text>
                      <Text style={[styles.statSep, { color: tokens.textMuted }]}>·</Text>
                      <Text style={[styles.statItem, { color: tokens.textSecondary }]}>
                        {`Reply ${formatDurationMs(medianReplyMs)}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rightBadges}>
                    {row.csatAverage !== null && row.csatAverage !== undefined ? (
                      <FlatBadge
                        label={`${Number(row.csatAverage).toFixed(1)}★`}
                        tone="success"
                      />
                    ) : (
                      <FlatBadge label="No CSAT" tone="neutral" />
                    )}
                    {flagged > 0 ? (
                      <FlatBadge
                        label={`${flagged} flag${flagged > 1 ? 's' : ''}`}
                        tone="danger"
                      />
                    ) : (
                      <Text style={[styles.cleanFlag, { color: tokens.textMuted }]}>
                        0 flags
                      </Text>
                    )}
                  </View>
                </View>
              </AnimatedListItem>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default AgentLeaderboardScreen;

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
  goalHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  goalTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  goalStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  goalBigNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalSlash: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  goalHint: {
    fontSize: 11,
    marginTop: 2,
  },
  goalStepper: {
    gap: 6,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sortBar: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
  },
  sortTab: {
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rankBadge: {
    minWidth: 28,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  statItem: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  statSep: {
    fontSize: 11.5,
  },
  rightBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cleanFlag: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
