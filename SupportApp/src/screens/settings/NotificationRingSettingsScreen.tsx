import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  getBackgroundMonitorPreference,
  getNotificationPermissionStatus,
  initializeNotificationsOnLaunch,
  isBatteryOptimizationIgnored,
  requestBatteryOptimizationExemption,
  setBackgroundMonitorPreference,
  stopSupportRingtone,
  syncAuthenticatedBackgroundMonitor,
  triggerSupportCallRingtone,
} from '../../services/notificationService';
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
  FlatNotice,
  Hairline,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface NotificationRingSettingsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const RING_DURATIONS: readonly (5 | 10 | 15)[] = [5, 10, 15];

const QUIET_PRESETS: readonly { label: string; start: string; end: string }[] = [
  { label: '23:00 – 07:00', start: '23:00', end: '07:00' },
  { label: '00:00 – 06:00', start: '00:00', end: '06:00' },
  { label: '22:00 – 08:00', start: '22:00', end: '08:00' },
];

export const NotificationRingSettingsScreen: React.FC<NotificationRingSettingsScreenProps> = ({
  user,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [prefs, setPrefs] = useState<StaffWorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [notifAllowed, setNotifAllowed] = useState(true);
  const [batteryExempt, setBatteryExempt] = useState(true);
  const [bgMonitorEnabled, setBgMonitorEnabled] = useState(true);

  const [quietStartDraft, setQuietStartDraft] = useState('23:00');
  const [quietEndDraft, setQuietEndDraft] = useState('07:00');

  const [isRingingTest, setIsRingingTest] = useState(false);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSystemPermissions = useCallback(async () => {
    try {
      const [perm, bat, bg] = await Promise.all([
        getNotificationPermissionStatus(),
        isBatteryOptimizationIgnored(),
        getBackgroundMonitorPreference(),
      ]);
      setNotifAllowed(perm);
      setBatteryExempt(bat);
      setBgMonitorEnabled(bg);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    let active = true;
    getWorkspacePreferences().then((loaded) => {
      if (!active) return;
      setPrefs(loaded);
      setQuietStartDraft(loaded.quietHoursStart);
      setQuietEndDraft(loaded.quietHoursEnd);
    });
    const unsub = subscribeWorkspacePreferences((next) => {
      setPrefs(next);
      setQuietStartDraft(next.quietHoursStart);
      setQuietEndDraft(next.quietHoursEnd);
    });
    Promise.all([
      getNotificationPermissionStatus(),
      isBatteryOptimizationIgnored(),
      getBackgroundMonitorPreference(),
    ])
      .then(([perm, bat, bg]) => {
        if (!active) return;
        setNotifAllowed(perm);
        setBatteryExempt(bat);
        setBgMonitorEnabled(bg);
      })
      .catch(() => {});

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshSystemPermissions();
      }
    });

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => {
      active = false;
      unsub();
      appSub.remove();
      backSub.remove();
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      stopSupportRingtone().catch(() => {});
    };
  }, [onBack, refreshSystemPermissions]);

  const handleRequestNotifPermission = async () => {
    const granted = await initializeNotificationsOnLaunch();
    setNotifAllowed(granted);
    if (granted) {
      toast.show({ variant: 'success', label: 'System notifications enabled.' });
    } else {
      toast.show({ variant: 'accent', label: 'Opening OS notification settings...' });
      Linking.openSettings().catch(() => {});
    }
  };

  const handleRequestBatteryExemption = async () => {
    await requestBatteryOptimizationExemption();
    setTimeout(() => {
      isBatteryOptimizationIgnored()
        .then((exempt) => {
          setBatteryExempt(exempt);
          if (exempt) {
            toast.show({
              variant: 'success',
              label: 'Always-on background execution granted.',
            });
          }
        })
        .catch(() => {});
    }, 900);
  };

  const handleToggleBgMonitor = async (enabled: boolean) => {
    setBgMonitorEnabled(enabled);
    await setBackgroundMonitorPreference(enabled);
    await syncAuthenticatedBackgroundMonitor(user.id);
    toast.show({
      variant: enabled ? 'success' : 'accent',
      label: enabled ? 'Background live listener enabled.' : 'Background listener paused.',
    });
  };

  const handleSelectRingDuration = async (seconds: 5 | 10 | 15) => {
    Haptics.selectionAsync().catch(() => {});
    await updateWorkspacePreferences({ ringDurationSeconds: seconds });
    toast.show({ variant: 'success', label: `Call ring duration set to ${seconds}s.` });
  };

  const handleTestRingtone = async () => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    setIsRingingTest(true);
    if (prefs.vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    await triggerSupportCallRingtone(prefs.ringDurationSeconds * 1000);
    toast.show({
      variant: 'accent',
      label: `Playing ${prefs.ringDurationSeconds}s incoming support call ringtone...`,
    });
    ringTimerRef.current = setTimeout(() => {
      setIsRingingTest(false);
    }, prefs.ringDurationSeconds * 1000);
  };

  const handleStopRingtone = async () => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    setIsRingingTest(false);
    await stopSupportRingtone();
    toast.show({ variant: 'default', label: 'Call ringtone stopped.' });
  };

  const handleToggleVibration = async (enabled: boolean) => {
    if (enabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await updateWorkspacePreferences({ vibrationEnabled: enabled });
  };

  const handleSaveQuietHoursWindow = async (startVal: string, endVal: string) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startVal.trim()) || !timeRegex.test(endVal.trim())) {
      toast.show({
        variant: 'danger',
        label: 'Use 24-hour HH:MM format (for example 23:00 and 07:00).',
      });
      return;
    }
    await updateWorkspacePreferences({
      quietHoursStart: startVal.trim(),
      quietHoursEnd: endVal.trim(),
    });
    toast.show({
      variant: 'success',
      label: `Quiet hours updated (${startVal.trim()} – ${endVal.trim()}).`,
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Sub-Screen Top Bar */}
      <View style={styles.topBar}>
        <BorderlessIconButton
          name="arrow-left"
          size={19}
          onPress={onBack}
          accessibilityLabel="Back to settings"
        />
        <View style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: tokens.text }]}>
            Notifications & Call Ring
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            System permissions, background service & {prefs.ringDurationSeconds}s ring alerts
          </Text>
        </View>
        <FlatBadge
          label={notifAllowed && bgMonitorEnabled ? 'Active' : 'Action Needed'}
          tone={notifAllowed && bgMonitorEnabled ? 'success' : 'warning'}
          withDot
        />
      </View>

      <Hairline />

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* OS & Background Permissions */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          SYSTEM & BACKGROUND PERMISSIONS
        </Text>

        <View style={styles.rowsGroup}>
          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather
              name="bell"
              size={17}
              color={notifAllowed ? tokens.accent : tokens.warning}
            />
            <View style={styles.rowTextCol}>
              <View style={styles.rowTitleInline}>
                <Text style={[styles.rowTitle, { color: tokens.text }]}>
                  System Notification Permission
                </Text>
                <FlatBadge
                  label={notifAllowed ? 'Granted' : 'Denied'}
                  tone={notifAllowed ? 'success' : 'warning'}
                />
              </View>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                {notifAllowed
                  ? 'OS banner & high-priority incoming support alerts are enabled.'
                  : 'Required so new live chats and tickets alert your device immediately.'}
              </Text>
            </View>
            <ShimmerButton
              label={notifAllowed ? 'Verify' : 'Enable'}
              size="xs"
              variant={notifAllowed ? 'subtle' : 'accent'}
              onPress={handleRequestNotifPermission}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather
              name="battery-charging"
              size={17}
              color={batteryExempt ? tokens.accent : tokens.warning}
            />
            <View style={styles.rowTextCol}>
              <View style={styles.rowTitleInline}>
                <Text style={[styles.rowTitle, { color: tokens.text }]}>
                  Always Run in Background
                </Text>
                <FlatBadge
                  label={batteryExempt ? 'Unrestricted' : 'Optimized'}
                  tone={batteryExempt ? 'success' : 'warning'}
                />
              </View>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                {batteryExempt
                  ? 'Exempt from battery killer — survives screen lock & reboots.'
                  : 'Exempt SupportApp from OS battery optimization for reliable rings.'}
              </Text>
            </View>
            <ShimmerButton
              label={batteryExempt ? 'Recheck' : 'Allow'}
              size="xs"
              variant={batteryExempt ? 'subtle' : 'accent'}
              onPress={handleRequestBatteryExemption}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="activity" size={17} color={tokens.accent} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                Background Live Listener
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Maintain persistent queue monitor when app is minimized or locked
              </Text>
            </View>
            <MagicSwitch value={bgMonitorEnabled} onValueChange={handleToggleBgMonitor} />
          </View>
        </View>

        {/* Call Ringtone Duration & Live Test */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          INCOMING CALL RINGTONE & HAPTICS
        </Text>

        <View style={styles.blockStack}>
          <View style={styles.subLabelGroup}>
            <Text style={[styles.rowTitle, { color: tokens.text }]}>Call Ringtone Duration</Text>
            <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
              Length of audio ring burst when an unaccepted live chat or ticket arrives
            </Text>
          </View>

          <View style={styles.segmentedRow}>
            {RING_DURATIONS.map((sec) => {
              const active = prefs.ringDurationSeconds === sec;
              return (
                <TouchableOpacity
                  key={sec}
                  activeOpacity={0.75}
                  onPress={() => handleSelectRingDuration(sec)}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Feather
                    name="volume-2"
                    size={13}
                    color={active ? tokens.accent : tokens.textMuted}
                  />
                  <Text
                    style={[
                      styles.durationChipLabel,
                      {
                        color: active ? tokens.accent : tokens.text,
                        fontWeight: active ? '700' : '600',
                      },
                    ]}
                  >
                    {sec}s {sec === 10 ? '(Default)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Live Test & Stop Ringtone Controls */}
          <View
            style={[
              styles.testBar,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: isRingingTest ? tokens.accent : tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>
                {isRingingTest ? 'Ringtone Playing Now...' : 'Live Audio Ring Diagnostics'}
              </Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Preview device speaker volume with a {prefs.ringDurationSeconds}s test call alert
              </Text>
            </View>
            <View style={styles.testBtns}>
              <ShimmerButton
                label="Test Call Ringtone"
                size="sm"
                variant="accent"
                onPress={handleTestRingtone}
                leftIcon={<Feather name="phone-call" size={12} color={tokens.accentText} />}
              />
              <ShimmerButton
                label="Stop Ringtone"
                size="sm"
                variant={isRingingTest ? 'danger' : 'subtle'}
                onPress={handleStopRingtone}
                leftIcon={
                  <Feather
                    name="volume-x"
                    size={12}
                    color={isRingingTest ? '#FFFFFF' : tokens.text}
                  />
                }
              />
            </View>
          </View>

          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="smartphone" size={17} color={tokens.text} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>Vibration & Haptics</Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Pulse device vibration alongside incoming support call alerts
              </Text>
            </View>
            <MagicSwitch
              value={prefs.vibrationEnabled}
              onValueChange={handleToggleVibration}
            />
          </View>
        </View>

        {/* Quiet Hours Schedule */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          QUIET HOURS SCHEDULE
        </Text>

        <View style={styles.blockStack}>
          <View style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}>
            <Feather name="moon" size={17} color={tokens.text} />
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>Enable Quiet Hours</Text>
              <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                Mute non-critical alerts outside your active support shift window
              </Text>
            </View>
            <MagicSwitch
              value={prefs.quietHoursEnabled}
              onValueChange={(val) => updateWorkspacePreferences({ quietHoursEnabled: val })}
            />
          </View>

          {prefs.quietHoursEnabled ? (
            <View
              style={[
                styles.quietBox,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <View style={styles.presetsRow}>
                {QUIET_PRESETS.map((preset) => {
                  const selected =
                    prefs.quietHoursStart === preset.start &&
                    prefs.quietHoursEnd === preset.end;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      activeOpacity={0.7}
                      onPress={() => {
                        setQuietStartDraft(preset.start);
                        setQuietEndDraft(preset.end);
                        handleSaveQuietHoursWindow(preset.start, preset.end);
                      }}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: selected ? tokens.accentSoft : tokens.bg,
                          borderColor: selected ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          { color: selected ? tokens.accent : tokens.textSecondary },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.timeInputsRow}>
                <FlatInput
                  label="Start (24h)"
                  value={quietStartDraft}
                  onChangeText={setQuietStartDraft}
                  placeholder="23:00"
                  maxLength={5}
                  style={styles.flex1}
                />
                <FlatInput
                  label="End (24h)"
                  value={quietEndDraft}
                  onChangeText={setQuietEndDraft}
                  placeholder="07:00"
                  maxLength={5}
                  style={styles.flex1}
                />
              </View>

              <ShimmerButton
                label="Save Quiet Window"
                size="sm"
                onPress={() => handleSaveQuietHoursWindow(quietStartDraft, quietEndDraft)}
              />
            </View>
          ) : null}
        </View>

        {/* Mandatory 5-Minute Repeat Policy */}
        <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
          SLA ESCALATION POLICY
        </Text>

        <FlatNotice
          tone="accent"
          icon="phone-incoming"
          text="5-Minute Mandatory Repeat Policy: Any waiting live chat or unaccepted ticket assignment automatically triggers a call ringtone and repeats every 5 minutes until accepted by an online agent or resolved."
        />
      </ScrollView>
    </View>
  );
};

export default NotificationRingSettingsScreen;

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
  rowsGroup: {},
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
  rowTitleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  blockStack: {
    gap: 11,
  },
  subLabelGroup: {
    gap: 2,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  durationChipLabel: {
    fontSize: 12,
  },
  testBar: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    gap: 10,
  },
  testBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  quietBox: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
    gap: 11,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
