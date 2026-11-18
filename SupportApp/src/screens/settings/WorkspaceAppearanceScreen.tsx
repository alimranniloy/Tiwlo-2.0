import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  getWorkspacePreferences,
  subscribeWorkspacePreferences,
  updateWorkspacePreferences,
} from '../../services/preferencesService';
import { useAppTheme, type AppThemeMode } from '../../theme/ThemeContext';
import type { StaffWorkspacePreferences } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  BorderlessIconButton,
  FlatBadge,
  Hairline,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface WorkspaceAppearanceScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const LANDING_TABS: readonly {
  key: StaffWorkspacePreferences['defaultLandingTab'];
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'home', label: 'Home', icon: 'grid' },
  { key: 'tickets', label: 'Tickets', icon: 'inbox' },
  { key: 'livechat', label: 'Live Chat', icon: 'message-circle' },
];

export const WorkspaceAppearanceScreen: React.FC<WorkspaceAppearanceScreenProps> = ({ onBack }) => {
  const { theme, tokens, setTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [prefs, setPrefs] = useState<StaffWorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    getWorkspacePreferences().then((loaded) => {
      if (active) setPrefs(loaded);
    });
    const unsub = subscribeWorkspacePreferences(setPrefs);
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

  const handleSelectTheme = (mode: AppThemeMode) => {
    Haptics.selectionAsync().catch(() => {});
    setTheme(mode);
  };

  const handleResetLocalPreferences = async () => {
    setResetting(true);
    try {
      const next = await updateWorkspacePreferences({ ...DEFAULT_WORKSPACE_PREFERENCES });
      setPrefs(next);
      toast.show({
        variant: 'success',
        label: 'Local workspace preferences restored to defaults.',
      });
    } finally {
      setResetting(false);
    }
  };

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
            Appearance & Layout
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            Surface palette, list density, structural borders & startup tab
          </Text>
        </View>
        <FlatBadge label={theme === 'dark' ? 'Dark' : 'Light'} tone="accent" withDot />
      </View>

      <Hairline />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Light / Dark Theme Cards with 1px Active Border */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>COLOR THEME</Text>

        <View style={styles.themeRow}>
          {(
            [
              {
                mode: 'light' as const,
                title: 'Light Surface',
                sub: 'Crisp high-contrast daylight canvas',
                previewBg: '#FFFFFF',
                previewBar: '#F4F4F5',
                previewLine: '#E4E4E7',
                previewAccent: '#16A34A',
                icon: 'sun' as const,
              },
              {
                mode: 'dark' as const,
                title: 'Dark Surface',
                sub: 'Low-glare OLED night shift canvas',
                previewBg: '#09090B',
                previewBar: '#18181B',
                previewLine: '#27272A',
                previewAccent: '#22C55E',
                icon: 'moon' as const,
              },
            ] as const
          ).map((card) => {
            const active = theme === card.mode;
            return (
              <TouchableOpacity
                key={card.mode}
                activeOpacity={0.75}
                onPress={() => handleSelectTheme(card.mode)}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                    borderColor: active ? tokens.accent : tokens.hairlineStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.miniPreview,
                    {
                      backgroundColor: card.previewBg,
                      borderColor: card.previewLine,
                    },
                  ]}
                >
                  <View style={styles.miniTopDotRow}>
                    <View
                      style={[styles.miniAccentDot, { backgroundColor: card.previewAccent }]}
                    />
                    <View
                      style={[styles.miniShortBar, { backgroundColor: card.previewBar }]}
                    />
                  </View>
                  <View style={[styles.miniWideBar, { backgroundColor: card.previewBar }]} />
                  <View style={[styles.miniMidBar, { backgroundColor: card.previewBar }]} />
                </View>

                <View style={styles.themeTitleRow}>
                  <View style={styles.themeIconLabel}>
                    <Feather
                      name={card.icon}
                      size={13}
                      color={active ? tokens.accent : tokens.text}
                    />
                    <Text
                      style={[
                        styles.themeName,
                        { color: active ? tokens.accent : tokens.text },
                      ]}
                    >
                      {card.title}
                    </Text>
                  </View>
                  {active ? (
                    <Feather name="check-circle" size={14} color={tokens.accent} />
                  ) : null}
                </View>
                <Text style={[styles.themeSub, { color: tokens.textMuted }]}>{card.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* UI Density */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          WORKSPACE DENSITY & BORDERS
        </Text>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>UI List Density</Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Adjust vertical spacing across ticket queues and live chat streams
            </Text>
          </View>

          <View style={styles.densityRow}>
            {(
              [
                {
                  key: 'comfortable',
                  label: 'Comfortable',
                  sub: 'Standard breathing room',
                },
                {
                  key: 'compact',
                  label: 'Compact',
                  sub: 'Higher queue density',
                },
              ] as const
            ).map((opt) => {
              const selected = prefs.uiDensity === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    updateWorkspacePreferences({ uiDensity: opt.key });
                  }}
                  style={[
                    styles.densityChip,
                    {
                      backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.densityLabel,
                      { color: selected ? tokens.accent : tokens.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={[styles.densitySub, { color: tokens.textMuted }]}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="sidebar" size={17} color={tokens.text} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Selective Structural Borders
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Render crisp 1px hairlines on inputs, segmented controls & list dividers
              </Text>
            </View>
            <MagicSwitch
              value={prefs.selectiveBorders}
              onValueChange={(val) => updateWorkspacePreferences({ selectiveBorders: val })}
            />
          </View>
        </View>

        {/* Default Landing Tab */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          DEFAULT STARTUP TAB
        </Text>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>Default Landing Tab</Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Primary workspace screen opened right after signing in or unlocking
            </Text>
          </View>

          <View style={styles.tabsRow}>
            {LANDING_TABS.map((tab) => {
              const selected = prefs.defaultLandingTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    updateWorkspacePreferences({ defaultLandingTab: tab.key });
                    toast.show({
                      variant: 'success',
                      label: `Default landing tab set to ${tab.label}.`,
                    });
                  }}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: selected ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Feather
                    name={tab.icon}
                    size={14}
                    color={selected ? tokens.accent : tokens.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabChipLabel,
                      {
                        color: selected ? tokens.accent : tokens.text,
                        fontWeight: selected ? '700' : '500',
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reset Local Preferences */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          PREFERENCE STORAGE
        </Text>

        <View
          style={[
            styles.resetStrip,
            {
              backgroundColor: tokens.surfaceSubtle,
              borderColor: tokens.hairlineStrong,
            },
          ]}
        >
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>
              Reset Local Preferences
            </Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Restore ringtone duration, auto-lock, signature & layout settings to factory defaults
            </Text>
          </View>
          <ShimmerButton
            label="Reset Defaults"
            size="sm"
            variant="subtle"
            loading={resetting}
            onPress={handleResetLocalPreferences}
            leftIcon={<Feather name="rotate-ccw" size={12} color={tokens.text} />}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default WorkspaceAppearanceScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    gap: 7,
  },
  miniPreview: {
    borderWidth: 1,
    borderRadius: 7,
    padding: 8,
    gap: 5,
  },
  miniTopDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  miniShortBar: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
  },
  miniWideBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  miniMidBar: {
    width: '68%',
    height: 6,
    borderRadius: 3,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  themeIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  themeName: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  blockStack: {
    gap: 11,
  },
  subLabelGroup: {
    gap: 2,
  },
  densityRow: {
    flexDirection: 'row',
    gap: 9,
  },
  densityChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  densityLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  densitySub: {
    fontSize: 11,
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  tabChipLabel: {
    fontSize: 12,
  },
  resetStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
  },
});
