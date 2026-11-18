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
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, SupportAutomationRule } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  MagicModalSheet,
  MagicSpinner,
  MagicSwitch,
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

const TRIGGER_OPTIONS: {
  key: SupportAutomationRule['triggerField'];
  label: string;
  operator: string;
}[] = [
  { key: 'keyword', label: 'Keyword', operator: 'CONTAINS' },
  { key: 'priority', label: 'Priority', operator: 'EQUALS' },
  { key: 'category', label: 'Category', operator: 'EQUALS' },
  { key: 'requester_type', label: 'Requester Type', operator: 'EQUALS' },
  { key: 'channel', label: 'Channel', operator: 'EQUALS' },
];

const ACTION_OPTIONS: {
  key: SupportAutomationRule['actionType'];
  label: string;
  verb: string;
  presets: string[];
}[] = [
  {
    key: 'set_priority',
    label: 'Set Priority',
    verb: 'SET priority =',
    presets: ['urgent', 'high', 'medium', 'low'],
  },
  {
    key: 'set_department',
    label: 'Route Department',
    verb: 'SET department =',
    presets: ['Billing', 'Technical', 'Customer Support', 'Trust & Safety'],
  },
  {
    key: 'add_tag',
    label: 'Add Tag',
    verb: 'ADD tag =',
    presets: ['refund-request', 'vip-attention', 'billing-audit'],
  },
  {
    key: 'mark_escalated',
    label: 'Mark Escalated',
    verb: 'ESCALATE tier =',
    presets: ['tier_2', 'urgent_review'],
  },
];

function formatRuleFormula(rule: {
  triggerField: SupportAutomationRule['triggerField'];
  triggerValue: string;
  actionType: SupportAutomationRule['actionType'];
  actionValue: string;
}): string {
  const trig =
    TRIGGER_OPTIONS.find((t) => t.key === rule.triggerField) || TRIGGER_OPTIONS[0];
  const act =
    ACTION_OPTIONS.find((a) => a.key === rule.actionType) || ACTION_OPTIONS[0];
  return `WHEN ${rule.triggerField} ${trig.operator} "${rule.triggerValue || '...'}" → ${act.verb} ${rule.actionValue || '...'}`;
}

export const AutomationRulesScreen: React.FC<OpsScreenProps> = ({ onBack }) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<SupportAutomationRule[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'paused'>('all');
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  // Builder Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerField, setTriggerField] =
    useState<SupportAutomationRule['triggerField']>('keyword');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] =
    useState<SupportAutomationRule['actionType']>('set_priority');
  const [actionValue, setActionValue] = useState('high');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listAutomationRules();
        setRules(res.rules || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load automation rules.',
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
    loadRules(false);
  }, [loadRules]);

  const filteredRules = useMemo(() => {
    if (statusFilter === 'enabled') return rules.filter((r) => r.enabled);
    if (statusFilter === 'paused') return rules.filter((r) => !r.enabled);
    return rules;
  }, [rules, statusFilter]);

  const totalHits = useMemo(
    () => rules.reduce((sum, r) => sum + Number(r.hitsCount || 0), 0),
    [rules]
  );

  const openBuilder = (rule?: SupportAutomationRule) => {
    if (rule) {
      setEditingRuleId(rule.id);
      setName(rule.name);
      setDescription(rule.description || '');
      setTriggerField(rule.triggerField);
      setTriggerValue(rule.triggerValue);
      setActionType(rule.actionType);
      setActionValue(rule.actionValue);
      setEnabled(rule.enabled);
    } else {
      setEditingRuleId(undefined);
      setName('');
      setDescription('');
      setTriggerField('keyword');
      setTriggerValue('');
      setActionType('set_priority');
      setActionValue('high');
      setEnabled(true);
    }
    setModalVisible(true);
  };

  const handleToggleRule = async (rule: SupportAutomationRule, nextEnabled: boolean) => {
    setBusyRuleId(rule.id);
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextEnabled } : r))
    );
    try {
      const res = await opsHubService.saveAutomationRule({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        enabled: nextEnabled,
        triggerField: rule.triggerField,
        triggerValue: rule.triggerValue,
        actionType: rule.actionType,
        actionValue: rule.actionValue,
      });
      if (res.rule) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? res.rule : r)));
      }
      toast.show({
        variant: 'success',
        label: nextEnabled ? `Rule "${rule.name}" enabled.` : `Rule "${rule.name}" paused.`,
      });
    } catch (err) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r))
      );
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to toggle rule.',
      });
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleSaveRule = async () => {
    if (!name.trim() || !triggerValue.trim() || !actionValue.trim()) {
      toast.show({
        variant: 'danger',
        label: 'Provide rule name, trigger condition, and action target.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await opsHubService.saveAutomationRule({
        id: editingRuleId,
        name: name.trim(),
        description: description.trim() || undefined,
        enabled,
        triggerField,
        triggerValue: triggerValue.trim(),
        actionType,
        actionValue: actionValue.trim(),
      });
      if (res.rule) {
        setRules((prev) =>
          editingRuleId
            ? prev.map((r) => (r.id === editingRuleId ? res.rule : r))
            : [res.rule, ...prev]
        );
      } else {
        loadRules(true);
      }
      setModalVisible(false);
      toast.show({
        variant: 'success',
        label: editingRuleId ? 'Automation rule updated.' : 'Automation rule created.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to save rule.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    setBusyRuleId(id);
    try {
      await opsHubService.deleteAutomationRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.show({ variant: 'accent', label: 'Automation rule deleted.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not delete rule.',
      });
    } finally {
      setBusyRuleId(null);
    }
  };

  const activeActionOption =
    ACTION_OPTIONS.find((a) => a.key === actionType) || ACTION_OPTIONS[0];

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
            Auto-Triage & Automation Rules
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Instant intake routing, priority elevation & tagging
          </Text>
        </View>
        <ShimmerButton
          label="+ New Rule"
          size="xs"
          variant="accent"
          onPress={() => openBuilder()}
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
              loadRules(true);
            }}
          />
        }
      >
        {/* KPI Strip */}
        <BlurFade delay={0} offset={5}>
          <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>TOTAL RULES</Text>
              <NumberTicker
                value={rules.length}
                style={[styles.kpiVal, { color: tokens.text }]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>ACTIVE</Text>
              <NumberTicker
                value={rules.filter((r) => r.enabled).length}
                style={[styles.kpiVal, { color: tokens.success }]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>TOTAL HITS</Text>
              <NumberTicker
                value={totalHits}
                style={[styles.kpiVal, { color: tokens.accent }]}
              />
            </View>
          </View>
        </BlurFade>

        {/* Filter Tabs */}
        <View style={[styles.filterTabs, { borderBottomColor: tokens.hairline }]}>
          {(
            [
              { key: 'all', label: `All (${rules.length})` },
              {
                key: 'enabled',
                label: `Active (${rules.filter((r) => r.enabled).length})`,
              },
              {
                key: 'paused',
                label: `Paused (${rules.filter((r) => !r.enabled).length})`,
              },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setStatusFilter(tab.key)}
                style={[
                  styles.filterTab,
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

        {/* Rules List */}
        {loading && rules.length === 0 ? (
          <MagicSpinner label="Loading automation rules..." />
        ) : filteredRules.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No automation rules configured in this view.
          </Text>
        ) : (
          filteredRules.map((rule, idx) => (
            <AnimatedListItem key={rule.id} index={idx}>
              <View style={[styles.ruleRow, { borderBottomColor: tokens.hairlineStrong }]}>
                <View style={styles.ruleTop}>
                  <View style={styles.flex1}>
                    <View style={styles.ruleTitleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.ruleName, { color: tokens.text }]}
                      >
                        {rule.name}
                      </Text>
                      <FlatBadge
                        label={`${rule.hitsCount || 0} hits`}
                        tone={rule.hitsCount > 0 ? 'accent' : 'neutral'}
                      />
                    </View>
                    {rule.description ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.ruleDesc, { color: tokens.textMuted }]}
                      >
                        {rule.description}
                      </Text>
                    ) : null}
                  </View>

                  <MagicSwitch
                    value={rule.enabled}
                    disabled={busyRuleId === rule.id}
                    onValueChange={(next) => handleToggleRule(rule, next)}
                  />
                </View>

                {/* Crisp Trigger -> Action Formula Strip */}
                <View
                  style={[
                    styles.formulaBox,
                    {
                      backgroundColor: tokens.surfaceSubtle,
                      borderColor: tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Feather name="zap" size={12} color={tokens.accent} />
                  <Text style={[styles.formulaText, { color: tokens.textSecondary }]}>
                    {formatRuleFormula(rule)}
                  </Text>
                </View>

                <View style={styles.ruleFooter}>
                  <Text style={[styles.updatedText, { color: tokens.textMuted }]}>
                    {`Updated ${formatShortDateTime(rule.updatedAt)}`}
                  </Text>
                  <View style={styles.actionLinks}>
                    <TouchableOpacity onPress={() => openBuilder(rule)} hitSlop={8}>
                      <Text style={[styles.linkText, { color: tokens.accent }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyRuleId === rule.id}
                      onPress={() => handleDeleteRule(rule.id)}
                      hitSlop={8}
                    >
                      <Text style={[styles.linkText, { color: tokens.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* + New / Edit Rule Builder Modal */}
      <MagicModalSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingRuleId ? 'Edit Automation Rule' : 'New Auto-Triage Rule'}
        subtitle={formatRuleFormula({ triggerField, triggerValue, actionType, actionValue })}
      >
        <FlatInput
          label="Rule Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="e.g. Escalate Refund Keywords"
        />

        <FlatInput
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          autoCapitalize="sentences"
          placeholder="Routes billing refund inquiries directly to high priority"
        />

        <View style={styles.builderBlock}>
          <Text style={[styles.builderLabel, { color: tokens.textSecondary }]}>
            WHEN Trigger Field
          </Text>
          <View style={styles.chipWrap}>
            {TRIGGER_OPTIONS.map((opt) => {
              const active = triggerField === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.7}
                  onPress={() => setTriggerField(opt.key)}
                  style={[
                    styles.choiceChip,
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
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Trigger Match Value"
          value={triggerValue}
          onChangeText={setTriggerValue}
          placeholder={triggerField === 'keyword' ? 'refund' : 'Enter match value...'}
        />

        <View style={styles.builderBlock}>
          <Text style={[styles.builderLabel, { color: tokens.textSecondary }]}>
            THEN Action Type
          </Text>
          <View style={styles.chipWrap}>
            {ACTION_OPTIONS.map((opt) => {
              const active = actionType === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.7}
                  onPress={() => {
                    setActionType(opt.key);
                    if (opt.presets[0]) setActionValue(opt.presets[0]);
                  }}
                  style={[
                    styles.choiceChip,
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
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatInput
          label="Action Value"
          value={actionValue}
          onChangeText={setActionValue}
          placeholder="high"
        />

        <View style={styles.chipWrap}>
          {activeActionOption.presets.map((preset) => (
            <TouchableOpacity
              key={preset}
              activeOpacity={0.7}
              onPress={() => setActionValue(preset)}
              style={[
                styles.presetPill,
                {
                  backgroundColor:
                    actionValue === preset ? tokens.accentSoft : tokens.surfaceMuted,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: actionValue === preset ? tokens.accent : tokens.textMuted,
                }}
              >
                {preset}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalFooter}>
          <View style={styles.enablePair}>
            <MagicSwitch value={enabled} onValueChange={setEnabled} />
            <Text style={[styles.builderLabel, { color: tokens.text }]}>Rule Active</Text>
          </View>
          <ShimmerButton
            label={editingRuleId ? 'Update Rule' : 'Save Rule'}
            size="sm"
            variant="accent"
            loading={saving}
            onPress={handleSaveRule}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default AutomationRulesScreen;

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
  kpiVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  vSep: {
    width: 1,
    height: 26,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  ruleRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 9,
  },
  ruleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  ruleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  formulaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
  },
  formulaText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  ruleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updatedText: {
    fontSize: 11,
  },
  actionLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  builderBlock: {
    gap: 6,
  },
  builderLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  enablePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
