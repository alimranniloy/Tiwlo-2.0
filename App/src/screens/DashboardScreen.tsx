import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Bot,
  ChevronRight,
  CreditCard,
  DatabaseBackup,
  Download,
  Droplet,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  MoreVertical,
  Plus,
  Server,
  Shield,
  ShieldAlert,
  Store,
  Terminal,
  Users,
  Webhook,
  X,
} from 'lucide-react-native';
import {
  BottomNavKey,
  MobileBottomNavbar,
  MobileTopNavbar,
} from '../components/MobileNavbar';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  fetchWorkspaceServices,
  resolvePluginNavId,
  WorkspacePluginService,
} from '../services/tiwloAccount';
import { subscribeRealtimeSync } from '../services/tiwloRealtime';
import {
  DashboardSnapshot,
  EMPTY_DASHBOARD_SNAPSHOT,
  loadTiwloDashboard,
} from '../services/tiwloDashboard';
import { colors } from '../theme/tokens';

interface DashboardScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  activeNav: string;
  bottomTab: BottomNavKey;
  selectedNotice: string;
  unreadNotifications?: number;
  onSelectNav: (id: string, label: string) => void;
  onSelectBottomTab: (tab: BottomNavKey) => void;
  onOpenMenu: () => void;
  onOpenNotifications?: () => void;
  onOpenPluginDashboard?: (navId: string, label: string) => void;
  onSetNotice: (notice: string) => void;
  onStoresLoaded?: (count: number) => void;
  onAuthAction: () => void;
}

const QUICK_SHORTCUTS: {
  id: string;
  label: string;
  renderIcon: () => React.ReactNode;
}[] = [
  {
    id: 'workspace/performance',
    label: 'Performance',
    renderIcon: () => <Activity size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'workspace/security-alerts',
    label: 'Security',
    renderIcon: () => <ShieldAlert size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'workspace/billing',
    label: 'Billing',
    renderIcon: () => <CreditCard size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'workspace/webhooks',
    label: 'Webhooks',
    renderIcon: () => <Webhook size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'workspace/backup-policy',
    label: 'Backups',
    renderIcon: () => <DatabaseBackup size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'workspace/data-export',
    label: 'Export',
    renderIcon: () => <Download size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'team-management',
    label: 'Team',
    renderIcon: () => <Users size={18} strokeWidth={1.9} color={colors.ink} />,
  },
  {
    id: 'two-factor-auth',
    label: '2FA Auth',
    renderIcon: () => <KeyRound size={18} strokeWidth={1.9} color={colors.ink} />,
  },
];

const QUICK_ACCESS_ITEMS: {
  id: string;
  title: string;
  desc: string;
  available: boolean;
  renderIcon: () => React.ReactNode;
}[] = [
  {
    id: 'domains',
    title: 'Domains',
    desc: 'Manage custom domains',
    available: true,
    renderIcon: () => <Globe size={16} strokeWidth={1.9} color={colors.foreground} />,
  },
  {
    id: 'ssh',
    title: 'SSH Keys',
    desc: 'Deployment keys',
    available: false,
    renderIcon: () => <KeyRound size={16} strokeWidth={1.9} color={colors.muted} />,
  },
  {
    id: 'firewall',
    title: 'Firewall',
    desc: 'Network traffic rules',
    available: false,
    renderIcon: () => <Shield size={16} strokeWidth={1.9} color={colors.muted} />,
  },
  {
    id: 'api-tokens',
    title: 'API Tokens',
    desc: 'Programmatic access',
    available: false,
    renderIcon: () => <Terminal size={16} strokeWidth={1.9} color={colors.muted} />,
  },
];

const SERVICE_HEALTH: { name: string; status: string }[] = [
  { name: 'Tiwlo API Gateway', status: 'Operational' },
  { name: 'Compute & Droplets', status: 'Operational' },
  { name: 'Online Storefront', status: 'Operational' },
  { name: 'tMail & Authenticator', status: 'Operational' },
];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  sessionToken,
  activeNav,
  bottomTab,
  selectedNotice,
  unreadNotifications,
  onSelectNav,
  onSelectBottomTab,
  onOpenMenu,
  onOpenNotifications,
  onOpenPluginDashboard,
  onSetNotice,
  onStoresLoaded,
  onAuthAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_DASHBOARD_SNAPSHOT);
  const [plugins, setPlugins] = useState<WorkspacePluginService[]>([]);

  const fetchDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, pluginList] = await Promise.all([
        loadTiwloDashboard(user?.id || user?.tiwiId, sessionToken),
        fetchWorkspaceServices(sessionToken),
      ]);
      setSnapshot(data);
      setPlugins(pluginList);
      onStoresLoaded?.(data.stores.length);
    } finally {
      setRefreshing(false);
    }
  }, [onStoresLoaded, sessionToken, user?.id, user?.tiwiId]);

  useEffect(() => {
    void fetchDashboard();
    const unsub = subscribeRealtimeSync((topic) => {
      if (topic === 'all' || topic === 'dashboard' || topic === 'stores') {
        void fetchDashboard();
      }
    });
    return unsub;
  }, [fetchDashboard]);

  const handleSelectNav = (id: string, label: string) => {
    onSelectNav(id, label);
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredDroplets = snapshot.droplets.filter((d) => {
    if (!query) return true;
    return (
      d.name.toLowerCase().includes(query) ||
      (d.ip || '').toLowerCase().includes(query) ||
      (d.region || '').toLowerCase().includes(query)
    );
  });
  const filteredStores = snapshot.stores.filter((s) => {
    if (!query) return true;
    return (
      s.storeName.toLowerCase().includes(query) ||
      (s.subdomain || '').toLowerCase().includes(query)
    );
  });

  const runningDropletsCount = snapshot.droplets.filter((d) =>
    ['active', 'running'].includes((d.status || '').toLowerCase())
  ).length;

  return (
    <View style={styles.page}>
      <MobileTopNavbar
        user={user}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenNotifications={() => {
          if (onOpenNotifications) {
            onOpenNotifications();
          } else {
            onSetNotice(
              snapshot.activities.length > 0
                ? `Latest: ${snapshot.activities[0].action}`
                : 'No unread workspace alerts.'
            );
          }
        }}
        onOpenProfile={onOpenMenu}
        unreadCount={unreadNotifications ?? snapshot.activities.length}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchDashboard()}
            tintColor={colors.primaryHover}
            colors={[colors.primary]}
          />
        }
      >
        {/* Top Context Header */}
        <View style={styles.headerStrip}>
          <View>
            <Text style={styles.pageTitle}>Workspace</Text>
            <View style={styles.statusRowInline}>
              <View style={styles.liveDot} />
              <Text style={styles.pageSub}>
                {user?.tiwiId ? `${user.tiwiId} · Operational` : 'All systems operational'}
              </Text>
            </View>
          </View>
          {!user ? (
            <TouchableOpacity style={styles.syncBtn} onPress={onAuthAction} activeOpacity={0.85}>
              <Text style={styles.syncBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {selectedNotice ? (
          <View style={styles.noticeStrip}>
            <Layers size={14} strokeWidth={2} color={colors.primaryHover} />
            <Text style={styles.noticeStripText}>{selectedNotice}</Text>
            <TouchableOpacity onPress={() => onSetNotice('')}>
              <X size={14} strokeWidth={2} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 1. Signature Tiwlo 2x2 Stat Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, styles.statTileDark]}>
            <View style={styles.statIconDark}>
              <Droplet size={16} strokeWidth={2} color={colors.primary} />
            </View>
            <Text style={styles.statLabelLight}>Total Droplets</Text>
            <Text style={styles.statValueLight}>{snapshot.metrics.totalDroplets}</Text>
            <Text style={styles.statHintLight} numberOfLines={1}>
              {snapshot.metrics.dropletsGrowth || 'Ready to deploy'}
            </Text>
          </View>

          <View style={styles.statTile}>
            <View style={styles.statIconLight}>
              <Layers size={16} strokeWidth={2} color={colors.foreground} />
            </View>
            <Text style={styles.statLabelDark}>Total vCPUs</Text>
            <Text style={styles.statValueDark}>{snapshot.metrics.totalVcpus}</Text>
            <Text style={styles.statHintDark} numberOfLines={1}>
              {snapshot.metrics.vcpusGrowth || 'Compute'}
            </Text>
          </View>

          <View style={styles.statTile}>
            <View style={styles.statIconLight}>
              <HardDrive size={16} strokeWidth={2} color={colors.foreground} />
            </View>
            <Text style={styles.statLabelDark}>Total Storage</Text>
            <Text style={styles.statValueDark}>{snapshot.metrics.totalStorage}</Text>
            <Text style={styles.statHintDark} numberOfLines={1}>
              {snapshot.metrics.storageGrowth || 'NVMe SSD'}
            </Text>
          </View>

          <View style={[styles.statTile, styles.statTileGreen]}>
            <View style={styles.statIconGreen}>
              <Globe size={16} strokeWidth={2} color={colors.ink} />
            </View>
            <Text style={styles.statLabelGreen}>Total Bandwidth</Text>
            <Text style={styles.statValueGreen}>{snapshot.metrics.totalBandwidth}</Text>
            <Text style={styles.statHintGreen} numberOfLines={1}>
              {snapshot.metrics.bandwidthGrowth || 'Active cycle'}
            </Text>
          </View>
        </View>

        {/* 2. Native Horizontal Quick Actions */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutScroll}
          >
            {QUICK_SHORTCUTS.map((item) => {
              const active = activeNav === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.shortcutItem}
                  onPress={() => handleSelectNav(item.id, item.label)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.shortcutCircle, active && styles.shortcutCircleActive]}>
                    {item.renderIcon()}
                  </View>
                  <Text style={styles.shortcutText} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionDivider} />

        {/* 3. Active Workspace Services */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Services</Text>
            <TouchableOpacity
              onPress={() => handleSelectNav('workspace-hub', 'Services Hub')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkAction}>Open Hub</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceSummaryRow}>
            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => handleSelectNav('my-online-store', 'Online Store')}
              activeOpacity={0.75}
            >
              <View style={styles.serviceIcon}>
                <Store size={16} strokeWidth={1.9} color={colors.foreground} />
              </View>
              <Text style={styles.serviceCount}>{filteredStores.length}</Text>
              <Text style={styles.serviceName}>Stores</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => handleSelectNav('my-droplets', 'My Droplets')}
              activeOpacity={0.75}
            >
              <View style={styles.serviceIcon}>
                <Server size={16} strokeWidth={1.9} color={colors.foreground} />
              </View>
              <Text style={styles.serviceCount}>{runningDropletsCount}</Text>
              <Text style={styles.serviceName}>Running</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => handleSelectNav('workspace/performance', 'System Performance')}
              activeOpacity={0.75}
            >
              <View style={[styles.serviceIcon, styles.serviceIconGreen]}>
                <Activity size={16} strokeWidth={1.9} color={colors.primaryHover} />
              </View>
              <Text style={styles.serviceCount}>{snapshot.metrics.cpuPercent}%</Text>
              <Text style={styles.serviceName}>CPU Load</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 4. Resource Telemetry */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Resource Usage</Text>
          {[
            { label: 'CPU', pct: snapshot.metrics.cpuPercent, used: snapshot.metrics.cpuUsed || '0%' },
            { label: 'Memory', pct: snapshot.metrics.memoryPercent, used: snapshot.metrics.memoryUsed || '0 GB' },
            { label: 'Storage', pct: snapshot.metrics.storagePercent, used: snapshot.metrics.storageUsed || '0 GB' },
            { label: 'Bandwidth', pct: snapshot.metrics.bandwidthPercent, used: snapshot.metrics.bandwidthUsed || '0 GB' },
          ].map((meter) => (
            <View key={meter.label} style={styles.meterBlock}>
              <View style={styles.meterTop}>
                <Text style={styles.meterLabel}>{meter.label}</Text>
                <Text style={styles.meterValue}>
                  {meter.used} · {meter.pct}%
                </Text>
              </View>
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.min(100, Math.max(2, meter.pct))}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionDivider} />

        {/* 5. Cloud Droplets */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Droplets</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleSelectNav('create-droplet', 'Create Droplet')}
              activeOpacity={0.85}
            >
              <Plus size={13} strokeWidth={2.4} color={colors.ink} />
              <Text style={styles.addBtnText}>Deploy</Text>
            </TouchableOpacity>
          </View>

          {filteredDroplets.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No active droplets</Text>
              <Text style={styles.emptySub}>
                Deploy an Ubuntu, Debian, or Node droplet from the Cloud menu.
              </Text>
            </View>
          ) : (
            <View style={styles.listGroup}>
              {filteredDroplets.map((droplet, idx) => (
                <React.Fragment key={droplet.id}>
                  {idx > 0 ? <View style={styles.hairline} /> : null}
                  <TouchableOpacity
                    style={styles.listRow}
                    onPress={() => handleSelectNav('my-droplets', droplet.name)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.statusDotGreen} />
                    <View style={styles.listBody}>
                      <Text style={styles.listTitle}>{droplet.name}</Text>
                      <Text style={styles.listSub}>
                        {[droplet.specs, droplet.ip, droplet.region].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <MoreVertical size={16} strokeWidth={2} color={colors.muted} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionDivider} />

        {/* 6. Active Workspace Plugins & Products (Auto-Synced from Main Dashboard & Marketplace) */}
        {plugins.length > 0 ? (
          <>
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Active Plugins & Bots</Text>
                <TouchableOpacity
                  onPress={() => handleSelectNav('workspace-hub', 'Services Hub')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkAction}>Manage</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.listGroup}>
                {plugins.map((plugin, idx) => (
                  <React.Fragment key={plugin.id}>
                    {idx > 0 ? <View style={styles.hairline} /> : null}
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => {
                        const nav = resolvePluginNavId(plugin);
                        if (onOpenPluginDashboard) {
                          onOpenPluginDashboard(nav, plugin.name);
                        } else {
                          handleSelectNav(nav, plugin.name);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.listIcon}>
                        <Bot size={16} strokeWidth={1.9} color={colors.primaryHover} />
                      </View>
                      <View style={styles.listBody}>
                        <Text style={styles.listTitle}>{plugin.name}</Text>
                        <Text style={styles.listSub}>
                          {[plugin.category, plugin.status, plugin.serverName].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <ChevronRight size={16} strokeWidth={2} color={colors.muted} />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            </View>
            <View style={styles.sectionDivider} />
          </>
        ) : null}

        {/* 7. Quick Access */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.listGroup}>
            {QUICK_ACCESS_ITEMS.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <TouchableOpacity
                  style={[styles.listRow, !item.available && styles.rowMuted]}
                  disabled={!item.available}
                  onPress={() => handleSelectNav(item.id, item.title)}
                  activeOpacity={0.75}
                >
                  <View style={styles.listIcon}>{item.renderIcon()}</View>
                  <View style={styles.listBody}>
                    <Text style={styles.listTitle}>{item.title}</Text>
                    <Text style={styles.listSub}>
                      {item.available ? item.desc : 'Not available yet'}
                    </Text>
                  </View>
                  {item.available ? (
                    <ChevronRight size={16} strokeWidth={2} color={colors.muted} />
                  ) : null}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 7. Service Status & Recent Activity */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Service Status</Text>
          <View style={styles.listGroup}>
            {SERVICE_HEALTH.map((svc, idx) => (
              <React.Fragment key={svc.name}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <View style={styles.statusRow}>
                  <Text style={styles.statusName}>{svc.name}</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDotGreen} />
                    <Text style={styles.statusPillText}>{svc.status}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {snapshot.activities.length === 0 ? (
            <Text style={styles.emptySub}>
              Recent cloud and account activity will appear once synced.
            </Text>
          ) : (
            <View style={styles.listGroup}>
              {snapshot.activities.slice(0, 6).map((act, idx) => (
                <React.Fragment key={act.id}>
                  {idx > 0 ? <View style={styles.hairline} /> : null}
                  <View style={styles.activityRow}>
                    <View style={styles.listBody}>
                      <Text style={styles.listTitle}>{act.action}</Text>
                      {act.target ? <Text style={styles.listSub}>{act.target}</Text> : null}
                    </View>
                    <Text style={styles.activityTime}>{act.time || ''}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <MobileBottomNavbar activeTab={bottomTab} onSelectTab={onSelectBottomTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.6,
  },
  statusRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  pageSub: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  syncBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  noticeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noticeStripText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  statTile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 15,
  },
  statTileDark: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  statTileGreen: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statIconDark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconLight: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconGreen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(18,18,18,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabelLight: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  statValueLight: { fontSize: 23, fontWeight: '800', color: '#FFFFFF', marginTop: 2, fontVariant: ['tabular-nums'] },
  statHintLight: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  statLabelDark: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statValueDark: { fontSize: 23, fontWeight: '800', color: colors.foreground, marginTop: 2, fontVariant: ['tabular-nums'] },
  statHintDark: { fontSize: 11, color: colors.muted, marginTop: 4 },
  statLabelGreen: { fontSize: 12, color: 'rgba(18,18,18,0.75)', fontWeight: '600' },
  statValueGreen: { fontSize: 23, fontWeight: '800', color: colors.ink, marginTop: 2, fontVariant: ['tabular-nums'] },
  statHintGreen: { fontSize: 11, color: 'rgba(18,18,18,0.7)', marginTop: 4 },
  sectionBlock: {
    paddingVertical: 16,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 12,
  },
  linkAction: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryHover,
    marginBottom: 12,
  },
  shortcutScroll: {
    gap: 14,
    paddingRight: 8,
  },
  shortcutItem: {
    alignItems: 'center',
    width: 68,
    gap: 7,
  },
  shortcutCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutCircleActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  serviceSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serviceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 13,
    backgroundColor: colors.background,
  },
  serviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceIconGreen: {
    backgroundColor: colors.primarySoft,
  },
  serviceCount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  serviceName: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 2,
  },
  meterBlock: {
    marginBottom: 12,
  },
  meterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  meterValue: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  meterFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyBlock: {
    paddingVertical: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 3,
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
  },
  listGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  rowMuted: {
    opacity: 0.45,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBody: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  listSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  statusName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryHover,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    gap: 10,
  },
  activityTime: {
    fontSize: 11,
    color: colors.muted,
  },
});
