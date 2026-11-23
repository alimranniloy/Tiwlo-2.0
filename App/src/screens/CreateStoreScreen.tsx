import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Sparkles,
  Store,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import { CountryPickerField } from '../components/CountryPickerModal';
import { TIWLO_API_BASE, type TiwloUser } from '../services/tiwloAuth';
import { fetchCloudBillingAccount } from '../services/tiwloAccount';
import { loadTiwloDashboard, type StoreItem } from '../services/tiwloDashboard';
import { colors } from '../theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');
const STORE_DOMAIN = 'tiwlo.com';

export const STORE_CATEGORIES = [
  'General Retail & Electronics',
  'Fashion & Apparel',
  'Grocery & Supermarket',
  'Pharmacy & Healthcare',
  'Restaurant & Fast Food',
  'Wholesale & Distribution',
  'Digital Products & Services',
] as const;

export const STORE_CURRENCIES = [
  'BDT (৳)',
  'USD ($)',
  'EUR (€)',
  'GBP (£)',
] as const;

export interface StorePackage {
  planId: string;
  planName: string;
  price: number;
  productLimit?: number;
  warehouseLimit?: number;
  staffLimit?: number;
  monthlyOrderLimit?: number;
  hasCustomDomain?: boolean;
  hasPos?: boolean;
  enabled?: boolean;
  description?: string;
}

export const FALLBACK_STORE_PACKAGES: StorePackage[] = [
  {
    planId: 'free',
    planName: 'Free Starter',
    price: 0,
    productLimit: 10,
    warehouseLimit: 1,
    staffLimit: 1,
    monthlyOrderLimit: 50,
    hasCustomDomain: false,
    hasPos: false,
    enabled: true,
    description: 'Free *.tiwlo.com subdomain with core inventory.',
  },
  {
    planId: 'growth',
    planName: 'Growth Retailer',
    price: 19,
    productLimit: 150,
    warehouseLimit: 2,
    staffLimit: 3,
    monthlyOrderLimit: 1000,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true,
    description: 'Higher inventory limits, POS, and custom domain.',
  },
  {
    planId: 'pro',
    planName: 'Pro Business',
    price: 49,
    productLimit: 1000,
    warehouseLimit: 5,
    staffLimit: 10,
    monthlyOrderLimit: 5000,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true,
    description: 'Multi-branch e-commerce with high product & order limits.',
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    price: 129,
    productLimit: 10000,
    warehouseLimit: 25,
    staffLimit: 50,
    monthlyOrderLimit: 50000,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true,
    description: 'Dedicated high-volume store infrastructure.',
  },
];

export interface StoreInvoiceRecord {
  id: string;
  amount: number;
  currency?: string;
  status?: string;
  planId?: string;
  isFreeTrial?: boolean;
  description?: string;
  createdAt?: string;
}

export type StoreRecord = StoreItem & {
  planId?: string;
  currency?: string;
  orderNumber?: string;
  invoice?: StoreInvoiceRecord;
  createdAt?: string;
};

export interface StoreCreationReceipt {
  store: StoreRecord;
  invoice: StoreInvoiceRecord;
  planName: string;
  isFreeTrial: boolean;
}

export interface CreateStoreScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  existingStores?: StoreItem[];
  onBack: () => void;
  onStoreCreated?: (store: StoreItem) => void;
  onOpenOnlineStore: () => void;
  onOpenBilling: () => void;
  onRequireAuth: () => void;
}

type SubdomainCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'error';

interface SubdomainAvailability {
  candidate: string;
  status: SubdomainCheckStatus;
  message: string;
}

interface StoreFormState {
  storeName: string;
  subdomain: string;
  category: string;
  currency: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  description: string;
  planId: string;
}

export function normalizeStoreSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeSubdomainInput(value: string): string {
  const candidate = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[/?#]/, 1)[0]
    .replace(/\.$/, '');
  const suffix = `.${STORE_DOMAIN}`;
  const stripped = candidate.endsWith(suffix)
    ? candidate.slice(0, -suffix.length)
    : candidate;
  return stripped.replace(/[^a-z0-9-]/g, '');
}

function buildHeaders(sessionToken?: string, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Device-Platform': Platform.OS === 'ios' ? 'iOS' : 'Android',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

function formatPackageLimits(pkg: StorePackage): string {
  const parts: string[] = [];
  if (pkg.productLimit != null) {
    parts.push(
      pkg.productLimit >= 999999
        ? 'Unlimited products'
        : `${Number(pkg.productLimit).toLocaleString()} products`
    );
  }
  if (pkg.warehouseLimit != null) {
    parts.push(
      pkg.warehouseLimit >= 99
        ? 'Unlimited warehouses'
        : `${pkg.warehouseLimit} warehouse${pkg.warehouseLimit > 1 ? 's' : ''}`
    );
  }
  if (pkg.staffLimit != null) {
    parts.push(
      pkg.staffLimit >= 999999 ? 'Unlimited staff' : `${pkg.staffLimit} staff`
    );
  }
  if (pkg.monthlyOrderLimit != null) {
    parts.push(
      pkg.monthlyOrderLimit >= 999999
        ? 'Unlimited orders/mo'
        : `${Number(pkg.monthlyOrderLimit).toLocaleString()} orders/mo`
    );
  }
  if (pkg.hasPos) parts.push('POS');
  if (pkg.hasCustomDomain) parts.push('Custom domain');
  return parts.join(' · ');
}

export const CreateStoreScreen: React.FC<CreateStoreScreenProps> = ({
  user,
  sessionToken,
  existingStores,
  onBack,
  onStoreCreated,
  onOpenOnlineStore,
  onOpenBilling,
  onRequireAuth,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paidUpgradeMode, setPaidUpgradeMode] = useState(false);
  const [packages, setPackages] = useState<StorePackage[]>(FALLBACK_STORE_PACKAGES);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loadedStores, setLoadedStores] = useState<StoreRecord[]>(
    Array.isArray(existingStores) ? (existingStores as StoreRecord[]) : []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');
  const [receipt, setReceipt] = useState<StoreCreationReceipt | null>(null);

  const [form, setForm] = useState<StoreFormState>({
    storeName: '',
    subdomain: '',
    category: STORE_CATEGORIES[0],
    currency: STORE_CURRENCIES[0],
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    city: 'Dhaka',
    country: 'Bangladesh',
    postalCode: '',
    description: '',
    planId: 'free',
  });

  const [availability, setAvailability] = useState<SubdomainAvailability>({
    candidate: '',
    status: 'idle',
    message: '',
  });

  useEffect(() => {
    if (Array.isArray(existingStores)) {
      setLoadedStores(existingStores as StoreRecord[]);
    }
  }, [existingStores]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: prev.email || user?.email || '',
      phone: prev.phone || user?.phone || '',
    }));
  }, [user?.email, user?.phone]);

  const loadSetupData = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const pkgPromise = fetch(`${TIWLO_API_BASE}/packages`, {
        method: 'GET',
        headers: buildHeaders(sessionToken),
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as { packages?: StorePackage[] };
        })
        .catch(() => null);

      const billingPromise =
        user || sessionToken
          ? fetchCloudBillingAccount(sessionToken).catch(() => null)
          : Promise.resolve(null);

      const storesPromise =
        existingStores === undefined && (user?.id || user?.tiwiId) && sessionToken
          ? loadTiwloDashboard(user?.id || user?.tiwiId, sessionToken).catch(() => null)
          : Promise.resolve(null);

      const [pkgRes, billingData, dashData] = await Promise.all([
        pkgPromise,
        billingPromise,
        storesPromise,
      ]);

      if (Array.isArray(pkgRes?.packages) && pkgRes.packages.length > 0) {
        setPackages(pkgRes.packages);
      } else {
        setPackages(FALLBACK_STORE_PACKAGES);
      }

      if (billingData) {
        const rawCredits = Number(billingData.credits);
        const rawPromo = Number(billingData.promotionalCredits);
        const total =
          (Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 0) +
          (Number.isFinite(rawPromo) && rawPromo > 0 ? rawPromo : 0);
        setCreditBalance(total);
      }

      if (dashData && Array.isArray(dashData.stores)) {
        setLoadedStores(dashData.stores as StoreRecord[]);
      }
    } finally {
      setPackagesLoading(false);
    }
  }, [existingStores, sessionToken, user]);

  useEffect(() => {
    void loadSetupData();
  }, [loadSetupData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSetupData();
    } finally {
      setRefreshing(false);
    }
  }, [loadSetupData]);

  // Live debounced subdomain availability check
  useEffect(() => {
    const candidate = normalizeSubdomainInput(form.subdomain);
    if (!candidate) {
      setAvailability({ candidate: '', status: 'idle', message: '' });
      return;
    }

    setAvailability({
      candidate,
      status: 'checking',
      message: 'Checking availability...',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `${TIWLO_API_BASE}/stores/subdomain-availability?subdomain=${encodeURIComponent(
              candidate
            )}`,
            {
              method: 'GET',
              headers: buildHeaders(sessionToken),
              credentials: 'include',
              signal: controller.signal,
            }
          );
          const payload = (await res.json().catch(() => ({}))) as {
            available?: boolean;
            subdomain?: string;
            error?: string;
          };
          if (!res.ok) {
            setAvailability({
              candidate,
              status: res.status === 400 ? 'invalid' : 'error',
              message: payload.error || 'Subdomain could not be verified.',
            });
            return;
          }
          const resolvedSubdomain = payload.subdomain || `${candidate}.${STORE_DOMAIN}`;
          setAvailability(
            payload.available
              ? {
                  candidate,
                  status: 'available',
                  message: `${resolvedSubdomain} is available`,
                }
              : {
                  candidate,
                  status: 'unavailable',
                  message: `${resolvedSubdomain} is taken`,
                }
          );
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setAvailability({
            candidate,
            status: 'error',
            message: 'Could not check subdomain availability.',
          });
        }
      })();
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.subdomain, sessionToken]);

  const activeStores = useMemo(
    () =>
      loadedStores.filter(
        (store) => String(store?.status || 'active').toLowerCase() !== 'deleted'
      ),
    [loadedStores]
  );

  const existingFreeStore = useMemo(
    () =>
      activeStores.find(
        (store) => String(store?.planId || 'free').toLowerCase() === 'free'
      ) || null,
    [activeStores]
  );
  const hasFreeStore = Boolean(existingFreeStore);

  const paidPackages = useMemo(
    () =>
      packages.filter(
        (pkg) =>
          Number(pkg.price || 0) > 0 &&
          String(pkg.planId || '').toLowerCase() !== 'free' &&
          pkg.enabled !== false
      ),
    [packages]
  );

  const paidFallbackPackage = hasFreeStore ? paidPackages[0] || null : null;
  const rawSelectedPackage =
    packages.find((pkg) => pkg.planId === form.planId) ||
    packages[0] ||
    FALLBACK_STORE_PACKAGES[0];
  const selectedPackage =
    hasFreeStore &&
    (Number(rawSelectedPackage?.price || 0) <= 0 ||
      String(rawSelectedPackage?.planId || '').toLowerCase() === 'free') &&
    paidFallbackPackage
      ? paidFallbackPackage
      : rawSelectedPackage;

  const effectivePlanId = selectedPackage?.planId || form.planId;
  const monthlyCost = Number(selectedPackage?.price || 0);
  const hasEnoughCredits =
    monthlyCost <= 0 || (creditBalance !== null && creditBalance >= monthlyCost);

  const updateField = <K extends keyof StoreFormState>(
    field: K,
    value: StoreFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStoreNameChange = (value: string) => {
    const slug = normalizeStoreSlug(value);
    setForm((prev) => ({
      ...prev,
      storeName: value,
      subdomain: slug,
    }));
  };

  const startPaidPlanMode = (planId?: string) => {
    setBanner('');
    if (planId) {
      updateField('planId', planId);
    } else if (paidFallbackPackage?.planId) {
      updateField('planId', paidFallbackPackage.planId);
    }
    setPaidUpgradeMode(true);
  };

  const handleNextStep = () => {
    setBanner('');
    if (step === 1) {
      if (!form.storeName.trim()) {
        setBannerTone('error');
        setBanner('Enter a store name.');
        return;
      }
      if (!normalizeSubdomainInput(form.subdomain)) {
        setBannerTone('error');
        setBanner('Enter a valid store subdomain.');
        return;
      }
      if (availability.status === 'checking') {
        setBannerTone('info');
        setBanner('Wait for subdomain availability check to complete.');
        return;
      }
      if (availability.status !== 'available') {
        setBannerTone('error');
        setBanner(availability.message || 'Choose an available subdomain.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (hasFreeStore && monthlyCost <= 0) {
        setBannerTone('error');
        setBanner('Your free store slot is used. Select a paid package.');
        return;
      }
      if (!form.address.trim() || !form.city.trim() || !form.country.trim()) {
        setBannerTone('error');
        setBanner('Street address, city, and country are required.');
        return;
      }
      setStep(3);
    }
  };

  const submitCreateStore = async () => {
    setBanner('');

    if (!user) {
      onRequireAuth();
      return;
    }
    if (hasFreeStore && monthlyCost <= 0) {
      setBannerTone('error');
      setBanner('Each account allows 1 free store. Select a paid plan to continue.');
      return;
    }
    if (monthlyCost > 0 && !hasEnoughCredits) {
      setBannerTone('error');
      setBanner('Insufficient cloud credits. Add credits before launching.');
      return;
    }

    const userId = user.id || user.tiwiId || null;
    const cleanSubdomain = `${normalizeSubdomainInput(form.subdomain)}.${STORE_DOMAIN}`;
    const storeInput = {
      storeName: form.storeName.trim(),
      category: form.category,
      subdomain: cleanSubdomain,
      currency: form.currency,
      planId: effectivePlanId,
      email: form.email.trim(),
      phone: form.phone.trim(),
      description: form.description.trim(),
      billingDetails: {
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        phone: form.phone.trim(),
        postalCode: form.postalCode.trim(),
      },
    };

    const mutation = `
      mutation CreateUserStore($userId: String, $input: CreateStoreInput!) {
        createUserStore(userId: $userId, input: $input) {
          id
          tiwiId
          storeName
          subdomain
          planId
          category
          currency
          billingDetails {
            address
            city
            country
            phone
            postalCode
          }
          status
          createdAt
        }
      }
    `;

    setSubmitting(true);
    const submitStartedAt = Date.now();
    try {
      let created: StoreRecord | null = null;

      try {
        const gqlRes = await fetch(`${TIWLO_ORIGIN}/graphql`, {
          method: 'POST',
          headers: buildHeaders(sessionToken, true),
          credentials: 'include',
          body: JSON.stringify({
            query: mutation,
            variables: { userId, input: storeInput },
          }),
        });
        const gqlJson = (await gqlRes.json().catch(() => null)) as {
          data?: { createUserStore?: StoreRecord };
          errors?: { message?: string }[];
        } | null;

        if (gqlJson?.errors && gqlJson.errors.length > 0) {
          throw new Error(gqlJson.errors[0]?.message || 'Failed to create store.');
        }
        if (gqlRes.ok && gqlJson?.data?.createUserStore) {
          created = gqlJson.data.createUserStore;
        }
      } catch (err) {
        if (err instanceof Error && err.message && !err.message.includes('fetch')) {
          throw err;
        }
      }

      if (!created) {
        const restRes = await fetch(`${TIWLO_API_BASE}/stores`, {
          method: 'POST',
          headers: buildHeaders(sessionToken, true),
          credentials: 'include',
          body: JSON.stringify({ userId, ...storeInput }),
        });
        const restJson = (await restRes.json().catch(() => ({}))) as StoreRecord & {
          store?: StoreRecord;
          error?: string;
          message?: string;
        };
        if (!restRes.ok) {
          throw new Error(restJson.error || restJson.message || 'Failed to create store.');
        }
        created = restJson.store || restJson;
      }

      if (!created) {
        throw new Error('The store could not be created.');
      }

      onStoreCreated?.(created);

      let invoice: StoreInvoiceRecord | null = created.invoice || null;
      const orderNumber = created.orderNumber || null;

      if (!invoice && userId) {
        const billingData = await fetchCloudBillingAccount(sessionToken).catch(() => null);
        const invoicesList = Array.isArray(billingData?.invoices) ? billingData.invoices : [];
        if (orderNumber) {
          invoice = invoicesList.find((inv) => inv.id === orderNumber) || null;
        }
        if (!invoice) {
          const cleanName = form.storeName.trim().toLowerCase();
          invoice =
            invoicesList.find((inv) => {
              const createdMs = Date.parse(inv.createdAt || '');
              if (!Number.isFinite(createdMs) || createdMs < submitStartedAt - 15000) {
                return false;
              }
              const matchesPlan =
                String(inv.planId || '').toLowerCase() ===
                String(effectivePlanId || '').toLowerCase();
              const matchesStore =
                Boolean(cleanName) &&
                String(inv.description || '').toLowerCase().includes(cleanName);
              return matchesPlan || matchesStore;
            }) || null;
        }
      }

      const isTrial =
        monthlyCost <= 0 || String(effectivePlanId || '').toLowerCase() === 'free';
      if (!invoice) {
        invoice = {
          id: orderNumber || created.tiwiId || created.id || `INV-${Date.now()}`,
          amount: monthlyCost,
          currency: 'USD',
          status: isTrial ? 'Free Trial' : 'Paid',
          planId: effectivePlanId,
          isFreeTrial: isTrial,
          description: `${selectedPackage.planName} (${created.storeName || form.storeName.trim()})`,
          createdAt: new Date().toISOString(),
        };
      }

      const invoiceIsTrial =
        Boolean(invoice.isFreeTrial) ||
        Number(invoice.amount ?? monthlyCost) <= 0 ||
        ['free trial', 'trial', 'free_trial'].includes(
          String(invoice.status || '').toLowerCase()
        );

      setReceipt({
        store: created,
        invoice,
        planName: selectedPackage.planName || created.planId || 'Free Starter',
        isFreeTrial: invoiceIsTrial,
      });
      setBannerTone('success');
      setBanner(`${created.storeName || form.storeName.trim()} created.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Failed to create store.');
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    const { store, invoice, planName, isFreeTrial } = receipt;
    const invoiceUrl = `${TIWLO_ORIGIN}/billing/invoices/${encodeURIComponent(invoice.id)}`;
    const amountNum = Number(invoice.amount ?? 0);
    const displaySubdomain = store.subdomain || `${normalizeSubdomainInput(form.subdomain)}.${STORE_DOMAIN}`;

    return (
      <AccountPageShell
        title="Store Created"
        onBack={onBack}
        bannerMessage={banner}
        bannerTone={bannerTone}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={styles.iconCircleGreen}>
              <CheckCircle2 size={20} strokeWidth={2} color={colors.primaryHover} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.statusTitle}>{store.storeName || 'Your store'} is live</Text>
              <Text style={styles.statusSub}>{displaySubdomain}</Text>
            </View>
          </View>
          <View style={[styles.badgePill, styles.badgePillGreen]}>
            <Text style={[styles.badgeText, styles.badgeTextGreen]}>
              {isFreeTrial ? 'Free Trial' : invoice.status || 'Paid'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.surfaceBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Invoice ID</Text>
            <Text style={styles.summaryValueMono}>{invoice.id}</Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Store ID</Text>
            <Text style={styles.summaryValueMono}>{store.tiwiId || store.id || '—'}</Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subdomain</Text>
            <Text style={styles.summaryValue}>{displaySubdomain}</Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan</Text>
            <Text style={styles.summaryValue}>{planName}</Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryValue}>
              ${amountNum.toFixed(2)} {invoice.currency || 'USD'}
              {isFreeTrial ? ' · Free Trial' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.actionStack}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onOpenOnlineStore}
            activeOpacity={0.85}
          >
            <Store size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Open Store Dashboard</Text>
            <ArrowRight size={17} strokeWidth={2} color={colors.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => void Linking.openURL(invoiceUrl)}
            activeOpacity={0.8}
          >
            <Receipt size={16} strokeWidth={1.9} color={colors.foreground} />
            <Text style={styles.secondaryBtnText}>View Invoice</Text>
            <ExternalLink size={14} strokeWidth={1.9} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </AccountPageShell>
    );
  }

  if (hasFreeStore && !paidUpgradeMode) {
    return (
      <AccountPageShell
        title="Create Store"
        onBack={onBack}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        bannerMessage={banner}
        bannerTone={bannerTone}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={styles.iconCircleMuted}>
              <Lock size={19} strokeWidth={1.9} color={colors.foreground} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.statusTitle}>1 / 1 Free Slot Used</Text>
              <Text style={styles.statusSub}>
                Free accounts include 1 store slot. Pick a paid package or manage billing to add another store.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.surfaceBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Active Free Store</Text>
            <Text style={styles.summaryValue}>
              {existingFreeStore?.storeName || existingFreeStore?.tiwiId || 'Free Store'}
            </Text>
          </View>
          {existingFreeStore?.subdomain ? (
            <>
              <View style={styles.hairline} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Domain</Text>
                <Text style={styles.summaryValueMono}>
                  {existingFreeStore.subdomain.includes('.')
                    ? existingFreeStore.subdomain
                    : `${existingFreeStore.subdomain}.${STORE_DOMAIN}`}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.hairline} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cloud Credits</Text>
            <View style={styles.inlineRow}>
              <Text style={styles.summaryValue}>
                {creditBalance === null ? '—' : `$${creditBalance.toFixed(2)} USD`}
              </Text>
              <TouchableOpacity
                style={styles.inlineChipBtn}
                onPress={onOpenBilling}
                activeOpacity={0.8}
              >
                <Text style={styles.inlineChipText}>Add Credits</Text>
                <ArrowUpRight size={13} strokeWidth={2} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Paid Store Packages</Text>

          {packagesLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primaryHover} />
              <Text style={styles.mutedText}>Loading packages...</Text>
            </View>
          ) : (
            paidPackages.map((pkg, idx) => (
              <React.Fragment key={pkg.planId}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <TouchableOpacity
                  style={styles.packageRow}
                  onPress={() => startPaidPlanMode(pkg.planId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.flexOne}>
                    <View style={styles.packageTop}>
                      <Text style={styles.rowTitle}>{pkg.planName}</Text>
                      <Text style={styles.packagePrice}>${Number(pkg.price || 0)}/mo</Text>
                    </View>
                    <Text style={styles.rowSub}>{formatPackageLimits(pkg)}</Text>
                  </View>
                  <View style={styles.inlineChipBtn}>
                    <Text style={styles.inlineChipText}>Select</Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))
          )}
        </View>

        <View style={styles.actionStack}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onOpenBilling}
            activeOpacity={0.85}
          >
            <Sparkles size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Upgrade Plan in Billing</Text>
          </TouchableOpacity>

          {paidFallbackPackage ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => startPaidPlanMode(paidFallbackPackage.planId)}
              activeOpacity={0.8}
            >
              <Store size={16} strokeWidth={1.9} color={colors.foreground} />
              <Text style={styles.secondaryBtnText}>
                Create Paid Store ({paidFallbackPackage.planName})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </AccountPageShell>
    );
  }

  return (
    <AccountPageShell
      title="Create Store"
      onBack={onBack}
      onRefresh={() => void handleRefresh()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* 3-Step Indicator */}
      <View style={styles.stepBar}>
        {(
          [
            { id: 1, label: '1. Store' },
            { id: 2, label: '2. Package & Billing' },
            { id: 3, label: '3. Review & Launch' },
          ] as const
        ).map((item) => {
          const active = step === item.id;
          const done = step > item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.stepPill,
                active && styles.stepPillActive,
                done && styles.stepPillDone,
              ]}
              onPress={() => {
                if (item.id < step) {
                  setBanner('');
                  setStep(item.id);
                }
              }}
              activeOpacity={item.id < step ? 0.8 : 1}
            >
              {done ? (
                <Check size={13} strokeWidth={2.4} color={colors.primaryHover} />
              ) : null}
              <Text
                style={[
                  styles.stepPillText,
                  active && styles.stepPillTextActive,
                  done && styles.stepPillTextDone,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {step === 1 && (
        <View style={styles.section}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Store Name *</Text>
            <View style={styles.inputWithIcon}>
              <Store size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={form.storeName}
                onChangeText={handleStoreNameChange}
                placeholder="e.g. Urban Threads"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Subdomain *</Text>
            <View style={styles.subdomainRow}>
              <View style={styles.subdomainInputWrap}>
                <Globe size={15} strokeWidth={1.9} color={colors.muted} />
                <TextInput
                  style={styles.innerInput}
                  value={form.subdomain}
                  onChangeText={(val) => updateField('subdomain', normalizeSubdomainInput(val))}
                  placeholder="urban-threads"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.subdomainSuffix}>
                <Text style={styles.subdomainSuffixText}>.{STORE_DOMAIN}</Text>
              </View>
            </View>

            {availability.status !== 'idle' ? (
              <View style={styles.availabilityRow}>
                {availability.status === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : availability.status === 'available' ? (
                  <CheckCircle2 size={14} strokeWidth={2} color={colors.primaryHover} />
                ) : (
                  <AlertCircle size={14} strokeWidth={2} color={colors.danger} />
                )}
                <Text
                  style={[
                    styles.availabilityText,
                    availability.status === 'available' && styles.availabilityTextOk,
                    (availability.status === 'unavailable' ||
                      availability.status === 'invalid' ||
                      availability.status === 'error') &&
                      styles.availabilityTextBad,
                  ]}
                >
                  {availability.status === 'available'
                    ? `Available · ${availability.message}`
                    : availability.status === 'unavailable'
                    ? `Taken · ${availability.message}`
                    : availability.status === 'checking'
                    ? 'Checking availability...'
                    : availability.message}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.chipWrap}>
              {STORE_CATEGORIES.map((category) => {
                const active = form.category === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                    onPress={() => updateField('category', category)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Currency</Text>
            <View style={styles.chipWrap}>
              {STORE_CURRENCIES.map((currency) => {
                const active = form.currency === currency;
                return (
                  <TouchableOpacity
                    key={currency}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                    onPress={() => updateField('currency', currency)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {currency}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleNextStep}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continue to Package & Billing</Text>
            <ArrowRight size={17} strokeWidth={2} color={colors.ink} />
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.section}>
          {hasFreeStore ? (
            <View style={styles.noticeStrip}>
              <Lock size={15} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.noticeText}>
                1 / 1 Free Slot Used — select a paid package for this store.
              </Text>
            </View>
          ) : null}

          <View style={styles.creditsStrip}>
            <View style={styles.inlineRow}>
              <CreditCard size={16} strokeWidth={1.9} color={colors.foreground} />
              <Text style={styles.summaryLabel}>Cloud Credits</Text>
            </View>
            <View style={styles.inlineRow}>
              <Text style={styles.summaryValue}>
                {creditBalance === null ? '—' : `$${creditBalance.toFixed(2)} USD`}
              </Text>
              <TouchableOpacity
                style={styles.inlineChipBtn}
                onPress={onOpenBilling}
                activeOpacity={0.8}
              >
                <Text style={styles.inlineChipText}>Add</Text>
                <ArrowUpRight size={13} strokeWidth={2} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Select Package</Text>

          {packagesLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primaryHover} />
              <Text style={styles.mutedText}>Loading packages...</Text>
            </View>
          ) : (
            <View style={styles.packageList}>
              {packages.map((pkg, idx) => {
                const price = Number(pkg.price || 0);
                const isFreeBlocked =
                  hasFreeStore &&
                  (price <= 0 || String(pkg.planId || '').toLowerCase() === 'free');
                const selected = effectivePlanId === pkg.planId;
                return (
                  <React.Fragment key={pkg.planId}>
                    {idx > 0 ? <View style={styles.hairline} /> : null}
                    <TouchableOpacity
                      disabled={isFreeBlocked}
                      onPress={() => {
                        setBanner('');
                        updateField('planId', pkg.planId);
                      }}
                      style={[
                        styles.packageSelectRow,
                        selected && styles.packageSelectRowActive,
                        isFreeBlocked && styles.packageDisabled,
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.flexOne}>
                        <View style={styles.packageTop}>
                          <Text style={styles.rowTitle}>{pkg.planName}</Text>
                          <Text style={styles.packagePrice}>
                            {isFreeBlocked
                              ? 'Free Slot Used'
                              : price <= 0
                              ? 'Free'
                              : `$${price}/mo`}
                          </Text>
                        </View>
                        {pkg.description ? (
                          <Text style={styles.rowSub}>{pkg.description}</Text>
                        ) : null}
                        <Text style={styles.packageMeta}>{formatPackageLimits(pkg)}</Text>
                      </View>
                      {selected ? (
                        <CheckCircle2 size={18} strokeWidth={2.2} color={colors.primaryHover} />
                      ) : null}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {monthlyCost > 0 && !hasEnoughCredits ? (
            <View style={styles.warningStrip}>
              <AlertCircle size={16} strokeWidth={2} color={colors.danger} />
              <View style={styles.flexOne}>
                <Text style={styles.warningTitle}>Insufficient Cloud Credits</Text>
                <Text style={styles.warningSub}>
                  {selectedPackage.planName} needs ${monthlyCost.toFixed(2)}/mo. Current balance: $
                  {(creditBalance || 0).toFixed(2)}.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inlineChipBtn}
                onPress={onOpenBilling}
                activeOpacity={0.8}
              >
                <Text style={styles.inlineChipText}>Top Up</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Contact & Billing Address</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Contact Email</Text>
            <View style={styles.inputWithIcon}>
              <Mail size={15} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={form.email}
                onChangeText={(val) => updateField('email', val)}
                placeholder="orders@yourstore.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.inputWithIcon}>
              <Phone size={15} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={form.phone}
                onChangeText={(val) => updateField('phone', val)}
                placeholder="+880 1700-000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Street Address *</Text>
            <View style={styles.inputWithIcon}>
              <MapPin size={15} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={form.address}
                onChangeText={(val) => updateField('address', val)}
                placeholder="House, Road, Area"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>City *</Text>
              <TextInput
                style={styles.inputBox}
                value={form.city}
                onChangeText={(val) => updateField('city', val)}
                placeholder="Dhaka"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Postal Code</Text>
              <TextInput
                style={styles.inputBox}
                value={form.postalCode}
                onChangeText={(val) => updateField('postalCode', val)}
                placeholder="1205"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Country *</Text>
            <CountryPickerField
              value={form.country}
              onChange={(countryName) => updateField('country', countryName)}
              placeholder="Select country"
              title="Select store country"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Store Description</Text>
            <TextInput
              style={styles.textAreaBox}
              value={form.description}
              onChangeText={(val) => updateField('description', val)}
              placeholder="Short description of what your store sells"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.backStepBtn}
              onPress={() => {
                setBanner('');
                setStep(1);
              }}
              activeOpacity={0.8}
            >
              <ArrowLeft size={16} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.flexOne]}
              onPress={handleNextStep}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Review & Launch</Text>
              <ArrowRight size={17} strokeWidth={2} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Store Summary</Text>

          <View style={styles.surfaceBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Store Name</Text>
              <Text style={styles.summaryValue}>{form.storeName.trim()}</Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subdomain</Text>
              <Text style={styles.summaryValueMono}>
                {normalizeSubdomainInput(form.subdomain)}.{STORE_DOMAIN}
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Category</Text>
              <Text style={styles.summaryValue}>{form.category}</Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Currency</Text>
              <Text style={styles.summaryValue}>{form.currency}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Package & Billing</Text>

          <View style={styles.surfaceBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Package</Text>
              <Text style={styles.summaryValue}>{selectedPackage.planName}</Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Monthly Price</Text>
              <Text style={styles.summaryValue}>
                {monthlyCost <= 0 ? 'Free' : `$${monthlyCost.toFixed(2)} USD / mo`}
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Contact</Text>
              <Text style={styles.summaryValue}>
                {[form.email.trim(), form.phone.trim()].filter(Boolean).join(' · ') || '—'}
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Address</Text>
              <Text style={styles.summaryValue}>
                {[form.address.trim(), form.city.trim(), form.postalCode.trim(), form.country.trim()]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
            {form.description.trim() ? (
              <>
                <View style={styles.hairline} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Description</Text>
                  <Text style={styles.summaryValue}>{form.description.trim()}</Text>
                </View>
              </>
            ) : null}
          </View>

          {monthlyCost > 0 && !hasEnoughCredits ? (
            <View style={styles.warningStrip}>
              <AlertCircle size={16} strokeWidth={2} color={colors.danger} />
              <View style={styles.flexOne}>
                <Text style={styles.warningTitle}>Insufficient Cloud Credits</Text>
                <Text style={styles.warningSub}>
                  Add credits in Billing to cover ${monthlyCost.toFixed(2)}/mo.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inlineChipBtn}
                onPress={onOpenBilling}
                activeOpacity={0.8}
              >
                <Text style={styles.inlineChipText}>Billing</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.backStepBtn}
              onPress={() => {
                setBanner('');
                setStep(2);
              }}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <ArrowLeft size={16} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                styles.flexOne,
                (submitting ||
                  (hasFreeStore && monthlyCost <= 0) ||
                  (monthlyCost > 0 && !hasEnoughCredits)) &&
                  styles.btnDisabled,
              ]}
              onPress={() => void submitCreateStore()}
              disabled={
                submitting ||
                (hasFreeStore && monthlyCost <= 0) ||
                (monthlyCost > 0 && !hasEnoughCredits)
              }
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Store size={17} strokeWidth={2} color={colors.ink} />
              )}
              <Text style={styles.primaryBtnText}>
                {!user
                  ? 'Sign in to Launch Store'
                  : submitting
                  ? 'Launching Store...'
                  : monthlyCost > 0
                  ? `Pay $${monthlyCost}/mo & Launch`
                  : 'Launch Free Store'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  stepBar: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  stepPillActive: {
    backgroundColor: colors.primary,
  },
  stepPillDone: {
    backgroundColor: colors.primarySoft,
  },
  stepPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
  },
  stepPillTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  stepPillTextDone: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircleGreen: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleMuted: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  statusSub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  badgePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgePillGreen: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  badgeTextGreen: {
    color: colors.primaryHover,
  },
  surfaceBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  summaryLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.muted,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  summaryValueMono: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inlineChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.foreground,
  },
  textAreaBox: {
    minHeight: 76,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.foreground,
  },
  inputWithIcon: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
    gap: 6,
  },
  subdomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subdomainInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subdomainSuffix: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subdomainSuffixText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  availabilityText: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  availabilityTextOk: {
    color: colors.primaryHover,
    fontWeight: '600',
  },
  availabilityTextBad: {
    color: colors.danger,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  choiceTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  noticeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.foreground,
  },
  creditsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.danger,
  },
  warningSub: {
    fontSize: 12,
    color: colors.foreground,
    marginTop: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  mutedText: {
    fontSize: 13,
    color: colors.muted,
  },
  packageList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  packageSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  packageSelectRowActive: {
    backgroundColor: colors.primarySoft,
  },
  packageDisabled: {
    opacity: 0.5,
  },
  packageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  packagePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  packageMeta: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 4,
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
  actionStack: {
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  backStepBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
