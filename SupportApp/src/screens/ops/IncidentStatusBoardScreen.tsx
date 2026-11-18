import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { opsHubService } from '../../services/opsHubService';
import { getTonePalette, useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { SupportIncident } from '../../types/opsHub';
import { formatRelativeTime, formatShortDateTime, getStatusLabel } from '../../utils/formatters';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicModalSheet,
  MagicSpinner,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type IncidentFilterTab = 'active' | 'resolved' | 'all';

const SEVERITY_OPTIONS: {
  id: SupportIncident['severity'];
  label: string;
  tone: SemanticTone;
}[] = [
  { id: 'minor', label: 'Minor', tone: 'accent' },
  { id: 'major', label: 'Major', tone: 'warning' },
  { id: 'critical', label: 'Critical', tone: 'danger' },
];

const INCIDENT_STATUSES: SupportIncident['status'][] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
];

const COMPONENT_PRESETS = [
  'Storefronts',
  'Checkout & Payments',
  'Custom Domains & SSL',
  'Auth & 2FA',
  'Merchant Dashboard',
  'Live Chat & Notifications',
];

function getSeverityTone(severity: SupportIncident['severity']): SemanticTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'major') return 'warning';
  return 'accent';
}

function getIncidentStatusTone(status: SupportIncident['status']): SemanticTone {
  if (status === 'resolved') return 'success';
  if (status === 'monitoring') return 'accent';
  if (status === 'identified') return 'warning';
  return 'danger';
}

export const IncidentStatusBoardScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onNavigateSubScreen,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [filterTab, setFilterTab] = useState<IncidentFilterTab>('active');
  const [incidents, setIncidents] = useState<SupportIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [updateDrafts, setUpdateDrafts] = useState<
    Record<string, { status: SupportIncident['status']; message: string }>
  >({});
  const [postingUpdateId, setPostingUpdateId] = useState<string | null>(null);

  const [declareVisible, setDeclareVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<SupportIncident['severity']>('major');
  const [newSummary, setNewSummary] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [customComponents, setCustomComponents] = useState('');
  const [creating, setCreating] = useState(false);

  const loadIncidents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listIncidents('all');
        setIncidents(res.incidents || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load incident board.',
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
    loadIncidents(false);
  }, [loadIncidents]);

  const counts = useMemo(() => {
    const active = incidents.filter((i) => i.status !== 'resolved').length;
    const resolved = incidents.filter((i) => i.status === 'resolved').length;
    return { active, resolved, all: incidents.length };
  }, [incidents]);

  const visibleIncidents = useMemo(() => {
    if (filterTab === 'active') return incidents.filter((i) => i.status !== 'resolved');
    if (filterTab === 'resolved') return incidents.filter((i) => i.status === 'resolved');
    return incidents;
  }, [filterTab, incidents]);

  const toggleExpand = (inc: SupportIncident) => {
    setExpandedIds((prev) => ({ ...prev, [inc.id]: !prev[inc.id] }));
    setUpdateDrafts((prev) => {
      if (prev[inc.id]) return prev;
      const defaultNext: SupportIncident['status'] =
        inc.status === 'investigating'
          ? 'identified'
          : inc.status === 'identified'
            ? 'monitoring'
            : inc.status;
      return {
        ...prev,
        [inc.id]: { status: defaultNext, message: '' },
      };
    });
  };

  const toggleComponentPreset = (comp: string) => {
    setSelectedComponents((prev) =>
      prev.includes(comp) ? prev.filter((c) => c !== comp) : [...prev, comp]
    );
  };

  const handleDeclareIncident = async () => {
    const cleanTitle = newTitle.trim();
    const cleanSummary = newSummary.trim();
    if (!cleanTitle || !cleanSummary) {
      showToast({
        variant: 'danger',
        label: 'Incident title and initial summary are required.',
      });
      return;
    }

    const extra = customComponents
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedComponents = Array.from(new Set([...selectedComponents, ...extra]));

    setCreating(true);
    try {
      const res = await opsHubService.createIncident({
        title: cleanTitle,
        severity: newSeverity,
        summary: cleanSummary,
        affectedComponents: mergedComponents,
      });
      setDeclareVisible(false);
      setNewTitle('');
      setNewSummary('');
      setSelectedComponents([]);
      setCustomComponents('');
      setExpandedIds((prev) => ({ ...prev, [res.incident.id]: true }));
      showToast({ variant: 'success', label: `Declared incident ${res.incident.code}.` });
      await loadIncidents(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not declare incident.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePostStatusUpdate = async (
    inc: SupportIncident,
    forcedStatus?: SupportIncident['status']
  ) => {
    const draft = updateDrafts[inc.id] || { status: inc.status, message: '' };
    const nextStatus = forcedStatus || draft.status;
    const cleanMessage =
      draft.message.trim() ||
      (nextStatus === 'resolved'
        ? 'Service stability has been restored and verified across affected systems.'
        : '');

    if (!cleanMessage) {
      showToast({ variant: 'danger', label: 'Enter a timeline update note first.' });
      return;
    }

    setPostingUpdateId(inc.id);
    try {
      const res = await opsHubService.addIncidentUpdate(inc.id, {
        status: nextStatus,
        message: cleanMessage,
      });
      setIncidents((prev) =>
        prev.map((item) => (item.id === inc.id ? res.incident : item))
      );
      setUpdateDrafts((prev) => ({
        ...prev,
        [inc.id]: { status: res.incident.status, message: '' },
      }));
      showToast({
        variant: 'success',
        label:
          nextStatus === 'resolved'
            ? `${inc.code} marked resolved.`
            : `Posted ${getStatusLabel(nextStatus)} update.`,
      });
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to post update.',
      });
    } finally {
      setPostingUpdateId(null);
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
              <Text style={[styles.pageTitle, { color: tokens.text }]}>Incident Status Board</Text>
              {counts.active > 0 ? (
                <PulsatingDot color={tokens.danger} size={7} active />
              ) : null}
            </View>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {counts.active > 0
                ? `${counts.active} active platform incident${counts.active > 1 ? 's' : ''}`
                : 'All platform services operational'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <BorderlessIconButton
            name="radio"
            size={18}
            color={tokens.accent}
            accessibilityLabel="Outage broadcast"
            onPress={() => onNavigateSubScreen('outage_broadcast')}
          />
          <ShimmerButton
            label="+ Declare Incident"
            size="xs"
            variant="danger"
            onPress={() => setDeclareVisible(true)}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        {(
          [
            { id: 'active', label: `Active (${counts.active})` },
            { id: 'resolved', label: `Resolved (${counts.resolved})` },
            { id: 'all', label: `All (${counts.all})` },
          ] as const
        ).map((tab) => {
          const active = filterTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setFilterTab(tab.id)}
              style={[
                styles.tabBtn,
                active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.tabLabel, { color: active ? tokens.text : tokens.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && incidents.length === 0 ? (
        <MagicSpinner label="Loading platform incidents..." />
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
                loadIncidents(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
        >
          {visibleIncidents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="check-circle" size={24} color={tokens.success} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                {filterTab === 'active'
                  ? 'No active outages or degraded services right now.'
                  : 'No incidents recorded in this filter.'}
              </Text>
            </View>
          ) : (
            visibleIncidents.map((inc, index) => {
              const expanded = Boolean(expandedIds[inc.id]);
              const draft = updateDrafts[inc.id] || {
                status: inc.status,
                message: '',
              };
              const updatesList = inc.updates || [];

              return (
                <AnimatedListItem key={inc.id} index={index}>
                  {index > 0 ? <Hairline style={styles.itemSep} /> : null}
                  <View style={styles.incidentBlock}>
                    {/* Top Meta */}
                    <View style={styles.incTopRow}>
                      <View style={styles.badgeCluster}>
                        <Text style={[styles.incCode, { color: tokens.textMuted }]}>
                          {inc.code}
                        </Text>
                        <FlatBadge
                          label={getStatusLabel(inc.severity)}
                          tone={getSeverityTone(inc.severity)}
                          withDot
                        />
                        <FlatBadge
                          label={getStatusLabel(inc.status)}
                          tone={getIncidentStatusTone(inc.status)}
                        />
                      </View>
                      <Text style={[styles.incTime, { color: tokens.textMuted }]}>
                        {formatRelativeTime(inc.updatedAt || inc.createdAt)}
                      </Text>
                    </View>

                    <Text style={[styles.incTitle, { color: tokens.text }]}>{inc.title}</Text>
                    <Text style={[styles.incSummary, { color: tokens.textSecondary }]}>
                      {inc.summary}
                    </Text>

                    {inc.affectedComponents && inc.affectedComponents.length > 0 ? (
                      <View style={styles.componentsRow}>
                        {inc.affectedComponents.map((comp) => (
                          <FlatBadge key={comp} label={comp} tone="neutral" />
                        ))}
                      </View>
                    ) : null}

                    {/* Action Bar */}
                    <View style={styles.incActionRow}>
                      <TouchableOpacity
                        onPress={() => toggleExpand(inc)}
                        style={styles.timelineToggle}
                        hitSlop={6}
                      >
                        <Feather
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color={tokens.accent}
                        />
                        <Text style={[styles.timelineToggleText, { color: tokens.accent }]}>
                          {expanded
                            ? 'Hide Timeline & Updater'
                            : `Timeline (${updatesList.length}) & Post Update`}
                        </Text>
                      </TouchableOpacity>

                      <ShimmerButton
                        label={`Broadcast Update (${inc.broadcastCount ?? 0})`}
                        size="xs"
                        variant="subtle"
                        leftIcon={<Feather name="radio" size={12} color={tokens.accent} />}
                        onPress={() =>
                          onNavigateSubScreen('outage_broadcast', { incidentId: inc.id })
                        }
                      />
                    </View>

                    {/* Expandable Timeline + Inline Status Updater */}
                    {expanded ? (
                      <View
                        style={[
                          styles.expandedBox,
                          {
                            backgroundColor: tokens.surfaceSubtle,
                            borderColor: tokens.hairlineStrong,
                          },
                        ]}
                      >
                        <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                          INCIDENT TIMELINE
                        </Text>

                        {updatesList.length === 0 ? (
                          <Text style={[styles.noUpdates, { color: tokens.textMuted }]}>
                            {`Declared by ${inc.createdByName || 'Staff'} on ${formatShortDateTime(inc.createdAt)}`}
                          </Text>
                        ) : (
                          <View style={styles.timelineList}>
                            {updatesList.map((upd, uIdx) => (
                              <View key={upd.id || `upd-${uIdx}`} style={styles.timelineItem}>
                                <View style={styles.timelineMeta}>
                                  <FlatBadge
                                    label={getStatusLabel(upd.status)}
                                    tone={getIncidentStatusTone(
                                      upd.status as SupportIncident['status']
                                    )}
                                  />
                                  <Text style={[styles.updAuthor, { color: tokens.textMuted }]}>
                                    {`${upd.authorName} · ${formatShortDateTime(upd.createdAt)}`}
                                  </Text>
                                </View>
                                <Text style={[styles.updMessage, { color: tokens.textSecondary }]}>
                                  {upd.message}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <Hairline />

                        {/* Inline Post Status Update / Mark Resolved Form */}
                        <View style={styles.inlineForm}>
                          <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                            POST STATUS UPDATE
                          </Text>

                          <View style={styles.statusChipRow}>
                            {INCIDENT_STATUSES.map((st) => {
                              const active = draft.status === st;
                              return (
                                <TouchableOpacity
                                  key={st}
                                  onPress={() =>
                                    setUpdateDrafts((prev) => ({
                                      ...prev,
                                      [inc.id]: { ...draft, status: st },
                                    }))
                                  }
                                  style={[
                                    styles.statusChip,
                                    {
                                      backgroundColor: active ? tokens.accentSoft : tokens.bg,
                                      borderColor: active
                                        ? tokens.accent
                                        : tokens.hairlineStrong,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusChipText,
                                      { color: active ? tokens.accent : tokens.textSecondary },
                                    ]}
                                  >
                                    {getStatusLabel(st)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <FlatInput
                            placeholder="Describe findings, mitigation progress, or resolution details..."
                            value={draft.message}
                            onChangeText={(txt) =>
                              setUpdateDrafts((prev) => ({
                                ...prev,
                                [inc.id]: { ...draft, message: txt },
                              }))
                            }
                            multiline
                            numberOfLines={3}
                            autoCapitalize="sentences"
                          />

                          <View style={styles.inlineFormActions}>
                            {inc.status !== 'resolved' ? (
                              <ShimmerButton
                                label="Mark Resolved"
                                size="xs"
                                variant="subtle"
                                loading={postingUpdateId === inc.id && draft.status === 'resolved'}
                                disabled={postingUpdateId !== null}
                                leftIcon={
                                  <Feather name="check-circle" size={12} color={tokens.success} />
                                }
                                onPress={() => handlePostStatusUpdate(inc, 'resolved')}
                              />
                            ) : (
                              <View />
                            )}

                            <ShimmerButton
                              label="Post Status Update"
                              size="xs"
                              variant="accent"
                              loading={postingUpdateId === inc.id}
                              disabled={postingUpdateId !== null}
                              onPress={() => handlePostStatusUpdate(inc)}
                            />
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </AnimatedListItem>
              );
            })
          )}
        </KeyboardAwareScrollView>
      )}

      {/* + Declare Incident Modal */}
      <MagicModalSheet
        visible={declareVisible}
        onClose={() => setDeclareVisible(false)}
        title="Declare Platform Incident"
        subtitle="Track service impact and coordinate mass ticket broadcasts"
      >
        <FlatInput
          label="Incident Title *"
          placeholder="e.g. Intermittent SSL Provisioning Delay on Custom Domains"
          value={newTitle}
          onChangeText={setNewTitle}
          autoCapitalize="sentences"
        />

        <View style={styles.modalField}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Severity</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => {
              const active = newSeverity === opt.id;
              const palette = getTonePalette(tokens, opt.tone);
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setNewSeverity(opt.id)}
                  style={[
                    styles.severityBtn,
                    {
                      backgroundColor: active ? palette.bg : tokens.surfaceSubtle,
                      borderColor: active ? palette.fg : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityBtnText,
                      { color: active ? palette.fg : tokens.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Summary & Customer Impact *"
          placeholder="Explain what customers are experiencing and current investigation scope..."
          value={newSummary}
          onChangeText={setNewSummary}
          multiline
          numberOfLines={4}
          autoCapitalize="sentences"
        />

        <View style={styles.modalField}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>
            Affected Components
          </Text>
          <View style={styles.presetGrid}>
            {COMPONENT_PRESETS.map((comp) => {
              const active = selectedComponents.includes(comp);
              return (
                <TouchableOpacity
                  key={comp}
                  onPress={() => toggleComponentPreset(comp)}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: active ? tokens.accent : tokens.textSecondary },
                    ]}
                  >
                    {comp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Additional Components (comma-separated)"
          placeholder="Webhook Worker, Email Relay"
          value={customComponents}
          onChangeText={setCustomComponents}
        />

        <View style={styles.modalFooter}>
          <TouchableOpacity onPress={() => setDeclareVisible(false)} hitSlop={8}>
            <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label="Declare Incident"
            size="sm"
            variant="danger"
            loading={creating}
            onPress={handleDeclareIncident}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 34,
  },
  itemSep: {
    marginVertical: 4,
  },
  incidentBlock: {
    paddingVertical: 12,
    gap: 8,
  },
  incTopRow: {
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
  },
  incCode: {
    fontSize: 11,
    fontWeight: '700',
  },
  incTime: {
    fontSize: 11,
  },
  incTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  incSummary: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  componentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  incActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
  },
  timelineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timelineToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  noUpdates: {
    fontSize: 12,
  },
  timelineList: {
    gap: 10,
  },
  timelineItem: {
    gap: 4,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  updAuthor: {
    fontSize: 11,
  },
  updMessage: {
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  inlineForm: {
    gap: 9,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  inlineFormActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  modalField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetGrid: {
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
