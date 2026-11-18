import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  getWorkspacePreferences,
  subscribeWorkspacePreferences,
  updateWorkspacePreferences,
} from '../../services/preferencesService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StaffWorkspacePreferences } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface ComposerSignatureSettingsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const AI_TONE_OPTIONS: readonly {
  key: StaffWorkspacePreferences['aiPreferredTone'];
  label: string;
  desc: string;
}[] = [
  {
    key: 'warm_brand',
    label: 'Warm Tiwlo Brand',
    desc: 'Friendly, reassuring, customer-first voice',
  },
  {
    key: 'concise_technical',
    label: 'Concise Technical',
    desc: 'Direct steps, root-cause clarity, zero fluff',
  },
  {
    key: 'empathetic_apology',
    label: 'Empathetic Resolution',
    desc: 'Calm ownership & de-escalation on urgent issues',
  },
];

const DAILY_GOAL_TARGETS = [10, 15, 25, 40] as const;

export const ComposerSignatureSettingsScreen: React.FC<ComposerSignatureSettingsScreenProps> = ({
  user,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [prefs, setPrefs] = useState<StaffWorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [signatureDraft, setSignatureDraft] = useState(
    DEFAULT_WORKSPACE_PREFERENCES.signatureText
  );
  const [savingSignature, setSavingSignature] = useState(false);

  useEffect(() => {
    let active = true;
    getWorkspacePreferences().then((loaded) => {
      if (!active) return;
      setPrefs(loaded);
      setSignatureDraft(loaded.signatureText);
    });
    const unsub = subscribeWorkspacePreferences((next) => {
      setPrefs(next);
      setSignatureDraft(next.signatureText);
    });
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      active = false;
      unsub();
      backSub.remove();
    };
  }, [onBack]);

  const handleSaveSignature = async () => {
    setSavingSignature(true);
    try {
      await updateWorkspacePreferences({ signatureText: signatureDraft });
      toast.show({ variant: 'success', label: 'Personal reply signature saved.' });
    } finally {
      setSavingSignature(false);
    }
  };

  const handleResetSignature = async () => {
    const fallback = `Best regards,\n${user.name || 'Tiwlo Support'}\nTiwlo Support Desk`;
    setSignatureDraft(fallback);
    await updateWorkspacePreferences({ signatureText: fallback });
    toast.show({ variant: 'accent', label: 'Signature reset to staff template.' });
  };

  const signatureDirty = signatureDraft !== prefs.signatureText;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.topBar}>
        <BorderlessIconButton
          name="arrow-left"
          size={19}
          onPress={onBack}
          accessibilityLabel="Back to settings"
        />
        <View style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: tokens.text }]}>
            Composer, Signature & AI
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            Reply signature, default composer mode, Gemini tone & daily goal
          </Text>
        </View>
        <FlatBadge
          label={prefs.defaultReplyMode === 'public' ? 'Public Default' : 'Internal Default'}
          tone="accent"
        />
      </View>

      <Hairline />

      <KeyboardAwareScrollView
        style={styles.flex1}
        bottomOffset={64}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Reply Signature */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          PERSONAL REPLY SIGNATURE
        </Text>

        <View style={styles.blockStack}>
          <FlatInput
            label="Signature Footer Text"
            value={signatureDraft}
            onChangeText={setSignatureDraft}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
            placeholder={'Best regards,\nTiwlo Support Team'}
          />

          <View style={styles.signatureActionsRow}>
            <ShimmerButton
              label={signatureDirty ? 'Save Signature' : 'Saved'}
              size="sm"
              variant={signatureDirty ? 'accent' : 'subtle'}
              loading={savingSignature}
              onPress={handleSaveSignature}
            />
            <TouchableOpacity onPress={handleResetSignature} hitSlop={8}>
              <Text style={[styles.resetLink, { color: tokens.accent }]}>
                Use my name template
              </Text>
            </TouchableOpacity>
          </View>

          {/* Live Preview */}
          <View
            style={[
              styles.previewBox,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.previewHeader}>
              <Text style={[styles.previewLabel, { color: tokens.textMuted }]}>
                LIVE PUBLIC REPLY PREVIEW
              </Text>
              <FlatBadge
                label={prefs.autoAppendSignature ? 'Auto-Append ON' : 'Manual Append'}
                tone={prefs.autoAppendSignature ? 'success' : 'neutral'}
              />
            </View>
            <Text style={[styles.previewMessage, { color: tokens.text }]}>
              Hi there, I have reviewed your ticket and confirmed that your account settlement is
              now active.
            </Text>
            {signatureDraft.trim().length > 0 ? (
              <Text
                style={[
                  styles.previewSignature,
                  {
                    color: prefs.autoAppendSignature ? tokens.textSecondary : tokens.textMuted,
                    borderTopColor: tokens.hairline,
                  },
                ]}
              >
                {signatureDraft.trim()}
              </Text>
            ) : null}
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="edit-3" size={17} color={tokens.accent} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Auto-append signature on public replies
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Automatically attach your signature when sending customer-facing replies
              </Text>
            </View>
            <MagicSwitch
              value={prefs.autoAppendSignature}
              onValueChange={(val) => updateWorkspacePreferences({ autoAppendSignature: val })}
            />
          </View>
        </View>

        {/* Default Composer Mode */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          TICKET COMPOSER BEHAVIOR
        </Text>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>
              Default Ticket Composer Mode
            </Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Choose which tab opens first inside ticket conversations
            </Text>
          </View>

          <View style={styles.dualRow}>
            {(
              [
                {
                  mode: 'public',
                  label: 'Public Reply',
                  icon: 'send',
                  sub: 'Visible to customer',
                },
                {
                  mode: 'internal',
                  label: 'Internal Note',
                  icon: 'lock',
                  sub: 'Staff-only whisper',
                },
              ] as const
            ).map((item) => {
              const active = prefs.defaultReplyMode === item.mode;
              return (
                <TouchableOpacity
                  key={item.mode}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    updateWorkspacePreferences({ defaultReplyMode: item.mode });
                  }}
                  style={[
                    styles.modeOption,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <View style={styles.modeTitleLine}>
                    <Feather
                      name={item.icon}
                      size={13}
                      color={active ? tokens.accent : tokens.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeTitleText,
                        { color: active ? tokens.accent : tokens.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <Text style={[styles.modeSubText, { color: tokens.textMuted }]}>
                    {item.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="eye" size={17} color={tokens.text} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Pre-Click Quick Peek Preview
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Enable instant message & reply-access drawer before opening full threads
              </Text>
            </View>
            <MagicSwitch
              value={prefs.preClickPreviewEnabled}
              onValueChange={(val) =>
                updateWorkspacePreferences({ preClickPreviewEnabled: val })
              }
            />
          </View>
        </View>

        {/* Preferred Gemini AI Tone */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          PREFERRED GEMINI AI TONE
        </Text>

        <View style={styles.toneStack}>
          {AI_TONE_OPTIONS.map((tone) => {
            const selected = prefs.aiPreferredTone === tone.key;
            return (
              <TouchableOpacity
                key={tone.key}
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  updateWorkspacePreferences({ aiPreferredTone: tone.key });
                  toast.show({
                    variant: 'success',
                    label: `AI Copilot tone set to ${tone.label}.`,
                  });
                }}
                style={[
                  styles.toneRow,
                  {
                    backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                    borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                  },
                ]}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: selected ? tokens.accent : tokens.text },
                    ]}
                  >
                    {tone.label}
                  </Text>
                  <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>{tone.desc}</Text>
                </View>
                <Feather
                  name={selected ? 'check-circle' : 'circle'}
                  size={16}
                  color={selected ? tokens.accent : tokens.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Daily Resolved Ticket Target */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          PERSONAL PRODUCTIVITY GOAL
        </Text>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>
              Daily Resolved Ticket Target
            </Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Personal benchmark tracked on your Desk Home ring indicator
            </Text>
          </View>

          <View style={styles.goalRow}>
            {DAILY_GOAL_TARGETS.map((goal) => {
              const selected = prefs.dailyResolvedGoal === goal;
              return (
                <TouchableOpacity
                  key={goal}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    updateWorkspacePreferences({ dailyResolvedGoal: goal });
                    toast.show({
                      variant: 'success',
                      label: `Daily resolved goal set to ${goal} tickets.`,
                    });
                  }}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalChipNumber,
                      { color: selected ? tokens.accent : tokens.text },
                    ]}
                  >
                    {goal}
                  </Text>
                  <Text style={[styles.goalChipUnit, { color: tokens.textMuted }]}>
                    / day
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default ComposerSignatureSettingsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topTitleWrap: {
    flex: 1,
    gap: 1,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  topSubtitle: {
    fontSize: 11.5,
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 14,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  blockStack: {
    gap: 11,
  },
  subLabelGroup: {
    gap: 2,
  },
  signatureActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    gap: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  previewMessage: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  previewSignature: {
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowTextCol: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  dualRow: {
    flexDirection: 'row',
    gap: 9,
  },
  modeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  modeTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeTitleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeSubText: {
    fontSize: 11,
  },
  toneStack: {
    gap: 8,
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  goalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
  },
  goalChipNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  goalChipUnit: {
    fontSize: 10.5,
  },
});
