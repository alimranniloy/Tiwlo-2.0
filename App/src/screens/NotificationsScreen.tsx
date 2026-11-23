import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Bell,
  Check,
  ChevronRight,
  CreditCard,
  Shield,
  Smartphone,
  Store,
  UserRound,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  DEFAULT_NOTIFICATION_PREFS,
  fetchTiwloNotifications,
  loadNotificationPrefs,
  loadReadNotificationIds,
  registerInAppBannerDispatcher,
  saveNotificationPrefs,
  saveReadNotificationIds,
  TiwloNotificationCategory,
  TiwloNotificationItem,
  TiwloNotificationPrefs,
  triggerNativeLocalAlert,
} from '../services/tiwloNotifications';
import { colors } from '../theme/tokens';

type FilterTab = 'all' | 'unread' | 'security' | 'billing';

const FILTER_TABS: readonly { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'security', label: 'Security' },
  { key: 'billing', label: 'Billing' },
];

const POLL_INTERVAL_MS = 30000;

export interface NotificationsScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
  onNavigateRoute?: (routeId: string) => void;
}

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) {
    return iso;
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ts).toLocaleDateString();
}

function shouldAlertForCategory(
  category: TiwloNotificationCategory,
  prefs: TiwloNotificationPrefs
): boolean {
  if (category === 'security') return prefs.securityVibrateAlert;
  if (category === 'billing') return prefs.billingInvoiceNotices;
  if (category === 'store') return prefs.storeOrderAlerts;
  return true;
}

function getCategoryLabel(category: TiwloNotificationCategory): string {
  switch (category) {
    case 'security':
      return 'Security';
    case 'billing':
      return 'Billing';
    case 'store':
      return 'Store';
    default:
      return 'System';
  }
}

function renderCategoryIcon(category: TiwloNotificationCategory, unread: boolean) {
  const iconColor = unread ? colors.primaryHover : colors.muted;
  switch (category) {
    case 'security':
      return <Shield size={17} strokeWidth={2} color={iconColor} />;
    case 'billing':
      return <CreditCard size={17} strokeWidth={2} color={iconColor} />;
    case 'store':
      return <Store size={17} strokeWidth={2} color={iconColor} />;
    default:
      return <Bell size={17} strokeWidth={2} color={iconColor} />;
  }
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
  onNavigateRoute,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [items, setItems] = useState<TiwloNotificationItem[]>([]);
  const [prefs, setPrefs] = useState<TiwloNotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadNotificationPrefs().then((loaded) => {
      if (active) {
        setPrefs(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unregister = registerInAppBannerDispatcher((alertItem) => {
      setBannerTone('info');
      setBanner(`${alertItem.title}: ${alertItem.body}`);
    });
    return unregister;
  }, []);

  const syncNotifications = useCallback(
    async (options?: { fromPolling?: boolean; silent?: boolean }) => {
      if (!sessionToken && !user) {
        setItems([]);
        return;
      }

      if (!options?.silent) {
        setRefreshing(true);
      }

      try {
        const fetched = await fetchTiwloNotifications(sessionToken);
        setItems(fetched);

        if (initializedRef.current && options?.fromPolling) {
          const newEvent = fetched.find(
            (entry) =>
              !entry.read &&
              !seenIdsRef.current.has(entry.id) &&
              shouldAlertForCategory(entry.category, prefs)
          );
          if (newEvent) {
            triggerNativeLocalAlert(newEvent, {
              vibrate: prefs.securityVibrateAlert,
              showSystemAlert: false,
            });
          }
        }

        for (const entry of fetched) {
          seenIdsRef.current.add(entry.id);
        }
        initializedRef.current = true;
      } catch (err) {
        if (!options?.fromPolling) {
          setBannerTone('error');
          setBanner(
            err instanceof Error
              ? err.message
              : 'Unable to sync Tiwlo notifications.'
          );
        }
      } finally {
        if (!options?.silent) {
          setRefreshing(false);
        }
      }
    },
    [prefs, sessionToken, user]
  );

  useEffect(() => {
    void syncNotifications();
  }, [syncNotifications]);

  useEffect(() => {
    if (!prefs.pollingSyncEnabled || (!sessionToken && !user)) {
      return undefined;
    }

    const interval = setInterval(() => {
      void syncNotifications({ fromPolling: true, silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [prefs.pollingSyncEnabled, sessionToken, syncNotifications, user]);

  const unreadCount = useMemo(
    () => items.reduce((count, entry) => (entry.read ? count : count + 1), 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (filter === 'unread') {
      return items.filter((entry) => !entry.read);
    }
    if (filter === 'security') {
      return items.filter((entry) => entry.category === 'security');
    }
    if (filter === 'billing') {
      return items.filter((entry) => entry.category === 'billing');
    }
    return items;
  }, [filter, items]);

  const persistReadIds = useCallback(async (idsToAdd: string[]) => {
    if (idsToAdd.length === 0) return;
    const existing = await loadReadNotificationIds();
    await saveReadNotificationIds([...existing, ...idsToAdd]);
  }, []);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }
    const unreadIds = items.filter((entry) => !entry.read).map((entry) => entry.id);
    setItems((prev) => prev.map((entry) => ({ ...entry, read: true })));
    await persistReadIds(unreadIds);
    setBannerTone('success');
    setBanner('All notifications marked as read.');
  };

  const handlePressNotification = async (item: TiwloNotificationItem) => {
    if (!item.read) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, read: true } : entry
        )
      );
      await persistReadIds([item.id]);
    }

    if (item.targetRoute && onNavigateRoute) {
      onNavigateRoute(item.targetRoute);
    }
  };

  const handleTogglePref = async (
    key: keyof TiwloNotificationPrefs,
    value: boolean
  ) => {
    const next: TiwloNotificationPrefs = {
      ...prefs,
      [key]: value,
    };
    setPrefs(next);
    await saveNotificationPrefs(next);
    setBannerTone('success');
    setBanner('Native notification preferences saved.');
  };

  const handleTestNativeAlert = () => {
    const sample: TiwloNotificationItem = {
      id: `local-test-${Date.now()}`,
      title: 'Tiwlo Native Alert Active',
      body: 'Delivered via direct Tiwlo sync + device vibration without Firebase.',
      category: 'security',
      createdAt: new Date().toISOString(),
      read: false,
      targetRoute: 'active-sessions',
    };
    triggerNativeLocalAlert(sample, {
      vibrate: true,
      showSystemAlert: true,
    });
  };

  return (
    <AccountPageShell
      title="Notifications"
      onBack={onBack}
      onRefresh={() => {
        void syncNotifications();
      }}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Auth Prompt Row when signed out */}
      {!user && !sessionToken ? (
        <View style={styles.authRow}>
          <View style={styles.iconPillMuted}>
            <UserRound size={18} strokeWidth={2} color={colors.muted} />
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.rowTitle}>Sign in to sync Tiwlo alerts</Text>
            <Text style={styles.rowSub}>
              Direct account polling without Firebase or Google Play services
            </Text>
          </View>
          <TouchableOpacity
            style={styles.miniBtn}
            onPress={onRequireAuth}
            activeOpacity={0.85}
          >
            <Text style={styles.miniBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary & Mark All Read Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <View style={styles.iconPillPrimary}>
            <Bell size={17} strokeWidth={2} color={colors.primaryHover} />
          </View>
          <View style={styles.metaCol}>
            <View style={styles.badgeLine}>
              <Text style={styles.summaryTitle}>Inbox</Text>
              <View
                style={[
                  styles.unreadBadge,
                  unreadCount === 0 && styles.unreadBadgeClear,
                ]}
              >
                <Text
                  style={[
                    styles.unreadBadgeText,
                    unreadCount === 0 && styles.unreadBadgeTextClear,
                  ]}
                >
                  {unreadCount} unread
                </Text>
              </View>
            </View>
            <Text style={styles.rowSub}>
              Tiwlo native sync · Zero Firebase
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.markAllBtn,
            unreadCount === 0 && styles.markAllBtnDisabled,
          ]}
          onPress={() => {
            void handleMarkAllRead();
          }}
          disabled={unreadCount === 0}
          activeOpacity={0.8}
        >
          <Check
            size={14}
            strokeWidth={2.2}
            color={unreadCount === 0 ? colors.muted : colors.foreground}
          />
          <Text
            style={[
              styles.markAllText,
              unreadCount === 0 && styles.markAllTextDisabled,
            ]}
          >
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Bar */}
      <View style={styles.segmentWrap}>
        {FILTER_TABS.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentPill, active && styles.segmentPillActive]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications List */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Activity Feed</Text>

        {filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {!user && !sessionToken
                ? 'No notifications loaded'
                : filter === 'unread'
                ? 'All caught up'
                : 'No notifications in this filter'}
            </Text>
            <Text style={styles.emptySub}>
              {!user && !sessionToken
                ? 'Sign in to receive live security, billing, and store events from Tiwlo.'
                : 'Pull down to refresh your Tiwlo account feed.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <TouchableOpacity
                  style={[
                    styles.notifRow,
                    !item.read && styles.notifRowUnread,
                  ]}
                  onPress={() => {
                    void handlePressNotification(item);
                  }}
                  activeOpacity={0.78}
                >
                  <View
                    style={[
                      styles.iconPillMuted,
                      !item.read && styles.iconPillPrimary,
                    ]}
                  >
                    {renderCategoryIcon(item.category, !item.read)}
                  </View>

                  <View style={styles.metaCol}>
                    <View style={styles.notifTopLine}>
                      <View style={styles.titleWithDot}>
                        {!item.read ? <View style={styles.unreadDot} /> : null}
                        <Text style={styles.notifTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={styles.notifTime}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>

                    <Text style={styles.notifBody} numberOfLines={2}>
                      {item.body}
                    </Text>

                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>
                        {getCategoryLabel(item.category)}
                      </Text>
                    </View>
                  </View>

                  {item.targetRoute ? (
                    <ChevronRight
                      size={16}
                      strokeWidth={2}
                      color={colors.muted}
                    />
                  ) : null}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Native / Custom Tiwlo Notification Channels (Zero Firebase) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Native Tiwlo Channels · No Firebase
        </Text>

        <View style={styles.prefRow}>
          <Activity size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.metaCol}>
            <Text style={styles.rowTitle}>Pure Tiwlo Polling Sync</Text>
            <Text style={styles.rowSub}>
              Direct Tiwlo backend polling without Firebase or Google Push
            </Text>
          </View>
          <Switch
            value={prefs.pollingSyncEnabled}
            onValueChange={(val) => {
              void handleTogglePref('pollingSyncEnabled', val);
            }}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.prefRow}>
          <Smartphone size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.metaCol}>
            <Text style={styles.rowTitle}>Security Login Vibrate/Alert</Text>
            <Text style={styles.rowSub}>
              Trigger native mobile vibration & alert on new sign-ins
            </Text>
          </View>
          <Switch
            value={prefs.securityVibrateAlert}
            onValueChange={(val) => {
              void handleTogglePref('securityVibrateAlert', val);
            }}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.prefRow}>
          <CreditCard size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.metaCol}>
            <Text style={styles.rowTitle}>Billing & Invoice Notices</Text>
            <Text style={styles.rowSub}>
              Wallet credits, renewals, and invoice alerts via Tiwlo
            </Text>
          </View>
          <Switch
            value={prefs.billingInvoiceNotices}
            onValueChange={(val) => {
              void handleTogglePref('billingInvoiceNotices', val);
            }}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.prefRow}>
          <Store size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.metaCol}>
            <Text style={styles.rowTitle}>Store Order Alerts</Text>
            <Text style={styles.rowSub}>
              Direct native alerts for storefront & checkout activity
            </Text>
          </View>
          <Switch
            value={prefs.storeOrderAlerts}
            onValueChange={(val) => {
              void handleTogglePref('storeOrderAlerts', val);
            }}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleTestNativeAlert}
          activeOpacity={0.82}
        >
          <Bell size={16} strokeWidth={2} color={colors.foreground} />
          <Text style={styles.secondaryBtnText}>
            Test Native Alert & Vibration
          </Text>
        </TouchableOpacity>
      </View>
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconPillPrimary: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillMuted: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCol: {
    flex: 1,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  unreadBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  unreadBadgeClear: {
    backgroundColor: colors.surface,
  },
  unreadBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  unreadBadgeTextClear: {
    color: colors.muted,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markAllBtnDisabled: {
    opacity: 0.6,
  },
  markAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  markAllTextDisabled: {
    color: colors.muted,
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
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
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
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  listContainer: {
    borderRadius: 12,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  notifRowUnread: {
    backgroundColor: colors.surface,
  },
  notifTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWithDot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  notifTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  notifTime: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.muted,
  },
  notifBody: {
    fontSize: 12.5,
    lineHeight: 17.5,
    color: colors.muted,
    marginTop: 3,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  emptySub: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
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
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.foreground,
  },
});
