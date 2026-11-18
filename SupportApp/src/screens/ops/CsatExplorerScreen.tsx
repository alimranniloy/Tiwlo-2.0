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
import { supportService } from '../../services/supportService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe, SupportTicket } from '../../types/support';
import { formatShortDateTime, getTicketSerial } from '../../utils/formatters';
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

interface CsatFeedbackItem {
  key: string;
  ticketId: string | null;
  serial: string;
  customerName: string;
  customerAvatar: string | null;
  agentName: string | null;
  rating: number;
  comment: string;
  subject: string;
  createdAt: string;
}

function getStarTone(stars: number): SemanticTone {
  if (stars >= 5) return 'success';
  if (stars === 4) return 'accent';
  if (stars === 3) return 'warning';
  return 'danger';
}

export const CsatExplorerScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onOpenTicket,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');

  const [analytics, setAnalytics] = useState<{
    averageRating?: number | null;
    totalResponses?: number;
    distribution?: Record<string, number>;
    recentSurveys?: Record<string, unknown>[];
  } | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const loadCsat = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [csatRes, ticketsRes] = await Promise.all([
          supportService.getCsatAnalytics(),
          supportService.listTickets({ limit: 50 }),
        ]);
        setAnalytics(csatRes || null);
        setTickets(ticketsRes.tickets || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load CSAT analytics.',
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
    loadCsat(false);
  }, [loadCsat]);

  const feedbackItems = useMemo<CsatFeedbackItem[]>(() => {
    const map = new Map<string, CsatFeedbackItem>();

    for (const raw of analytics?.recentSurveys || []) {
      const rating = Math.round(Number(raw.rating ?? raw.csatRating ?? raw.score ?? 0));
      if (rating < 1 || rating > 5) continue;
      const ticketId = raw.ticketId ? String(raw.ticketId) : raw.id ? String(raw.id) : null;
      const serialRaw = String(raw.serialNumber || raw.ticketSerial || ticketId || 'SURVEY');
      const serial = serialRaw.startsWith('#') ? serialRaw : `#${serialRaw}`;
      const dedupeKey = ticketId || `${serial}-${String(raw.createdAt || '')}`;

      map.set(dedupeKey, {
        key: dedupeKey,
        ticketId,
        serial,
        customerName: String(
          raw.customerName || raw.userName || raw.guestName || raw.requesterName || 'Customer'
        ),
        customerAvatar: raw.userAvatar ? String(raw.userAvatar) : null,
        agentName: raw.agentName || raw.assignedAgentName
          ? String(raw.agentName || raw.assignedAgentName)
          : null,
        rating,
        comment: String(raw.comment || raw.feedback || raw.note || ''),
        subject: String(raw.subject || 'Support interaction'),
        createdAt: String(raw.createdAt || raw.ratedAt || raw.updatedAt || ''),
      });
    }

    for (const t of tickets) {
      const rating = Math.round(Number(t.csatRating ?? 0));
      if (rating < 1 || rating > 5) continue;
      const dedupeKey = String(t.id);
      if (map.has(dedupeKey)) continue;

      map.set(dedupeKey, {
        key: dedupeKey,
        ticketId: t.id,
        serial: getTicketSerial(t),
        customerName: t.userName || t.guestName || t.userEmail || 'Customer',
        customerAvatar: t.userAvatar || null,
        agentName: t.assignedAgentName || null,
        rating,
        comment: t.lastMessage || '',
        subject: t.subject,
        createdAt: t.updatedAt || t.createdAt,
      });
    }

    return Array.from(map.values()).sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    );
  }, [analytics?.recentSurveys, tickets]);

  const starBreakdown = useMemo(() => {
    const dist = analytics?.distribution || {};
    const hasServerDist = [1, 2, 3, 4, 5].some((s) => Number(dist[String(s)] || 0) > 0);

    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (hasServerDist) {
      for (const s of [5, 4, 3, 2, 1]) {
        counts[s] = Number(dist[String(s)] || 0);
      }
    } else {
      for (const item of feedbackItems) {
        if (counts[item.rating] !== undefined) {
          counts[item.rating] += 1;
        }
      }
    }

    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, sum };
  }, [analytics?.distribution, feedbackItems]);

  const totalResponses =
    analytics?.totalResponses !== undefined && Number(analytics.totalResponses) > 0
      ? Number(analytics.totalResponses)
      : starBreakdown.sum || feedbackItems.length;

  const averageRating = useMemo(() => {
    if (analytics?.averageRating !== null && analytics?.averageRating !== undefined) {
      return Number(analytics.averageRating);
    }
    if (starBreakdown.sum > 0) {
      const weighted = [5, 4, 3, 2, 1].reduce(
        (acc, star) => acc + star * starBreakdown.counts[star],
        0
      );
      return weighted / starBreakdown.sum;
    }
    return 0;
  }, [analytics?.averageRating, starBreakdown]);

  const positiveSharePct = useMemo(() => {
    if (starBreakdown.sum === 0) return 0;
    return Math.round(
      ((starBreakdown.counts[5] + starBreakdown.counts[4]) / starBreakdown.sum) * 100
    );
  }, [starBreakdown]);

  const visibleFeedback = useMemo(() => {
    if (starFilter === 'all') return feedbackItems;
    return feedbackItems.filter((f) => f.rating === starFilter);
  }, [feedbackItems, starFilter]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Borderless Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton
          name="arrow-left"
          size={20}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.text }]}>
            CSAT & Customer Sentiment
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Verified post-resolution ratings & feedback explorer
          </Text>
        </View>
        <BorderlessIconButton
          name="refresh-cw"
          size={17}
          onPress={() => loadCsat(false)}
          accessibilityLabel="Refresh CSAT"
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
              loadCsat(true);
            }}
          />
        }
      >
        {/* Overall CSAT Ring + 5★ to 1★ Breakdown Bars */}
        <BlurFade delay={0} offset={6}>
          <View style={styles.heroWrap}>
            <View style={styles.ringColumn}>
              <AnimatedCircularProgress
                value={averageRating}
                max={5}
                size={70}
                strokeWidth={6}
                label={averageRating > 0 ? averageRating.toFixed(2) : '—'}
              />
              <View style={styles.responsesInline}>
                <NumberTicker
                  value={totalResponses}
                  style={[styles.respCount, { color: tokens.text }]}
                />
                <Text style={[styles.respLabel, { color: tokens.textMuted }]}>responses</Text>
              </View>
              <FlatBadge
                label={`${positiveSharePct}% Positive`}
                tone={positiveSharePct >= 80 ? 'success' : 'accent'}
              />
            </View>

            <View style={styles.barsColumn}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = starBreakdown.counts[star] || 0;
                const pct =
                  starBreakdown.sum > 0 ? Math.round((count / starBreakdown.sum) * 100) : 0;
                const barColor =
                  star >= 4
                    ? tokens.success
                    : star === 3
                      ? tokens.warning
                      : tokens.danger;
                const active = starFilter === star;

                return (
                  <TouchableOpacity
                    key={star}
                    activeOpacity={0.7}
                    onPress={() => setStarFilter((prev) => (prev === star ? 'all' : star))}
                    style={[
                      styles.starBarRow,
                      active && { backgroundColor: tokens.surfaceSubtle, borderRadius: 5 },
                    ]}
                  >
                    <Text style={[styles.starLabel, { color: tokens.text }]}>{`${star} ★`}</Text>
                    <View style={[styles.track, { backgroundColor: tokens.surfaceMuted }]}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${pct}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={[styles.starCount, { color: tokens.textMuted }]}>
                      {`${count} (${pct}%)`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </BlurFade>

        <Hairline strong />

        {/* Star Filter Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {(['all', 5, 4, 3, 2, 1] as const).map((val) => {
            const active = starFilter === val;
            return (
              <TouchableOpacity
                key={String(val)}
                activeOpacity={0.7}
                onPress={() => setStarFilter(val)}
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
                  {val === 'all' ? `All Feedback (${feedbackItems.length})` : `${val}★ Only`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Recent Customer Feedback List */}
        {loading && feedbackItems.length === 0 ? (
          <MagicSpinner label="Loading customer feedback..." />
        ) : visibleFeedback.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No customer ratings recorded for this star tier yet.
          </Text>
        ) : (
          visibleFeedback.map((item, idx) => (
            <AnimatedListItem key={item.key} index={idx}>
              <View style={[styles.feedbackRow, { borderBottomColor: tokens.hairline }]}>
                <View style={styles.feedbackTop}>
                  <MagicAvatar
                    name={item.customerName}
                    uri={resolveWebsiteUrl(item.customerAvatar)}
                    size={34}
                  />
                  <View style={styles.flex1}>
                    <View style={styles.customerLine}>
                      <Text
                        numberOfLines={1}
                        style={[styles.customerName, { color: tokens.text }]}
                      >
                        {item.customerName}
                      </Text>
                      <FlatBadge
                        label={`${'★'.repeat(item.rating)} (${item.rating}.0)`}
                        tone={getStarTone(item.rating)}
                      />
                    </View>
                    <Text style={[styles.metaLine, { color: tokens.textMuted }]}>
                      {`${item.serial}${item.agentName ? ` · Handled by ${item.agentName}` : ''} · ${formatShortDateTime(item.createdAt)}`}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={[styles.subjectText, { color: tokens.text }]}>
                  {item.subject}
                </Text>

                {item.comment ? (
                  <Text
                    numberOfLines={3}
                    style={[styles.commentText, { color: tokens.textSecondary }]}
                  >
                    {item.comment}
                  </Text>
                ) : null}

                {item.ticketId ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onOpenTicket(item.ticketId!)}
                    style={styles.openBtn}
                  >
                    <Text style={[styles.openLink, { color: tokens.accent }]}>
                      Inspect Ticket →
                    </Text>
                    <Feather name="external-link" size={12} color={tokens.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default CsatExplorerScreen;

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
    paddingTop: 14,
    paddingBottom: 32,
    gap: 12,
  },
  heroWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  ringColumn: {
    alignItems: 'center',
    gap: 5,
  },
  responsesInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  respCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  respLabel: {
    fontSize: 11,
  },
  barsColumn: {
    flex: 1,
    gap: 6,
  },
  starBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  starLabel: {
    width: 28,
    fontSize: 11.5,
    fontWeight: '700',
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2.5,
  },
  starCount: {
    width: 58,
    textAlign: 'right',
    fontSize: 10.5,
    fontWeight: '600',
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
  feedbackRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 6,
  },
  feedbackTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customerName: {
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  metaLine: {
    fontSize: 11,
    marginTop: 1,
  },
  subjectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 2,
  },
  openLink: {
    fontSize: 12,
    fontWeight: '700',
  },
});
