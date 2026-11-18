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
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type {
  DedicatedScreenKey,
  QaReviewScorecard,
  QaSummaryStats,
} from '../../types/opsHub';
import type { AuthUser, StaffProfileMe, SupportAgent } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedCircularProgress,
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
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

const DEFAULT_SUMMARY: QaSummaryStats = {
  totalReviews: 0,
  averagePct: 0,
  avgTone: 0,
  avgAccuracy: 0,
  avgBrand: 0,
  avgSpeed: 0,
};

function getScoreTone(pct: number): SemanticTone {
  if (pct >= 85) return 'success';
  if (pct >= 70) return 'accent';
  if (pct >= 55) return 'warning';
  return 'danger';
}

export const QaTicketReviewScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onOpenTicket,
  onOpenChat,
  routeParams,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<QaReviewScorecard[]>([]);
  const [summary, setSummary] = useState<QaSummaryStats>(DEFAULT_SUMMARY);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [targetFilter, setTargetFilter] = useState<'all' | 'ticket' | 'livechat'>('all');

  const [gradeVisible, setGradeVisible] = useState(false);
  const [targetType, setTargetType] = useState<'ticket' | 'livechat'>('ticket');
  const [targetSerial, setTargetSerial] = useState('');
  const [agentName, setAgentName] = useState('');
  const [toneScore, setToneScore] = useState(5);
  const [accuracyScore, setAccuracyScore] = useState(5);
  const [brandScore, setBrandScore] = useState(5);
  const [speedScore, setSpeedScore] = useState(5);
  const [coachingNote, setCoachingNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [qaRes, agentsRes] = await Promise.all([
          opsHubService.listQaReviews(),
          supportService.getAgents().catch(() => ({ agents: [] as SupportAgent[] })),
        ]);
        setReviews(qaRes.reviews || []);
        setSummary(qaRes.summary || DEFAULT_SUMMARY);
        setAgents(agentsRes.agents || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load QA scorecards.',
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
    loadReviews(false);
  }, [loadReviews]);

  useEffect(() => {
    if (routeParams?.targetSerial || routeParams?.targetId) {
      setTargetType(routeParams.targetType === 'livechat' ? 'livechat' : 'ticket');
      setTargetSerial(routeParams.targetSerial || routeParams.targetId || '');
      if (routeParams.agentName) setAgentName(routeParams.agentName);
      setGradeVisible(true);
    }
  }, [routeParams]);

  const filteredReviews = useMemo(() => {
    if (targetFilter === 'all') return reviews;
    return reviews.filter((r) => r.targetType === targetFilter);
  }, [reviews, targetFilter]);

  const livePreviewPct = Math.round(((toneScore + accuracyScore + brandScore + speedScore) / 20) * 100);

  const handleSubmitReview = async () => {
    const cleanSerial = targetSerial.trim();
    if (!cleanSerial || !agentName.trim()) {
      toast.show({
        variant: 'danger',
        label: 'Enter conversation serial/ID and specialist name.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const normalizedId = cleanSerial.replace(/^#/, '');
      const res = await opsHubService.createQaReview({
        targetType,
        targetId: routeParams?.targetId || normalizedId,
        targetSerial: cleanSerial.startsWith('#') ? cleanSerial : `#${cleanSerial}`,
        agentName: agentName.trim(),
        toneScore,
        accuracyScore,
        brandScore,
        speedScore,
        coachingNote: coachingNote.trim(),
      });

      if (res.review) {
        setReviews((prev) => [res.review, ...prev]);
      }
      if (res.summary) {
        setSummary(res.summary);
      } else {
        loadReviews(true);
      }

      setGradeVisible(false);
      setTargetSerial('');
      setAgentName('');
      setCoachingNote('');
      setToneScore(5);
      setAccuracyScore(5);
      setBrandScore(5);
      setSpeedScore(5);
      toast.show({ variant: 'success', label: 'QA scorecard recorded.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to save QA scorecard.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const subMetrics = [
    { label: 'Tone', val: Number(summary.avgTone || 0) },
    { label: 'Accuracy', val: Number(summary.avgAccuracy || 0) },
    { label: 'Brand Compliance', val: Number(summary.avgBrand || 0) },
    { label: 'Speed', val: Number(summary.avgSpeed || 0) },
  ];

  const renderScorePicker = (
    label: string,
    value: number,
    onChange: (next: number) => void
  ) => (
    <View style={styles.scorePickerRow}>
      <Text style={[styles.scorePickerLabel, { color: tokens.text }]}>{label}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((num) => {
          const active = num <= value;
          return (
            <TouchableOpacity
              key={num}
              activeOpacity={0.65}
              onPress={() => onChange(num)}
              style={[
                styles.starBtn,
                {
                  backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                  borderColor: active ? tokens.accent : tokens.hairlineStrong,
                },
              ]}
            >
              <Feather
                name="star"
                size={13}
                color={active ? tokens.accent : tokens.textMuted}
              />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: active ? tokens.accent : tokens.textMuted,
                }}
              >
                {num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

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
            QA Scorecards & Coaching
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Conversation quality audits across tickets & live chat
          </Text>
        </View>
        <ShimmerButton
          label="+ Grade"
          size="xs"
          variant="accent"
          onPress={() => setGradeVisible(true)}
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
              loadReviews(true);
            }}
          />
        }
      >
        {/* Top QA Quality Ring + 4 Sub-Metric Bars */}
        <BlurFade delay={0} offset={6}>
          <View style={styles.heroSection}>
            <View style={styles.ringCol}>
              <AnimatedCircularProgress
                value={Number(summary.averagePct || 0)}
                max={100}
                size={68}
                strokeWidth={6}
                label={`${Math.round(summary.averagePct || 0)}%`}
              />
              <Text style={[styles.ringCaption, { color: tokens.textMuted }]}>QUALITY</Text>
              <View style={styles.countInline}>
                <NumberTicker
                  value={summary.totalReviews || reviews.length}
                  style={[styles.reviewCountVal, { color: tokens.text }]}
                />
                <Text style={[styles.ringCaption, { color: tokens.textMuted }]}>audits</Text>
              </View>
            </View>

            <View style={styles.subBarsCol}>
              {subMetrics.map((m) => {
                const pct = Math.min(100, Math.max(0, (m.val / 5) * 100));
                return (
                  <View key={m.label} style={styles.metricBarGroup}>
                    <View style={styles.metricBarTop}>
                      <Text style={[styles.metricName, { color: tokens.textSecondary }]}>
                        {m.label}
                      </Text>
                      <Text style={[styles.metricVal, { color: tokens.text }]}>
                        {m.val > 0 ? `${m.val.toFixed(1)} / 5` : '—'}
                      </Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: tokens.surfaceMuted }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: tokens.accent },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </BlurFade>

        <Hairline strong />

        {/* Channel Filter Tabs */}
        <View style={[styles.filterRow, { borderBottomColor: tokens.hairline }]}>
          {(
            [
              { key: 'all', label: `All (${reviews.length})` },
              {
                key: 'ticket',
                label: `Tickets (${reviews.filter((r) => r.targetType === 'ticket').length})`,
              },
              {
                key: 'livechat',
                label: `Live Chats (${reviews.filter((r) => r.targetType === 'livechat').length})`,
              },
            ] as const
          ).map((tab) => {
            const active = targetFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setTargetFilter(tab.key)}
                style={[
                  styles.filterTab,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reviews Feed */}
        {loading && reviews.length === 0 ? (
          <MagicSpinner label="Loading QA reviews..." />
        ) : filteredReviews.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No graded conversations yet. Tap + Grade to submit a scorecard.
          </Text>
        ) : (
          filteredReviews.map((rev, idx) => (
            <AnimatedListItem key={rev.id} index={idx}>
              <View style={[styles.reviewRow, { borderBottomColor: tokens.hairline }]}>
                <View style={styles.reviewHead}>
                  <MagicAvatar name={rev.agentName || 'Agent'} size={34} />
                  <View style={styles.flex1}>
                    <View style={styles.agentTitleLine}>
                      <Text numberOfLines={1} style={[styles.agentTitle, { color: tokens.text }]}>
                        {rev.agentName}
                      </Text>
                      <FlatBadge
                        label={rev.targetType === 'livechat' ? 'Live Chat' : 'Ticket'}
                        tone="neutral"
                      />
                    </View>
                    <Text style={[styles.reviewerSub, { color: tokens.textMuted }]}>
                      {`Reviewed by ${rev.reviewerName || 'QA Lead'} · ${formatShortDateTime(rev.createdAt)}`}
                    </Text>
                  </View>

                  <FlatBadge
                    label={`${Math.round(rev.overallPct)}%`}
                    tone={getScoreTone(rev.overallPct)}
                    withDot
                  />
                </View>

                <View style={styles.quadScoreStrip}>
                  <Text style={[styles.quadItem, { color: tokens.textSecondary }]}>
                    {`Tone ${rev.toneScore}/5`}
                  </Text>
                  <Text style={[styles.quadSep, { color: tokens.textMuted }]}>·</Text>
                  <Text style={[styles.quadItem, { color: tokens.textSecondary }]}>
                    {`Accuracy ${rev.accuracyScore}/5`}
                  </Text>
                  <Text style={[styles.quadSep, { color: tokens.textMuted }]}>·</Text>
                  <Text style={[styles.quadItem, { color: tokens.textSecondary }]}>
                    {`Brand ${rev.brandScore}/5`}
                  </Text>
                  <Text style={[styles.quadSep, { color: tokens.textMuted }]}>·</Text>
                  <Text style={[styles.quadItem, { color: tokens.textSecondary }]}>
                    {`Speed ${rev.speedScore}/5`}
                  </Text>
                </View>

                {rev.coachingNote ? (
                  <Text style={[styles.coachingText, { color: tokens.textSecondary }]}>
                    {rev.coachingNote}
                  </Text>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const cleanTarget = (rev.targetId || rev.targetSerial || '').replace(/^#/, '');
                    if (!cleanTarget) return;
                    if (rev.targetType === 'livechat') {
                      onOpenChat(cleanTarget);
                    } else {
                      onOpenTicket(cleanTarget);
                    }
                  }}
                  style={styles.openTargetLink}
                >
                  <Text style={[styles.targetLinkText, { color: tokens.accent }]}>
                    {`Open ${rev.targetSerial || rev.targetId} →`}
                  </Text>
                </TouchableOpacity>
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* + Grade Conversation Modal Sheet */}
      <MagicModalSheet
        visible={gradeVisible}
        onClose={() => setGradeVisible(false)}
        title="Grade Conversation"
        subtitle={`Projected QA Score: ${livePreviewPct}%`}
      >
        <View style={styles.typeToggleRow}>
          {(['ticket', 'livechat'] as const).map((kind) => {
            const active = targetType === kind;
            return (
              <TouchableOpacity
                key={kind}
                activeOpacity={0.7}
                onPress={() => setTargetType(kind)}
                style={[
                  styles.typeOption,
                  {
                    backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                    borderColor: active ? tokens.accent : tokens.hairlineStrong,
                  },
                ]}
              >
                <Feather
                  name={kind === 'ticket' ? 'inbox' : 'message-circle'}
                  size={13}
                  color={active ? tokens.accent : tokens.textMuted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: active ? tokens.accent : tokens.textSecondary,
                  }}
                >
                  {kind === 'ticket' ? 'Ticket' : 'Live Chat'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatInput
          label="Ticket Serial or Chat ID"
          value={targetSerial}
          onChangeText={setTargetSerial}
          placeholder={targetType === 'ticket' ? '#TKT-1048' : 'CHAT-9021'}
        />

        <FlatInput
          label="Specialist Name"
          value={agentName}
          onChangeText={setAgentName}
          autoCapitalize="words"
          placeholder="Select below or enter specialist name..."
        />

        {agents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.agentPickRow}
          >
            {agents.slice(0, 12).map((ag) => {
              const selected = agentName.trim().toLowerCase() === ag.name.trim().toLowerCase();
              return (
                <TouchableOpacity
                  key={ag.id}
                  activeOpacity={0.7}
                  onPress={() => setAgentName(ag.name)}
                  style={[
                    styles.agentChip,
                    {
                      backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: selected ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {ag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <Hairline />

        {renderScorePicker('Tone & Empathy', toneScore, setToneScore)}
        {renderScorePicker('Technical Accuracy', accuracyScore, setAccuracyScore)}
        {renderScorePicker('Brand Compliance', brandScore, setBrandScore)}
        {renderScorePicker('Response Speed', speedScore, setSpeedScore)}

        <FlatInput
          label="Coaching Note"
          value={coachingNote}
          onChangeText={setCoachingNote}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder="Constructive feedback, highlights, or recommended macro..."
        />

        <View style={styles.modalActions}>
          <ShimmerButton
            label="Cancel"
            size="sm"
            variant="subtle"
            onPress={() => setGradeVisible(false)}
          />
          <ShimmerButton
            label="Submit Scorecard"
            size="sm"
            variant="accent"
            loading={submitting}
            onPress={handleSubmitReview}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default QaTicketReviewScreen;

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
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 4,
  },
  ringCol: {
    alignItems: 'center',
    gap: 3,
  },
  ringCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  countInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  reviewCountVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  subBarsCol: {
    flex: 1,
    gap: 8,
  },
  metricBarGroup: {
    gap: 3,
  },
  metricBarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingVertical: 8,
  },
  filterTabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  reviewRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 8,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  reviewerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  quadScoreStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  quadItem: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  quadSep: {
    fontSize: 11.5,
  },
  coachingText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  openTargetLink: {
    alignSelf: 'flex-start',
  },
  targetLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  agentPickRow: {
    gap: 6,
    paddingVertical: 2,
  },
  agentChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  scorePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scorePickerLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  starBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
});
