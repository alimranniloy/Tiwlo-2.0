import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { SupportIncident } from '../../types/opsHub';
import type { SupportTicket } from '../../types/support';
import { getStatusLabel } from '../../utils/formatters';
import {
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicSpinner,
  NumberTicker,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type TargetAudienceFilter = 'open_tickets' | 'escalated_tickets' | 'linked_only';

const AUDIENCE_OPTIONS: {
  id: TargetAudienceFilter;
  label: string;
  description: string;
}[] = [
  {
    id: 'open_tickets',
    label: 'All Open Tickets',
    description: 'Customers with open, in-progress, or waiting tickets',
  },
  {
    id: 'escalated_tickets',
    label: 'Escalated Tickets',
    description: 'High-priority & escalated customer conversations only',
  },
  {
    id: 'linked_only',
    label: 'Linked Tickets',
    description: 'Tickets explicitly linked to the selected incident',
  },
];

export const OutageBroadcastScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onNavigateSubScreen,
  routeParams,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const initialIncidentId = routeParams?.incidentId || '';

  const [incidents, setIncidents] = useState<SupportIncident[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    initialIncidentId || 'custom'
  );
  const [customAdvisoryTitle, setCustomAdvisoryTitle] = useState('');
  const [targetAudience, setTargetAudience] = useState<TargetAudienceFilter>('open_tickets');
  const [message, setMessage] = useState('');

  const [aiPolishing, setAiPolishing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [lastDispatchSummary, setLastDispatchSummary] = useState<string>('');

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, tRes] = await Promise.all([
        opsHubService.listIncidents('all'),
        supportService.listTickets({ limit: 100 }),
      ]);
      const loadedIncidents = incRes.incidents || [];
      setIncidents(loadedIncidents);
      setTickets(tRes.tickets || []);

      const matchedIncident =
        (initialIncidentId
          ? loadedIncidents.find((i) => i.id === initialIncidentId)
          : undefined) ||
        loadedIncidents.find((i) => i.status !== 'resolved') ||
        null;

      if (matchedIncident) {
        setSelectedIncidentId(matchedIncident.id);
        setMessage((prev) =>
          prev.trim()
            ? prev
            : `Status Advisory (${matchedIncident.code} — ${matchedIncident.title}): ${matchedIncident.summary} Our engineering team is actively ${matchedIncident.status} and will post an update as soon as service is fully restored.`
        );
      } else {
        setSelectedIncidentId('custom');
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to load broadcast data.',
      });
    } finally {
      setLoading(false);
    }
  }, [initialIncidentId, showToast]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) || null,
    [incidents, selectedIncidentId]
  );

  const audienceCounts = useMemo(() => {
    const openCount = tickets.filter((t) => {
      const s = String(t.status || '').toLowerCase();
      return s !== 'closed' && s !== 'resolved';
    }).length;
    const escalatedCount = tickets.filter(
      (t) => String(t.status || '').toLowerCase() === 'escalated'
    ).length;
    const linkedCount = selectedIncident?.linkedTicketIds?.length || 0;

    return {
      open_tickets: openCount,
      escalated_tickets: escalatedCount,
      linked_only: linkedCount,
    };
  }, [selectedIncident?.linkedTicketIds?.length, tickets]);

  const estimatedRecipients = audienceCounts[targetAudience];

  const handleAiPolish = async () => {
    const raw = message.trim();
    if (!raw) {
      showToast({ variant: 'danger', label: 'Write a draft broadcast message first.' });
      return;
    }
    setAiPolishing(true);
    try {
      const res = await opsHubService.runAiPlayground({
        task: 'polish',
        input: raw,
      });
      if (res.output?.trim()) {
        setMessage(res.output.trim());
        showToast({ variant: 'accent', label: 'Broadcast advisory polished with Gemini AI.' });
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'AI polish failed.',
      });
    } finally {
      setAiPolishing(false);
    }
  };

  const handleDispatchBroadcast = async () => {
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      showToast({ variant: 'danger', label: 'Broadcast message cannot be empty.' });
      return;
    }

    if (selectedIncidentId === 'custom' && targetAudience === 'linked_only') {
      showToast({
        variant: 'danger',
        label: 'Select an existing incident to broadcast to linked tickets, or choose Open Tickets.',
      });
      return;
    }

    setDispatching(true);
    setLastDispatchSummary('');
    try {
      let targetIncidentId = selectedIncidentId;

      if (targetIncidentId === 'custom') {
        const created = await opsHubService.createIncident({
          title: customAdvisoryTitle.trim() || 'Platform Service Advisory',
          severity: 'minor',
          summary: cleanMsg.slice(0, 200),
          affectedComponents: ['Service Advisory'],
        });
        targetIncidentId = created.incident.id;
        setIncidents((prev) => [created.incident, ...prev]);
        setSelectedIncidentId(created.incident.id);
      }

      const res = await opsHubService.broadcastIncidentUpdate(targetIncidentId, {
        message: cleanMsg,
        targetFilter: targetAudience,
      });

      setIncidents((prev) =>
        prev.map((item) => (item.id === res.incident.id ? res.incident : item))
      );

      const summary = `Broadcast delivered to ${res.notifiedCount} customer ticket${res.notifiedCount === 1 ? '' : 's'} under ${res.incident.code}.`;
      setLastDispatchSummary(summary);
      showToast({ variant: 'success', label: summary });
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Broadcast dispatch failed.',
      });
    } finally {
      setDispatching(false);
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
            <Text style={[styles.pageTitle, { color: tokens.text }]}>Outage Broadcast</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              Mass status advisory dispatch to affected tickets
            </Text>
          </View>
        </View>

        <ShimmerButton
          label="Incidents"
          size="xs"
          variant="subtle"
          onPress={() => onNavigateSubScreen('incident_board')}
        />
      </View>

      {loading ? (
        <MagicSpinner label="Preparing broadcast studio..." />
      ) : (
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={72}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {lastDispatchSummary ? (
            <FlatNotice text={lastDispatchSummary} tone="success" icon="check-circle" />
          ) : null}

          {/* Step 1: Select Active Incident or Custom Advisory */}
          <BlurFade delay={20} offset={6}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                1. SELECT INCIDENT OR CUSTOM ADVISORY
              </Text>

              <View style={styles.incidentChoices}>
                {incidents.map((inc) => {
                  const active = selectedIncidentId === inc.id;
                  return (
                    <TouchableOpacity
                      key={inc.id}
                      onPress={() => {
                        setSelectedIncidentId(inc.id);
                        setMessage(
                          `Status Advisory (${inc.code} — ${inc.title}): ${inc.summary} Our team is currently ${inc.status} and will update your ticket once resolved.`
                        );
                      }}
                      style={[
                        styles.incidentOption,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <View style={styles.incOptTop}>
                        <Text
                          style={[
                            styles.incOptCode,
                            { color: active ? tokens.accent : tokens.textMuted },
                          ]}
                        >
                          {inc.code}
                        </Text>
                        <FlatBadge
                          label={getStatusLabel(inc.status)}
                          tone={inc.status === 'resolved' ? 'success' : 'warning'}
                        />
                      </View>
                      <Text numberOfLines={1} style={[styles.incOptTitle, { color: tokens.text }]}>
                        {inc.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setSelectedIncidentId('custom')}
                  style={[
                    styles.incidentOption,
                    {
                      backgroundColor:
                        selectedIncidentId === 'custom'
                          ? tokens.accentSoft
                          : tokens.surfaceSubtle,
                      borderColor:
                        selectedIncidentId === 'custom'
                          ? tokens.accent
                          : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <View style={styles.incOptTop}>
                    <Text
                      style={[
                        styles.incOptCode,
                        {
                          color:
                            selectedIncidentId === 'custom'
                              ? tokens.accent
                              : tokens.textMuted,
                        },
                      ]}
                    >
                      CUSTOM ADVISORY
                    </Text>
                    <FlatBadge label="Ad-Hoc" tone="neutral" />
                  </View>
                  <Text style={[styles.incOptTitle, { color: tokens.text }]}>
                    Create standalone service advisory & broadcast
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedIncidentId === 'custom' ? (
                <FlatInput
                  label="Custom Advisory Headline"
                  placeholder="e.g. Scheduled Gateway Maintenance Notice"
                  value={customAdvisoryTitle}
                  onChangeText={setCustomAdvisoryTitle}
                  autoCapitalize="sentences"
                />
              ) : null}
            </View>
          </BlurFade>

          <Hairline />

          {/* Step 2: Target Audience */}
          <BlurFade delay={50} offset={6}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                2. TARGET AUDIENCE
              </Text>

              <View style={styles.audienceStack}>
                {AUDIENCE_OPTIONS.map((opt) => {
                  const active = targetAudience === opt.id;
                  const count = audienceCounts[opt.id];
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setTargetAudience(opt.id)}
                      style={[
                        styles.audienceRow,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <View style={styles.audienceMeta}>
                        <Text
                          style={[
                            styles.audienceLabel,
                            { color: active ? tokens.accent : tokens.text },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={[styles.audienceDesc, { color: tokens.textMuted }]}>
                          {opt.description}
                        </Text>
                      </View>
                      <FlatBadge
                        label={`${count} tickets`}
                        tone={active ? 'accent' : 'neutral'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </BlurFade>

          <Hairline />

          {/* Step 3: Compose & AI-Polish Broadcast */}
          <BlurFade delay={80} offset={6}>
            <View style={styles.section}>
              <View style={styles.composeHeader}>
                <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                  3. BROADCAST MESSAGE
                </Text>
                <ShimmerButton
                  label="Gemini AI Polish"
                  size="xs"
                  variant="subtle"
                  loading={aiPolishing}
                  disabled={dispatching}
                  leftIcon={<Feather name="zap" size={12} color={tokens.accent} />}
                  onPress={handleAiPolish}
                />
              </View>

              <FlatInput
                placeholder="Write a calm, transparent status update that will be posted directly into each recipient ticket..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                autoCapitalize="sentences"
                autoCorrect
                inputStyle={styles.messageBox}
              />
            </View>
          </BlurFade>

          {/* Recipient Preview & Dispatch Strip */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.previewLeft}>
              <Text style={[styles.previewTitle, { color: tokens.text }]}>
                Recipient Dispatch Preview
              </Text>
              <Text style={[styles.previewSub, { color: tokens.textMuted }]}>
                {selectedIncident
                  ? `${selectedIncident.code} · ${AUDIENCE_OPTIONS.find((a) => a.id === targetAudience)?.label}`
                  : `Custom Advisory · ${AUDIENCE_OPTIONS.find((a) => a.id === targetAudience)?.label}`}
              </Text>
            </View>

            <View style={styles.recipientCounter}>
              <NumberTicker
                value={estimatedRecipients}
                style={[styles.recipientNum, { color: tokens.accent }]}
              />
              <Text style={[styles.recipientCaption, { color: tokens.textMuted }]}>
                recipients
              </Text>
            </View>
          </View>

          <View style={styles.dispatchFooter}>
            <TouchableOpacity onPress={onBack} disabled={dispatching} hitSlop={8}>
              <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <ShimmerButton
              label="Dispatch Mass Update"
              size="sm"
              variant="accent"
              loading={dispatching}
              disabled={aiPolishing}
              leftIcon={<Feather name="send" size={13} color={tokens.accentText} />}
              onPress={handleDispatchBroadcast}
            />
          </View>
        </KeyboardAwareScrollView>
      )}
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
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  incidentChoices: {
    gap: 8,
  },
  incidentOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  incOptTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incOptCode: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  incOptTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  audienceStack: {
    gap: 8,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  audienceMeta: {
    flex: 1,
    gap: 2,
  },
  audienceLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  audienceDesc: {
    fontSize: 11.5,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  messageBox: {
    minHeight: 120,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  previewLeft: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: 11.5,
  },
  recipientCounter: {
    alignItems: 'flex-end',
  },
  recipientNum: {
    fontSize: 20,
    fontWeight: '700',
  },
  recipientCaption: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  dispatchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
