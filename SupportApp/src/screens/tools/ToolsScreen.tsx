import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import {
  AnimatedListItem,
  BlurFade,
  FlatBadge,
  FlatInput,
  Hairline,
  NumberTicker,
} from '../../components/magicui';

interface ToolsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onOpenTicket: (ticketId: string) => void;
  onNavigateSubScreen?: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
}

type HubCategory = 'all' | 'triage' | 'knowledge_ai' | 'team' | 'quality_sla' | 'security_admin';

interface ModuleDescriptor {
  key: DedicatedScreenKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  category: Exclude<HubCategory, 'all'>;
  toneColor: string;
  badgeText?: string;
}

const CATEGORIES: { id: HubCategory; label: string }[] = [
  { id: 'all', label: 'All Modules' },
  { id: 'triage', label: 'Inbox & Triage' },
  { id: 'knowledge_ai', label: 'Knowledge & AI' },
  { id: 'team', label: 'Team & Shifts' },
  { id: 'quality_sla', label: 'Quality & SLA' },
  { id: 'security_admin', label: 'Security & Admin' },
];

export const ToolsScreen: React.FC<ToolsScreenProps> = ({
  staffProfile,
  onNavigateSubScreen,
}) => {
  const { tokens } = useAppTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<HubCategory>('all');
  const [refreshing, setRefreshing] = useState(false);

  const [counts, setCounts] = useState({
    incidents: 0,
    approvals: 0,
    tasks: 0,
    kb: 0,
    accessReqs: 0,
  });

  const loadHubSummary = useCallback(async () => {
    try {
      const [inc, app, tsk, kb, acc] = await Promise.all([
        opsHubService.listIncidents('all').catch(() => ({ incidents: [] })),
        opsHubService.listApprovals('pending').catch(() => ({ approvals: [] })),
        opsHubService.listPersonalTasks().catch(() => ({ tasks: [] })),
        opsHubService.listKbArticles().catch(() => ({ articles: [] })),
        opsHubService.listStaffAccessRequests('pending').catch(() => ({ requests: [] })),
        supportService.getOverview().catch(() => null),
      ]);

      setCounts({
        incidents: (inc.incidents || []).filter((i) => i.status !== 'resolved').length,
        approvals: (app.approvals || []).length,
        tasks: (tsk.tasks || []).filter((t) => !t.completed).length,
        kb: (kb.articles || []).length,
        accessReqs: (acc.requests || []).length,
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHubSummary();
  }, [loadHubSummary]);

  const modules: ModuleDescriptor[] = useMemo(
    () => [
      {
        key: 'unified_inbox',
        title: 'Unified Omnichannel Stream',
        subtitle: 'Combined tickets & live chats with pre-click Quick Peek',
        icon: 'layers',
        category: 'triage',
        toneColor: tokens.accent,
        badgeText: 'Live',
      },
      {
        key: 'create_ticket',
        title: 'Create Outbound Ticket',
        subtitle: 'Open proactive support ticket on behalf of any customer',
        icon: 'plus-circle',
        category: 'triage',
        toneColor: '#2563EB',
      },
      {
        key: 'customer_directory',
        title: 'Customer 360 Directory',
        subtitle: 'Lookup users & guests, VIP/Watchlist tags & internal notes',
        icon: 'users',
        category: 'triage',
        toneColor: '#0891B2',
      },
      {
        key: 'escalation_approvals',
        title: 'Tier-2 Escalations & Approvals',
        subtitle: 'Refund, credit, account unlock & senior escalation workflow',
        icon: 'arrow-up-circle',
        category: 'triage',
        toneColor: tokens.warning,
        badgeText: counts.approvals > 0 ? `${counts.approvals} pending` : undefined,
      },
      {
        key: 'personal_tasks',
        title: 'My Follow-Ups & Scratchpad',
        subtitle: 'Personal ticket reminders, pinned notes & shift checklist',
        icon: 'check-square',
        category: 'triage',
        toneColor: tokens.accent,
        badgeText: counts.tasks > 0 ? `${counts.tasks} open` : undefined,
      },
      {
        key: 'ai_playground',
        title: 'Gemini AI Support Lab',
        subtitle: 'Draft, polish, translate EN↔BN, summarize & check AI Key Pool',
        icon: 'cpu',
        category: 'knowledge_ai',
        toneColor: tokens.accent,
        badgeText: 'Gemini',
      },
      {
        key: 'kb_hub',
        title: 'Knowledge Base & Playbooks',
        subtitle: 'Internal staff runbooks & public help center articles',
        icon: 'book-open',
        category: 'knowledge_ai',
        toneColor: '#7C3AED',
        badgeText: counts.kb > 0 ? `${counts.kb}` : undefined,
      },
      {
        key: 'macros_studio',
        title: 'Macros & Chat Templates Studio',
        subtitle: 'Canned ticket macros, shortcuts & live chat quick replies',
        icon: 'zap',
        category: 'knowledge_ai',
        toneColor: '#D97706',
      },
      {
        key: 'automation_rules',
        title: 'Auto-Triage & Routing Rules',
        subtitle: 'Keyword, priority & channel triggers for automatic routing',
        icon: 'git-branch',
        category: 'knowledge_ai',
        toneColor: '#2563EB',
      },
      {
        key: 'team_presence',
        title: 'Live Team Roster & Workload',
        subtitle: 'Real-time online specialists, availability & active load',
        icon: 'radio',
        category: 'team',
        toneColor: tokens.accent,
      },
      {
        key: 'shift_handover',
        title: 'Shift Handover Briefings',
        subtitle: 'Morning, evening & night shift logs with team acknowledgements',
        icon: 'repeat',
        category: 'team',
        toneColor: '#0D9488',
      },
      {
        key: 'team_wall',
        title: 'Internal Staff Announcements',
        subtitle: 'Team coordination feed, pinned notices & #ticket mentions',
        icon: 'message-square',
        category: 'team',
        toneColor: '#4F46E5',
      },
      {
        key: 'departments_hours',
        title: 'Departments & Business Hours',
        subtitle: 'Configure support queues, SLA targets & auto-acknowledgements',
        icon: 'briefcase',
        category: 'team',
        toneColor: '#64748B',
      },
      {
        key: 'sla_command',
        title: 'SLA Breach Command Center',
        subtitle: 'Countdown monitor for breached & at-risk SLA commitments',
        icon: 'clock',
        category: 'quality_sla',
        toneColor: tokens.danger,
      },
      {
        key: 'incident_board',
        title: 'Major Incidents & Status Board',
        subtitle: 'Declare platform outages, track timeline updates & resolution',
        icon: 'alert-octagon',
        category: 'quality_sla',
        toneColor: tokens.danger,
        badgeText: counts.incidents > 0 ? `${counts.incidents} active` : undefined,
      },
      {
        key: 'outage_broadcast',
        title: 'Mass Outage Broadcast',
        subtitle: 'Dispatch coordinated status advisories to waiting tickets',
        icon: 'volume-2',
        category: 'quality_sla',
        toneColor: '#EA580C',
      },
      {
        key: 'qa_reviews',
        title: 'QA & Coaching Scorecards',
        subtitle: 'Grade tone, accuracy, brand compliance & response speed',
        icon: 'award',
        category: 'quality_sla',
        toneColor: '#16A34A',
      },
      {
        key: 'csat_explorer',
        title: 'CSAT & Sentiment Explorer',
        subtitle: '1★–5★ rating distribution & customer verbatim feedback',
        icon: 'smile',
        category: 'quality_sla',
        toneColor: '#0284C7',
      },
      {
        key: 'agent_leaderboard',
        title: 'Agent Productivity & Goals',
        subtitle: 'Response speed median, daily resolved target & leaderboard',
        icon: 'trending-up',
        category: 'quality_sla',
        toneColor: tokens.accent,
      },
      {
        key: 'platform_ops_analytics',
        title: 'Platform Ops & PICK Appeals',
        subtitle: '7d / 30d / 12m executive metrics, account appeals & CSV export',
        icon: 'bar-chart-2',
        category: 'security_admin',
        toneColor: '#2563EB',
      },
      {
        key: 'spam_shield',
        title: 'Spam Blocklist & Collusion Shield',
        subtitle: 'Block abusive emails/IPs/keywords & inspect forensic flags',
        icon: 'shield-off',
        category: 'security_admin',
        toneColor: tokens.danger,
      },
      {
        key: 'audit_security',
        title: 'Audit Trail & Session Control',
        subtitle: 'Permission audit logs, forensics & remote session revocation',
        icon: 'lock',
        category: 'security_admin',
        toneColor: '#475569',
      },
      {
        key: 'staff_access_approvals',
        title: 'Staff Access & Role Management',
        subtitle: 'Approve new staff sign-up requests & manage RBAC permissions',
        icon: 'user-plus',
        category: 'security_admin',
        toneColor: '#7C3AED',
        badgeText: counts.accessReqs > 0 ? `${counts.accessReqs} new` : undefined,
      },
    ],
    [counts, tokens.accent, tokens.danger, tokens.warning]
  );

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modules.filter((m) => {
      if (category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return `${m.title} ${m.subtitle} ${m.category}`.toLowerCase().includes(q);
    });
  }, [category, modules, search]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: tokens.bg }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.accent}
          onRefresh={() => {
            setRefreshing(true);
            loadHubSummary();
          }}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <BlurFade delay={0} offset={5}>
        <View style={styles.headerBlock}>
          <View>
            <Text style={[styles.title, { color: tokens.text }]}>Operations Hub</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${modules.length} specialized support modules · ${staffProfile.roleKey.replace(/_/g, ' ')}`}
            </Text>
          </View>
          <FlatBadge label={staffProfile.isSuperAdmin ? 'Super Admin' : 'Staff'} tone="accent" withDot />
        </View>
      </BlurFade>

      {/* Live Operations Pulse Strip */}
      <View
        style={[
          styles.pulseGrid,
          {
            borderColor: tokens.hairlineStrong,
            backgroundColor: tokens.surfaceSubtle,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.pulseCell}
          activeOpacity={0.7}
          onPress={() => onNavigateSubScreen?.('incident_board')}
        >
          <Text style={[styles.pulseLabel, { color: tokens.textMuted }]}>INCIDENTS</Text>
          <NumberTicker
            value={counts.incidents}
            style={[
              styles.pulseVal,
              { color: counts.incidents > 0 ? tokens.danger : tokens.text },
            ]}
          />
        </TouchableOpacity>
        <View style={[styles.vDivider, { backgroundColor: tokens.hairlineStrong }]} />
        <TouchableOpacity
          style={styles.pulseCell}
          activeOpacity={0.7}
          onPress={() => onNavigateSubScreen?.('escalation_approvals')}
        >
          <Text style={[styles.pulseLabel, { color: tokens.textMuted }]}>APPROVALS</Text>
          <NumberTicker
            value={counts.approvals}
            style={[
              styles.pulseVal,
              { color: counts.approvals > 0 ? tokens.warning : tokens.text },
            ]}
          />
        </TouchableOpacity>
        <View style={[styles.vDivider, { backgroundColor: tokens.hairlineStrong }]} />
        <TouchableOpacity
          style={styles.pulseCell}
          activeOpacity={0.7}
          onPress={() => onNavigateSubScreen?.('personal_tasks')}
        >
          <Text style={[styles.pulseLabel, { color: tokens.textMuted }]}>MY TASKS</Text>
          <NumberTicker value={counts.tasks} style={[styles.pulseVal, { color: tokens.accent }]} />
        </TouchableOpacity>
        <View style={[styles.vDivider, { backgroundColor: tokens.hairlineStrong }]} />
        <TouchableOpacity
          style={styles.pulseCell}
          activeOpacity={0.7}
          onPress={() => onNavigateSubScreen?.('kb_hub')}
        >
          <Text style={[styles.pulseLabel, { color: tokens.textMuted }]}>KB DOCS</Text>
          <NumberTicker value={counts.kb} style={[styles.pulseVal, { color: tokens.text }]} />
        </TouchableOpacity>
      </View>

      {/* Search Modules */}
      <FlatInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search modules, AI lab, SLA, handovers..."
        leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
      />

      {/* Category Filter Strip */}
      <View style={[styles.catStripWrap, { borderBottomColor: tokens.hairlineStrong }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                style={[
                  styles.catTab,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.catLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Structured Module Directory */}
      <View style={styles.moduleList}>
        {filteredModules.map((mod, idx) => (
          <AnimatedListItem key={mod.key} index={idx} staggerMs={18}>
            <TouchableOpacity
              activeOpacity={0.68}
              onPress={() => onNavigateSubScreen?.(mod.key)}
              style={[styles.moduleRow, { borderBottomColor: tokens.hairline }]}
            >
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: tokens.surfaceMuted,
                    borderColor: tokens.hairlineStrong,
                  },
                ]}
              >
                <Feather name={mod.icon} size={17} color={mod.toneColor} />
              </View>

              <View style={styles.moduleTextCol}>
                <View style={styles.moduleTitleLine}>
                  <Text numberOfLines={1} style={[styles.moduleTitle, { color: tokens.text }]}>
                    {mod.title}
                  </Text>
                  {mod.badgeText ? <FlatBadge label={mod.badgeText} tone="accent" /> : null}
                </View>
                <Text numberOfLines={2} style={[styles.moduleDesc, { color: tokens.textMuted }]}>
                  {mod.subtitle}
                </Text>
              </View>

              <Feather name="chevron-right" size={16} color={tokens.textMuted} />
            </TouchableOpacity>
          </AnimatedListItem>
        ))}

        {filteredModules.length === 0 ? (
          <Text style={[styles.emptyHint, { color: tokens.textMuted }]}>
            No modules match your search query.
          </Text>
        ) : null}
      </View>

      <Hairline />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  pulseGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  pulseCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  vDivider: {
    width: 1,
    height: 26,
  },
  pulseLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pulseVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  catStripWrap: {
    borderBottomWidth: 1,
  },
  catScroll: {
    gap: 16,
  },
  catTab: {
    paddingVertical: 9,
  },
  catLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  moduleList: {
    gap: 0,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTextCol: {
    flex: 1,
    gap: 2,
  },
  moduleTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  moduleDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyHint: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
  },
});
