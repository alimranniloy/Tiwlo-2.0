import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { logoutAccount } from '../../services/authService';
import {
  getBackgroundMonitorPreference,
  getNotificationPermissionStatus,
} from '../../services/notificationService';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  getWorkspacePreferences,
  subscribeWorkspacePreferences,
} from '../../services/preferencesService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, StaffWorkspacePreferences } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  FlatBadge,
  Hairline,
  MagicAvatar,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { AccountProfileDetailScreen } from '../settings/AccountProfileDetailScreen';
import { ComposerSignatureSettingsScreen } from '../settings/ComposerSignatureSettingsScreen';
import { NotificationRingSettingsScreen } from '../settings/NotificationRingSettingsScreen';
import { SecurityPinSessionScreen } from '../settings/SecurityPinSessionScreen';
import { SystemSwitchesConfigScreen } from '../settings/SystemSwitchesConfigScreen';
import { WorkspaceAppearanceScreen } from '../settings/WorkspaceAppearanceScreen';

export interface ProfileSettingsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onLogout: () => void;
  onRefreshSession: () => Promise<void>;
  onNavigateSubScreen?: (screen: DedicatedScreenKey) => void;
  onLockNow?: () => void;
}

export const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  user,
  staffProfile,
  onLogout,
  onRefreshSession,
  onNavigateSubScreen,
  onLockNow,
}) => {
  const { theme, tokens, setTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [prefs, setPrefs] = useState<StaffWorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [notifAllowed, setNotifAllowed] = useState(true);
  const [bgEnabled, setBgEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fallback internal sub-screen routing when parent does not pass onNavigateSubScreen
  const [localSubScreen, setLocalSubScreen] = useState<DedicatedScreenKey | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getWorkspacePreferences(),
      getNotificationPermissionStatus().catch(() => true),
      getBackgroundMonitorPreference().catch(() => true),
    ]).then(([loadedPrefs, perm, bg]) => {
      if (!active) return;
      setPrefs(loadedPrefs);
      setNotifAllowed(perm);
      setBgEnabled(bg);
    });

    const unsub = subscribeWorkspacePreferences(setPrefs);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleOpenSubPage = (screen: DedicatedScreenKey) => {
    Haptics.selectionAsync().catch(() => {});
    if (onNavigateSubScreen) {
      onNavigateSubScreen(screen);
      return;
    }
    setLocalSubScreen(screen);
  };

  const handleToggleOnlinePresence = async () => {
    if (presenceBusy) return;
    const nextOnline = !isOnline;
    setPresenceBusy(true);
    setIsOnline(nextOnline);
    try {
      await supportService.updatePresence(nextOnline);
      toast.show({
        variant: nextOnline ? 'success' : 'accent',
        label: nextOnline
          ? 'Desk status set to Online.'
          : 'Desk status set to Away.',
      });
    } catch {
      // Keep local toggle responsive even if offline
      toast.show({
        variant: 'accent',
        label: nextOnline ? 'Marked Online locally.' : 'Marked Away locally.',
      });
    } finally {
      setPresenceBusy(false);
    }
  };

  const handleLockDesk = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (onLockNow) {
      onLockNow();
      return;
    }
    handleOpenSubPage('settings_security_pin');
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutAccount();
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  if (localSubScreen) {
    const sharedProps = {
      user,
      staffProfile,
      onBack: () => setLocalSubScreen(null),
      onRefreshSession,
      onLockNow,
    };
    switch (localSubScreen) {
      case 'settings_notifications_ring':
        return <NotificationRingSettingsScreen {...sharedProps} />;
      case 'settings_security_pin':
        return <SecurityPinSessionScreen {...sharedProps} />;
      case 'settings_composer_signature':
        return <ComposerSignatureSettingsScreen {...sharedProps} />;
      case 'settings_appearance':
        return <WorkspaceAppearanceScreen {...sharedProps} />;
      case 'settings_system_switches':
        return <SystemSwitchesConfigScreen {...sharedProps} />;
      case 'settings_account_profile':
        return <AccountProfileDetailScreen {...sharedProps} />;
      default:
        break;
    }
  }

  const avatarUri = resolveWebsiteUrl(user.avatar);
  const canManageSettings =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).includes('manage_system_settings') ||
    (staffProfile.permissions || []).includes('support.manage_settings');

  const toneLabel =
    prefs.aiPreferredTone === 'concise_technical'
      ? 'Concise AI'
      : prefs.aiPreferredTone === 'empathetic_apology'
        ? 'Empathetic AI'
        : 'Warm Brand AI';

  const navItems: readonly {
    key: DedicatedScreenKey;
    icon: React.ComponentProps<typeof Feather>['name'];
    title: string;
    subtitle: string;
    badgeLabel?: string;
    badgeTone?: 'success' | 'warning' | 'accent' | 'neutral';
  }[] = [
    {
      key: 'settings_notifications_ring',
      icon: 'bell',
      title: 'Notifications & 10s Call Ring',
      subtitle: `${prefs.ringDurationSeconds}s call ring · ${
        bgEnabled ? 'Background listener active' : 'Listener paused'
      }`,
      badgeLabel: notifAllowed ? `${prefs.ringDurationSeconds}s` : 'Enable',
      badgeTone: notifAllowed ? 'success' : 'warning',
    },
    {
      key: 'settings_security_pin',
      icon: 'shield',
      title: 'App Lock, PIN & Security',
      subtitle: `${
        prefs.requirePinOnLaunch ? 'Launch PIN ON' : 'Launch PIN OFF'
      } · Auto-lock: ${
        prefs.autoLockMinutes === 0 ? 'Immediate' : `${prefs.autoLockMinutes}m`
      }`,
      badgeLabel: staffProfile.hasPin ? 'PIN Set' : 'No PIN',
      badgeTone: staffProfile.hasPin ? 'accent' : 'warning',
    },
    {
      key: 'settings_composer_signature',
      icon: 'edit-3',
      title: 'Composer, Signature & AI',
      subtitle: `Default: ${
        prefs.defaultReplyMode === 'public' ? 'Public Reply' : 'Internal Note'
      } · ${toneLabel} · ${prefs.dailyResolvedGoal}/day`,
    },
    {
      key: 'settings_appearance',
      icon: 'sliders',
      title: 'Appearance & Layout',
      subtitle: `${theme === 'dark' ? 'Dark' : 'Light'} surface · ${
        prefs.uiDensity === 'compact' ? 'Compact' : 'Comfortable'
      } · Start: ${prefs.defaultLandingTab}`,
    },
    {
      key: 'settings_system_switches',
      icon: 'cpu',
      title: 'Support Feature Switches',
      subtitle: 'Live Chat widget, guest tickets, attachments & Gemini AI rules',
      badgeLabel: canManageSettings ? 'Admin' : 'View',
      badgeTone: canManageSettings ? 'success' : 'neutral',
    },
    {
      key: 'settings_account_profile',
      icon: 'user-check',
      title: 'Staff Profile & Permissions',
      subtitle: `Role: ${staffProfile.roleKey} · RBAC chips & reply eligibility`,
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: tokens.bg }]}
      contentContainerStyle={styles.scrollBody}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={styles.headerBlock}>
        <Text style={[styles.pageTitle, { color: tokens.text }]}>Settings</Text>
        <Text style={[styles.subText, { color: tokens.textMuted }]}>
          Call ring alerts, PIN security, composer preferences & system controls
        </Text>
      </View>

      {/* Staff Identity Summary Row */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOpenSubPage('settings_account_profile')}
        style={[
          styles.profileHero,
          {
            backgroundColor: tokens.surfaceSubtle,
            borderColor: tokens.hairlineStrong,
          },
        ]}
      >
        <MagicAvatar
          name={user.name || staffProfile.name}
          uri={avatarUri}
          size={46}
          online={isOnline}
        />
        <View style={styles.profileTextCol}>
          <Text numberOfLines={1} style={[styles.userName, { color: tokens.text }]}>
            {user.name || staffProfile.name}
          </Text>
          <Text numberOfLines={1} style={[styles.userEmail, { color: tokens.textMuted }]}>
            {user.email}
          </Text>
          <View style={styles.badgeRow}>
            <FlatBadge
              label={staffProfile.roleKey.replace(/_/g, ' ').toUpperCase()}
              tone="accent"
              withDot
            />
            {staffProfile.isSuperAdmin ? (
              <FlatBadge label="Super Admin" tone="success" />
            ) : null}
            <FlatBadge
              label={staffProfile.hasPin ? 'PIN Armed' : 'Setup PIN'}
              tone={staffProfile.hasPin ? 'neutral' : 'warning'}
            />
          </View>
        </View>
        <Feather name="chevron-right" size={17} color={tokens.textMuted} />
      </TouchableOpacity>

      {/* Quick Dark Mode & Online / Lock Actions */}
      <View
        style={[
          styles.quickBar,
          {
            backgroundColor: tokens.surfaceSubtle,
            borderColor: tokens.hairlineStrong,
          },
        ]}
      >
        <View style={[styles.quickTopRow, { borderBottomColor: tokens.hairline }]}>
          <View style={styles.quickLeft}>
            <Feather
              name={theme === 'dark' ? 'moon' : 'sun'}
              size={15}
              color={tokens.accent}
            />
            <Text style={[styles.quickLabel, { color: tokens.text }]}>Dark Mode</Text>
          </View>
          <MagicSwitch
            value={theme === 'dark'}
            onValueChange={(dark) => setTheme(dark ? 'dark' : 'light')}
          />
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={presenceBusy}
            onPress={handleToggleOnlinePresence}
            style={[
              styles.quickPillBtn,
              {
                backgroundColor: isOnline ? tokens.accentSoft : tokens.bg,
                borderColor: isOnline ? tokens.accent : tokens.hairlineStrong,
              },
            ]}
          >
            <View
              style={[
                styles.presenceDot,
                { backgroundColor: isOnline ? tokens.success : tokens.warning },
              ]}
            />
            <Text
              style={[
                styles.quickPillText,
                { color: isOnline ? tokens.accent : tokens.textSecondary },
              ]}
            >
              {isOnline ? 'Desk Online' : 'Away Mode'}
            </Text>
          </TouchableOpacity>

          <ShimmerButton
            label="Lock Desk"
            size="sm"
            variant="subtle"
            onPress={handleLockDesk}
            leftIcon={<Feather name="lock" size={12} color={tokens.text} />}
          />
        </View>
      </View>

      {/* Dedicated Settings Sub-Pages Navigation */}
      <Text style={[styles.sectionHeading, { color: tokens.textMuted }]}>
        WORKSPACE & SECURITY SUITE
      </Text>

      <View style={styles.navList}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.65}
            onPress={() => handleOpenSubPage(item.key)}
            style={[styles.navRow, { borderBottomColor: tokens.hairline }]}
          >
            <View
              style={[
                styles.navIconWrap,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <Feather name={item.icon} size={16} color={tokens.accent} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: tokens.text }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.rowDesc, { color: tokens.textMuted }]}>
                {item.subtitle}
              </Text>
            </View>
            {item.badgeLabel ? (
              <FlatBadge label={item.badgeLabel} tone={item.badgeTone || 'neutral'} />
            ) : null}
            <Feather name="chevron-right" size={16} color={tokens.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <Hairline strong style={styles.bottomDivider} />

      {/* Minimal Flat Sign-Out Row */}
      <TouchableOpacity
        disabled={loggingOut}
        activeOpacity={0.65}
        onPress={handleLogout}
        style={styles.signOutRow}
      >
        <Feather name="log-out" size={17} color={tokens.danger} />
        <View style={styles.rowTextCol}>
          <Text style={[styles.signOutTitle, { color: tokens.danger }]}>Sign out</Text>
          <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
            End this staff session on this device
          </Text>
        </View>
        {loggingOut ? (
          <ActivityIndicator size="small" color={tokens.danger} />
        ) : (
          <Feather name="chevron-right" size={16} color={tokens.danger} />
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ProfileSettingsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 14,
  },
  headerBlock: {
    gap: 2,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subText: {
    fontSize: 12,
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  profileTextCol: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickBar: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  quickTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  quickPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 2,
  },
  navList: {},
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 11.5,
  },
  bottomDivider: {
    marginTop: 4,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  signOutTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
});
