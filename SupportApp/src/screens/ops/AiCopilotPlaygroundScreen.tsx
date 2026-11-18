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
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ApiRequestError } from '../../services/apiClient';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicSpinner,
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

type AiPlaygroundTask =
  | 'draft_reply'
  | 'polish'
  | 'translate_bn'
  | 'translate_en'
  | 'empathetic'
  | 'summarize'
  | 'kb_draft';

const AI_TASKS: { key: AiPlaygroundTask; label: string; hint: string }[] = [
  {
    key: 'draft_reply',
    label: 'Draft Reply',
    hint: 'Paste customer inquiry or context to draft a ready-to-send response...',
  },
  {
    key: 'polish',
    label: 'Polish Brand Tone',
    hint: 'Paste your rough draft to refine into warm, clear Tiwlo brand tone...',
  },
  {
    key: 'translate_bn',
    label: 'Translate → Bengali',
    hint: 'Enter English or mixed message to translate naturally into Bengali...',
  },
  {
    key: 'translate_en',
    label: 'Translate → English',
    hint: 'Enter customer message in Bengali or another language to translate to English...',
  },
  {
    key: 'empathetic',
    label: 'Empathetic Apology',
    hint: 'Describe the delay or issue to craft a sincere, reassuring apology...',
  },
  {
    key: 'summarize',
    label: 'Summarize Thread',
    hint: 'Paste a multi-message ticket or chat transcript for an executive summary...',
  },
  {
    key: 'kb_draft',
    label: 'Draft KB Article',
    hint: 'Describe a resolution workflow to turn into a structured Knowledge Base guide...',
  },
];

const DEFAULT_FAILOVER_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

export const AiCopilotPlaygroundScreen: React.FC<OpsScreenProps> = ({
  staffProfile,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [activeTab, setActiveTab] = useState<'studio' | 'health'>('studio');

  // Studio state
  const [selectedTask, setSelectedTask] = useState<AiPlaygroundTask>('draft_reply');
  const [customerName, setCustomerName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [runningAi, setRunningAi] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [outputModel, setOutputModel] = useState<string | null>(null);
  const [outputKeyLabel, setOutputKeyLabel] = useState<string | null>(null);

  // Key Pool & Models state
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [restrictedNotice, setRestrictedNotice] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<{
    config?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    keys?: Record<string, unknown>[];
  } | null>(null);

  const loadSystemHealth = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingHealth(true);
      try {
        const res = await opsHubService.getAiSystemHealth();
        setHealthData(res || {});
        setRestrictedNotice(null);
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 403 || err.status === 401)) {
          setRestrictedNotice(
            'Detailed API key pool telemetry is restricted to Super Admins. Gemini AI Copilot studio routing and automatic key failover remain active for your desk.'
          );
          setHealthData(null);
        } else if (!silent) {
          setRestrictedNotice(
            err instanceof Error
              ? err.message
              : 'Showing baseline Gemini model routing configuration.'
          );
        }
      } finally {
        setLoadingHealth(false);
        setRefreshingHealth(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === 'health') {
      loadSystemHealth(false);
    }
  }, [activeTab, loadSystemHealth]);

  const handleRunPlayground = async () => {
    if (!sourceText.trim()) {
      toast.show({ variant: 'danger', label: 'Enter source text or prompt context first.' });
      return;
    }
    setRunningAi(true);
    try {
      const res = await opsHubService.runAiPlayground({
        task: selectedTask,
        input: sourceText.trim(),
        customerName: customerName.trim() || undefined,
      });
      setAiOutput(res.output || '');
      setOutputModel(res.model || 'gemini-2.5-flash');
      setOutputKeyLabel(res.keyLabel || null);
      toast.show({ variant: 'success', label: 'Gemini response generated.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Gemini AI request failed.',
      });
    } finally {
      setRunningAi(false);
    }
  };

  const handleShareOutput = async () => {
    if (!aiOutput.trim()) return;
    try {
      await Share.share({
        title: 'Tiwlo Gemini Copilot Output',
        message: aiOutput,
      });
    } catch {
      // Share sheet dismissed
    }
  };

  const parsedPoolMetrics = useMemo(() => {
    const summary = healthData?.summary || {};
    const config = healthData?.config || {};
    const keys = Array.isArray(healthData?.keys) ? healthData!.keys! : [];

    const totalKeys = Number(
      summary.totalKeys ?? summary.keysCount ?? summary.total ?? keys.length
    );
    const healthyKeys = Number(
      summary.healthyKeys ??
        summary.activeKeys ??
        summary.availableKeys ??
        keys.filter(
          (k) =>
            k.isActive !== false &&
            !k.cooldownUntil &&
            String(k.status || 'healthy').toLowerCase() !== 'cooldown'
        ).length
    );
    const cooldownKeys = Number(
      summary.cooldownKeys ??
        summary.rateLimitedKeys ??
        keys.filter(
          (k) =>
            Boolean(k.cooldownUntil) ||
            String(k.status || '').toLowerCase() === 'cooldown' ||
            String(k.status || '').toLowerCase() === 'rate_limited'
        ).length
    );

    const preferredModel = String(
      config.preferredModel ||
        config.primaryModel ||
        config.model ||
        summary.preferredModel ||
        outputModel ||
        'gemini-2.5-flash'
    );

    const rawCandidates =
      config.candidateModels ||
      config.failoverModels ||
      config.fallbackModels ||
      config.models ||
      summary.candidateModels;

    const candidateModels: string[] = Array.isArray(rawCandidates)
      ? rawCandidates.map((m) => String(m)).filter(Boolean)
      : DEFAULT_FAILOVER_MODELS;

    return {
      totalKeys,
      healthyKeys,
      cooldownKeys,
      preferredModel,
      candidateModels:
        candidateModels.length > 0 ? candidateModels : DEFAULT_FAILOVER_MODELS,
      keys,
    };
  }, [healthData, outputModel]);

  const currentTaskObj = AI_TASKS.find((t) => t.key === selectedTask) || AI_TASKS[0];

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
            Gemini AI Copilot Lab
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Drafting studio, translation & Gemini key pool health
          </Text>
        </View>
        <FlatBadge
          label={staffProfile.isSuperAdmin ? 'Super Admin' : 'AI Ready'}
          tone="accent"
          withDot
        />
      </View>

      {/* Dual-Tab Strip */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('studio')}
          style={[
            styles.tabBtn,
            activeTab === 'studio' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'studio' ? tokens.text : tokens.textMuted },
            ]}
          >
            AI Studio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('health')}
          style={[
            styles.tabBtn,
            activeTab === 'health' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'health' ? tokens.text : tokens.textMuted },
            ]}
          >
            Key Pool & Models
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'studio' ? (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Task Selector Chips */}
          <BlurFade delay={0} offset={5}>
            <View style={styles.blockGap}>
              <Text style={[styles.secLabel, { color: tokens.textSecondary }]}>
                Select Copilot Task
              </Text>
              <View style={styles.taskWrap}>
                {AI_TASKS.map((task) => {
                  const active = selectedTask === task.key;
                  return (
                    <TouchableOpacity
                      key={task.key}
                      activeOpacity={0.7}
                      onPress={() => setSelectedTask(task.key)}
                      style={[
                        styles.taskChip,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: active ? tokens.accent : tokens.textSecondary,
                        }}
                      >
                        {task.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </BlurFade>

          {/* Optional Customer Name + Source Text */}
          <FlatInput
            label="Customer Name (Optional)"
            value={customerName}
            onChangeText={setCustomerName}
            autoCapitalize="words"
            placeholder="e.g. Ayesha Rahman"
          />

          <FlatInput
            label="Source Text / Thread Context"
            value={sourceText}
            onChangeText={setSourceText}
            autoCapitalize="sentences"
            autoCorrect
            multiline
            numberOfLines={5}
            placeholder={currentTaskObj.hint}
            inputStyle={{ minHeight: 108 }}
          />

          <View style={styles.runRow}>
            {sourceText.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setSourceText('');
                  setAiOutput('');
                }}
                hitSlop={8}
              >
                <Text style={[styles.clearLink, { color: tokens.textMuted }]}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <ShimmerButton
              label="Run Gemini AI"
              size="sm"
              variant="accent"
              loading={runningAi}
              leftIcon={<Feather name="zap" size={13} color={tokens.accentText} />}
              onPress={handleRunPlayground}
            />
          </View>

          {/* Output Box */}
          {aiOutput ? (
            <BlurFade delay={20} offset={6}>
              <View
                style={[
                  styles.outputBox,
                  {
                    backgroundColor: tokens.surfaceSubtle,
                    borderColor: tokens.hairlineStrong,
                  },
                ]}
              >
                <View style={styles.outputHeader}>
                  <View style={styles.badgePair}>
                    <FlatBadge label={outputModel || 'gemini'} tone="accent" withDot />
                    {outputKeyLabel ? (
                      <FlatBadge label={outputKeyLabel} tone="neutral" />
                    ) : null}
                  </View>

                  <View style={styles.outputBtns}>
                    <ShimmerButton
                      label="Use as Input"
                      size="xs"
                      variant="subtle"
                      onPress={() => setSourceText(aiOutput)}
                    />
                    <ShimmerButton
                      label="Share / Copy"
                      size="xs"
                      variant="primary"
                      leftIcon={
                        <Feather name="share-2" size={11} color={tokens.inkButtonText} />
                      }
                      onPress={handleShareOutput}
                    />
                  </View>
                </View>

                <Hairline />

                <Text selectable style={[styles.outputText, { color: tokens.text }]}>
                  {aiOutput}
                </Text>
              </View>
            </BlurFade>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingHealth}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshingHealth(true);
                loadSystemHealth(true);
              }}
            />
          }
        >
          {loadingHealth && !healthData && !restrictedNotice ? (
            <MagicSpinner label="Inspecting Gemini key pool & failover routing..." />
          ) : (
            <>
              {/* Live Gemini Status Strip */}
              <View
                style={[
                  styles.statusStrip,
                  {
                    backgroundColor: tokens.surfaceSubtle,
                    borderColor: tokens.hairlineStrong,
                  },
                ]}
              >
                <PulsatingDot color={tokens.success} size={8} active />
                <View style={styles.flex1}>
                  <Text style={[styles.statusTitle, { color: tokens.text }]}>
                    Gemini Multi-Key Failover Engine Operational
                  </Text>
                  <Text style={[styles.statusSub, { color: tokens.textMuted }]}>
                    {`Preferred model: ${parsedPoolMetrics.preferredModel}`}
                  </Text>
                </View>
                <FlatBadge label="Healthy" tone="success" />
              </View>

              {restrictedNotice ? (
                <FlatNotice text={restrictedNotice} tone="accent" icon="shield" />
              ) : null}

              {/* Key Pool KPI Strip */}
              {healthData ? (
                <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
                  <View style={styles.kpiCell}>
                    <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>
                      ACTIVE POOL
                    </Text>
                    <NumberTicker
                      value={parsedPoolMetrics.totalKeys}
                      style={[styles.kpiVal, { color: tokens.text }]}
                    />
                  </View>
                  <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
                  <View style={styles.kpiCell}>
                    <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>HEALTHY</Text>
                    <NumberTicker
                      value={parsedPoolMetrics.healthyKeys}
                      style={[styles.kpiVal, { color: tokens.success }]}
                    />
                  </View>
                  <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
                  <View style={styles.kpiCell}>
                    <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>COOLDOWN</Text>
                    <NumberTicker
                      value={parsedPoolMetrics.cooldownKeys}
                      style={[
                        styles.kpiVal,
                        {
                          color:
                            parsedPoolMetrics.cooldownKeys > 0
                              ? tokens.warning
                              : tokens.text,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {/* Preferred + Candidate Failover Models */}
              <View style={styles.blockGap}>
                <Text style={[styles.secHeading, { color: tokens.text }]}>
                  Preferred & Candidate Failover Models
                </Text>
                {parsedPoolMetrics.candidateModels.map((modelName, idx) => {
                  const isPrimary = modelName === parsedPoolMetrics.preferredModel || idx === 0;
                  return (
                    <AnimatedListItem key={modelName} index={idx}>
                      <View style={[styles.modelRow, { borderBottomColor: tokens.hairline }]}>
                        <Feather
                          name="cpu"
                          size={15}
                          color={isPrimary ? tokens.accent : tokens.textMuted}
                        />
                        <Text
                          style={[
                            styles.modelName,
                            { color: tokens.text, flex: 1 },
                          ]}
                        >
                          {modelName}
                        </Text>
                        <FlatBadge
                          label={isPrimary ? 'Preferred' : `Failover #${idx}`}
                          tone={isPrimary ? 'accent' : 'neutral'}
                        />
                      </View>
                    </AnimatedListItem>
                  );
                })}
              </View>

              {/* Individual Key Pool Rows (Super Admin View) */}
              {parsedPoolMetrics.keys.length > 0 ? (
                <View style={styles.blockGap}>
                  <Hairline strong />
                  <Text style={[styles.secHeading, { color: tokens.text }]}>
                    Key Pool Slots ({parsedPoolMetrics.keys.length})
                  </Text>
                  {parsedPoolMetrics.keys.map((keyItem, idx) => {
                    const label = String(
                      keyItem.label || keyItem.maskedKey || keyItem.id || `Key #${idx + 1}`
                    );
                    const inCooldown =
                      Boolean(keyItem.cooldownUntil) ||
                      String(keyItem.status || '').toLowerCase() === 'cooldown';
                    const active = keyItem.isActive !== false;
                    return (
                      <View
                        key={`${label}-${idx}`}
                        style={[styles.keyRow, { borderBottomColor: tokens.hairline }]}
                      >
                        <View style={styles.flex1}>
                          <Text style={[styles.modelName, { color: tokens.text }]}>
                            {label}
                          </Text>
                          <Text style={[styles.keySub, { color: tokens.textMuted }]}>
                            {keyItem.requestsCount !== undefined
                              ? `${String(keyItem.requestsCount)} requests served`
                              : 'Automatic round-robin slot'}
                          </Text>
                        </View>
                        <FlatBadge
                          label={!active ? 'Disabled' : inCooldown ? 'Cooldown' : 'Healthy'}
                          tone={!active ? 'neutral' : inCooldown ? 'warning' : 'success'}
                          withDot
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

export default AiCopilotPlaygroundScreen;

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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 13,
  },
  blockGap: {
    gap: 8,
  },
  secLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  secHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  taskChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearLink: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  outputBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outputBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  outputText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 11.5,
    marginTop: 1,
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
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  keySub: {
    fontSize: 11,
    marginTop: 1,
  },
});
