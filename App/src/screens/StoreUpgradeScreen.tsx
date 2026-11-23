import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Check,
  CreditCard,
  Globe,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import { fetchCloudBillingAccount } from '../services/tiwloAccount';
import { emitRealtimeSync } from '../services/tiwloRealtime';
import {
  fetchStorePackages,
  fetchStoreSubscription,
  purchaseStoreAddon,
  type StoreAddonRecord,
  type StorePackageRecord,
  type StoreSubscriptionRecord,
  upgradeStorePlan,
} from '../services/tiwloStoreAdmin';
import { colors } from '../theme/tokens';
import type { OnlineStoreRecord } from './OnlineStoreScreen';

const FALLBACK_PACKAGES: StorePackageRecord[] = [
  {
    planId: 'free',
    planName: 'Free Starter',
    price: 0,
    productLimit: 50,
    warehouseLimit: 1,
    staffLimit: 1,
    monthlyOrderLimit: 100,
    hasCustomDomain: false,
    hasPos: false,
    description: 'Core catalog, local stock & free *.tiwlo.com storefront.',
  },
  {
    planId: 'growth',
    planName: 'Growth Retailer',
    price: 19,
    productLimit: 500,
    warehouseLimit: 2,
    staffLimit: 3,
    monthlyOrderLimit: 1000,
    hasCustomDomain: true,
    hasPos: true,
    description: 'Custom domain, POS access, higher limits & staff seats.',
  },
  {
    planId: 'pro',
    planName: 'Pro Business',
    price: 49,
    productLimit: 5000,
    warehouseLimit: 5,
    staffLimit: 10,
    monthlyOrderLimit: 10000,
    hasCustomDomain: true,
    hasPos: true,
    description: 'Multi-warehouse routing, higher quotas & POS terminal.',
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    price: 129,
    productLimit: 999999,
    warehouseLimit: 99,
    staffLimit: 999999,
    monthlyOrderLimit: 999999,
    hasCustomDomain: true,
    hasPos: true,
    description: 'Unlimited retail volume for chains & wholesale teams.',
  },
];

export interface StoreUpgradeScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  store: OnlineStoreRecord;
  onBack: () => void;
  onOpenBilling: () => void;
  onRequireAuth: () => void;
}

function formatLimit(n: number): string {
  if (!n || n >= 99999) return 'Unlimited';
  return n.toLocaleString();
}

export const StoreUpgradeScreen: React.FC<StoreUpgradeScreenProps> = ({
  user,
  sessionToken,
  store,
  onBack,
  onOpenBilling,
  onRequireAuth,
}) => {
  const tiwiId = store.tiwiId || store.id;
  const [packages, setPackages] = useState<StorePackageRecord[]>(FALLBACK_PACKAGES);
  const [addons, setAddons] = useState<StoreAddonRecord[]>([]);
  const [sub, setSub] = useState<StoreSubscriptionRecord | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const loadData = useCallback(async () => {
    if (!sessionToken || !tiwiId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [catalogRes, subRes, billingRes] = await Promise.allSettled([
        fetchStorePackages(sessionToken),
        fetchStoreSubscription(tiwiId, sessionToken),
        fetchCloudBillingAccount(sessionToken),
      ]);
      if (catalogRes.status === 'fulfilled') {
        if (catalogRes.value.packages.length > 0) {
          setPackages(catalogRes.value.packages);
        }
        setAddons(catalogRes.value.addons);
      }
      if (subRes.status === 'fulfilled' && subRes.value) {
        setSub(subRes.value);
      }
      if (billingRes.status === 'fulfilled' && billingRes.value) {
        const acct = billingRes.value;
        setCreditBalance(
          Number(acct.credits || 0) + Number(acct.promotionalCredits || 0)
        );
      }
    } catch {
      // keep fallback catalog cleanly
    } finally {
      setLoading(false);
    }
  }, [sessionToken, tiwiId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUpgrade = async (plan: StorePackageRecord) => {
    if (!user || !sessionToken) {
      onRequireAuth();
      return;
    }
    setBusyId(plan.planId);
    setBanner('');
    try {
      const res = await upgradeStorePlan(tiwiId, plan.planId, sessionToken);
      if (res.subscription) setSub(res.subscription);
      setBannerTone('success');
      setBanner(res.message || `Switched ${store.storeName} to ${plan.planName}.`);
      emitRealtimeSync('all');
      await loadData();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        setBannerTone('error');
        setBanner('Insufficient Cloud Credits. Top up your wallet to activate this plan.');
        onOpenBilling();
        return;
      }
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Upgrade failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleBuyAddon = async (addon: StoreAddonRecord) => {
    if (!user || !sessionToken) {
      onRequireAuth();
      return;
    }
    setBusyId(addon.addonId);
    setBanner('');
    try {
      const res = await purchaseStoreAddon(tiwiId, addon.addonId, sessionToken);
      if (res.subscription) setSub(res.subscription);
      setBannerTone('success');
      setBanner(res.message || `Added ${addon.name} to ${store.storeName}.`);
      emitRealtimeSync('all');
      await loadData();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 402) {
        setBannerTone('error');
        setBanner('Insufficient Cloud Credits for add-on. Top up wallet first.');
        onOpenBilling();
        return;
      }
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Add-on purchase failed.');
    } finally {
      setBusyId('');
    }
  };

  const currentPlanId = (sub?.planId || store.planId || 'free').toLowerCase();
  const currentMonthlyPrice = sub?.price ?? store.monthlyPrice ?? store.price ?? 0;

  return (
    <AccountPageShell
      title="Plan & Upgrades"
      onBack={onBack}
      onRefresh={() => void loadData()}
      refreshing={loading}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Active Plan & Cloud Credit Strip */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Sparkles size={19} strokeWidth={2} color={colors.primaryHover} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrow}>{store.storeName || tiwiId}</Text>
            <Text style={styles.heroTitle}>{sub?.planName || currentPlanId.toUpperCase()}</Text>
          </View>
          <View style={styles.ratePill}>
            <Text style={styles.ratePillText}>${currentMonthlyPrice}/mo</Text>
          </View>
        </View>

        {creditBalance !== null ? (
          <View style={styles.walletStrip}>
            <View style={styles.walletLeft}>
              <CreditCard size={15} strokeWidth={2} color={colors.muted} />
              <Text style={styles.walletLabel}>Cloud Credits: ${creditBalance.toFixed(2)}</Text>
            </View>
            <TouchableOpacity onPress={onOpenBilling} activeOpacity={0.8}>
              <Text style={styles.topUpLink}>Add Credits</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sub ? (
          <View style={styles.quotaRow}>
            <View style={styles.quotaTile}>
              <Package size={14} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.quotaValue}>
                {sub.usage?.products ?? 0}/{formatLimit(sub.productLimit)}
              </Text>
              <Text style={styles.quotaLabel}>Products</Text>
            </View>
            <View style={styles.quotaTile}>
              <Users size={14} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.quotaValue}>
                {sub.usage?.staff ?? 0}/{formatLimit(sub.staffLimit)}
              </Text>
              <Text style={styles.quotaLabel}>Staff</Text>
            </View>
            <View style={styles.quotaTile}>
              <ShoppingCart size={14} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.quotaValue}>
                {sub.usage?.monthlyOrders ?? 0}/{formatLimit(sub.monthlyOrderLimit)}
              </Text>
              <Text style={styles.quotaLabel}>Orders/mo</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Monthly Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Monthly Packages</Text>
        {packages.map((plan) => {
          const isCurrent = plan.planId.toLowerCase() === currentPlanId;
          const isBusy = busyId === plan.planId;
          return (
            <View key={plan.planId} style={[styles.planCard, isCurrent && styles.planCardActive]}>
              <View style={styles.planHead}>
                <View style={styles.flexOne}>
                  <Text style={styles.planName}>{plan.planName}</Text>
                  <Text style={styles.planDesc}>{plan.description || 'Monthly store tier'}</Text>
                </View>
                <Text style={styles.planPrice}>${plan.price}/mo</Text>
              </View>

              <View style={styles.specList}>
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>{formatLimit(plan.productLimit || 0)} Products</Text>
                </View>
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>{formatLimit(plan.staffLimit || 0)} Staff</Text>
                </View>
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>
                    {formatLimit(plan.monthlyOrderLimit || 0)} Orders/mo
                  </Text>
                </View>
                {plan.hasCustomDomain ? (
                  <View style={styles.specChipGreen}>
                    <Globe size={11} strokeWidth={2} color={colors.primaryHover} />
                    <Text style={styles.specChipGreenText}>Custom Domain</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.planBtn,
                  isCurrent && styles.planBtnCurrent,
                  isBusy && styles.disabledBtn,
                ]}
                disabled={isCurrent || isBusy}
                onPress={() => void handleUpgrade(plan)}
                activeOpacity={0.85}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={isCurrent ? colors.primaryHover : colors.ink} />
                ) : isCurrent ? (
                  <>
                    <Check size={15} strokeWidth={2.4} color={colors.primaryHover} />
                    <Text style={styles.planBtnCurrentText}>Current Active Plan</Text>
                  </>
                ) : (
                  <Text style={styles.planBtnText}>
                    {plan.price > currentMonthlyPrice ? 'Upgrade Now' : 'Switch to Plan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Store Add-ons */}
      {addons.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Capacity & Feature Add-ons</Text>
          {addons.map((addon) => {
            const isBusy = busyId === addon.addonId;
            return (
              <View key={addon.addonId} style={styles.addonRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.planName}>{addon.name}</Text>
                  <Text style={styles.planDesc}>{addon.description || 'Monthly store expansion'}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addonBtn, isBusy && styles.disabledBtn]}
                  disabled={isBusy}
                  onPress={() => void handleBuyAddon(addon)}
                  activeOpacity={0.84}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={colors.ink} />
                  ) : (
                    <Text style={styles.addonBtnText}>+${addon.price}</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 1,
  },
  ratePill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  ratePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryHover,
  },
  walletStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  walletLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  topUpLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  quotaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quotaTile: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  quotaValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 2,
  },
  quotaLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.muted,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 11,
  },
  planCardActive: {
    backgroundColor: colors.primarySoft,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  planDesc: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.foreground,
  },
  specList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specChip: {
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  specChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  specChipGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  specChipGreenText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.primaryHover,
  },
  planBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  planBtnCurrent: {
    backgroundColor: colors.background,
  },
  planBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  planBtnCurrentText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  addonBtn: {
    height: 36,
    borderRadius: 9,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
