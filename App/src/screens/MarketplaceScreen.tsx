import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowUpDown,
  BarChart2,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Headphones,
  Lock,
  MessageCircle,
  PackageCheck,
  Search,
  Shield,
  Sparkles,
  Star,
  Store,
  Webhook,
  X,
  Zap,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import { resolvePluginNavId } from '../services/tiwloAccount';
import { emitRealtimeSync } from '../services/tiwloRealtime';
import { colors } from '../theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

export interface MarketplaceScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenPluginDashboard?: (navId: string, label: string) => void;
}

type ViewTab = 'catalog' | 'installed';
type CategoryFilter = 'all' | 'moderation' | 'community' | 'automation' | 'support' | 'analytics';
type PricingFilter = 'all' | 'free' | 'paid';
type SortOption = 'recommended' | 'rating' | 'installs' | 'name';
type TargetKind = 'workspace' | 'store' | 'webhook';

interface RawFeature {
  name?: string;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  developer?: string;
  category?: string;
  description?: string;
  rating?: number | null;
  reviewsCount?: number | null;
  pricingType?: string;
  price?: string;
  pricingLabel?: string;
  iconType?: string;
  logoUrl?: string | null;
  installCount?: number | null;
  features?: Array<string | RawFeature>;
  permissions?: string[];
  verified?: boolean;
  isFallback?: boolean;
}

interface InstalledSolution {
  id: string;
  serviceId?: string;
  name: string;
  productName?: string;
  category?: string;
  status?: string;
  plan?: string;
  serverName?: string;
  target?: string;
  iconType?: string;
  logoUrl?: string | null;
}

const CATEGORIES: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'community', label: 'Community' },
  { id: 'automation', label: 'Automation' },
  { id: 'support', label: 'Support' },
  { id: 'analytics', label: 'Analytics' },
];

const PRICING_OPTIONS: ReadonlyArray<{ id: PricingFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
];

const SORT_OPTIONS: ReadonlyArray<{ id: SortOption; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Rating' },
  { id: 'installs', label: 'Installs' },
  { id: 'name', label: 'Name' },
];

const FALLBACK_SOLUTIONS: MarketplaceProduct[] = [
  {
    id: 'online-storefront-sync',
    name: 'Online Storefront Sync',
    developer: 'Tiwlo Core',
    category: 'Automation',
    description:
      'Synchronize product inventory, order statuses, and storefront webhook events between your Tiwlo store and workspace tools.',
    pricingType: 'free',
    price: 'Free',
    iconType: 'store',
    features: ['Inventory Sync', 'Order Webhooks', 'Store Mapping'],
    permissions: ['Read catalog & inventory', 'Subscribe to order webhooks', 'Update fulfillment status'],
    verified: true,
    isFallback: true,
  },
  {
    id: 'whatsapp-order-notifier',
    name: 'WhatsApp Order Notifier',
    developer: 'Tiwlo Messaging',
    category: 'Support',
    description:
      'Send automated order confirmations, shipping updates, and customer support replies directly over WhatsApp Business.',
    pricingType: 'paid',
    price: 'Paid Plan',
    iconType: 'whatsapp',
    features: ['Order Alerts', 'Customer Replies', 'Template Rules'],
    permissions: ['Read order contact details', 'Send WhatsApp session alerts', 'Access messaging templates'],
    verified: true,
    isFallback: true,
  },
  {
    id: 'discord-community-bridge',
    name: 'Discord Community Bridge',
    developer: 'Tiwlo Official',
    category: 'Community',
    description:
      'Connect your Discord server with role synchronization, AI slash commands, welcome workflows, and member ticket routing.',
    pricingType: 'paid',
    price: 'Paid Plan',
    iconType: 'discord',
    features: ['Role Sync', 'Slash Commands', 'Member Alerts'],
    permissions: ['Manage connected Discord guilds', 'Sync member verification roles', 'Dispatch webhook notices'],
    verified: true,
    isFallback: true,
  },
  {
    id: 'auto-fraud-shield',
    name: 'Auto Fraud Shield',
    developer: 'Tiwlo Security',
    category: 'Moderation',
    description:
      'Screen incoming orders and account actions using velocity checks, suspicious IP detection, and automated hold rules.',
    pricingType: 'free',
    price: 'Free',
    iconType: 'shield',
    features: ['Risk Scoring', 'Velocity Rules', 'Auto Hold'],
    permissions: ['Inspect order risk signals', 'Flag high-risk checkouts', 'Write moderation audit logs'],
    verified: true,
    isFallback: true,
  },
  {
    id: 'pixel-funnel-analytics',
    name: 'Pixel & Funnel Analytics',
    developer: 'Tiwlo Insights',
    category: 'Analytics',
    description:
      'Track storefront checkout conversions, campaign attribution, and retention funnels in real time without manual tagging.',
    pricingType: 'free',
    price: 'Free',
    iconType: 'chart',
    features: ['Conversion Events', 'Funnel Tracking', 'Export Feed'],
    permissions: ['Read storefront event stream', 'Generate conversion metrics', 'Export analytics reports'],
    verified: true,
    isFallback: true,
  },
];

function resolveImageUri(uri?: string | null): string | null {
  const clean = typeof uri === 'string' ? uri.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('https://') || clean.startsWith('http://')) return clean;
  if (clean.startsWith('/')) return `${TIWLO_ORIGIN}${clean}`;
  return null;
}

function getFeatureLabels(features?: Array<string | RawFeature>): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((item) => (typeof item === 'string' ? item : item?.name || ''))
    .map((label) => label.trim())
    .filter(Boolean);
}

function getRequiredPermissions(product: MarketplaceProduct): string[] {
  if (Array.isArray(product.permissions) && product.permissions.length > 0) {
    return product.permissions;
  }
  const cat = String(product.category || '').toLowerCase();
  if (cat === 'moderation') {
    return ['Read workspace security events', 'Apply moderation & risk rules', 'Write audit logs'];
  }
  if (cat === 'community') {
    return ['Connect community channels', 'Sync member roles & commands', 'Send channel notifications'];
  }
  if (cat === 'support') {
    return ['Read customer order inquiries', 'Send automated support replies', 'Manage ticket status'];
  }
  if (cat === 'analytics') {
    return ['Read storefront & funnel events', 'Aggregate performance metrics', 'Export telemetry reports'];
  }
  return ['Read workspace configuration', 'Register event webhooks', 'Trigger automated actions'];
}

function getPricingBadge(product: MarketplaceProduct): { label: string; isFree: boolean } {
  const pricingType = String(product.pricingType || '').toLowerCase();
  const rawPrice = String(product.price || product.pricingLabel || '').trim();
  const isFree =
    pricingType === 'free' ||
    pricingType === 'freemium' ||
    rawPrice.toLowerCase() === 'free';
  return {
    label: rawPrice || (isFree ? 'Free' : 'Paid'),
    isFree,
  };
}

function renderSolutionIcon(iconType?: string, category?: string) {
  const key = String(iconType || category || '').toLowerCase();
  if (key.includes('whatsapp')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
        <MessageCircle size={20} strokeWidth={1.9} color={colors.primaryHover} />
      </View>
    );
  }
  if (key.includes('discord') || key.includes('community')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
        <Bot size={20} strokeWidth={1.9} color={colors.foreground} />
      </View>
    );
  }
  if (key.includes('shield') || key.includes('moderation')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.dangerSoft }]}>
        <Shield size={20} strokeWidth={1.9} color={colors.danger} />
      </View>
    );
  }
  if (key.includes('chart') || key.includes('analytics') || key.includes('trending')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.warningSoft }]}>
        <BarChart2 size={20} strokeWidth={1.9} color={colors.warning} />
      </View>
    );
  }
  if (key.includes('ticket') || key.includes('support')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
        <Headphones size={20} strokeWidth={1.9} color={colors.primaryHover} />
      </View>
    );
  }
  if (key.includes('store')) {
    return (
      <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
        <Store size={20} strokeWidth={1.9} color={colors.primaryHover} />
      </View>
    );
  }
  return (
    <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
      <Zap size={20} strokeWidth={1.9} color={colors.foreground} />
    </View>
  );
}

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
  onOpenPluginDashboard,
}) => {
  const [viewTab, setViewTab] = useState<ViewTab>('catalog');
  const [catalog, setCatalog] = useState<MarketplaceProduct[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledSolution[]>([]);
  const [usingFallback, setUsingFallback] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [pricing, setPricing] = useState<PricingFilter>('all');
  const [sort, setSort] = useState<SortOption>('recommended');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [targetKind, setTargetKind] = useState<TargetKind>('workspace');
  const [serviceNameInput, setServiceNameInput] = useState('');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const buildAuthHeaders = useCallback(
    (includeJsonContentType = false): Record<string, string> => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (includeJsonContentType) {
        headers['Content-Type'] = 'application/json';
      }
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      return headers;
    },
    [sessionToken]
  );

  const fetchInstalledSolutions = useCallback(async () => {
    if (!user && !sessionToken) return;
    try {
      const res = await fetch(`${TIWLO_API_BASE}/discord/workspace`, {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as {
        workspace?: { services?: InstalledSolution[] };
        services?: InstalledSolution[];
      } | null;
      const rawList = data?.workspace?.services ?? data?.services;
      if (Array.isArray(rawList)) {
        setInstalledApps(
          rawList.map((item) => ({
            id: String(item.id),
            serviceId: item.serviceId ? String(item.serviceId) : undefined,
            name: String(item.name || item.productName || 'Workspace App'),
            productName: item.productName,
            category: item.category,
            status: item.status || 'Active',
            plan: item.plan,
            serverName: item.serverName,
            target: item.target || item.serverName,
            iconType: item.iconType,
            logoUrl: item.logoUrl,
          }))
        );
      }
    } catch {
      // Keep current installed list if workspace endpoint is unreachable
    }
  }, [buildAuthHeaders, sessionToken, user]);

  const loadMarketplace = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await fetch(`${TIWLO_API_BASE}/discord/marketplace`, {
          method: 'GET',
          headers: buildAuthHeaders(),
          credentials: 'include',
        });
        const data = (await res.json().catch(() => null)) as {
          products?: MarketplaceProduct[];
        } | null;

        const remoteProducts = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
          ? (data as MarketplaceProduct[])
          : [];

        if (res.ok && remoteProducts.length > 0) {
          setCatalog(remoteProducts);
          setUsingFallback(false);
        } else {
          setCatalog(FALLBACK_SOLUTIONS);
          setUsingFallback(true);
        }
      } catch {
        setCatalog(FALLBACK_SOLUTIONS);
        setUsingFallback(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }

      void fetchInstalledSolutions();
    },
    [buildAuthHeaders, fetchInstalledSolutions]
  );

  useEffect(() => {
    void loadMarketplace(false);
  }, [loadMarketplace]);

  const installedProductIds = useMemo(() => {
    const ids = new Set<string>();
    installedApps.forEach((app) => {
      if (app.serviceId) ids.add(String(app.serviceId));
      ids.add(String(app.id));
    });
    return ids;
  }, [installedApps]);

  const filteredCatalog = useMemo(() => {
    let list = [...catalog];

    if (category !== 'all') {
      list = list.filter(
        (item) => String(item.category || '').toLowerCase() === category.toLowerCase()
      );
    }

    if (pricing !== 'all') {
      list = list.filter((item) => {
        const { isFree } = getPricingBadge(item);
        return pricing === 'free' ? isFree : !isFree;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const featureText = getFeatureLabels(item.features).join(' ').toLowerCase();
        return (
          String(item.name || '').toLowerCase().includes(q) ||
          String(item.developer || '').toLowerCase().includes(q) ||
          String(item.description || '').toLowerCase().includes(q) ||
          String(item.category || '').toLowerCase().includes(q) ||
          featureText.includes(q)
        );
      });
    }

    if (sort === 'rating') {
      list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sort === 'installs') {
      list.sort((a, b) => (Number(b.installCount) || 0) - (Number(a.installCount) || 0));
    } else if (sort === 'name') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }

    return list;
  }, [catalog, category, pricing, search, sort]);

  const filteredInstalled = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return installedApps;
    return installedApps.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        String(item.productName || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q)
    );
  }, [installedApps, search]);

  const handleToggleExpand = (product: MarketplaceProduct) => {
    if (expandedId === product.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(product.id);
    setServiceNameInput(product.name);
    setTargetKind('workspace');
    setWebhookUrlInput('');
  };

  const handleInstallSolution = async (product: MarketplaceProduct) => {
    if (!user && !sessionToken) {
      setBannerTone('info');
      setBanner('Sign in to install and activate Marketplace solutions.');
      onRequireAuth();
      return;
    }

    const resolvedName = serviceNameInput.trim() || product.name;
    if (targetKind === 'webhook' && webhookUrlInput.trim() && !/^https?:\/\//i.test(webhookUrlInput.trim())) {
      setBannerTone('error');
      setBanner('Enter a valid webhook URL starting with https:// or http://.');
      return;
    }

    const targetLabel =
      targetKind === 'store'
        ? user?.storeName || user?.storeId || 'Primary Store'
        : targetKind === 'webhook'
        ? webhookUrlInput.trim() || 'Custom Webhook'
        : 'Default Workspace';

    setInstallingId(product.id);
    setBanner('');

    try {
      const payload: Record<string, string> = {
        serviceName: resolvedName,
        target: targetLabel,
      };
      if (user?.storeId) {
        payload.storeId = user.storeId;
      }
      if (targetKind === 'webhook' && webhookUrlInput.trim()) {
        payload.webhookUrl = webhookUrlInput.trim();
      }

      const res = await fetch(
        `${TIWLO_API_BASE}/discord/marketplace/${encodeURIComponent(product.id)}/install`,
        {
          method: 'POST',
          headers: buildAuthHeaders(true),
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 401 || res.status === 403) {
        setBannerTone('error');
        setBanner('Your session expired. Sign in to activate this solution.');
        onRequireAuth();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        service?: InstalledSolution;
      };

      if (!res.ok) {
        throw new Error(data.error || data.message || `Activation failed (${res.status}).`);
      }

      const created: InstalledSolution = {
        id: data.service?.id || `local-${product.id}-${Date.now()}`,
        serviceId: data.service?.serviceId || product.id,
        name: data.service?.name || resolvedName,
        productName: data.service?.productName || product.name,
        category: data.service?.category || product.category,
        status: data.service?.status || 'Active',
        plan: data.service?.plan || getPricingBadge(product).label,
        serverName: data.service?.serverName || targetLabel,
        target: targetLabel,
        iconType: product.iconType,
        logoUrl: product.logoUrl,
      };

      setInstalledApps((prev) => {
        const exists = prev.some(
          (app) => app.id === created.id || (app.serviceId && app.serviceId === created.serviceId)
        );
        return exists ? prev : [created, ...prev];
      });

      setBannerTone('success');
      setBanner(data.message || `${product.name} activated for ${targetLabel}.`);
      emitRealtimeSync('all');
      void fetchInstalledSolutions();
      if (onOpenPluginDashboard) {
        onOpenPluginDashboard(resolvePluginNavId(created), created.name);
      }
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not activate this solution.');
    } finally {
      setInstallingId(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('all');
    setPricing('all');
    setSort('recommended');
  };

  return (
    <AccountPageShell
      title="Marketplace"
      onBack={onBack}
      onRefresh={() => void loadMarketplace(true)}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Segmented View Toggle: Browse Catalog vs Installed Apps */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segmentPill, viewTab === 'catalog' && styles.segmentPillActive]}
          onPress={() => setViewTab('catalog')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, viewTab === 'catalog' && styles.segmentTextActive]}>
            Browse Catalog
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentPill, viewTab === 'installed' && styles.segmentPillActive]}
          onPress={() => setViewTab('installed')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, viewTab === 'installed' && styles.segmentTextActive]}>
            {installedApps.length > 0 ? `Installed Apps (${installedApps.length})` : 'Installed Apps'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <Search size={17} strokeWidth={1.9} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search extensions, integrations, developers..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <X size={16} strokeWidth={2} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {viewTab === 'catalog' ? (
        <>
          {/* Category Horizontal Scrollable Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsScrollContent}
          >
            {CATEGORIES.map((item) => {
              const active = category === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setCategory(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pricing Pills & Sort Selector */}
          <View style={styles.filterBlock}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Price</Text>
              <View style={styles.pillGroup}>
                {PRICING_OPTIONS.map((opt) => {
                  const active = pricing === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.compactPill, active && styles.compactPillActive]}
                      onPress={() => setPricing(opt.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.compactPillText, active && styles.compactPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.sortLabelWrap}>
                <ArrowUpDown size={13} strokeWidth={2} color={colors.muted} />
                <Text style={styles.filterLabel}>Sort</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillGroup}
              >
                {SORT_OPTIONS.map((opt) => {
                  const active = sort === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.compactPill, active && styles.compactPillActive]}
                      onPress={() => setSort(opt.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.compactPillText, active && styles.compactPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {usingFallback ? (
            <View style={styles.fallbackNotice}>
              <Sparkles size={14} strokeWidth={2} color={colors.muted} />
              <Text style={styles.fallbackNoticeText}>
                Offline fallback catalog — default Tiwlo solutions shown
              </Text>
            </View>
          ) : null}

          <View style={styles.hairline} />

          {/* Catalog Rows */}
          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={colors.primaryHover} />
              <Text style={styles.stateText}>Loading Marketplace solutions...</Text>
            </View>
          ) : filteredCatalog.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>No matching solutions</Text>
              <Text style={styles.stateText}>
                Try another search term or clear active category and pricing filters.
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetFilters} activeOpacity={0.85}>
                <Text style={styles.secondaryBtnText}>Reset filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredCatalog.map((product, index) => {
                const isExpanded = expandedId === product.id;
                const isInstalled = installedProductIds.has(product.id);
                const isInstalling = installingId === product.id;
                const logoUri = resolveImageUri(product.logoUrl);
                const features = getFeatureLabels(product.features).slice(0, 3);
                const badge = getPricingBadge(product);
                const permissions = getRequiredPermissions(product);

                return (
                  <React.Fragment key={product.id}>
                    {index > 0 ? <View style={styles.hairline} /> : null}
                    <View style={styles.rowWrap}>
                      <TouchableOpacity
                        style={styles.itemRow}
                        onPress={() => handleToggleExpand(product)}
                        activeOpacity={0.75}
                      >
                        {logoUri ? (
                          <Image source={{ uri: logoUri }} style={styles.logoImg} />
                        ) : (
                          renderSolutionIcon(product.iconType, product.category)
                        )}

                        <View style={styles.itemMain}>
                          <View style={styles.itemTitleLine}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {product.name}
                            </Text>
                            {product.verified ? (
                              <CheckCircle2 size={14} strokeWidth={2.2} color={colors.primaryHover} />
                            ) : null}
                          </View>

                          <Text style={styles.itemMeta} numberOfLines={1}>
                            {[product.developer || 'Tiwlo Official', product.category || 'Extension']
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>

                          <View style={styles.itemStatsLine}>
                            <View
                              style={[
                                styles.priceBadge,
                                badge.isFree ? styles.priceBadgeFree : styles.priceBadgePaid,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.priceBadgeText,
                                  badge.isFree ? styles.priceBadgeFreeText : styles.priceBadgePaidText,
                                ]}
                              >
                                {badge.label}
                              </Text>
                            </View>

                            {product.rating != null ? (
                              <View style={styles.ratingWrap}>
                                <Star size={12} strokeWidth={2.2} color={colors.warning} />
                                <Text style={styles.statText}>{Number(product.rating).toFixed(1)}</Text>
                              </View>
                            ) : null}

                            {product.installCount != null ? (
                              <Text style={styles.statText}>
                                {Number(product.installCount).toLocaleString()} installs
                              </Text>
                            ) : null}

                            {isInstalled ? (
                              <View style={styles.installedBadge}>
                                <Text style={styles.installedBadgeText}>Installed</Text>
                              </View>
                            ) : null}
                          </View>

                          {features.length > 0 ? (
                            <View style={styles.featureTagsRow}>
                              {features.map((feat) => (
                                <View key={feat} style={styles.featureTag}>
                                  <Text style={styles.featureTagText}>{feat}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.chevronWrap}>
                          {isExpanded ? (
                            <ChevronUp size={18} strokeWidth={2} color={colors.muted} />
                          ) : (
                            <ChevronDown size={18} strokeWidth={2} color={colors.muted} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Inline Detail Drawer */}
                      {isExpanded ? (
                        <View style={styles.drawer}>
                          <Text style={styles.drawerDescription}>
                            {product.description || 'No description available for this solution.'}
                          </Text>

                          <View style={styles.drawerBlock}>
                            <Text style={styles.drawerSectionTitle}>Required Permissions</Text>
                            <View style={styles.permissionList}>
                              {permissions.map((perm) => (
                                <View key={perm} style={styles.permissionRow}>
                                  <Lock size={13} strokeWidth={2} color={colors.muted} />
                                  <Text style={styles.permissionText}>{perm}</Text>
                                </View>
                              ))}
                            </View>
                          </View>

                          <View style={styles.drawerBlock}>
                            <Text style={styles.drawerSectionTitle}>Service Name</Text>
                            <TextInput
                              style={styles.drawerInput}
                              value={serviceNameInput}
                              onChangeText={setServiceNameInput}
                              placeholder={product.name}
                              placeholderTextColor={colors.muted}
                            />
                          </View>

                          <View style={styles.drawerBlock}>
                            <Text style={styles.drawerSectionTitle}>Webhook / Store Target</Text>
                            <View style={styles.targetPillsRow}>
                              <TouchableOpacity
                                style={[
                                  styles.targetPill,
                                  targetKind === 'workspace' && styles.targetPillActive,
                                ]}
                                onPress={() => setTargetKind('workspace')}
                                activeOpacity={0.8}
                              >
                                <Text
                                  style={[
                                    styles.targetPillText,
                                    targetKind === 'workspace' && styles.targetPillTextActive,
                                  ]}
                                >
                                  Default Workspace
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.targetPill,
                                  targetKind === 'store' && styles.targetPillActive,
                                ]}
                                onPress={() => setTargetKind('store')}
                                activeOpacity={0.8}
                              >
                                <Store
                                  size={13}
                                  strokeWidth={2}
                                  color={
                                    targetKind === 'store' ? colors.primaryHover : colors.muted
                                  }
                                />
                                <Text
                                  style={[
                                    styles.targetPillText,
                                    targetKind === 'store' && styles.targetPillTextActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {user?.storeName || 'Primary Store'}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.targetPill,
                                  targetKind === 'webhook' && styles.targetPillActive,
                                ]}
                                onPress={() => setTargetKind('webhook')}
                                activeOpacity={0.8}
                              >
                                <Webhook
                                  size={13}
                                  strokeWidth={2}
                                  color={
                                    targetKind === 'webhook' ? colors.primaryHover : colors.muted
                                  }
                                />
                                <Text
                                  style={[
                                    styles.targetPillText,
                                    targetKind === 'webhook' && styles.targetPillTextActive,
                                  ]}
                                >
                                  Custom Webhook
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {targetKind === 'webhook' ? (
                              <TextInput
                                style={styles.drawerInput}
                                value={webhookUrlInput}
                                onChangeText={setWebhookUrlInput}
                                placeholder="https://example.com/webhooks/tiwlo"
                                placeholderTextColor={colors.muted}
                                autoCapitalize="none"
                                keyboardType="url"
                              />
                            ) : null}
                          </View>

                          <TouchableOpacity
                            style={[styles.primaryBtn, isInstalling && styles.disabledBtn]}
                            disabled={isInstalling}
                            onPress={() => void handleInstallSolution(product)}
                            activeOpacity={0.85}
                          >
                            {isInstalling ? (
                              <ActivityIndicator size="small" color={colors.ink} />
                            ) : isInstalled ? (
                              <Check size={17} strokeWidth={2.2} color={colors.ink} />
                            ) : (
                              <PackageCheck size={17} strokeWidth={2.1} color={colors.ink} />
                            )}
                            <Text style={styles.primaryBtnText}>
                              {isInstalling
                                ? 'Activating...'
                                : !user && !sessionToken
                                ? 'Sign in to Activate'
                                : isInstalled
                                ? 'Install Another Instance'
                                : 'Install / Activate Solution'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </>
      ) : (
        /* Installed Apps View */
        <View style={styles.installedSection}>
          {!user && !sessionToken && filteredInstalled.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>Sign in to manage installed apps</Text>
              <Text style={styles.stateText}>
                Connect your Tiwlo account to view and manage solutions active in your Workspace.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onRequireAuth}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : filteredInstalled.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.emptyTitle}>No installed apps yet</Text>
              <Text style={styles.stateText}>
                Browse the Marketplace catalog and activate a solution to see it here.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setViewTab('catalog')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Browse Catalog</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredInstalled.map((app, index) => {
                const logoUri = resolveImageUri(app.logoUrl);
                return (
                  <React.Fragment key={app.id}>
                    {index > 0 ? <View style={styles.hairline} /> : null}
                    <TouchableOpacity
                      style={styles.itemRow}
                      onPress={() =>
                        onOpenPluginDashboard?.(resolvePluginNavId(app), app.name)
                      }
                      activeOpacity={0.75}
                    >
                      {logoUri ? (
                        <Image source={{ uri: logoUri }} style={styles.logoImg} />
                      ) : (
                        renderSolutionIcon(app.iconType, app.category)
                      )}

                      <View style={styles.itemMain}>
                        <View style={styles.itemTitleLine}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {app.name}
                          </Text>
                          <View style={styles.installedBadge}>
                            <Text style={styles.installedBadgeText}>
                              {app.status || 'Active'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {[
                            app.productName && app.productName !== app.name ? app.productName : null,
                            app.category || 'Workspace',
                            app.plan,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>

                        {app.target || app.serverName ? (
                          <Text style={styles.targetMeta} numberOfLines={1}>
                            Target: {app.target || app.serverName}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>
      )}
    </AccountPageShell>
  );
};

export default MarketplaceScreen;

const styles = StyleSheet.create({
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  searchRow: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 13,
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
  pillsScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  categoryPillTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  filterBlock: {
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compactPillActive: {
    backgroundColor: colors.primarySoft,
  },
  compactPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  compactPillTextActive: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fallbackNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  listContainer: {
    gap: 4,
  },
  rowWrap: {
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  itemMeta: {
    fontSize: 12.5,
    color: colors.muted,
  },
  targetMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  itemStatsLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  priceBadgeFree: {
    backgroundColor: colors.surface,
  },
  priceBadgePaid: {
    backgroundColor: colors.primarySoft,
  },
  priceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceBadgeFreeText: {
    color: colors.foreground,
  },
  priceBadgePaidText: {
    color: colors.primaryHover,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  installedBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  installedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  featureTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  featureTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featureTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.foreground,
  },
  chevronWrap: {
    paddingTop: 2,
  },
  drawer: {
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  drawerDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.foreground,
  },
  drawerBlock: {
    gap: 7,
  },
  drawerSectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  permissionList: {
    gap: 6,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.foreground,
  },
  drawerInput: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    fontSize: 13.5,
    color: colors.foreground,
  },
  targetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  targetPillActive: {
    backgroundColor: colors.primarySoft,
  },
  targetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  targetPillTextActive: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  secondaryBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  stateBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  stateText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  installedSection: {
    gap: 10,
  },
});
