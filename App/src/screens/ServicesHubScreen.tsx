import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Archive,
  Bot,
  Camera,
  ChevronRight,
  Container,
  CreditCard,
  ExternalLink,
  Fingerprint,
  Globe,
  HardDrive,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  PanelsTopLeft,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Server,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Star,
  Store,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  deleteStoreRecord,
  deleteWorkspaceService,
  fetchWorkspaceServices,
  resolvePluginNavId,
  setStoreStatus,
  setWorkspaceServiceStatus,
  WorkspacePluginService,
} from '../services/tiwloAccount';
import { loadTiwloDashboard, StoreItem } from '../services/tiwloDashboard';
import { emitRealtimeSync, subscribeRealtimeSync } from '../services/tiwloRealtime';
import { colors } from '../theme/tokens';

type ServiceCategory = 'Products' | 'Cloud' | 'Controls' | 'Account';
type CategoryFilter = 'All' | ServiceCategory;

interface CatalogServiceItem {
  id: string;
  label: string;
  description: string;
  category: ServiceCategory;
  badge?: string;
  renderIcon: (color: string) => React.ReactNode;
}

export interface ServicesHubScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  storeCount?: number;
  onBack: () => void;
  onNavigateService: (id: string, label: string) => void;
  onOpenPluginDashboard?: (navId: string, label: string) => void;
  onRequireAuth?: () => void;
}

const FILTER_TABS: readonly CategoryFilter[] = [
  'All',
  'Products',
  'Cloud',
  'Controls',
  'Account',
];

const CATEGORY_ORDER: readonly ServiceCategory[] = [
  'Products',
  'Cloud',
  'Controls',
  'Account',
];

export const ServicesHubScreen: React.FC<ServicesHubScreenProps> = ({
  user,
  sessionToken,
  storeCount = 0,
  onBack,
  onNavigateService,
  onOpenPluginDashboard,
  onRequireAuth,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([
    'my-online-store',
    'my-droplets',
    'workspace',
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlugins, setActivePlugins] = useState<WorkspacePluginService[]>([]);
  const [activeStores, setActiveStores] = useState<StoreItem[]>([]);
  const [geoFenceEnabled, setGeoFenceEnabled] = useState(true);
  const [panicLockEnabled, setPanicLockEnabled] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const loadWorkspaceData = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const [plugins, dash] = await Promise.all([
        fetchWorkspaceServices(sessionToken),
        loadTiwloDashboard(user?.id || user?.tiwiId, sessionToken),
      ]);
      setActivePlugins(plugins);
      setActiveStores(dash.stores);
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void loadWorkspaceData();
    const unsub = subscribeRealtimeSync((topic) => {
      if (topic === 'all' || topic === 'dashboard' || topic === 'stores') {
        void loadWorkspaceData();
      }
    });
    return unsub;
  }, [loadWorkspaceData]);

  const handleTogglePluginStatus = async (svc: WorkspacePluginService) => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    const isPaused = String(svc.status).toLowerCase() === 'paused';
    const nextStatus = isPaused ? 'active' : 'paused';
    try {
      await setWorkspaceServiceStatus(svc.id, nextStatus, sessionToken);
      setActivePlugins((prev) =>
        prev.map((item) => (item.id === svc.id ? { ...item, status: nextStatus } : item))
      );
      emitRealtimeSync('all');
      setBannerTone('success');
      setBanner(`${svc.name} is now ${nextStatus}.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update plugin status.');
    }
  };

  const handleDeletePlugin = (svc: WorkspacePluginService) => {
    Alert.alert('Remove Service', `Delete "${svc.name}" from your workspace?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteWorkspaceService(svc.id, sessionToken);
              setActivePlugins((prev) => prev.filter((item) => item.id !== svc.id));
              emitRealtimeSync('all');
              setBannerTone('info');
              setBanner(`${svc.name} removed.`);
            } catch (err) {
              setBannerTone('error');
              setBanner(err instanceof Error ? err.message : 'Could not delete plugin.');
            }
          })();
        },
      },
    ]);
  };

  const applyStoreStatus = async (
    store: StoreItem,
    nextStatus: 'active' | 'paused' | 'offline'
  ) => {
    const tiwiId = store.tiwiId || store.id;
    try {
      await setStoreStatus(tiwiId, nextStatus, sessionToken);
      setActiveStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, status: nextStatus } : s))
      );
      emitRealtimeSync('all');
      setBannerTone('success');
      const friendly =
        nextStatus === 'active'
          ? 'Online'
          : nextStatus === 'paused'
          ? 'Paused'
          : 'Offline';
      setBanner(`${store.storeName} is now ${friendly}.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update store status.');
    }
  };

  const handleToggleStoreStatus = (store: StoreItem) => {
    Alert.alert(
      'Store Availability',
      `Choose live status for "${store.storeName}"`,
      [
        { text: 'Online', onPress: () => void applyStoreStatus(store, 'active') },
        { text: 'Paused', onPress: () => void applyStoreStatus(store, 'paused') },
        { text: 'Offline', style: 'destructive', onPress: () => void applyStoreStatus(store, 'offline') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDeleteStore = (store: StoreItem) => {
    const tiwiId = store.tiwiId || store.id;
    Alert.alert('Delete Store', `Permanently delete "${store.storeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteStoreRecord(tiwiId, sessionToken);
              setActiveStores((prev) => prev.filter((s) => s.id !== store.id));
              emitRealtimeSync('all');
              setBannerTone('info');
              setBanner(`${store.storeName} deleted.`);
            } catch (err) {
              setBannerTone('error');
              setBanner(err instanceof Error ? err.message : 'Could not delete store.');
            }
          })();
        },
      },
    ]);
  };

  const catalog = useMemo<CatalogServiceItem[]>(
    () => [
      // Products
      {
        id: 'my-online-store',
        label: 'Online Store',
        description: 'Manage storefronts, products & customer orders',
        category: 'Products',
        badge: storeCount > 0 ? String(storeCount) : undefined,
        renderIcon: (c) => <Store size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'create-store',
        label: 'Create Store',
        description: 'Launch a new Tiwlo commerce storefront',
        category: 'Products',
        renderIcon: (c) => <Plus size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        description: 'Browse themes, apps & storefront extensions',
        category: 'Products',
        renderIcon: (c) => <ShoppingBag size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'email',
        label: 'tMail',
        description: 'Custom domain mailboxes & transactional email',
        category: 'Products',
        renderIcon: (c) => <Mail size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'oneprofile',
        label: 'OneProfile',
        description: 'Unified public link hub & brand card',
        category: 'Products',
        renderIcon: (c) => <UserRound size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'whatsapp-automation',
        label: 'WhatsApp Automation',
        description: 'Order alerts & automated customer replies',
        category: 'Products',
        renderIcon: (c) => <MessageCircle size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'discord',
        label: 'Discord Console',
        description: 'Bot hosting, community alerts & webhooks',
        category: 'Products',
        renderIcon: (c) => <Bot size={18} strokeWidth={1.9} color={c} />,
      },

      // Cloud
      {
        id: 'my-droplets',
        label: 'My Droplets',
        description: 'Manage virtual machines, IPs & power states',
        category: 'Cloud',
        renderIcon: (c) => <Server size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'create-droplet',
        label: 'Create Droplet',
        description: 'Deploy an NVMe cloud compute instance',
        category: 'Cloud',
        renderIcon: (c) => <Plus size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'domains',
        label: 'Domains',
        description: 'DNS zones, SSL certificates & routing',
        category: 'Cloud',
        renderIcon: (c) => <Globe size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'tpanel',
        label: 'TPanel Control Panel',
        description: 'Server stack, databases & file management',
        category: 'Cloud',
        badge: 'Pro',
        renderIcon: (c) => <PanelsTopLeft size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        description: 'Managed container clusters & node pools',
        category: 'Cloud',
        badge: 'New',
        renderIcon: (c) => <Container size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'images',
        label: 'Images',
        description: 'OS distributions & custom machine images',
        category: 'Cloud',
        renderIcon: (c) => <ImageIcon size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'snapshots',
        label: 'Snapshots',
        description: 'On-demand disk & server point-in-time copies',
        category: 'Cloud',
        renderIcon: (c) => <Camera size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'backups',
        label: 'Backups',
        description: 'Scheduled recovery archives & restore points',
        category: 'Cloud',
        renderIcon: (c) => <Archive size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'volumes',
        label: 'Volumes',
        description: 'Attachable high-speed block storage disks',
        category: 'Cloud',
        renderIcon: (c) => <HardDrive size={18} strokeWidth={1.9} color={c} />,
      },

      // Controls & Account
      {
        id: 'workspace',
        label: 'Workspace',
        description: 'Quotas, webhooks, backup policy & API tokens',
        category: 'Controls',
        renderIcon: (c) => <LayoutGrid size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'billing',
        label: 'Cloud Wallet & Plans',
        description: 'Credits, active plan, invoices & vouchers',
        category: 'Controls',
        renderIcon: (c) => <CreditCard size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'identity',
        label: 'Identity',
        description: 'Tiwi ID, verification status & account details',
        category: 'Account',
        renderIcon: (c) => <Fingerprint size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'active-sessions',
        label: 'Active Sessions',
        description: 'Signed-in devices & remote session revoke',
        category: 'Account',
        renderIcon: (c) => <Smartphone size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'two-factor-auth',
        label: 'Two-Factor Auth',
        description: 'Authenticator app, email OTP & backup codes',
        category: 'Account',
        renderIcon: (c) => <KeyRound size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'team-management',
        label: 'Team Management',
        description: 'Member seats, roles & module permissions',
        category: 'Account',
        renderIcon: (c) => <Users size={18} strokeWidth={1.9} color={c} />,
      },
      {
        id: 'help-support',
        label: 'Help & Support',
        description: 'Support tickets, docs & system guidance',
        category: 'Account',
        renderIcon: (c) => <HelpCircle size={18} strokeWidth={1.9} color={c} />,
      },
    ],
    [storeCount]
  );

  const pinnedServices = useMemo(
    () =>
      pinnedIds
        .map((id) => catalog.find((item) => item.id === id))
        .filter((item): item is CatalogServiceItem => Boolean(item)),
    [catalog, pinnedIds]
  );

  const togglePin = (id: string) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredServices = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (activeCategory !== 'All' && item.category !== activeCategory) {
        return false;
      }
      if (!clean) return true;
      return (
        item.label.toLowerCase().includes(clean) ||
        item.description.toLowerCase().includes(clean) ||
        item.id.toLowerCase().includes(clean) ||
        item.category.toLowerCase().includes(clean)
      );
    });
  }, [activeCategory, catalog, query]);

  const groupedCategories = useMemo(() => {
    const categories =
      activeCategory === 'All' ? CATEGORY_ORDER : ([activeCategory] as const);
    return categories
      .map((category) => ({
        category,
        items: filteredServices.filter((s) => s.category === category),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeCategory, filteredServices]);

  return (
    <AccountPageShell
      title="Services Hub"
      onBack={onBack}
      onRefresh={() => void loadWorkspaceData()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <Search size={17} strokeWidth={1.9} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search all Tiwlo services..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} strokeWidth={2} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Pinned Favorites Bar */}
      <View style={styles.favoritesSection}>
        <View style={styles.favoritesHeader}>
          <Text style={styles.sectionLabel}>Pinned Favorites</Text>
          {user?.tiwiId ? (
            <Text style={styles.tiwiMeta}>{user.tiwiId}</Text>
          ) : null}
        </View>

        {pinnedServices.length === 0 ? (
          <Text style={styles.emptyHint}>
            Tap the star on any service below to pin it here.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesList}
          >
            {pinnedServices.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.favoriteChip}
                onPress={() => onNavigateService(item.id, item.label)}
                activeOpacity={0.8}
              >
                {item.renderIcon(colors.primaryHover)}
                <Text style={styles.favoriteChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTER_TABS.map((cat) => {
          const active = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.filterPillText, active && styles.filterPillTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      {/* Live Installed Plugins, Bots & Stores Console */}
      {(activePlugins.length > 0 || activeStores.length > 0) ? (
        <>
          <View style={styles.groupBlock}>
            <Text style={styles.sectionLabel}>Active Workspace Products</Text>
            <View style={styles.groupList}>
              {activePlugins.map((svc, idx) => {
                const isPaused = String(svc.status || '').toLowerCase() === 'paused';
                return (
                  <React.Fragment key={svc.id}>
                    {idx > 0 ? <View style={styles.hairline} /> : null}
                    <View style={styles.liveRow}>
                      <TouchableOpacity
                        style={styles.liveMainTap}
                        onPress={() => {
                          const nav = resolvePluginNavId(svc);
                          if (onOpenPluginDashboard) {
                            onOpenPluginDashboard(nav, svc.name);
                          } else {
                            onNavigateService(nav, svc.name);
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={styles.iconBox}>
                          <Bot size={18} strokeWidth={1.9} color={colors.primaryHover} />
                        </View>
                        <View style={styles.serviceMeta}>
                          <View style={styles.titleRow}>
                            <Text style={styles.serviceTitle}>{svc.name}</Text>
                            <View style={[styles.badgePill, !isPaused && styles.activeBadge]}>
                              <Text style={styles.badgeText}>{svc.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.serviceDesc} numberOfLines={1}>
                            {[svc.category, svc.plan, svc.serverName].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const nav = resolvePluginNavId(svc);
                          if (onOpenPluginDashboard) {
                            onOpenPluginDashboard(nav, svc.name);
                          } else {
                            onNavigateService(nav, svc.name);
                          }
                        }}
                        style={styles.actionIconBtn}
                      >
                        <ExternalLink size={16} strokeWidth={1.9} color={colors.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void handleTogglePluginStatus(svc)}
                        style={styles.actionIconBtn}
                      >
                        {isPaused ? (
                          <PlayCircle size={17} strokeWidth={1.9} color={colors.primaryHover} />
                        ) : (
                          <PauseCircle size={17} strokeWidth={1.9} color={colors.warning} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeletePlugin(svc)}
                        style={styles.actionIconBtn}
                      >
                        <Trash2 size={16} strokeWidth={1.9} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                );
              })}

              {activeStores.map((st, idx) => {
                const rawStatus = String(st.status || 'active').toLowerCase();
                const isLive = ['active', 'live', 'online', 'running'].includes(rawStatus);
                const statusLabel =
                  rawStatus === 'paused'
                    ? 'Paused'
                    : rawStatus === 'offline' || rawStatus === 'suspended'
                    ? 'Offline'
                    : 'Online';
                return (
                  <React.Fragment key={st.id}>
                    {activePlugins.length > 0 || idx > 0 ? <View style={styles.hairline} /> : null}
                    <View style={styles.liveRow}>
                      <TouchableOpacity
                        style={styles.liveMainTap}
                        onPress={() => onNavigateService('my-online-store', st.storeName)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.iconBox}>
                          <Store size={18} strokeWidth={1.9} color={colors.foreground} />
                        </View>
                        <View style={styles.serviceMeta}>
                          <View style={styles.titleRow}>
                            <Text style={styles.serviceTitle}>{st.storeName}</Text>
                            <View style={[styles.badgePill, isLive && styles.activeBadge]}>
                              <Text style={styles.badgeText}>{statusLabel}</Text>
                            </View>
                          </View>
                          <Text style={styles.serviceDesc} numberOfLines={1}>
                            {st.subdomain || st.tiwiId || 'Storefront'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleToggleStoreStatus(st)}
                        style={styles.actionIconBtn}
                      >
                        {!isLive ? (
                          <PlayCircle size={17} strokeWidth={1.9} color={colors.primaryHover} />
                        ) : (
                          <PauseCircle size={17} strokeWidth={1.9} color={colors.warning} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteStore(st)}
                        style={styles.actionIconBtn}
                      >
                        <Trash2 size={16} strokeWidth={1.9} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
          <View style={styles.divider} />
        </>
      ) : null}

      {/* Security Enhancements: Geo-Fence & Panic PIN */}
      <View style={styles.groupBlock}>
        <Text style={styles.sectionLabel}>Workspace Safety</Text>
        <View style={styles.groupList}>
          <View style={styles.serviceRow}>
            <View style={styles.iconBox}>
              <MapPin size={18} strokeWidth={1.9} color={colors.primaryHover} />
            </View>
            <View style={styles.serviceMeta}>
              <Text style={styles.serviceTitle}>Geo-Fence Login Lock</Text>
              <Text style={styles.serviceDesc}>Alert & challenge logins outside main country</Text>
            </View>
            <Switch
              value={geoFenceEnabled}
              onValueChange={setGeoFenceEnabled}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.hairline} />
          <View style={styles.serviceRow}>
            <View style={styles.iconBox}>
              <ShieldAlert size={18} strokeWidth={1.9} color={colors.danger} />
            </View>
            <View style={styles.serviceMeta}>
              <Text style={styles.serviceTitle}>Panic Lockdown Mode</Text>
              <Text style={styles.serviceDesc}>Instantly revoke sessions on emergency PIN entry</Text>
            </View>
            <Switch
              value={panicLockEnabled}
              onValueChange={setPanicLockEnabled}
              trackColor={{ false: '#E4E4E7', true: colors.danger }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Service Catalog */}
      {groupedCategories.length === 0 ? (
        <Text style={styles.emptyHint}>
          No Tiwlo services matched "{query.trim()}".
        </Text>
      ) : (
        groupedCategories.map((group) => (
          <View key={group.category} style={styles.groupBlock}>
            <Text style={styles.sectionLabel}>{group.category}</Text>

            <View style={styles.groupList}>
              {group.items.map((item, idx) => {
                const pinned = pinnedIds.includes(item.id);
                return (
                  <React.Fragment key={item.id}>
                    {idx > 0 ? <View style={styles.hairline} /> : null}
                    <TouchableOpacity
                      style={styles.serviceRow}
                      onPress={() => onNavigateService(item.id, item.label)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.iconBox}>
                        {item.renderIcon(colors.foreground)}
                      </View>

                      <View style={styles.serviceMeta}>
                        <View style={styles.titleRow}>
                          <Text style={styles.serviceTitle}>{item.label}</Text>
                          {item.badge ? (
                            <View style={styles.badgePill}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.serviceDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.starTouch}
                        onPress={() => togglePin(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={
                          pinned ? `Unpin ${item.label}` : `Pin ${item.label}`
                        }
                      >
                        <Star
                          size={17}
                          strokeWidth={1.9}
                          color={pinned ? colors.primaryHover : colors.muted}
                          fill={pinned ? colors.primary : 'transparent'}
                        />
                      </TouchableOpacity>

                      <ChevronRight size={17} strokeWidth={1.9} color={colors.muted} />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))
      )}
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  favoritesSection: {
    gap: 10,
  },
  favoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tiwiMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  favoritesList: {
    gap: 8,
  },
  favoriteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  favoriteChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  filterScroll: {
    gap: 8,
  },
  filterPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  filterPillTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  groupBlock: {
    gap: 8,
  },
  groupList: {
    gap: 2,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  liveMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBtn: {
    padding: 6,
  },
  activeBadge: {
    backgroundColor: colors.primarySoft,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceMeta: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  badgePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  serviceDesc: {
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 17,
  },
  starTouch: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 6,
  },
});
