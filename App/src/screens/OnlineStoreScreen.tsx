import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowUpRight,
  Check,
  CreditCard,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import { TIWLO_API_BASE, type TiwloUser } from '../services/tiwloAuth';
import { loadTiwloDashboard, type StoreItem } from '../services/tiwloDashboard';
import { subscribeRealtimeSync } from '../services/tiwloRealtime';
import { colors } from '../theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');
const STORE_DOMAIN = 'tiwlo.com';

const PLAN_MONTHLY_PRICES: Record<string, number> = {
  free: 0,
  starter: 0,
  growth: 19,
  pro: 49,
  business: 49,
  enterprise: 129,
};

export type OnlineStoreRecord = StoreItem & {
  planId?: string;
  planName?: string;
  price?: number;
  monthlyPrice?: number;
  monthlyCost?: number;
  planCurrency?: string;
  billingCycle?: string;
  currency?: string;
  customDomain?: string;
  nextBillingDate?: string;
  expiresAt?: string;
  createdAt?: string;
};

export interface OnlineStoreScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onOpenCreateStore: () => void;
  onOpenBilling: () => void;
  onOpenStoreAdmin?: (store: OnlineStoreRecord, initialTab?: 'overview' | 'catalog' | 'orders' | 'modules' | 'settings') => void;
  onOpenStoreUpgrade?: (store: OnlineStoreRecord) => void;
  onOpenInAppUrl?: (title: string, url: string, storeTiwiId?: string) => void;
  onRequireAuth: () => void;
}

export function getStoreHost(subdomain?: string): string {
  const value = String(subdomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase();
  if (!value) return '';
  if (
    value.endsWith(`.${STORE_DOMAIN}`) &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(value)
  ) {
    return value;
  }
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ? `${value}.${STORE_DOMAIN}`
    : '';
}

export function getStorefrontUrl(subdomain?: string, customDomain?: string): string {
  const cleanCustom = String(customDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase();
  if (cleanCustom) {
    return `https://${cleanCustom}`;
  }
  const host = getStoreHost(subdomain);
  return host ? `https://${host}` : '';
}

export function isStoreLive(status?: string): boolean {
  return ['active', 'live', 'running'].includes(String(status || '').trim().toLowerCase());
}

export function isFreePlanStore(store?: { planId?: string } | null): boolean {
  return String(store?.planId || 'free').trim().toLowerCase() === 'free';
}

export function formatStoreStatusLabel(status?: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Online';
  if (['active', 'live', 'running', 'online'].includes(normalized)) return 'Online';
  if (normalized === 'paused') return 'Paused';
  if (['offline', 'inactive'].includes(normalized)) return 'Offline';
  if (normalized === 'suspended') return 'Suspended';
  if (normalized === 'expired') return 'Expired';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatStorePlanLabel(planId?: string, explicitName?: string): string {
  if (explicitName && explicitName.trim()) return explicitName.trim();
  const normalized = String(planId || 'free').trim().toLowerCase();
  if (normalized === 'free') return 'Free Starter';
  if (normalized === 'growth') return 'Growth Retailer';
  if (normalized === 'pro') return 'Pro Business';
  if (normalized === 'enterprise') return 'Enterprise VIP';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getStoreMonthlyPrice(store?: OnlineStoreRecord | null): number {
  if (!store) return 0;
  const raw = store.monthlyPrice ?? store.monthlyCost ?? store.price;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  const key = String(store.planId || 'free').trim().toLowerCase();
  return PLAN_MONTHLY_PRICES[key] ?? 0;
}

function resolveCurrencySymbol(currency?: string): string {
  const upper = String(currency || 'USD').toUpperCase();
  if (upper.includes('BDT') || upper.includes('৳')) return '৳';
  if (upper.includes('EUR') || upper.includes('€')) return '€';
  if (upper.includes('GBP') || upper.includes('£')) return '£';
  return '$';
}

export function formatMonthlyRate(store?: OnlineStoreRecord | null): string {
  const amount = getStoreMonthlyPrice(store);
  const symbol = resolveCurrencySymbol(store?.planCurrency || 'USD');
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${symbol}${formatted}/mo`;
}

function formatDateBadge(iso?: string): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildHeaders(sessionToken?: string, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Device-Platform': Platform.OS === 'ios' ? 'iOS' : 'Android',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

export const OnlineStoreScreen: React.FC<OnlineStoreScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onOpenCreateStore,
  onOpenBilling,
  onOpenStoreAdmin,
  onOpenStoreUpgrade,
  onOpenInAppUrl,
  onRequireAuth,
}) => {
  const [stores, setStores] = useState<OnlineStoreRecord[]>([]);
  const [selectedStoreKey, setSelectedStoreKey] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [renewingId, setRenewingId] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const userId = user?.id || user?.tiwiId || '';

  const loadStores = useCallback(async () => {
    if (!userId || !sessionToken) {
      setStores([]);
      return;
    }
    setLoading(true);
    try {
      const [snapshot, restStores] = await Promise.all([
        loadTiwloDashboard(userId, sessionToken),
        fetch(`${TIWLO_API_BASE}/stores?userId=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: buildHeaders(sessionToken),
          credentials: 'include',
        })
          .then(async (res) => {
            if (!res.ok) return null;
            const data = (await res.json().catch(() => null)) as
              | OnlineStoreRecord[]
              | { stores?: OnlineStoreRecord[] }
              | null;
            if (Array.isArray(data)) return data;
            return Array.isArray(data?.stores) ? data.stores : null;
          })
          .catch(() => null),
      ]);

      const restMap = new Map<string, OnlineStoreRecord>();
      if (Array.isArray(restStores)) {
        for (const item of restStores) {
          const key = item.tiwiId || item.id;
          if (key) restMap.set(key, item);
        }
      }

      const baseStores = Array.isArray(snapshot.stores) ? snapshot.stores : [];
      const merged: OnlineStoreRecord[] =
        baseStores.length > 0
          ? baseStores.map((item) => {
              const extra = restMap.get(item.tiwiId || item.id);
              return extra ? { ...extra, ...item } : (item as OnlineStoreRecord);
            })
          : Array.isArray(restStores)
          ? restStores
          : [];

      const activeList = merged.filter(
        (store) => String(store?.status || 'active').toLowerCase() !== 'deleted'
      );
      setStores(activeList);

      if (activeList.length > 0) {
        setSelectedStoreKey((prev) => {
          const stillExists = activeList.some((s) => (s.tiwiId || s.id) === prev);
          return stillExists ? prev : activeList[0].tiwiId || activeList[0].id;
        });
      } else {
        setSelectedStoreKey('');
      }
    } catch {
      setBannerTone('error');
      setBanner('Could not load your stores.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, userId]);

  useEffect(() => {
    void loadStores();
    return subscribeRealtimeSync((topic) => {
      if (topic === 'all' || topic === 'stores' || topic === 'billing') {
        void loadStores();
      }
    });
  }, [loadStores]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStores();
    } finally {
      setRefreshing(false);
    }
  }, [loadStores]);

  const activeFreeStore = useMemo(
    () => stores.find((store) => isFreePlanStore(store)) || null,
    [stores]
  );

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stores;
    return stores.filter((store) =>
      [store.storeName, store.tiwiId, store.subdomain, store.category, store.status, store.planId]
        .some((val) => String(val || '').toLowerCase().includes(query))
    );
  }, [search, stores]);

  const selectedStore = useMemo(
    () =>
      stores.find((s) => (s.tiwiId || s.id) === selectedStoreKey) ||
      filteredStores[0] ||
      null,
    [filteredStores, selectedStoreKey, stores]
  );

  const liveCount = useMemo(
    () => stores.filter((store) => isStoreLive(store.status)).length,
    [stores]
  );

  const totalMonthlySpend = useMemo(
    () => stores.reduce((sum, store) => sum + getStoreMonthlyPrice(store), 0),
    [stores]
  );

  const handleRenewStore = async (store: OnlineStoreRecord) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const tiwiId = store.tiwiId || store.id;
    if (!tiwiId) {
      onOpenBilling();
      return;
    }

    setRenewingId(tiwiId);
    setBanner('');
    try {
      const response = await fetch(
        `${TIWLO_API_BASE}/stores/${encodeURIComponent(tiwiId)}/renew`,
        {
          method: 'POST',
          headers: buildHeaders(sessionToken, true),
          credentials: 'include',
          body: '{}',
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        insufficientFunds?: boolean;
        code?: string;
        error?: string;
        message?: string;
      };

      if (
        response.status === 402 ||
        payload.insufficientFunds ||
        payload.code === 'INSUFFICIENT_FUNDS'
      ) {
        setBannerTone('error');
        setBanner(
          payload.error || 'Insufficient billing balance. Add funds to renew this store.'
        );
        onOpenBilling();
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'Could not renew this store.');
      }

      setBannerTone('success');
      setBanner(
        payload.message || `${store.storeName || tiwiId} renewed and reactivated.`
      );
      await loadStores();
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not renew store.');
    } finally {
      setRenewingId('');
    }
  };

  const openDestination = useCallback(
    (title: string, url: string) => {
      if (!url) return;
      if (onOpenInAppUrl) {
        onOpenInAppUrl(title, url, selectedStore?.tiwiId || selectedStore?.id);
        return;
      }
      void Linking.openURL(url);
    },
    [onOpenInAppUrl, selectedStore?.id, selectedStore?.tiwiId]
  );

  const selectedHost = selectedStore ? getStoreHost(selectedStore.subdomain) : '';
  const selectedUrl = selectedStore
    ? getStorefrontUrl(selectedStore.subdomain, selectedStore.customDomain)
    : '';
  const selectedIsLive = selectedStore ? isStoreLive(selectedStore.status) : false;
  const selectedTiwiId = selectedStore?.tiwiId || selectedStore?.id || '';
  const selectedMonthlyPrice = getStoreMonthlyPrice(selectedStore);
  const renewalLabel = formatDateBadge(
    selectedStore?.nextBillingDate || selectedStore?.expiresAt
  );
  const tiwiParam = selectedTiwiId ? `?tiwiId=${encodeURIComponent(selectedTiwiId)}` : '';

  return (
    <AccountPageShell
      title="Online Store"
      onBack={onBack}
      onRefresh={() => void handleRefresh()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Clean Overview KPI Tiles */}
      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{stores.length}</Text>
          <Text style={styles.statLabel}>Stores</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statValue, liveCount > 0 && { color: colors.primaryHover }]}>
            {liveCount}
          </Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View style={[styles.statTile, styles.statTileAccent]}>
          <Text style={styles.statValue}>${totalMonthlySpend}</Text>
          <Text style={styles.statLabel}>Monthly / All</Text>
        </View>
      </View>

      {/* Top Action + Search Bar */}
      <View style={styles.actionBar}>
        <View style={styles.searchWrap}>
          <Search size={16} strokeWidth={1.9} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Find store by name or domain..."
            placeholderTextColor="#9CA3AF"
          />
          {search ? (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} strokeWidth={2} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={user ? onOpenCreateStore : onRequireAuth}
          activeOpacity={0.85}
        >
          <Plus size={16} strokeWidth={2.3} color={colors.ink} />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Store Selector Strip (if signed in with stores) */}
      {!user ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Store size={24} strokeWidth={1.8} color={colors.primaryHover} />
          </View>
          <Text style={styles.emptyTitle}>Sign in to open Store Console & Admin</Text>
          <Text style={styles.emptySub}>
            Manage your storefront dashboard, monthly plan, domains, and admin settings.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onRequireAuth}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : loading && stores.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primaryHover} />
          <Text style={styles.mutedText}>Loading stores...</Text>
        </View>
      ) : filteredStores.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Store size={24} strokeWidth={1.8} color={colors.primaryHover} />
          </View>
          <Text style={styles.emptyTitle}>
            {stores.length > 0 ? 'No stores match your search' : 'No stores created yet'}
          </Text>
          <Text style={styles.emptySub}>
            {stores.length > 0
              ? 'Try another store name, ID, or subdomain.'
              : 'Launch a free starter store or paid monthly retail workspace.'}
          </Text>
          {stores.length === 0 ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onOpenCreateStore}
              activeOpacity={0.85}
            >
              <Plus size={16} strokeWidth={2.2} color={colors.ink} />
              <Text style={styles.primaryBtnText}>Create Store</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <>
          {/* Compact Horizontal Store Switcher */}
          {filteredStores.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.switcherRow}
            >
              {filteredStores.map((store, index) => {
                const key = store.tiwiId || store.id || String(index);
                const active = selectedTiwiId === key;
                const rate = formatMonthlyRate(store);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.storeChip, active && styles.storeChipActive]}
                    onPress={() => setSelectedStoreKey(key)}
                    activeOpacity={0.82}
                  >
                    <Store
                      size={14}
                      strokeWidth={2}
                      color={active ? colors.primaryHover : colors.muted}
                    />
                    <Text
                      style={[styles.storeChipTitle, active && styles.storeChipTitleActive]}
                      numberOfLines={1}
                    >
                      {store.storeName || 'Store'}
                    </Text>
                    <Text style={styles.storeChipRate}>{rate}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {/* SECTION 1 (PRIMARY): STORE CONSOLE & ADMIN */}
          {selectedStore ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Store Console & Admin</Text>

              {/* Store Identity Card */}
              <View style={styles.identityCard}>
                <View style={styles.identityTop}>
                  <View style={styles.identityIcon}>
                    <Store size={20} strokeWidth={2} color={colors.primaryHover} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.identityTitle} numberOfLines={1}>
                      {selectedStore.storeName || 'Online Store'}
                    </Text>
                    <Text style={styles.identitySub} numberOfLines={1}>
                      {[selectedStore.customDomain || selectedHost, selectedTiwiId]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, selectedIsLive && styles.statusBadgeLive]}>
                    {selectedIsLive ? <View style={styles.onlineDot} /> : null}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        selectedIsLive && styles.statusBadgeTextLive,
                      ]}
                    >
                      {formatStoreStatusLabel(selectedStore.status)}
                    </Text>
                  </View>
                </View>

                {/* Primary 2x2 Console & Admin Launchpads */}
                <View style={styles.launchpadGrid}>
                  <TouchableOpacity
                    style={[styles.launchpadCard, styles.launchpadPrimary]}
                    onPress={() => {
                      if (onOpenStoreAdmin) {
                        onOpenStoreAdmin(selectedStore, 'overview');
                        return;
                      }
                      openDestination(
                        `${selectedStore.storeName || 'Store'} Dashboard`,
                        `${TIWLO_ORIGIN}/store-dashboard${tiwiParam}`
                      );
                    }}
                    activeOpacity={0.84}
                  >
                    <View style={styles.launchpadIconRow}>
                      <View style={styles.launchpadIconPrimary}>
                        <LayoutDashboard size={18} strokeWidth={2.1} color={colors.ink} />
                      </View>
                      <ArrowUpRight size={16} strokeWidth={2.1} color={colors.ink} />
                    </View>
                    <Text style={styles.launchpadPrimaryTitle}>Store Dashboard</Text>
                    <Text style={styles.launchpadPrimarySub}>Overview & live metrics</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.launchpadCard}
                    onPress={() => {
                      if (onOpenStoreAdmin) {
                        onOpenStoreAdmin(selectedStore, 'catalog');
                        return;
                      }
                      openDestination(
                        `${selectedStore.storeName || 'Store'} Admin`,
                        `${TIWLO_ORIGIN}/store-settings${tiwiParam}`
                      );
                    }}
                    activeOpacity={0.84}
                  >
                    <View style={styles.launchpadIconRow}>
                      <View style={styles.launchpadIconNeutral}>
                        <ShieldCheck
                          size={18}
                          strokeWidth={2}
                          color={colors.primaryHover}
                        />
                      </View>
                      <ArrowUpRight size={16} strokeWidth={2} color={colors.muted} />
                    </View>
                    <Text style={styles.launchpadTitle}>Store Admin</Text>
                    <Text style={styles.launchpadSub}>Controls, staff & store setup</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.launchpadCard}
                    onPress={() =>
                      openDestination(
                        selectedStore.storeName || 'Storefront',
                        selectedUrl || `${TIWLO_ORIGIN}/store${tiwiParam}`
                      )
                    }
                    activeOpacity={0.84}
                  >
                    <View style={styles.launchpadIconRow}>
                      <View style={styles.launchpadIconNeutral}>
                        <ExternalLink
                          size={17}
                          strokeWidth={2}
                          color={colors.foreground}
                        />
                      </View>
                      <ArrowUpRight size={16} strokeWidth={2} color={colors.muted} />
                    </View>
                    <Text style={styles.launchpadTitle}>Visit Storefront</Text>
                    <Text style={styles.launchpadSub} numberOfLines={1}>
                      {selectedHost || 'Open public site'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.launchpadCard}
                    onPress={() =>
                      openDestination(
                        'Domains & SSL',
                        `${TIWLO_ORIGIN}/domain-settings${tiwiParam}`
                      )
                    }
                    activeOpacity={0.84}
                  >
                    <View style={styles.launchpadIconRow}>
                      <View style={styles.launchpadIconNeutral}>
                        <Globe size={17} strokeWidth={2} color={colors.foreground} />
                      </View>
                      <ArrowUpRight size={16} strokeWidth={2} color={colors.muted} />
                    </View>
                    <Text style={styles.launchpadTitle}>Domains & SSL</Text>
                    <Text style={styles.launchpadSub} numberOfLines={1}>
                      {selectedStore.customDomain || 'Custom DNS setup'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* MONTHLY SUBSCRIPTION & COST BREAKDOWN */}
              <View style={styles.billingCard}>
                <View style={styles.billingTop}>
                  <View style={styles.billingIconWrap}>
                    <CreditCard size={18} strokeWidth={2} color={colors.primaryHover} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.billingEyebrow}>Monthly Subscription</Text>
                    <Text style={styles.billingPlanName}>
                      {formatStorePlanLabel(selectedStore.planId, selectedStore.planName)}
                    </Text>
                  </View>
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceValue}>
                      {formatMonthlyRate(selectedStore)}
                    </Text>
                  </View>
                </View>

                <View style={styles.billingMetaRow}>
                  <Text style={styles.billingMetaLabel}>Billing Mode</Text>
                  <Text style={styles.billingMetaValue}>
                    {selectedMonthlyPrice === 0
                      ? 'Free Tier ($0 / month)'
                      : selectedStore.billingCycle
                      ? String(selectedStore.billingCycle)
                      : 'Monthly Auto-Billing'}
                  </Text>
                </View>

                {renewalLabel ? (
                  <View style={styles.billingMetaRow}>
                    <Text style={styles.billingMetaLabel}>Next Renewal</Text>
                    <Text style={styles.billingMetaValue}>{renewalLabel}</Text>
                  </View>
                ) : null}

                <View style={styles.billingActions}>
                  <TouchableOpacity
                    style={styles.billingSecondaryBtn}
                    onPress={() => {
                      if (onOpenStoreUpgrade) {
                        onOpenStoreUpgrade(selectedStore);
                        return;
                      }
                      onOpenBilling();
                    }}
                    activeOpacity={0.84}
                  >
                    <Sparkles size={14} strokeWidth={2} color={colors.foreground} />
                    <Text style={styles.billingSecondaryText}>
                      {selectedMonthlyPrice === 0 ? 'Upgrade Plan' : 'Upgrade / Add-ons'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.billingRenewBtn,
                      !selectedIsLive && styles.billingRenewBtnPrimary,
                      renewingId === selectedTiwiId && styles.btnDisabled,
                    ]}
                    onPress={() => void handleRenewStore(selectedStore)}
                    disabled={renewingId === selectedTiwiId}
                    activeOpacity={0.85}
                  >
                    {renewingId === selectedTiwiId ? (
                      <ActivityIndicator
                        size="small"
                        color={selectedIsLive ? colors.foreground : colors.ink}
                      />
                    ) : (
                      <RefreshCw
                        size={14}
                        strokeWidth={2}
                        color={selectedIsLive ? colors.foreground : colors.ink}
                      />
                    )}
                    <Text
                      style={[
                        styles.billingRenewText,
                        !selectedIsLive && styles.billingRenewTextPrimary,
                      ]}
                    >
                      {renewingId === selectedTiwiId ? 'Renewing...' : 'Renew Store'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ADMIN CONTROLS LIST (NO Product Catalog / NO Recent Orders) */}
              <View style={styles.adminPanel}>
                <Text style={styles.adminPanelHeader}>Admin Controls</Text>

                <TouchableOpacity
                  style={styles.adminRow}
                  onPress={() =>
                    openDestination(
                      'Store Staff & Roles',
                      `${TIWLO_ORIGIN}/staff-management${tiwiParam}`
                    )
                  }
                  activeOpacity={0.82}
                >
                  <View style={styles.adminIcon}>
                    <Users size={16} strokeWidth={1.9} color={colors.foreground} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.rowTitle}>Team, Staff & Permissions</Text>
                    <Text style={styles.rowSub}>Manage store admins & role access</Text>
                  </View>
                  <ArrowUpRight size={16} strokeWidth={1.9} color={colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.adminRow}
                  onPress={() =>
                    openDestination(
                      'Payments & Gateways',
                      `${TIWLO_ORIGIN}/payments${tiwiParam}`
                    )
                  }
                  activeOpacity={0.82}
                >
                  <View style={styles.adminIcon}>
                    <Settings size={16} strokeWidth={1.9} color={colors.foreground} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.rowTitle}>Store Payments & Checkout Config</Text>
                    <Text style={styles.rowSub}>
                      {selectedStore.currency || 'USD'} · Gateways, tax & shipping rules
                    </Text>
                  </View>
                  <ArrowUpRight size={16} strokeWidth={1.9} color={colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.adminRow}
                  onPress={() =>
                    openDestination(
                      'Store Analytics',
                      `${TIWLO_ORIGIN}/analytics${tiwiParam}`
                    )
                  }
                  activeOpacity={0.82}
                >
                  <View style={styles.adminIcon}>
                    <LayoutDashboard size={16} strokeWidth={1.9} color={colors.foreground} />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.rowTitle}>Reports & Traffic Analytics</Text>
                    <Text style={styles.rowSub}>Dedicated telemetry workspace</Text>
                  </View>
                  <ArrowUpRight size={16} strokeWidth={1.9} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* ALL STORES DIRECTORY */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>All Stores ({filteredStores.length})</Text>
              <View style={styles.slotBadge}>
                <Lock size={11} strokeWidth={2.2} color={colors.foreground} />
                <Text style={styles.slotBadgeText}>
                  {activeFreeStore ? '1/1 Free Slot' : '0/1 Free Slot'}
                </Text>
              </View>
            </View>

            <View style={styles.storeList}>
              {filteredStores.map((store, index) => {
                const key = store.tiwiId || store.id || String(index);
                const isSelected = selectedTiwiId === key;
                const live = isStoreLive(store.status);
                const host = getStoreHost(store.subdomain);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.storeRow, isSelected && styles.storeRowSelected]}
                    onPress={() => setSelectedStoreKey(key)}
                    activeOpacity={0.82}
                  >
                      <View
                        style={[
                          styles.storeIconWrap,
                          isSelected && styles.storeIconWrapSelected,
                        ]}
                      >
                        <Store
                          size={17}
                          strokeWidth={1.9}
                          color={isSelected ? colors.primaryHover : colors.foreground}
                        />
                      </View>

                      <View style={styles.flexOne}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {store.storeName || 'Unnamed Store'}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {host || store.tiwiId || 'No subdomain'} ·{' '}
                          {formatMonthlyRate(store)}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, live && styles.statusBadgeLive]}>
                        <Text
                          style={[
                            styles.statusBadgeText,
                            live && styles.statusBadgeTextLive,
                          ]}
                        >
                          {formatStoreStatusLabel(store.status)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Check size={16} strokeWidth={2.3} color={colors.primaryHover} />
                      ) : null}
                    </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 2,
  },
  statTileAccent: {
    backgroundColor: colors.primarySoft,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.muted,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  createBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  createBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  switcherRow: {
    gap: 8,
    paddingVertical: 2,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storeChipActive: {
    backgroundColor: colors.primarySoft,
  },
  storeChipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    maxWidth: 130,
  },
  storeChipTitleActive: {
    color: colors.primaryHover,
  },
  storeChipRate: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.muted,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  identitySub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 1,
  },
  idPill: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  idPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  launchpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  launchpadCard: {
    width: '48.6%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  launchpadPrimary: {
    backgroundColor: colors.primary,
  },
  launchpadIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  launchpadIconPrimary: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchpadIconNeutral: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchpadPrimaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  launchpadPrimarySub: {
    fontSize: 11.5,
    color: '#064E3B',
  },
  launchpadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 2,
  },
  launchpadSub: {
    fontSize: 11.5,
    color: colors.muted,
  },
  billingCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  billingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  billingPlanName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 1,
  },
  priceBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  priceValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.primaryHover,
  },
  billingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  billingMetaLabel: {
    fontSize: 12.5,
    color: colors.muted,
  },
  billingMetaValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  billingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  billingSecondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  billingSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  billingRenewBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  billingRenewBtnPrimary: {
    backgroundColor: colors.primary,
  },
  billingRenewText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  billingRenewTextPrimary: {
    fontWeight: '700',
    color: colors.ink,
  },
  adminPanel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  adminPanelHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.muted,
    paddingBottom: 6,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
  },
  adminIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  slotBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  mutedText: {
    fontSize: 13,
    color: colors.muted,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  storeList: {
    gap: 2,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  storeRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  storeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeIconWrapSelected: {
    backgroundColor: colors.background,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primaryHover,
  },
  statusBadgeLive: {
    backgroundColor: colors.primarySoft,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
  },
  statusBadgeTextLive: {
    color: colors.primaryHover,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
