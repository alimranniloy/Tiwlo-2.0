import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { SITE_CONFIG } from '../config/siteConfig';
import {
  markSupportAlertHandled,
  stopSupportRingtone,
  triggerForegroundAlertNotification,
} from '../services/notificationService';
import { getWorkspacePreferences } from '../services/preferencesService';
import { supportService } from '../services/supportService';
import { useAppTheme } from '../theme/ThemeContext';
import type { DedicatedScreenKey, SubScreenRoute } from '../types/opsHub';
import type { AuthUser, StaffProfileMe, SupportTabKey } from '../types/support';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { PulsatingDot, useMagicToast } from '../components/magicui';
import { DeskHomeScreen } from '../screens/desk/DeskHomeScreen';
import { LiveChatRoomScreen } from '../screens/livechat/LiveChatRoomScreen';
import { LiveChatsScreen } from '../screens/livechat/LiveChatsScreen';
import { AgentLeaderboardScreen } from '../screens/ops/AgentLeaderboardScreen';
import { AiCopilotPlaygroundScreen } from '../screens/ops/AiCopilotPlaygroundScreen';
import { AuditSecurityLogsScreen } from '../screens/ops/AuditSecurityLogsScreen';
import { AutomationRulesScreen } from '../screens/ops/AutomationRulesScreen';
import { CannedMacrosStudioScreen } from '../screens/ops/CannedMacrosStudioScreen';
import { CsatExplorerScreen } from '../screens/ops/CsatExplorerScreen';
import { CustomerDirectoryScreen } from '../screens/ops/CustomerDirectoryScreen';
import { CustomerProfile360Screen } from '../screens/ops/CustomerProfile360Screen';
import { DepartmentsRoutingScreen } from '../screens/ops/DepartmentsRoutingScreen';
import { EscalationQueueScreen } from '../screens/ops/EscalationQueueScreen';
import { IncidentStatusBoardScreen } from '../screens/ops/IncidentStatusBoardScreen';
import { InternalTeamWallScreen } from '../screens/ops/InternalTeamWallScreen';
import { KnowledgeArticleEditorScreen } from '../screens/ops/KnowledgeArticleEditorScreen';
import { KnowledgeBaseScreen } from '../screens/ops/KnowledgeBaseScreen';
import { OutageBroadcastScreen } from '../screens/ops/OutageBroadcastScreen';
import { PersonalNotesTasksScreen } from '../screens/ops/PersonalNotesTasksScreen';
import { PlatformOpsAnalyticsScreen } from '../screens/ops/PlatformOpsAnalyticsScreen';
import { QaTicketReviewScreen } from '../screens/ops/QaTicketReviewScreen';
import { ShiftHandoverScreen } from '../screens/ops/ShiftHandoverScreen';
import { SlaCommandCenterScreen } from '../screens/ops/SlaCommandCenterScreen';
import { SpamAbuseShieldScreen } from '../screens/ops/SpamAbuseShieldScreen';
import { StaffAccessApprovalsScreen } from '../screens/ops/StaffAccessApprovalsScreen';
import { StaffDirectoryPresenceScreen } from '../screens/ops/StaffDirectoryPresenceScreen';
import { TicketCreateInternalScreen } from '../screens/ops/TicketCreateInternalScreen';
import { UnifiedInboxScreen } from '../screens/ops/UnifiedInboxScreen';
import { ProfileSettingsScreen } from '../screens/profile/ProfileSettingsScreen';
import { AccountProfileDetailScreen } from '../screens/settings/AccountProfileDetailScreen';
import { ComposerSignatureSettingsScreen } from '../screens/settings/ComposerSignatureSettingsScreen';
import { NotificationRingSettingsScreen } from '../screens/settings/NotificationRingSettingsScreen';
import { SecurityPinSessionScreen } from '../screens/settings/SecurityPinSessionScreen';
import { SystemSwitchesConfigScreen } from '../screens/settings/SystemSwitchesConfigScreen';
import { WorkspaceAppearanceScreen } from '../screens/settings/WorkspaceAppearanceScreen';
import { TicketDetailScreen } from '../screens/tickets/TicketDetailScreen';
import { TicketsScreen } from '../screens/tickets/TicketsScreen';
import { ToolsScreen } from '../screens/tools/ToolsScreen';

interface MainAppShellProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onLogout: () => void;
  onRefreshSession: () => Promise<void>;
  onLockNow?: () => void;
}

const TAB_ITEMS: {
  key: SupportTabKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { key: 'home', label: 'Home', icon: 'grid' },
  { key: 'tickets', label: 'Tickets', icon: 'inbox' },
  { key: 'livechat', label: 'Live Chat', icon: 'message-circle' },
  { key: 'tools', label: 'Ops Hub', icon: 'layers' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export const MainAppShell: React.FC<MainAppShellProps> = ({
  user,
  staffProfile,
  onLogout,
  onRefreshSession,
  onLockNow,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [activeTab, setActiveTab] = useState<SupportTabKey>('home');
  const [ticketQueuePreset, setTicketQueuePreset] = useState<string>('all');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [subRouteStack, setSubRouteStack] = useState<SubScreenRoute[]>([]);
  const [waitingChatsCount, setWaitingChatsCount] = useState(0);
  const [unacceptedTicketsCount, setUnacceptedTicketsCount] = useState(0);

  const seenChatKeyRef = useRef<string | null>(null);
  const seenTicketKeyRef = useRef<string | null>(null);
  const firstPulseDoneRef = useRef(false);

  useEffect(() => {
    getWorkspacePreferences()
      .then((prefs) => {
        if (prefs.defaultLandingTab) {
          setActiveTab(prefs.defaultLandingTab);
        }
      })
      .catch(() => {});
  }, []);

  const pushSubScreen = useCallback(
    (screen: DedicatedScreenKey, params?: Record<string, string | undefined>) => {
      setSubRouteStack((prev) => [...prev, { screen, params }]);
    },
    []
  );

  const popSubScreen = useCallback(() => {
    setSubRouteStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const refreshPulseAlerts = useCallback(async () => {
    try {
      const [res, prefs] = await Promise.all([
        supportService.getPulseAlerts(),
        getWorkspacePreferences(),
      ]);
      const nextChats = Number(res.waitingChatsCount || 0);
      const nextTickets = Number(res.unacceptedTicketsCount || 0);
      setWaitingChatsCount(nextChats);
      setUnacceptedTicketsCount(nextTickets);

      const latestChatId = res.latestWaitingChat?.id || null;
      const latestChatKey = res.latestWaitingChat?.alertKey || latestChatId;
      const latestTicketId = res.latestUnacceptedTicket?.id || null;
      const latestTicketKey = res.latestUnacceptedTicket?.alertKey || latestTicketId;

      if (nextChats === 0 && nextTickets === 0) {
        stopSupportRingtone().catch(() => {});
      }

      if (firstPulseDoneRef.current) {
        if (latestChatId && latestChatKey && latestChatKey !== seenChatKeyRef.current && nextChats > 0) {
          const guest = res.latestWaitingChat?.guestName || 'Visitor';
          const topic = res.latestWaitingChat?.topic || 'New live chat request';
          const cycle = Number(res.latestWaitingChat?.reminderCycle || 0);
          const prefix = cycle > 0 ? `Reminder (${cycle * 5}m) · ` : '';
          markSupportAlertHandled('livechat', latestChatKey).catch(() => {});
          toast.show({ variant: 'accent', label: `${prefix}Live Chat: ${guest}` });
          triggerForegroundAlertNotification({
            title: `${prefix}Live Chat ${res.latestWaitingChat?.chatNumber || ''}`.trim(),
            body: `${guest}: ${topic} — Tap to Accept`,
            ring: !prefs.quietHoursEnabled,
            data: { type: 'livechat', id: latestChatId },
          }).catch(() => {});
        }
        if (
          latestTicketId &&
          latestTicketKey &&
          latestTicketKey !== seenTicketKeyRef.current &&
          nextTickets > 0
        ) {
          const serial = res.latestUnacceptedTicket?.serialNumber || 'Ticket';
          const subj = res.latestUnacceptedTicket?.subject || 'New support ticket';
          const cycle = Number(res.latestUnacceptedTicket?.reminderCycle || 0);
          const prefix = cycle > 0 ? `Reminder (${cycle * 5}m) · ` : '';
          markSupportAlertHandled('ticket', latestTicketKey).catch(() => {});
          toast.show({ variant: 'accent', label: `${prefix}Ticket ${serial}` });
          triggerForegroundAlertNotification({
            title: `${prefix}Ticket ${serial}`.trim(),
            body: `${subj} — Tap to Accept`,
            ring: !prefs.quietHoursEnabled,
            data: { type: 'ticket', id: latestTicketId },
          }).catch(() => {});
        }
      }

      seenChatKeyRef.current = latestChatKey;
      seenTicketKeyRef.current = latestTicketKey;
      firstPulseDoneRef.current = true;
    } catch {
      // Transient background poll failure is safe to ignore
    }
  }, [toast]);

  useEffect(() => {
    refreshPulseAlerts();
    const timer = setInterval(
      refreshPulseAlerts,
      Math.max(4500, SITE_CONFIG.livePollIntervalMs || 5000)
    );
    return () => clearInterval(timer);
  }, [refreshPulseAlerts]);

  const routeDeepLink = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return;
    try {
      stopSupportRingtone().catch(() => {});
      const qIdx = rawUrl.indexOf('?');
      if (qIdx < 0) return;
      const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
      const kind = params.get('type');
      const targetId = params.get('id');
      if (!targetId) return;
      if (kind === 'livechat') {
        setActiveTicketId(null);
        setActiveTab('livechat');
        setActiveChatId(targetId);
      } else if (kind === 'ticket') {
        setActiveChatId(null);
        setActiveTab('tickets');
        setActiveTicketId(targetId);
      }
    } catch {
      // Ignore malformed deep links
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(routeDeepLink).catch(() => {});
    const linkSub = Linking.addEventListener('url', ({ url }) => routeDeepLink(url));
    const notifSub = Notifications.addNotificationResponseReceivedListener((resp) => {
      stopSupportRingtone().catch(() => {});
      const data = resp?.notification?.request?.content?.data as Record<string, unknown> | undefined;
      const kind = String(data?.type || '');
      const targetId = String(data?.id || data?.chatId || data?.ticketId || '');
      if (targetId && (kind.includes('livechat') || data?.chatId)) {
        setActiveTicketId(null);
        setActiveTab('livechat');
        setActiveChatId(targetId);
      } else if (targetId && (kind.includes('ticket') || data?.ticketId)) {
        setActiveChatId(null);
        setActiveTab('tickets');
        setActiveTicketId(targetId);
      }
    });
    return () => {
      linkSub.remove();
      notifSub.remove();
    };
  }, [routeDeepLink]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTicketId) {
        setActiveTicketId(null);
        return true;
      }
      if (activeChatId) {
        setActiveChatId(null);
        return true;
      }
      if (subRouteStack.length > 0) {
        popSubScreen();
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeChatId, activeTab, activeTicketId, popSubScreen, subRouteStack.length]);

  const handleOpenTicket = (ticketId: string) => {
    stopSupportRingtone().catch(() => {});
    setActiveChatId(null);
    setActiveTicketId(ticketId);
  };

  const handleOpenChat = (chatId: string) => {
    stopSupportRingtone().catch(() => {});
    setActiveTicketId(null);
    setActiveChatId(chatId);
  };

  if (activeTicketId) {
    return (
      <ScreenContainer applyTopInset applyBottomInset={false}>
        <TicketDetailScreen
          ticketId={activeTicketId}
          user={user}
          staffProfile={staffProfile}
          onBack={() => {
            setActiveTicketId(null);
            refreshPulseAlerts();
          }}
          onOpenTicket={(nextId) => setActiveTicketId(nextId)}
          onNavigateSubScreen={(screen, params) => {
            setActiveTicketId(null);
            pushSubScreen(screen, params);
          }}
          onPulseSync={refreshPulseAlerts}
        />
      </ScreenContainer>
    );
  }

  if (activeChatId) {
    return (
      <ScreenContainer applyTopInset applyBottomInset={false}>
        <LiveChatRoomScreen
          chatId={activeChatId}
          user={user}
          staffProfile={staffProfile}
          onBack={() => {
            setActiveChatId(null);
            refreshPulseAlerts();
          }}
          onOpenTicket={(tid) => {
            setActiveChatId(null);
            setActiveTicketId(tid);
          }}
          onPulseSync={refreshPulseAlerts}
        />
      </ScreenContainer>
    );
  }

  const topSubRoute =
    subRouteStack.length > 0 ? subRouteStack[subRouteStack.length - 1] : null;

  if (topSubRoute) {
    const commonOpsProps = {
      user,
      staffProfile,
      onBack: popSubScreen,
      onOpenTicket: handleOpenTicket,
      onOpenChat: handleOpenChat,
      onNavigateSubScreen: pushSubScreen,
      routeParams: topSubRoute.params,
      onPulseSync: refreshPulseAlerts,
    };

    const commonSettingsProps = {
      user,
      staffProfile,
      onBack: popSubScreen,
      onRefreshSession,
      onLockNow,
    };

    const renderDedicatedScreen = () => {
      switch (topSubRoute.screen) {
        case 'unified_inbox':
          return <UnifiedInboxScreen {...commonOpsProps} />;
        case 'create_ticket':
          return <TicketCreateInternalScreen {...commonOpsProps} />;
        case 'kb_hub':
          return <KnowledgeBaseScreen {...commonOpsProps} />;
        case 'kb_editor':
          return <KnowledgeArticleEditorScreen {...commonOpsProps} />;
        case 'macros_studio':
          return <CannedMacrosStudioScreen {...commonOpsProps} />;
        case 'customer_directory':
          return <CustomerDirectoryScreen {...commonOpsProps} />;
        case 'customer_360':
          return <CustomerProfile360Screen {...commonOpsProps} />;
        case 'sla_command':
          return <SlaCommandCenterScreen {...commonOpsProps} />;
        case 'incident_board':
          return <IncidentStatusBoardScreen {...commonOpsProps} />;
        case 'outage_broadcast':
          return <OutageBroadcastScreen {...commonOpsProps} />;
        case 'escalation_approvals':
          return <EscalationQueueScreen {...commonOpsProps} />;
        case 'team_presence':
          return <StaffDirectoryPresenceScreen {...commonOpsProps} />;
        case 'shift_handover':
          return <ShiftHandoverScreen {...commonOpsProps} />;
        case 'team_wall':
          return <InternalTeamWallScreen {...commonOpsProps} />;
        case 'qa_reviews':
          return <QaTicketReviewScreen {...commonOpsProps} />;
        case 'csat_explorer':
          return <CsatExplorerScreen {...commonOpsProps} />;
        case 'ai_playground':
          return <AiCopilotPlaygroundScreen {...commonOpsProps} />;
        case 'automation_rules':
          return <AutomationRulesScreen {...commonOpsProps} />;
        case 'spam_shield':
          return <SpamAbuseShieldScreen {...commonOpsProps} />;
        case 'departments_hours':
          return <DepartmentsRoutingScreen {...commonOpsProps} />;
        case 'agent_leaderboard':
          return <AgentLeaderboardScreen {...commonOpsProps} />;
        case 'personal_tasks':
          return <PersonalNotesTasksScreen {...commonOpsProps} />;
        case 'audit_security':
          return <AuditSecurityLogsScreen {...commonOpsProps} />;
        case 'staff_access_approvals':
          return <StaffAccessApprovalsScreen {...commonOpsProps} />;
        case 'platform_ops_analytics':
          return <PlatformOpsAnalyticsScreen {...commonOpsProps} />;
        case 'settings_notifications_ring':
          return <NotificationRingSettingsScreen {...commonSettingsProps} />;
        case 'settings_security_pin':
          return <SecurityPinSessionScreen {...commonSettingsProps} />;
        case 'settings_composer_signature':
          return <ComposerSignatureSettingsScreen {...commonSettingsProps} />;
        case 'settings_appearance':
          return <WorkspaceAppearanceScreen {...commonSettingsProps} />;
        case 'settings_system_switches':
          return <SystemSwitchesConfigScreen {...commonSettingsProps} />;
        case 'settings_account_profile':
          return <AccountProfileDetailScreen {...commonSettingsProps} />;
        default:
          return null;
      }
    };

    return (
      <ScreenContainer applyTopInset applyBottomInset>
        <View style={[styles.content, { backgroundColor: tokens.bg }]}>
          {renderDedicatedScreen()}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={[styles.content, { backgroundColor: tokens.bg }]}>
        {activeTab === 'home' && (
          <DeskHomeScreen
            user={user}
            staffProfile={staffProfile}
            onNavigateTab={(tab, preset) => {
              if (preset) setTicketQueuePreset(preset);
              setActiveTab(tab);
            }}
            onNavigateSubScreen={pushSubScreen}
            onOpenTicket={handleOpenTicket}
            onOpenChat={handleOpenChat}
            onWaitingCountChange={setWaitingChatsCount}
            onPulseSync={refreshPulseAlerts}
          />
        )}

        {activeTab === 'tickets' && (
          <TicketsScreen
            user={user}
            staffProfile={staffProfile}
            initialQueue={ticketQueuePreset}
            onOpenTicket={handleOpenTicket}
            onNavigateSubScreen={pushSubScreen}
            onPulseSync={refreshPulseAlerts}
          />
        )}

        {activeTab === 'livechat' && (
          <LiveChatsScreen
            user={user}
            staffProfile={staffProfile}
            onOpenChat={handleOpenChat}
            onWaitingCountChange={setWaitingChatsCount}
            onPulseSync={refreshPulseAlerts}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsScreen
            user={user}
            staffProfile={staffProfile}
            onOpenTicket={handleOpenTicket}
            onNavigateSubScreen={pushSubScreen}
          />
        )}

        {activeTab === 'settings' && (
          <ProfileSettingsScreen
            user={user}
            staffProfile={staffProfile}
            onLogout={onLogout}
            onRefreshSession={onRefreshSession}
            onNavigateSubScreen={pushSubScreen}
            onLockNow={onLockNow}
          />
        )}
      </View>

      {/* Bottom Navigation with Red Pulsing Dot for Unaccepted Tickets & Waiting Live Chats */}
      <View style={[styles.tabBar, { backgroundColor: tokens.bg, borderTopColor: tokens.hairlineStrong }]}>
        {TAB_ITEMS.map((item) => {
          const active = activeTab === item.key;
          const showRedLight =
            (item.key === 'tickets' && unacceptedTicketsCount > 0) ||
            (item.key === 'livechat' && waitingChatsCount > 0);

          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.65}
              style={styles.tabBtn}
              onPress={() => {
                setSubRouteStack([]);
                setActiveTab(item.key);
              }}
            >
              <View style={styles.iconBox}>
                <Feather
                  name={item.icon}
                  size={19}
                  color={active ? tokens.accent : tokens.textMuted}
                />
                {showRedLight ? (
                  <View style={styles.redLightWrap}>
                    <PulsatingDot color="#EF4444" size={7} active />
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.tabText,
                  {
                    color: active ? tokens.text : tokens.textMuted,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
              {active ? <View style={[styles.activeBar, { backgroundColor: tokens.accent }]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 6,
    paddingTop: 7,
    paddingBottom: 5,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    position: 'relative',
  },
  iconBox: {
    position: 'relative',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  redLightWrap: {
    position: 'absolute',
    top: -4,
    right: -1,
  },
  tabText: {
    fontSize: 10.5,
  },
  activeBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },
});
