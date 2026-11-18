import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type {
  AuthUser,
  PickAppealRecord,
  StaffProfileMe,
} from '../../types/support';
import { formatShortDateTime, getStatusTone } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
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

type TimeframeKey = '7d' | '30d' | '12m';

function humanizeMetricKey(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toUpperCase();
}

export const PlatformOpsAnalyticsScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onOpenTicket,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [timeframe, setTimeframe] = useState<TimeframeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [opsSummary, setOpsSummary] = useState<Record<string, unknown> | null>(null);
  const [appeals, setAppeals] = useState<PickAppealRecord[]>([]);
  const [appealFilter, setAppealFilter] = useState<'open' | 'all'>('open');

  // Appeal Review Modal
  const [selectedAppeal, setSelectedAppeal] = useState<PickAppealRecord | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);

  const loadPlatformOps = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [summaryRes, appealsRes] = await Promise.all([
          supportService.getPlatformOpsSummary(timeframe).catch(() => ({})),
          supportService
            .listPickAppeals()
            .catch(() => ({ appeals: [] as PickAppealRecord[] })),
        ]);
        setOpsSummary(summaryRes || {});
        const parsedAppeals = Array.isArray(appealsRes)
          ? appealsRes
          : appealsRes.appeals || [];
        setAppeals(parsedAppeals);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label:
              err instanceof Error
                ? err.message
                : 'Unable to load platform operations summary.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe, toast]
  );

  useEffect(() => {
    loadPlatformOps(false);
  }, [loadPlatformOps]);

  const scalarMetrics = useMemo(() => {
    if (!opsSummary) return [];
    const source =
      typeof opsSummary.summary === 'object' && opsSummary.summary !== null
        ? { ...opsSummary, ...(opsSummary.summary as Record<string, unknown>) }
        : opsSummary;

    return Object.entries(source)
      .filter(
        ([key, val]) =>
          key !== 'success' &&
          key !== 'timeframe' &&
          (typeof val === 'number' ||
            (typeof val === 'string' && val.trim().length > 0 && val.length <= 32))
      )
      .map(([key, val]) => ({
        key,
        label: humanizeMetricKey(key),
        value: val as number | string,
      }));
  }, [opsSummary]);

  const filteredAppeals = useMemo(() => {
    if (appealFilter === 'all') return appeals;
    return appeals.filter((ap) => {
      const s = String(ap.status || '').toLowerCase();
      return s !== 'approved' && s !== 'rejected' && s !== 'closed';
    });
  }, [appealFilter, appeals]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const csv = await supportService.exportTicketsCsv({});
      await Share.share({
        title: `Tiwlo Support Tickets Export (${timeframe})`,
        message: csv,
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'CSV export failed.',
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleAppealDecision = async (
    appeal: PickAppealRecord,
    status: 'approved' | 'rejected' | 'under_review',
    notes?: string
  ) => {
    setAppealBusy(true);
    try {
      await supportService.updatePickAppeal(appeal.id, {
        status,
        resolutionNotes: notes?.trim() || undefined,
      });
      setAppeals((prev) =>
        prev.map((a) =>
          a.id === appeal.id
            ? { ...a, status, resolutionNotes: notes?.trim() || a.resolutionNotes }
            : a
        )
      );
      setSelectedAppeal(null);
      setResolutionNotes('');
      toast.show({
        variant: 'success',
        label: `PICK appeal marked ${status.replace(/_/g, ' ')}.`,
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update appeal.',
      });
    } finally {
      setAppealBusy(false);
    }
  };

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
            Platform Ops & Analytics
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Executive KPIs, PICK appeals queue & CSV export
          </Text>
        </View>
        <ShimmerButton
          label="CSV Export"
          size="xs"
          variant="subtle"
          loading={exportingCsv}
          leftIcon={<Feather name="download" size={11} color={tokens.text} />}
          onPress={handleExportCsv}
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
              loadPlatformOps(true);
            }}
          />
        }
      >
        {/* Timeframe Switcher */}
        <BlurFade delay={0} offset={5}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.secTitle, { color: tokens.text }]}>
              Operations Summary
            </Text>

            <View style={styles.tfGroup}>
              {(['7d', '30d', '12m'] as const).map((tf) => {
                const active = timeframe === tf;
                return (
                  <TouchableOpacity
                    key={tf}
                    activeOpacity={0.7}
                    onPress={() => setTimeframe(tf)}
                    style={[
                      styles.tfBtn,
                      {
                        backgroundColor: active
                          ? tokens.accentSoft
                          : tokens.surfaceSubtle,
                        borderColor: active ? tokens.accent : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: active ? tokens.accent : tokens.textSecondary,
                      }}
                    >
                      {tf.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </BlurFade>

        {/* Dynamic KPI Grid */}
        {loading && scalarMetrics.length === 0 ? (
          <MagicSpinner label="Aggregating platform metrics..." />
        ) : scalarMetrics.length === 0 ? (
          <Text style={[styles.emptyHint, { color: tokens.textMuted }]}>
            No summary KPI fields returned for the selected window.
          </Text>
        ) : (
          <BlurFade delay={35} offset={6}>
            <View style={styles.kpiGrid}>
              {scalarMetrics.map((metric) => {
                const isPct =
                  metric.key.toLowerCase().includes('pct') ||
                  metric.key.toLowerCase().includes('rate');
                const numVal =
                  typeof metric.value === 'number' ? metric.value : Number.NaN;

                return (
                  <View
                    key={metric.key}
                    style={[
                      styles.kpiTile,
                      {
                        backgroundColor: tokens.surfaceSubtle,
                        borderColor: tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.kpiLabel, { color: tokens.textMuted }]}
                    >
                      {metric.label}
                    </Text>
                    {Number.isFinite(numVal) ? (
                      <NumberTicker
                        value={numVal}
                        decimalPlaces={Number.isInteger(numVal) ? 0 : 1}
                        suffix={isPct ? '%' : ''}
                        style={[styles.kpiValue, { color: tokens.text }]}
                      />
                    ) : (
                      <Text
                        numberOfLines={1}
                        style={[styles.kpiValue, { color: tokens.text }]}
                      >
                        {String(metric.value)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </BlurFade>
        )}

        <Hairline strong />

        {/* PICK Account Appeals Review Queue */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.secTitle, { color: tokens.text }]}>
              PICK Account Appeals Queue
            </Text>
            <Text style={[styles.subCaption, { color: tokens.textMuted }]}>
              Compliance & identity restoration reviews
            </Text>
          </View>

          <View style={styles.tfGroup}>
            {(
              [
                { key: 'open', label: 'Needs Review' },
                { key: 'all', label: `All (${appeals.length})` },
              ] as const
            ).map((f) => {
              const active = appealFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setAppealFilter(f.key)}
                  style={[
                    styles.tfBtn,
                    {
                      backgroundColor: active
                        ? tokens.accentSoft
                        : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: active ? tokens.accent : tokens.textSecondary,
                    }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {filteredAppeals.length === 0 ? (
          <Text style={[styles.emptyHint, { color: tokens.textMuted }]}>
            No PICK account appeals waiting in this queue.
          </Text>
        ) : (
          filteredAppeals.map((appeal, idx) => (
            <AnimatedListItem key={appeal.id} index={idx}>
              <View style={[styles.appealRow, { borderBottomColor: tokens.hairline }]}>
                <View style={styles.appealTop}>
                  <Text
                    numberOfLines={1}
                    style={[styles.appealSubject, { color: tokens.text, flex: 1 }]}
                  >
                    {appeal.subject || 'PICK Account Restoration Appeal'}
                  </Text>
                  <FlatBadge
                    label={appeal.status.replace(/_/g, ' ').toUpperCase()}
                    tone={getStatusTone(appeal.status)}
                    withDot
                  />
                </View>

                <Text style={[styles.appealMeta, { color: tokens.textMuted }]}>
                  {`${appeal.requesterName || appeal.requesterEmail || 'Applicant'} · ${formatShortDateTime(appeal.createdAt)}`}
                </Text>

                {appeal.description ? (
                  <Text
                    numberOfLines={3}
                    style={[styles.appealDesc, { color: tokens.textSecondary }]}
                  >
                    {appeal.description}
                  </Text>
                ) : null}

                {appeal.resolutionNotes ? (
                  <Text style={[styles.resNote, { color: tokens.textMuted }]}>
                    {`Notes: ${appeal.resolutionNotes}`}
                  </Text>
                ) : null}

                <View style={styles.appealActions}>
                  <View style={styles.btnCluster}>
                    <ShimmerButton
                      label="Approve"
                      size="xs"
                      variant="accent"
                      disabled={appealBusy}
                      onPress={() => {
                        setSelectedAppeal(appeal);
                        setResolutionNotes(appeal.resolutionNotes || '');
                      }}
                    />
                    <ShimmerButton
                      label="Reject"
                      size="xs"
                      variant="danger"
                      disabled={appealBusy}
                      onPress={() => {
                        setSelectedAppeal(appeal);
                        setResolutionNotes(appeal.resolutionNotes || '');
                      }}
                    />
                  </View>

                  {appeal.ticketId ? (
                    <TouchableOpacity
                      onPress={() => onOpenTicket(appeal.ticketId!)}
                      hitSlop={8}
                    >
                      <Text style={[styles.ticketLink, { color: tokens.accent }]}>
                        Open Ticket →
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* Appeal Decision Modal */}
      <MagicModalSheet
        visible={Boolean(selectedAppeal)}
        onClose={() => setSelectedAppeal(null)}
        title="Review PICK Account Appeal"
        subtitle={selectedAppeal?.subject || ''}
      >
        <FlatInput
          label="Resolution & Compliance Notes"
          value={resolutionNotes}
          onChangeText={setResolutionNotes}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder="Record verification findings or decision rationale..."
        />

        <View style={styles.modalDecisionRow}>
          <ShimmerButton
            label="Approve"
            size="sm"
            variant="accent"
            loading={appealBusy}
            onPress={() =>
              selectedAppeal &&
              handleAppealDecision(selectedAppeal, 'approved', resolutionNotes)
            }
          />
          <ShimmerButton
            label="Under Review"
            size="sm"
            variant="subtle"
            loading={appealBusy}
            onPress={() =>
              selectedAppeal &&
              handleAppealDecision(selectedAppeal, 'under_review', resolutionNotes)
            }
          />
          <ShimmerButton
            label="Reject"
            size="sm"
            variant="danger"
            loading={appealBusy}
            onPress={() =>
              selectedAppeal &&
              handleAppealDecision(selectedAppeal, 'rejected', resolutionNotes)
            }
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default PlatformOpsAnalyticsScreen;

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
    gap: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  secTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subCaption: {
    fontSize: 11.5,
    marginTop: 1,
  },
  tfGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tfBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  kpiTile: {
    width: '48%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyHint: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 24,
  },
  appealRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 6,
  },
  appealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appealSubject: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  appealMeta: {
    fontSize: 11,
  },
  appealDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  resNote: {
    fontSize: 11.5,
    fontStyle: 'italic',
  },
  appealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  btnCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ticketLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalDecisionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
});
