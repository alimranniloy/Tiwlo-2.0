import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AuthUser, StaffProfileMe, SupportFeatureSwitches } from '../../types/support';
import { useSensitiveGrant } from '../../components/security/SensitiveGrantContext';
import {
  BorderlessIconButton,
  FlatBadge,
  FlatNotice,
  Hairline,
  MagicSpinner,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface SystemSwitchesConfigScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onRefreshSession?: () => Promise<void>;
  onLockNow?: () => void;
}

const DEFAULT_SWITCHES: SupportFeatureSwitches = {
  liveChatWidget: true,
  guestTicketsEnabled: true,
  requireGuestContact: true,
  allowNewTickets: true,
  lockClosedReplies: true,
  allowCustomerReopen: true,
  fileAttachmentsEnabled: true,
  aiAutoReply: false,
  aiAgentDraftAssist: true,
  restrictStaffToAssignedQueue: false,
};

interface SwitchDescriptor {
  key: keyof SupportFeatureSwitches;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}

const SWITCH_SECTIONS: readonly {
  heading: string;
  items: readonly SwitchDescriptor[];
}[] = [
  {
    heading: 'LIVE CHAT & VISITOR INTAKE',
    items: [
      {
        key: 'liveChatWidget',
        label: 'Live Chat Widget',
        desc: 'Expose real-time support chat widget to website & app visitors',
        icon: 'message-circle',
      },
      {
        key: 'allowNewTickets',
        label: 'Allow New Tickets',
        desc: 'Permit customers to submit new support tickets across portals',
        icon: 'inbox',
      },
      {
        key: 'guestTicketsEnabled',
        label: 'Guest Ticket Submissions',
        desc: 'Allow unauthenticated visitors to open support inquiries',
        icon: 'user-check',
      },
      {
        key: 'requireGuestContact',
        label: 'Require Guest Contact Details',
        desc: 'Mandate verified email or phone number on guest intake forms',
        icon: 'mail',
      },
    ],
  },
  {
    heading: 'TICKET LIFECYCLE & ATTACHMENTS',
    items: [
      {
        key: 'lockClosedReplies',
        label: 'Lock Closed Ticket Replies',
        desc: 'Block customer replies once a ticket has been marked closed',
        icon: 'lock',
      },
      {
        key: 'allowCustomerReopen',
        label: 'Customer Self-Reopen',
        desc: 'Permit customers to reopen recently resolved tickets',
        icon: 'refresh-cw',
      },
      {
        key: 'fileAttachmentsEnabled',
        label: 'File & Screenshot Attachments',
        desc: 'Enable document and image uploads on tickets and replies',
        icon: 'paperclip',
      },
    ],
  },
  {
    heading: 'GEMINI AI & QUEUE ISOLATION',
    items: [
      {
        key: 'aiAutoReply',
        label: 'Gemini AI Auto-Reply',
        desc: 'Dispatch automated AI acknowledgement & triage before human pickup',
        icon: 'zap',
      },
      {
        key: 'aiAgentDraftAssist',
        label: 'Gemini Agent Draft Copilot',
        desc: 'Provide one-tap AI draft polish, summaries & tone suggestions for staff',
        icon: 'cpu',
      },
      {
        key: 'restrictStaffToAssignedQueue',
        label: 'Strict Queue Isolation',
        desc: 'Restrict non-lead agents to view only their assigned queue items',
        icon: 'shield',
      },
    ],
  },
];

export const SystemSwitchesConfigScreen: React.FC<SystemSwitchesConfigScreenProps> = ({
  staffProfile,
  onBack,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const { requestSensitiveGrant } = useSensitiveGrant();

  const [serverSwitches, setServerSwitches] = useState<SupportFeatureSwitches>(DEFAULT_SWITCHES);
  const [draftSwitches, setDraftSwitches] = useState<SupportFeatureSwitches>(DEFAULT_SWITCHES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManageSettings =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).includes('manage_system_settings') ||
    (staffProfile.permissions || []).includes('support.manage_settings');

  const fetchMergedSwitches = useCallback(async (): Promise<SupportFeatureSwitches> => {
    const [tRes, cRes] = await Promise.all([
      supportService.getSupportToggles(),
      supportService.getChatSystemConfig().catch(() => ({})),
    ]);
    const merged: SupportFeatureSwitches = {
      ...DEFAULT_SWITCHES,
      ...tRes.toggles,
    };
    if (typeof (cRes as Record<string, unknown>).liveChatWidget === 'boolean') {
      merged.liveChatWidget = Boolean((cRes as Record<string, unknown>).liveChatWidget);
    }
    return merged;
  }, []);

  const loadSwitches = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      try {
        const merged = await fetchMergedSwitches();
        setServerSwitches(merged);
        setDraftSwitches(merged);
      } catch (err) {
        toast.show({
          variant: 'danger',
          label: err instanceof Error ? err.message : 'Unable to fetch system feature switches.',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchMergedSwitches, toast]
  );

  useEffect(() => {
    let active = true;
    fetchMergedSwitches()
      .then((merged) => {
        if (!active) return;
        setServerSwitches(merged);
        setDraftSwitches(merged);
      })
      .catch((err) => {
        if (!active) return;
        toast.show({
          variant: 'danger',
          label: err instanceof Error ? err.message : 'Unable to fetch system feature switches.',
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      active = false;
      backSub.remove();
    };
  }, [fetchMergedSwitches, onBack, toast]);

  const changedCount = useMemo(() => {
    const keys = Object.keys(DEFAULT_SWITCHES) as (keyof SupportFeatureSwitches)[];
    return keys.filter((k) => draftSwitches[k] !== serverSwitches[k]).length;
  }, [draftSwitches, serverSwitches]);

  const handleToggleItem = (key: keyof SupportFeatureSwitches, value: boolean) => {
    if (!canManageSettings) {
      toast.show({
        variant: 'accent',
        label: 'System settings permission is required to modify switches.',
      });
      return;
    }
    setDraftSwitches((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    if (!canManageSettings || changedCount === 0) return;
    try {
      const grant = await requestSensitiveGrant('Update Support & Chat Feature Switches');
      setSaving(true);
      await supportService.saveSupportFeatureSwitches(draftSwitches, grant);
      setServerSwitches(draftSwitches);
      toast.show({
        variant: 'success',
        label: 'Platform support & chat switches synchronized.',
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Verification cancelled.') {
        return;
      }
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to update switches.',
      });
    } finally {
      setSaving(false);
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
            Support Feature Switches
          </Text>
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: tokens.textMuted }]}>
            Global live chat, ticket intake, AI Copilot & queue rules
          </Text>
        </View>
        <FlatBadge
          label={canManageSettings ? 'Admin Control' : 'View Only'}
          tone={canManageSettings ? 'success' : 'neutral'}
          withDot
        />
        <BorderlessIconButton
          name="refresh-cw"
          size={17}
          disabled={loading || refreshing || saving}
          onPress={() => loadSwitches(true)}
          accessibilityLabel="Reload switches"
        />
      </View>

      <Hairline />

      {loading ? (
        <MagicSpinner label="Loading platform feature switches..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSwitches(true)}
              tintColor={tokens.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {!canManageSettings ? (
            <FlatNotice
              tone="warning"
              icon="eye"
              text={`Read-only view: Your role (${staffProfile.roleKey}) can inspect live switches, while saving updates requires manage_system_settings permission.`}
            />
          ) : (
            <FlatNotice
              tone="accent"
              icon="shield"
              text="Toggle one or more platform switches below, then authorize once with your Staff Security PIN to publish live."
            />
          )}

          {changedCount > 0 ? (
            <View
              style={[
                styles.unsavedBar,
                {
                  backgroundColor: tokens.accentSoft,
                  borderColor: tokens.accent,
                },
              ]}
            >
              <View style={styles.rowTextCol}>
                <Text style={[styles.unsavedTitle, { color: tokens.accent }]}>
                  {changedCount} unsaved switch change{changedCount > 1 ? 's' : ''}
                </Text>
                <Text style={[styles.rowDesc, { color: tokens.textSecondary }]}>
                  Requires PIN verification to apply across Tiwlo Support
                </Text>
              </View>
              <View style={styles.unsavedBtns}>
                <TouchableOpacity
                  disabled={saving}
                  onPress={() => setDraftSwitches(serverSwitches)}
                  hitSlop={8}
                >
                  <Text style={[styles.discardLink, { color: tokens.textMuted }]}>Discard</Text>
                </TouchableOpacity>
                <ShimmerButton
                  label="Save & Authorize"
                  size="sm"
                  variant="accent"
                  loading={saving}
                  onPress={handleSaveChanges}
                />
              </View>
            </View>
          ) : null}

          {SWITCH_SECTIONS.map((section) => (
            <View key={section.heading} style={styles.sectionBlock}>
              <Text style={[styles.sectionHeader, { color: tokens.textMuted }]}>
                {section.heading}
              </Text>
              <View style={styles.rowsGroup}>
                {section.items.map((item) => {
                  const enabled = draftSwitches[item.key];
                  const modified = draftSwitches[item.key] !== serverSwitches[item.key];
                  return (
                    <View
                      key={item.key}
                      style={[styles.settingRow, { borderBottomColor: tokens.hairline }]}
                    >
                      <Feather
                        name={item.icon}
                        size={17}
                        color={enabled ? tokens.accent : tokens.textMuted}
                      />
                      <View style={styles.rowTextCol}>
                        <View style={styles.titleBadgeRow}>
                          <Text style={[styles.rowTitle, { color: tokens.text }]}>
                            {item.label}
                          </Text>
                          {modified ? <FlatBadge label="Modified" tone="warning" /> : null}
                        </View>
                        <Text style={[styles.rowDesc, { color: tokens.textMuted }]}>
                          {item.desc}
                        </Text>
                      </View>
                      <MagicSwitch
                        value={enabled}
                        disabled={!canManageSettings || saving}
                        onValueChange={(val) => handleToggleItem(item.key, val)}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default SystemSwitchesConfigScreen;

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
  sectionBlock: {
    gap: 4,
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
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  unsavedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 9,
    padding: 12,
  },
  unsavedTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  unsavedBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discardLink: {
    fontSize: 12,
    fontWeight: '600',
  },
});
