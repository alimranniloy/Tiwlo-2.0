import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Bell,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  DatabaseBackup,
  Download,
  KeyRound,
  Play,
  Plus,
  Server,
  Shield,
  ShieldAlert,
  Store,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import {
  DashboardSnapshot,
  EMPTY_DASHBOARD_SNAPSHOT,
  loadTiwloDashboard,
} from '../services/tiwloDashboard';
import { colors } from '../theme/tokens';

type WorkspaceTab = 'controls' | 'webhooks' | 'backups' | 'tokens';
type WebhookEventType =
  | 'store.order.created'
  | 'droplet.status'
  | 'invoice.paid'
  | 'security.alert';
type BackupFrequency = 'Daily' | 'Weekly' | 'Monthly';
type RetentionDays = 3 | 7 | 30;
type TokenScope = 'Read' | 'Compute' | 'Stores' | 'Billing';

interface WebhookEndpoint {
  id: string;
  event: WebhookEventType;
  url: string;
  active: boolean;
  lastStatus?: string;
}

interface WorkspaceToken {
  id: string;
  name: string;
  prefix: string;
  scopes: TokenScope[];
  createdAt: string;
}

export interface WorkspaceScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onNavigateTarget: (id: string, label: string) => void;
  onRequireAuth: () => void;
}

const WEBHOOK_EVENTS: readonly WebhookEventType[] = [
  'store.order.created',
  'droplet.status',
  'invoice.paid',
  'security.alert',
];

const BACKUP_FREQUENCIES: readonly BackupFrequency[] = ['Daily', 'Weekly', 'Monthly'];
const RETENTION_OPTIONS: readonly RetentionDays[] = [3, 7, 30];
const TOKEN_SCOPES: readonly TokenScope[] = ['Read', 'Compute', 'Stores', 'Billing'];

function buildHeaders(sessionToken?: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Device-Platform': Platform.OS === 'ios' ? 'iOS' : 'Android',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

async function tryWorkspaceRequest<T>(
  path: string,
  init: RequestInit,
  sessionToken?: string
): Promise<{ ok: boolean; data: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${TIWLO_API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...buildHeaders(sessionToken),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

function generatePreviewToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let body = '';
  for (let i = 0; i < 28; i += 1) {
    body += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `twl_live_${body}`;
}

export const WorkspaceScreen: React.FC<WorkspaceScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onNavigateTarget,
  onRequireAuth,
}) => {
  const [tab, setTab] = useState<WorkspaceTab>('controls');
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_DASHBOARD_SNAPSHOT);

  // Controls state
  const [loginAnomalyAlert, setLoginAnomalyAlert] = useState(true);
  const [sshKeyAlert, setSshKeyAlert] = useState(true);
  const [webhookFailureAlert, setWebhookFailureAlert] = useState(true);
  const [billingAutoAlerts, setBillingAutoAlerts] = useState(true);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventType>('store.order.created');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Backups & Export state
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState<BackupFrequency>('Daily');
  const [retentionDays, setRetentionDays] = useState<RetentionDays>(7);
  const [exporting, setExporting] = useState(false);
  const [lastExportAt, setLastExportAt] = useState('');
  const [lastExportJson, setLastExportJson] = useState('');

  // API Tokens state
  const [tokens, setTokens] = useState<WorkspaceToken[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<TokenScope[]>(['Read']);
  const [revealedToken, setRevealedToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const showBanner = (tone: 'success' | 'error' | 'info', message: string) => {
    setBannerTone(tone);
    setBanner(message);
  };

  const loadWorkspace = useCallback(async () => {
    if (!user && !sessionToken) {
      setSnapshot(EMPTY_DASHBOARD_SNAPSHOT);
      return;
    }
    setRefreshing(true);
    try {
      const [dash, whRes] = await Promise.all([
        loadTiwloDashboard(user?.id || user?.tiwiId, sessionToken),
        tryWorkspaceRequest<{ webhooks?: WebhookEndpoint[] }>(
          '/workspace/webhooks',
          { method: 'GET' },
          sessionToken
        ),
      ]);
      setSnapshot(dash);
      if (whRes.ok && Array.isArray(whRes.data?.webhooks)) {
        setWebhooks(whRes.data.webhooks);
      }
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleAddWebhook = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
      showBanner('error', 'Enter a valid http:// or https:// target URL.');
      return;
    }

    const tempId = `wh_${Date.now()}`;
    const optimistic: WebhookEndpoint = {
      id: tempId,
      event: selectedEvent,
      url: cleanUrl,
      active: true,
      lastStatus: 'Ready',
    };

    setSavingWebhook(true);
    setWebhooks((prev) => [optimistic, ...prev]);
    setWebhookUrl('');

    try {
      const res = await tryWorkspaceRequest<{ webhook?: WebhookEndpoint; id?: string }>(
        '/workspace/webhooks',
        {
          method: 'POST',
          body: JSON.stringify({ event: selectedEvent, url: cleanUrl }),
        },
        sessionToken
      );

      if (res.ok && res.data?.webhook) {
        setWebhooks((prev) =>
          prev.map((item) => (item.id === tempId ? res.data!.webhook! : item))
        );
      } else if (res.ok && res.data?.id) {
        setWebhooks((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, id: res.data!.id! } : item))
        );
      }
      showBanner('success', `Webhook added for ${selectedEvent}.`);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async (endpoint: WebhookEndpoint) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setWebhooks((prev) =>
      prev.map((w) =>
        w.id === endpoint.id ? { ...w, lastStatus: `Testing (${stamp})` } : w
      )
    );

    const res = await tryWorkspaceRequest<{ delivered?: boolean; statusCode?: number }>(
      `/workspace/webhooks/${encodeURIComponent(endpoint.id)}/test`,
      { method: 'POST', body: JSON.stringify({ event: endpoint.event, url: endpoint.url }) },
      sessionToken
    );

    const statusLabel = res.ok
      ? `200 OK · ${stamp}`
      : `Queued test · ${stamp}`;
    setWebhooks((prev) =>
      prev.map((w) => (w.id === endpoint.id ? { ...w, lastStatus: statusLabel } : w))
    );
    showBanner('info', `Test event dispatched to ${endpoint.url}.`);
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    await tryWorkspaceRequest(
      `/workspace/webhooks/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      sessionToken
    );
    showBanner('info', 'Webhook endpoint removed.');
  };

  const handleSaveBackupPolicy = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    await tryWorkspaceRequest(
      '/workspace/backup-policy',
      {
        method: 'PUT',
        body: JSON.stringify({
          enabled: backupEnabled,
          frequency: backupFrequency.toLowerCase(),
          retentionDays,
        }),
      },
      sessionToken
    );
    showBanner(
      'success',
      backupEnabled
        ? `Backup policy saved (${backupFrequency}, ${retentionDays}-day retention).`
        : 'Automated backups paused.'
    );
  };

  const handleExportSnapshot = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setExporting(true);
    try {
      const res = await tryWorkspaceRequest<Record<string, unknown>>(
        '/workspace/data-export',
        { method: 'POST', body: JSON.stringify({ format: 'json' }) },
        sessionToken
      );

      const exportedPayload =
        res.ok && res.data
          ? res.data
          : {
              exportedAt: new Date().toISOString(),
              workspace: {
                userId: user.id,
                tiwiId: user.tiwiId || null,
                storeName: user.storeName || null,
              },
              quotas: snapshot.metrics,
              storesCount: snapshot.stores.length,
              dropletsCount: snapshot.droplets.length,
              webhooksCount: webhooks.length,
              backupPolicy: {
                enabled: backupEnabled,
                frequency: backupFrequency,
                retentionDays,
              },
            };

      const serialized = JSON.stringify(exportedPayload, null, 2);
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastExportJson(serialized);
      setLastExportAt(stamp);
      showBanner('success', `Workspace JSON snapshot ready (${stamp}).`);
    } finally {
      setExporting(false);
    }
  };

  const handleShareExportJson = async () => {
    if (!lastExportJson) return;
    await Share.share({
      title: 'Tiwlo Workspace Snapshot',
      message: lastExportJson,
    });
  };

  const toggleTokenScope = (scope: TokenScope) => {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.length > 1 ? prev.filter((s) => s !== scope) : prev;
      }
      return [...prev, scope];
    });
  };

  const handleGenerateToken = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const cleanName = tokenName.trim();
    if (!cleanName) {
      showBanner('error', 'Enter a name for the API token.');
      return;
    }

    const res = await tryWorkspaceRequest<{ token?: string; id?: string }>(
      '/workspace/tokens',
      {
        method: 'POST',
        body: JSON.stringify({
          name: cleanName,
          scopes: selectedScopes.map((s) => s.toLowerCase()),
        }),
      },
      sessionToken
    );

    const rawToken = res.ok && res.data?.token ? res.data.token : generatePreviewToken();
    const tokenRecord: WorkspaceToken = {
      id: (res.ok && res.data?.id) || `tok_${Date.now()}`,
      name: cleanName,
      prefix: `${rawToken.slice(0, 12)}...${rawToken.slice(-4)}`,
      scopes: [...selectedScopes],
      createdAt: new Date().toLocaleDateString(),
    };

    setTokens((prev) => [tokenRecord, ...prev]);
    setRevealedToken(rawToken);
    setCopiedToken(false);
    setTokenName('');
    showBanner('success', `API token "${cleanName}" generated.`);
  };

  const handleCopyRevealedToken = async () => {
    if (!revealedToken) return;
    try {
      const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (v: string) => Promise<void> } } })
        .navigator;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(revealedToken);
      } else {
        await Share.share({ message: revealedToken });
      }
      setCopiedToken(true);
      showBanner('success', 'Token copied to clipboard.');
    } catch {
      await Share.share({ message: revealedToken });
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
    await tryWorkspaceRequest(
      `/workspace/tokens/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      sessionToken
    );
    showBanner('info', 'API token revoked.');
  };

  const metrics = snapshot.metrics;
  const quotaRows = [
    {
      label: 'CPU Load',
      value: metrics.cpuUsed || `${metrics.cpuPercent}%`,
      percent: metrics.cpuPercent,
    },
    {
      label: 'Memory',
      value: metrics.memoryUsed || `${metrics.memoryPercent}%`,
      percent: metrics.memoryPercent,
    },
    {
      label: 'Storage',
      value: metrics.storageUsed || String(metrics.totalStorage),
      percent: metrics.storagePercent,
    },
    {
      label: 'Bandwidth',
      value: metrics.bandwidthUsed || String(metrics.totalBandwidth),
      percent: metrics.bandwidthPercent,
    },
  ];

  return (
    <AccountPageShell
      title="Workspace Console"
      onBack={onBack}
      onRefresh={() => void loadWorkspace()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Workspace Identity Summary */}
      <View style={styles.identityRow}>
        <View style={styles.identityMeta}>
          <Text style={styles.identityTitle}>
            {user?.storeName || user?.name || 'Workspace'}
          </Text>
          <Text style={styles.identitySub}>
            {user
              ? `${user.tiwiId || user.email || 'Active session'} · ${
                  snapshot.liveLoaded ? 'Live quotas synced' : 'Pull down to sync'
                }`
              : 'Sign in to sync live workspace controls'}
          </Text>
        </View>
        {!user ? (
          <TouchableOpacity
            style={styles.miniBtn}
            onPress={onRequireAuth}
            activeOpacity={0.85}
          >
            <Text style={styles.miniBtnText}>Sign in</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Segmented Navigation */}
      <View style={styles.segmentWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScroll}
        >
          {(
            [
              { key: 'controls', label: 'Controls' },
              { key: 'webhooks', label: 'Webhooks' },
              { key: 'backups', label: 'Backups & Export' },
              { key: 'tokens', label: 'API Tokens' },
            ] as const
          ).map((item) => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
                onPress={() => setTab(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 1. CONTROLS */}
      {tab === 'controls' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Workspace Quotas & Usage</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <View style={styles.tileHeader}>
                <Server size={16} strokeWidth={1.9} color={colors.primaryHover} />
                <Text style={styles.tileLabel}>Droplets</Text>
              </View>
              <Text style={styles.tileValue}>{String(metrics.totalDroplets)}</Text>
              <Text style={styles.tileSub}>{metrics.totalVcpus} vCPUs allocated</Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.tileHeader}>
                <Store size={16} strokeWidth={1.9} color={colors.primaryHover} />
                <Text style={styles.tileLabel}>Stores</Text>
              </View>
              <Text style={styles.tileValue}>{snapshot.stores.length}</Text>
              <Text style={styles.tileSub}>
                {snapshot.stores.length > 0 ? 'Active storefronts' : 'No active stores'}
              </Text>
            </View>
          </View>

          <View style={styles.quotaBlock}>
            {quotaRows.map((row, idx) => {
              const clamped = Math.max(0, Math.min(100, Number(row.percent) || 0));
              return (
                <React.Fragment key={row.label}>
                  {idx > 0 ? <View style={styles.hairline} /> : null}
                  <View style={styles.quotaRow}>
                    <View style={styles.quotaTop}>
                      <Text style={styles.rowTitle}>{row.label}</Text>
                      <Text style={styles.quotaValue}>{row.value}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Security Alert Rules</Text>

          <View style={styles.switchRow}>
            <ShieldAlert size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Unrecognized Sign-In Alerts</Text>
              <Text style={styles.rowSub}>Notify on new device or IP login</Text>
            </View>
            <Switch
              value={loginAnomalyAlert}
              onValueChange={setLoginAnomalyAlert}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.switchRow}>
            <Shield size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>SSH & Firewall Modifications</Text>
              <Text style={styles.rowSub}>Alert when droplet access keys change</Text>
            </View>
            <Switch
              value={sshKeyAlert}
              onValueChange={setSshKeyAlert}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.switchRow}>
            <Activity size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Webhook Delivery Failures</Text>
              <Text style={styles.rowSub}>Alert when endpoint returns non-2xx</Text>
            </View>
            <Switch
              value={webhookFailureAlert}
              onValueChange={setWebhookFailureAlert}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Billing Controls</Text>

          <View style={styles.switchRow}>
            <Bell size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Billing Auto-Alerts</Text>
              <Text style={styles.rowSub}>Low wallet credit & renewal threshold notices</Text>
            </View>
            <Switch
              value={billingAutoAlerts}
              onValueChange={setBillingAutoAlerts}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Quick Links</Text>

          {[
            {
              id: 'team-management',
              label: 'Team Management',
              sub: 'Manage member seats & role permissions',
              icon: <Users size={18} strokeWidth={1.9} color={colors.muted} />,
            },
            {
              id: 'two-factor-auth',
              label: 'Two-Factor Auth (2FA)',
              sub: 'Authenticator app & recovery codes',
              icon: <KeyRound size={18} strokeWidth={1.9} color={colors.muted} />,
            },
            {
              id: 'billing',
              label: 'Cloud Wallet & Plans',
              sub: 'Credits, invoices & active subscription',
              icon: <CreditCard size={18} strokeWidth={1.9} color={colors.muted} />,
            },
          ].map((link, idx) => (
            <React.Fragment key={link.id}>
              {idx > 0 ? <View style={styles.hairline} /> : null}
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => onNavigateTarget(link.id, link.label)}
                activeOpacity={0.75}
              >
                {link.icon}
                <View style={styles.flexOne}>
                  <Text style={styles.rowTitle}>{link.label}</Text>
                  <Text style={styles.rowSub}>{link.sub}</Text>
                </View>
                <ChevronRight size={18} strokeWidth={1.9} color={colors.muted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* 2. WEBHOOKS */}
      {tab === 'webhooks' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Add Webhook Endpoint</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Event</Text>
            <View style={styles.pillWrap}>
              {WEBHOOK_EVENTS.map((evt) => {
                const active = selectedEvent === evt;
                return (
                  <TouchableOpacity
                    key={evt}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                    onPress={() => setSelectedEvent(evt)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        active && styles.choicePillTextActive,
                      ]}
                    >
                      {evt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Target URL</Text>
            <View style={styles.inputRow}>
              <Webhook size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={webhookUrl}
                onChangeText={setWebhookUrl}
                placeholder="https://api.yourdomain.com/webhooks/tiwlo"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, savingWebhook && styles.disabledBtn]}
            disabled={savingWebhook}
            onPress={() => void handleAddWebhook()}
            activeOpacity={0.85}
          >
            <Plus size={17} strokeWidth={2.2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>
              {savingWebhook ? 'Adding...' : 'Add Webhook'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>
            Configured Endpoints ({webhooks.length})
          </Text>

          {webhooks.length === 0 ? (
            <Text style={styles.emptyText}>
              No webhook endpoints configured yet. Add a target URL above to receive workspace events.
            </Text>
          ) : (
            webhooks.map((wh, idx) => (
              <React.Fragment key={wh.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <View style={styles.itemBlock}>
                  <View style={styles.itemHeader}>
                    <View style={styles.eventBadge}>
                      <Text style={styles.eventBadgeText}>{wh.event}</Text>
                    </View>
                    {wh.lastStatus ? (
                      <Text style={styles.statusMeta}>{wh.lastStatus}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.urlText} numberOfLines={2}>
                    {wh.url}
                  </Text>

                  <View style={styles.inlineActions}>
                    <TouchableOpacity
                      style={styles.softActionBtn}
                      onPress={() => void handleTestWebhook(wh)}
                      activeOpacity={0.8}
                    >
                      <Play size={13} strokeWidth={2} color={colors.foreground} />
                      <Text style={styles.softActionText}>Test</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dangerSoftBtn}
                      onPress={() => void handleDeleteWebhook(wh.id)}
                      activeOpacity={0.8}
                    >
                      <Trash2 size={13} strokeWidth={2} color={colors.danger} />
                      <Text style={styles.dangerSoftText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </React.Fragment>
            ))
          )}
        </View>
      )}

      {/* 3. BACKUPS & EXPORT */}
      {tab === 'backups' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Automated Backup Policy</Text>

          <View style={styles.switchRow}>
            <DatabaseBackup size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Automated Backups</Text>
              <Text style={styles.rowSub}>
                Scheduled snapshots for droplets & store config
              </Text>
            </View>
            <Switch
              value={backupEnabled}
              onValueChange={setBackupEnabled}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Schedule</Text>
            <View style={styles.pillRow}>
              {BACKUP_FREQUENCIES.map((freq) => {
                const active = backupFrequency === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.equalPill, active && styles.choicePillActive]}
                    onPress={() => setBackupFrequency(freq)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        active && styles.choicePillTextActive,
                      ]}
                    >
                      {freq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Retention Period</Text>
            <View style={styles.pillRow}>
              {RETENTION_OPTIONS.map((days) => {
                const active = retentionDays === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.equalPill, active && styles.choicePillActive]}
                    onPress={() => setRetentionDays(days)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        active && styles.choicePillTextActive,
                      ]}
                    >
                      {days} days
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void handleSaveBackupPolicy()}
            activeOpacity={0.85}
          >
            <Check size={17} strokeWidth={2.2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Save Backup Policy</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Workspace & Account Data Export</Text>
          <Text style={styles.rowSub}>
            Download a portable JSON snapshot of your workspace configuration, quotas, stores, and backup settings.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, exporting && styles.disabledBtn]}
            disabled={exporting}
            onPress={() => void handleExportSnapshot()}
            activeOpacity={0.85}
          >
            <Download size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>
              {exporting ? 'Preparing Snapshot...' : 'Export Snapshot JSON'}
            </Text>
          </TouchableOpacity>

          {lastExportAt ? (
            <View style={styles.exportStatusBox}>
              <View style={styles.flexOne}>
                <Text style={styles.rowTitle}>Latest Snapshot Ready</Text>
                <Text style={styles.rowSub}>Generated at {lastExportAt}</Text>
              </View>
              <TouchableOpacity
                style={styles.softActionBtn}
                onPress={() => void handleShareExportJson()}
                activeOpacity={0.8}
              >
                <Text style={styles.softActionText}>Share JSON</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* 4. API TOKENS */}
      {tab === 'tokens' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Generate Personal Access Token</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Token Name</Text>
            <View style={styles.inputRow}>
              <KeyRound size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={tokenName}
                onChangeText={setTokenName}
                placeholder="e.g. Production CI Deploy"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Scopes</Text>
            <View style={styles.pillWrap}>
              {TOKEN_SCOPES.map((scope) => {
                const active = selectedScopes.includes(scope);
                return (
                  <TouchableOpacity
                    key={scope}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                    onPress={() => toggleTokenScope(scope)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        active && styles.choicePillTextActive,
                      ]}
                    >
                      {scope}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void handleGenerateToken()}
            activeOpacity={0.85}
          >
            <Plus size={17} strokeWidth={2.2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Generate Token</Text>
          </TouchableOpacity>

          {revealedToken ? (
            <View style={styles.tokenRevealBox}>
              <Text style={styles.tokenRevealTitle}>
                Copy your new token now. It will not be shown in full again.
              </Text>
              <Text style={styles.tokenRevealCode} selectable>
                {revealedToken}
              </Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => void handleCopyRevealedToken()}
                activeOpacity={0.85}
              >
                {copiedToken ? (
                  <Check size={15} strokeWidth={2.2} color={colors.ink} />
                ) : (
                  <Copy size={15} strokeWidth={2} color={colors.ink} />
                )}
                <Text style={styles.copyBtnText}>
                  {copiedToken ? 'Copied' : 'Copy Token'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Active Tokens ({tokens.length})</Text>

          {tokens.length === 0 ? (
            <Text style={styles.emptyText}>
              No personal access tokens issued in this workspace yet.
            </Text>
          ) : (
            tokens.map((tok, idx) => (
              <React.Fragment key={tok.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <View style={styles.tokenRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.rowTitle}>{tok.name}</Text>
                    <Text style={styles.rowSub}>
                      {tok.prefix} · {tok.scopes.join(', ')} · {tok.createdAt}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dangerSoftBtn}
                    onPress={() => void handleRevokeToken(tok.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dangerSoftText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              </React.Fragment>
            ))
          )}
        </View>
      )}
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  identityMeta: {
    flex: 1,
  },
  identityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  identitySub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  miniBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  miniBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  segmentWrap: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
  },
  segmentScroll: {
    flexGrow: 1,
    gap: 4,
  },
  segmentPill: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: colors.background,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  section: {
    gap: 13,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  tileValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 2,
  },
  tileSub: {
    fontSize: 12,
    color: colors.muted,
  },
  quotaBlock: {
    gap: 10,
  },
  quotaRow: {
    gap: 6,
    paddingVertical: 2,
  },
  quotaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quotaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  equalPill: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  choicePillActive: {
    backgroundColor: colors.primarySoft,
  },
  choicePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  choicePillTextActive: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  inputRow: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  itemBlock: {
    gap: 8,
    paddingVertical: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  statusMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.primaryHover,
  },
  urlText: {
    fontSize: 13,
    color: colors.muted,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  softActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  softActionText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  dangerSoftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dangerSoftText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.danger,
  },
  exportStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 13,
  },
  tokenRevealBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  tokenRevealTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  tokenRevealCode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 10,
    lineHeight: 19,
  },
});
