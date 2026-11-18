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
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, ShiftHandoverRecord } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatRelativeTime, formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
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

type ShiftFilter = 'all' | 'morning' | 'evening' | 'night';

const SHIFT_META: Record<
  ShiftHandoverRecord['shiftType'],
  {
    label: string;
    tone: SemanticTone;
    icon: React.ComponentProps<typeof Feather>['name'];
  }
> = {
  morning: { label: 'Morning Shift', tone: 'accent', icon: 'sun' },
  evening: { label: 'Evening Shift', tone: 'warning', icon: 'sunset' },
  night: { label: 'Night Shift', tone: 'neutral', icon: 'moon' },
};

export const ShiftHandoverScreen: React.FC<OpsScreenProps> = ({
  user,
  onBack,
  onOpenTicket,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [handovers, setHandovers] = useState<ShiftHandoverRecord[]>([]);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [ackBusyId, setAckBusyId] = useState<string | null>(null);

  const [composerVisible, setComposerVisible] = useState(false);
  const [shiftType, setShiftType] = useState<ShiftHandoverRecord['shiftType']>('morning');
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [watchTicketIdsText, setWatchTicketIdsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadHandovers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listShiftHandovers();
        setHandovers(res.handovers || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load shift handovers.',
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
    loadHandovers(false);
  }, [loadHandovers]);

  const filteredHandovers = useMemo(() => {
    if (shiftFilter === 'all') return handovers;
    return handovers.filter((h) => h.shiftType === shiftFilter);
  }, [handovers, shiftFilter]);

  const unackedCount = useMemo(
    () =>
      handovers.filter(
        (h) =>
          String(h.createdById) !== String(user.id) &&
          !(h.acknowledgedBy || []).some((a) => String(a.staffId) === String(user.id))
      ).length,
    [handovers, user.id]
  );

  const handleCreateHandover = async () => {
    if (!headline.trim() || !summary.trim()) {
      toast.show({ variant: 'danger', label: 'Enter a shift headline and summary.' });
      return;
    }

    const parsedWatchIds = watchTicketIdsText
      .split(/[\s,]+/)
      .map((item) => item.trim().replace(/^#/, ''))
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await opsHubService.createShiftHandover({
        shiftType,
        headline: headline.trim(),
        summary: summary.trim(),
        blockers: blockers.trim() || undefined,
        watchTicketIds: parsedWatchIds,
      });
      if (res.handover) {
        setHandovers((prev) => [res.handover, ...prev]);
      } else {
        loadHandovers(true);
      }
      setComposerVisible(false);
      setHeadline('');
      setSummary('');
      setBlockers('');
      setWatchTicketIdsText('');
      toast.show({ variant: 'success', label: 'Shift handover posted for incoming team.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not publish handover.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setAckBusyId(id);
    try {
      const res = await opsHubService.acknowledgeShiftHandover(id);
      if (res.handover) {
        setHandovers((prev) => prev.map((h) => (h.id === id ? res.handover : h)));
      } else {
        loadHandovers(true);
      }
      toast.show({ variant: 'success', label: 'Handover acknowledged.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not acknowledge handover.',
      });
    } finally {
      setAckBusyId(null);
    }
  };

  const filterTabs: { key: ShiftFilter; label: string }[] = [
    { key: 'all', label: `All (${handovers.length})` },
    {
      key: 'morning',
      label: `Morning (${handovers.filter((h) => h.shiftType === 'morning').length})`,
    },
    {
      key: 'evening',
      label: `Evening (${handovers.filter((h) => h.shiftType === 'evening').length})`,
    },
    {
      key: 'night',
      label: `Night (${handovers.filter((h) => h.shiftType === 'night').length})`,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Borderless Header */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton
          name="arrow-left"
          size={20}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.text }]}>
            Shift Handover Log
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Continuity notes, active blockers & watch tickets
          </Text>
        </View>
        <ShimmerButton
          label="+ Post Handover"
          size="xs"
          variant="accent"
          onPress={() => setComposerVisible(true)}
        />
      </View>

      {/* Segmented Shift Filter Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {filterTabs.map((tab) => {
            const active = shiftFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                onPress={() => setShiftFilter(tab.key)}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
              loadHandovers(true);
            }}
          />
        }
      >
        {/* Summary Strip */}
        <BlurFade delay={0} offset={5}>
          <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>TOTAL LOGS</Text>
              <NumberTicker
                value={handovers.length}
                style={[styles.kpiValue, { color: tokens.text }]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>NEEDS MY ACK</Text>
              <NumberTicker
                value={unackedCount}
                style={[
                  styles.kpiValue,
                  { color: unackedCount > 0 ? tokens.warning : tokens.accent },
                ]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>WATCH TICKETS</Text>
              <NumberTicker
                value={handovers.reduce((acc, h) => acc + (h.watchTicketIds?.length || 0), 0)}
                style={[styles.kpiValue, { color: tokens.text }]}
              />
            </View>
          </View>
        </BlurFade>

        {loading && handovers.length === 0 ? (
          <MagicSpinner label="Loading shift handovers..." />
        ) : filteredHandovers.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No shift handovers recorded for this filter yet.
          </Text>
        ) : (
          filteredHandovers.map((item, idx) => {
            const meta = SHIFT_META[item.shiftType] || SHIFT_META.morning;
            const acks = item.acknowledgedBy || [];
            const hasAcked = acks.some((a) => String(a.staffId) === String(user.id));

            return (
              <AnimatedListItem key={item.id} index={idx}>
                <View style={[styles.handoverBlock, { borderBottomColor: tokens.hairlineStrong }]}>
                  {/* Author & Shift Row */}
                  <View style={styles.authorRow}>
                    <MagicAvatar
                      name={item.createdByName || 'Specialist'}
                      uri={resolveWebsiteUrl(item.createdByAvatar)}
                      size={34}
                    />
                    <View style={styles.flex1}>
                      <View style={styles.authorLine}>
                        <Text
                          numberOfLines={1}
                          style={[styles.authorName, { color: tokens.text }]}
                        >
                          {item.createdByName || 'Staff Member'}
                        </Text>
                        <FlatBadge label={meta.label} tone={meta.tone} withDot />
                      </View>
                      <Text style={[styles.timeMeta, { color: tokens.textMuted }]}>
                        {`${formatShortDateTime(item.createdAt)} · ${formatRelativeTime(item.createdAt)}`}
                      </Text>
                    </View>
                  </View>

                  {/* Headline & Summary */}
                  <Text style={[styles.headline, { color: tokens.text }]}>{item.headline}</Text>
                  <Text style={[styles.summaryText, { color: tokens.textSecondary }]}>
                    {item.summary}
                  </Text>

                  {/* Blockers Strip */}
                  {item.blockers && item.blockers.trim().length > 0 ? (
                    <FlatNotice
                      text={`Blockers: ${item.blockers.trim()}`}
                      tone="warning"
                      icon="alert-triangle"
                    />
                  ) : null}

                  {/* Watch Ticket Chips */}
                  {(item.watchTicketIds || []).length > 0 ? (
                    <View style={styles.watchRow}>
                      <Text style={[styles.microLabel, { color: tokens.textMuted }]}>
                        WATCH LIST:
                      </Text>
                      {(item.watchTicketIds || []).map((tid) => {
                        const cleanId = tid.replace(/^#/, '');
                        const displaySerial = tid.startsWith('#') ? tid : `#${tid}`;
                        return (
                          <TouchableOpacity
                            key={tid}
                            activeOpacity={0.7}
                            onPress={() => onOpenTicket(cleanId)}
                            style={[
                              styles.ticketChip,
                              {
                                backgroundColor: tokens.accentSoft,
                                borderColor: tokens.accent,
                              },
                            ]}
                          >
                            <Feather name="external-link" size={11} color={tokens.accent} />
                            <Text style={[styles.ticketChipText, { color: tokens.accent }]}>
                              {displaySerial}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  <Hairline />

                  {/* Acknowledgements & 1-Tap Action */}
                  <View style={styles.ackFooter}>
                    <View style={styles.ackNamesWrap}>
                      <Feather
                        name="check-circle"
                        size={13}
                        color={acks.length > 0 ? tokens.success : tokens.textMuted}
                      />
                      <Text style={[styles.ackListText, { color: tokens.textMuted }]}>
                        {acks.length === 0
                          ? 'Awaiting incoming shift acknowledgement'
                          : `Acked by ${acks.map((a) => a.staffName).join(', ')}`}
                      </Text>
                    </View>

                    {hasAcked ? (
                      <FlatBadge label="Acknowledged" tone="success" withDot />
                    ) : (
                      <ShimmerButton
                        label="Acknowledge Handover"
                        size="xs"
                        variant="accent"
                        loading={ackBusyId === item.id}
                        onPress={() => handleAcknowledge(item.id)}
                      />
                    )}
                  </View>
                </View>
              </AnimatedListItem>
            );
          })
        )}
      </ScrollView>

      {/* + Post Handover Modal Sheet */}
      <MagicModalSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        title="Post Shift Handover"
        subtitle="Brief incoming specialists on open priorities and watch items"
      >
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Shift Window</Text>
          <View style={styles.shiftSelector}>
            {(['morning', 'evening', 'night'] as const).map((type) => {
              const active = shiftType === type;
              const info = SHIFT_META[type];
              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.7}
                  onPress={() => setShiftType(type)}
                  style={[
                    styles.shiftOption,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Feather
                    name={info.icon}
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
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Headline"
          value={headline}
          onChangeText={setHeadline}
          autoCapitalize="sentences"
          autoCorrect
          placeholder="e.g. Payment webhook latency cleared; 3 VIP tickets pending"
        />

        <FlatInput
          label="Shift Summary"
          value={summary}
          onChangeText={setSummary}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder="Key resolutions, volume trends, and context for the next shift..."
        />

        <FlatInput
          label="Active Blockers (Optional)"
          value={blockers}
          onChangeText={setBlockers}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder="Any upstream dependencies, carrier delays, or escalations..."
        />

        <FlatInput
          label="Watch Ticket IDs / Serials (Comma-separated)"
          value={watchTicketIdsText}
          onChangeText={setWatchTicketIdsText}
          placeholder="TKT-1042, TKT-1089"
        />

        <View style={styles.sheetActions}>
          <ShimmerButton
            label="Cancel"
            size="sm"
            variant="subtle"
            onPress={() => setComposerVisible(false)}
          />
          <ShimmerButton
            label="Publish Handover"
            size="sm"
            variant="accent"
            loading={submitting}
            onPress={handleCreateHandover}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default ShiftHandoverScreen;

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
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 18,
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
    gap: 12,
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
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  vSep: {
    width: 1,
    height: 26,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  handoverBlock: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 9,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  timeMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  headline: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginRight: 2,
  },
  ticketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  ticketChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ackFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 2,
  },
  ackNamesWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ackListText: {
    flex: 1,
    fontSize: 11.5,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  shiftSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
});
