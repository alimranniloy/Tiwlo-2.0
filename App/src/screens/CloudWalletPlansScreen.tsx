import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
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
  Building2,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Gift,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import { CountryPickerField } from '../components/CountryPickerModal';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  BillingPromotionsStatus,
  cancelCloudInvoice,
  CloudBillingAccount,
  CloudInvoice,
  CreditQuoteResponse,
  fetchBillingPromotionsStatus,
  fetchCloudBillingAccount,
  fetchCreditQuote,
  getInvoiceViewUrl,
  redeemCloudVoucher,
  startCreditCheckout,
  updateCloudBillingProfile,
} from '../services/tiwloAccount';
import { openInAppBrowserUrl } from '../services/tiwloIntegrity';
import { emitRealtimeSync, subscribeRealtimeSync } from '../services/tiwloRealtime';
import { colors } from '../theme/tokens';

interface CloudWalletPlansScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenCheckoutWebView?: (url: string, meta?: { amount?: string; currency?: string; invoiceId?: string }) => void;
}

type WalletTab = 'overview' | 'plans' | 'invoices' | 'profile';
const TOP_UP_PRESETS = [10, 25, 50, 100];

const CLOUD_PLANS = [
  {
    id: 'starter',
    name: 'Starter Workspace',
    price: '$0 / mo',
    desc: 'Up to 2 stores and hourly droplet billing',
    features: ['2 Online Stores', 'Hourly Droplet Billing', 'Standard SSL & DNS'],
  },
  {
    id: 'pro',
    name: 'Pro Cloud',
    price: '$19 / mo',
    desc: 'NVMe priority, automated snapshots & team seats',
    features: ['Unlimited Stores', 'Automated Daily Backups', 'TPanel Tools'],
  },
  {
    id: 'scale',
    name: 'Business Scale',
    price: '$49 / mo',
    desc: 'Dedicated clusters, Kubernetes & 5 team admin seats',
    features: ['Kubernetes Clusters', '5 Admin Seats', 'Multi-Region Backups'],
  },
];

function formatMoney(amount: number | undefined | null, currency = 'USD'): string {
  const num = Number(amount ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const code = (currency || 'USD').toUpperCase();
  if (code === 'BDT') {
    return `৳${safe.toFixed(2)}`;
  }
  if (code === 'USD') {
    return `$${safe.toFixed(2)}`;
  }
  return `${safe.toFixed(2)} ${code}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatOrderType(orderType?: string): string {
  if (!orderType) return '';
  const clean = orderType.trim().toLowerCase();
  const labels: Record<string, string> = {
    credit_topup: 'Credit Top-up',
    voucher_redeem: 'Voucher Credit',
    subscription_charge: 'Subscription',
    store_creation: 'Store Activation',
    free_trial: 'Free Starter Trial',
    plan_upgrade: 'Plan Upgrade',
    plan_renewal: 'Plan Renewal',
    addon_purchase: 'Store Add-on',
  };
  return (
    labels[clean] ||
    clean.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getInvoiceBadge(inv: CloudInvoice): {
  label: string;
  bg: string;
  fg: string;
} {
  const raw = String(inv.status || '').trim();
  const st = raw.toLowerCase();
  if (inv.isFreeTrial || ['free trial', 'trial', 'free_trial'].includes(st)) {
    return { label: 'Free Trial', bg: colors.primarySoft, fg: colors.primaryHover };
  }
  if (['paid', 'verified'].includes(st)) {
    return { label: raw || 'Paid', bg: colors.primarySoft, fg: colors.primaryHover };
  }
  if (st === 'pending') {
    return { label: 'Pending', bg: colors.warningSoft, fg: colors.warning };
  }
  if (['failed', 'cancelled', 'canceled', 'expired'].includes(st)) {
    return { label: raw || 'Cancelled', bg: colors.dangerSoft, fg: colors.danger };
  }
  return { label: raw || 'Recorded', bg: colors.surface, fg: colors.muted };
}

export const CloudWalletPlansScreen: React.FC<CloudWalletPlansScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
  onOpenCheckoutWebView,
}) => {
  const [tab, setTab] = useState<WalletTab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [billing, setBilling] = useState<CloudBillingAccount>({
    currency: 'USD',
    credits: 0,
    promotionalCredits: 0,
    monthToDateSpent: 0,
    projectedCost: 0,
    status: 'Active',
    hasConfiguredGateway: false,
    configuredGateways: [],
    creditCheckoutGateways: [],
    invoices: [],
    costBreakdown: [],
  });
  const [promoStatus, setPromoStatus] = useState<BillingPromotionsStatus | null>(null);

  const [amountInput, setAmountInput] = useState('25');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [quote, setQuote] = useState<CreditQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const [voucherCode, setVoucherCode] = useState('');
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [activePlanId, setActivePlanId] = useState('pro');
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [taxInvoiceEmail, setTaxInvoiceEmail] = useState(true);

  const [companyName, setCompanyName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<CloudInvoice | null>(null);
  const [cancellingId, setCancellingId] = useState('');

  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const amountInputRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);

  const loadBilling = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const [acct, promo] = await Promise.all([
        fetchCloudBillingAccount(sessionToken),
        fetchBillingPromotionsStatus(sessionToken).catch(() => null),
      ]);
      setBilling(acct);
      if (promo) {
        setPromoStatus(promo);
      }
      if (acct.companyName) setCompanyName(acct.companyName);
      if (acct.billingAddress?.address) setAddressLine(acct.billingAddress.address);
      if (acct.billingAddress?.city) setCity(acct.billingAddress.city);
      if (acct.billingAddress?.country) setCountry(acct.billingAddress.country);
      if (acct.billingAddress?.phone) setPhone(acct.billingAddress.phone);
    } catch {
      // keep clean state
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void loadBilling();
    const unsub = subscribeRealtimeSync((topic) => {
      if (topic === 'all' || topic === 'billing') {
        void loadBilling();
      }
    });
    return unsub;
  }, [loadBilling]);

  const checkoutGateways = useMemo(() => {
    if (Array.isArray(billing.creditCheckoutGateways) && billing.creditCheckoutGateways.length > 0) {
      return billing.creditCheckoutGateways.filter((g) => g.enabled !== false);
    }
    return [];
  }, [billing.creditCheckoutGateways]);

  useEffect(() => {
    if (checkoutGateways.length === 0) {
      if (selectedProvider) setSelectedProvider('');
      return;
    }
    const stillExists = checkoutGateways.some((g) => g.id === selectedProvider);
    if (!stillExists) {
      setSelectedProvider(checkoutGateways[0].id);
    }
  }, [checkoutGateways, selectedProvider]);

  const parsedAmount = useMemo(() => {
    const cleaned = amountInput.replace(/[^0-9.]/g, '');
    const val = Number.parseFloat(cleaned);
    return Number.isFinite(val) ? val : 0;
  }, [amountInput]);

  const isAmountValid = parsedAmount >= 1 && parsedAmount <= 10000;

  useEffect(() => {
    if (!user || !selectedProvider || !isAmountValid) {
      setQuote(null);
      setQuoteError('');
      setQuoteLoading(false);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError('');

    const timer = setTimeout(() => {
      fetchCreditQuote(parsedAmount, selectedProvider, sessionToken)
        .then((res) => {
          if (!cancelled) {
            setQuote(res);
            setQuoteError('');
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setQuote(null);
            setQuoteError(err instanceof Error ? err.message : 'Unable to fetch quote.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setQuoteLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, selectedProvider, parsedAmount, isAmountValid, sessionToken]);

  const handleAmountTextChange = (text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
    setAmountInput(normalized);
  };

  const handleStartCheckout = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!isAmountValid) {
      setBannerTone('error');
      setBanner('Enter a valid amount between $1.00 and $10,000.00.');
      return;
    }
    if (!selectedProvider) {
      setBannerTone('error');
      setBanner('No live payment gateway is configured for credit checkout.');
      return;
    }
    if (checkoutSubmitting) return;

    setCheckoutSubmitting(true);
    try {
      const checkout = await startCreditCheckout(
        {
          amount: parsedAmount,
          provider: selectedProvider,
          expectedPaymentAmount: quote?.paymentAmount,
          expectedRateDate: quote?.rateDate ?? undefined,
        },
        sessionToken
      );
      if (onOpenCheckoutWebView) {
        onOpenCheckoutWebView(checkout.checkoutUrl, {
          amount: parsedAmount.toFixed(2),
          currency: 'USD',
          invoiceId: checkout.invoiceId,
        });
      } else {
        await openInAppBrowserUrl(checkout.checkoutUrl);
      }
      setBannerTone('success');
      setBanner('Secure checkout opened cleanly.');
      emitRealtimeSync('billing');
      void loadBilling();
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not start credit checkout.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleRedeemVoucher = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!voucherCode.trim()) {
      setBannerTone('error');
      setBanner('Enter a voucher code.');
      return;
    }
    if (redeemingVoucher) return;
    setRedeemingVoucher(true);
    try {
      const res = await redeemCloudVoucher(voucherCode.trim(), sessionToken);
      setVoucherCode('');
      await loadBilling();
      setBannerTone('success');
      setBanner(res.message || 'Voucher redeemed.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Voucher code could not be redeemed.');
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    if (cancellingId) return;
    setCancellingId(invoiceId);
    try {
      await cancelCloudInvoice(invoiceId, sessionToken);
      await loadBilling();
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(null);
      }
      setBannerTone('info');
      setBanner('Invoice cancelled.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not cancel invoice.');
    } finally {
      setCancellingId('');
    }
  };

  const handleOpenInvoiceUrl = async (invoiceId: string) => {
    const url = getInvoiceViewUrl(invoiceId);
    try {
      await Linking.openURL(url);
    } catch {
      setBannerTone('error');
      setBanner('Could not open invoice link in browser.');
    }
  };

  const handleDownloadInvoice = async (inv: CloudInvoice) => {
    const invoiceUrl = getInvoiceViewUrl(inv.id);
    const badge = getInvoiceBadge(inv);
    const lines = [
      'Tiwlo Cloud Invoice Receipt',
      `Invoice ID: ${inv.id}`,
      `Status: ${badge.label}`,
      `Date: ${formatDate(inv.createdAt)}`,
      `Description: ${inv.description || formatOrderType(inv.orderType) || 'Cloud Billing'}`,
      inv.planName || inv.planId ? `Plan: ${inv.planName || inv.planId}` : null,
      `Amount: ${formatMoney(inv.amount, inv.currency)}`,
      Number(inv.cashCreditUsed || 0) > 0
        ? `Cash Credits Used: ${formatMoney(inv.cashCreditUsed, inv.currency)}`
        : null,
      Number(inv.promoCreditUsed || 0) > 0
        ? `Promo Credits Used: ${formatMoney(inv.promoCreditUsed, inv.currency)}`
        : null,
      `Receipt URL: ${invoiceUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        title: `Tiwlo Invoice ${inv.id}`,
        message: lines,
        url: invoiceUrl,
      });
    } catch {
      await handleOpenInvoiceUrl(inv.id);
    }
  };

  const handleSaveBillingProfile = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await updateCloudBillingProfile(
        { companyName, address: addressLine, city, country, phone },
        sessionToken
      );
      await loadBilling();
      setBannerTone('success');
      setBanner('Billing profile saved.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Failed to update billing profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const cashCredits = Number(billing.credits || 0);
  const promoCredits = Number(billing.promotionalCredits || 0);
  const totalBalance = cashCredits + promoCredits;
  const currency = billing.currency || 'USD';
  const gatewayReady =
    billing.hasConfiguredGateway === true ||
    checkoutGateways.length > 0 ||
    (billing.configuredGateways?.length ?? 0) > 0;

  const promoCfg = promoStatus?.config;
  const showPromoStrip = Boolean(promoCfg?.enabled && promoStatus?.eligible);
  const promoMinUsd = Number(promoStatus?.minDepositUsd ?? promoCfg?.minDepositUsd ?? 1);
  const promoBonusUsd = Number(
    promoStatus?.maxBonusUsd ?? promoCfg?.bonusAmountUsd ?? 50
  );
  const promoDays = Number(promoCfg?.validityDays ?? 30);

  const formatPromoCopy = (raw?: string, fallback?: string) =>
    String(raw || fallback || '')
      .replaceAll('{min}', `$${promoMinUsd.toFixed(2)}`)
      .replaceAll('{deposit}', `$${promoMinUsd.toFixed(2)}`)
      .replaceAll('{bonus}', `$${promoBonusUsd.toFixed(2)}`)
      .replaceAll('{days}', String(promoDays));

  const selectedGatewayObj = checkoutGateways.find((g) => g.id === selectedProvider);

  return (
    <AccountPageShell
      title="Cloud Wallet & Plans"
      onBack={onBack}
      onRefresh={() => void loadBilling()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Flat White Wallet Balance Header */}
      <View style={styles.balanceHeader}>
        <View style={styles.balanceTopRow}>
          <Wallet size={19} strokeWidth={1.9} color={colors.foreground} />
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <View
            style={[
              styles.gatewayBadge,
              gatewayReady ? styles.gatewayBadgeReady : styles.gatewayBadgeMuted,
            ]}
          >
            <ShieldCheck
              size={12}
              strokeWidth={2}
              color={gatewayReady ? colors.primaryHover : colors.muted}
            />
            <Text
              style={[
                styles.gatewayBadgeText,
                gatewayReady ? styles.gatewayBadgeTextReady : styles.gatewayBadgeTextMuted,
              ]}
            >
              {gatewayReady
                ? checkoutGateways.length > 0
                  ? `${checkoutGateways.length} Gateway${checkoutGateways.length > 1 ? 's' : ''} Active`
                  : 'Gateway Ready'
                : 'No Gateway'}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{billing.status || 'Active'}</Text>
          </View>
        </View>

        <Text style={styles.balanceVal}>{formatMoney(totalBalance, currency)}</Text>

        {/* 2x2 Summary Stat Grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Cash Credits</Text>
            <Text style={styles.summaryCardValue}>{formatMoney(cashCredits, currency)}</Text>
          </View>
          <View style={[styles.summaryCard, promoCredits > 0 && styles.summaryCardPromo]}>
            <Text style={styles.summaryCardLabel}>Free / Promo Credits</Text>
            <Text
              style={[
                styles.summaryCardValue,
                promoCredits > 0 && styles.summaryCardValuePromo,
              ]}
            >
              {formatMoney(promoCredits, currency)}
            </Text>
            {promoCredits > 0 && promoStatus?.promotionalExpiresAt ? (
              <Text style={styles.summaryCardHint}>
                Expires {formatDate(promoStatus.promotionalExpiresAt)}
              </Text>
            ) : null}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Month-to-Date Spend</Text>
            <Text style={styles.summaryCardValue}>
              {formatMoney(billing.monthToDateSpent, currency)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconRow}>
              <Text style={styles.summaryCardLabel}>Projected Monthly</Text>
              <TrendingUp size={13} strokeWidth={2} color={colors.primaryHover} />
            </View>
            <Text style={styles.summaryCardValue}>
              {formatMoney(billing.projectedCost, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* Active Promo / Free Credit Eligibility Strip */}
      {showPromoStrip && (
        <View style={styles.promoStrip}>
          <View style={styles.promoTopRow}>
            <View style={styles.promoIconWrap}>
              <Gift size={16} strokeWidth={2} color={colors.primaryHover} />
            </View>
            <View style={styles.flexOne}>
              <View style={styles.promoBadgeRow}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>
                    {promoCfg?.badgeText || 'Free Credit Offer'}
                  </Text>
                </View>
                {promoStatus?.bonusPercent ? (
                  <Text style={styles.promoMeta}>{promoStatus.bonusPercent}% Bonus</Text>
                ) : (
                  <Text style={styles.promoMeta}>
                    ${promoMinUsd.toFixed(0)} → ${promoBonusUsd.toFixed(0)} Gift · {promoDays}d
                  </Text>
                )}
              </View>
              <Text style={styles.promoHeadline}>
                {formatPromoCopy(
                  promoCfg?.headline,
                  `Load $${promoMinUsd.toFixed(2)} credit to get $${promoBonusUsd.toFixed(2)} gift for ${promoDays} days`
                )}
              </Text>
              <Text style={styles.promoDesc}>
                {formatPromoCopy(
                  promoCfg?.description,
                  `New accounts loading at least $${promoMinUsd.toFixed(2)} receive $${promoBonusUsd.toFixed(2)} in promotional credits.`
                )}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.promoCta}
            activeOpacity={0.85}
            onPress={() => {
              setTab('overview');
              setAmountInput(
                promoMinUsd % 1 === 0 ? promoMinUsd.toFixed(0) : promoMinUsd.toFixed(2)
              );
              setTimeout(() => amountInputRef.current?.focus(), 100);
            }}
          >
            <Text style={styles.promoCtaText}>
              Add ${promoMinUsd % 1 === 0 ? promoMinUsd.toFixed(0) : promoMinUsd.toFixed(2)} &amp; Get $
              {promoBonusUsd % 1 === 0 ? promoBonusUsd.toFixed(0) : promoBonusUsd.toFixed(2)} Free
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Segmented Tabs */}
      <View style={styles.segmentWrap}>
        {(
          [
            { key: 'overview', label: 'Wallet' },
            { key: 'plans', label: 'Plans' },
            { key: 'invoices', label: 'Invoices' },
            { key: 'profile', label: 'Billing' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentPill, active && styles.segmentPillActive]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'overview' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Add Credits</Text>

          {/* Preset Pills */}
          <View style={styles.presetGrid}>
            {TOP_UP_PRESETS.map((amt) => {
              const active = parsedAmount === amt;
              return (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetPill, active && styles.presetPillActive]}
                  onPress={() => setAmountInput(String(amt))}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    ${amt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Amount Numeric Input */}
          <View style={styles.customAmountWrap}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.customAmountInput}
              value={amountInput}
              onChangeText={handleAmountTextChange}
              placeholder="Enter custom USD amount"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              maxLength={8}
            />
            <Text style={styles.currencySuffix}>USD</Text>
          </View>

          {/* Live Payment Gateway Selector Pills */}
          <View style={styles.gatewaySection}>
            <Text style={styles.subLabel}>Payment Gateway</Text>
            {checkoutGateways.length === 0 ? (
              <View style={styles.noGatewayCard}>
                <Text style={styles.noGatewayTitle}>Credit checkout not connected</Text>
                <Text style={styles.noGatewaySub}>
                  {billing.paymentGatewayStatusMessage ||
                    'Enable a live Stripe, PayPal, bKash, or SSLCOMMERZ gateway to top up credits.'}
                </Text>
              </View>
            ) : (
              <View style={styles.gatewayPillRow}>
                {checkoutGateways.map((gw) => {
                  const active = selectedProvider === gw.id;
                  const gwCurrency = gw.currencies?.[0] || 'USD';
                  return (
                    <TouchableOpacity
                      key={gw.id}
                      style={[styles.gatewayPill, active && styles.gatewayPillActive]}
                      onPress={() => setSelectedProvider(gw.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.gatewayPillText,
                          active && styles.gatewayPillTextActive,
                        ]}
                      >
                        {gw.name} · {gwCurrency}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Live Quote Calculator */}
          {user && selectedProvider && isAmountValid && (
            <View style={styles.quoteCard}>
              {quoteLoading ? (
                <View style={styles.quoteLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primaryHover} />
                  <Text style={styles.quoteLoadingText}>Calculating live quote…</Text>
                </View>
              ) : quoteError ? (
                <Text style={styles.quoteErrorText}>{quoteError}</Text>
              ) : quote ? (
                <>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteLabel}>Cloud Credits</Text>
                    <Text style={styles.quoteVal}>
                      {formatMoney(quote.creditAmount, quote.creditCurrency)}
                    </Text>
                  </View>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteLabel}>Total to Pay</Text>
                    <Text style={styles.quoteTotalVal}>
                      {formatMoney(quote.paymentAmount, quote.paymentCurrency)}
                    </Text>
                  </View>
                  {quote.paymentCurrency !== 'USD' && (
                    <Text style={styles.quoteRateText}>
                      1 USD = {Number(quote.exchangeRate).toFixed(4)} {quote.paymentCurrency}
                      {quote.rateDate ? ` · ${quote.rateDate}` : ''}
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          )}

          {/* Checkout CTA */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              user && (!isAmountValid || !selectedProvider || checkoutSubmitting) && styles.primaryBtnDisabled,
            ]}
            onPress={() => void handleStartCheckout()}
            disabled={Boolean(user && (!isAmountValid || !selectedProvider || checkoutSubmitting))}
            activeOpacity={0.85}
          >
            {checkoutSubmitting ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Plus size={17} strokeWidth={2.2} color={colors.ink} />
            )}
            <Text style={styles.primaryBtnText}>
              {!user
                ? 'Sign in to Add Credits'
                : checkoutSubmitting
                ? 'Opening Checkout…'
                : !isAmountValid
                ? 'Enter $1 – $10,000'
                : quote && selectedGatewayObj
                ? `Pay ${formatMoney(quote.paymentAmount, quote.paymentCurrency)} with ${selectedGatewayObj.name}`
                : selectedGatewayObj
                ? `Add $${parsedAmount.toFixed(2)} via ${selectedGatewayObj.name}`
                : `Add $${parsedAmount.toFixed(2)} to Wallet`}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Redeem Voucher</Text>
          <View style={styles.voucherRow}>
            <View style={styles.voucherInputWrap}>
              <Gift size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.voucherInput}
                value={voucherCode}
                onChangeText={setVoucherCode}
                placeholder="TIWLO-XXXX-XXXX"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              style={styles.redeemBtn}
              onPress={() => void handleRedeemVoucher()}
              disabled={redeemingVoucher}
            >
              <Text style={styles.redeemBtnText}>
                {redeemingVoucher ? 'Applying…' : 'Redeem'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Cost Breakdown & Automation</Text>
          {billing.costBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>No monthly cost breakdown recorded yet.</Text>
          ) : (
            billing.costBreakdown.map((item) => (
              <View key={item.service} style={styles.costItem}>
                <View style={styles.costHeader}>
                  <Text style={styles.costName}>{item.service}</Text>
                  <Text style={styles.costVal}>
                    {formatMoney(item.amount, currency)} ({item.percentage}%)
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(100, Math.max(4, item.percentage))}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}

          <View style={styles.switchRow}>
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Auto-Recharge Below $5</Text>
              <Text style={styles.rowSub}>Keep droplets running without interruption</Text>
            </View>
            <Switch
              value={autoRecharge}
              onValueChange={setAutoRecharge}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      )}

      {tab === 'plans' && (
        <View style={styles.section}>
          {CLOUD_PLANS.map((plan, idx) => {
            const active = activePlanId === plan.id;
            return (
              <React.Fragment key={plan.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <TouchableOpacity
                  style={[styles.planRow, active && styles.planRowActive]}
                  onPress={() => {
                    setActivePlanId(plan.id);
                    setBannerTone('success');
                    setBanner(`${plan.name} plan selected.`);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.planTop}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                  </View>
                  <Text style={styles.planDesc}>{plan.desc}</Text>
                  <View style={styles.planFeatures}>
                    {plan.features.map((feat) => (
                      <View key={feat} style={styles.featRow}>
                        <Check size={14} strokeWidth={2.2} color={colors.primaryHover} />
                        <Text style={styles.featText}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      )}

      {tab === 'invoices' && (
        <View style={styles.section}>
          {billing.invoices.length === 0 ? (
            <Text style={styles.emptyText}>
              {user ? 'No invoices found.' : 'Sign in to view invoices.'}
            </Text>
          ) : (
            billing.invoices.map((inv, idx) => {
              const badge = getInvoiceBadge(inv);
              const isPendingTopup =
                inv.status.toLowerCase() === 'pending' && inv.id.startsWith('ctu-');
              return (
                <React.Fragment key={inv.id}>
                  {idx > 0 ? <View style={styles.hairline} /> : null}
                  <View style={styles.invoiceBlock}>
                    <View style={styles.invoiceRow}>
                      <Receipt size={18} strokeWidth={1.9} color={colors.foreground} />
                      <View style={styles.flexOne}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {inv.description ||
                            formatOrderType(inv.orderType) ||
                            inv.planName ||
                            inv.planId ||
                            `Invoice #${inv.id.slice(0, 8)}`}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {formatDate(inv.createdAt)} · #{inv.id.slice(0, 12)}
                        </Text>
                      </View>
                      <View style={styles.invoiceRight}>
                        <Text style={styles.invoiceAmount}>
                          {formatMoney(inv.amount, inv.currency)}
                        </Text>
                        <View style={[styles.invoiceStatusPill, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.invoiceStatusText, { color: badge.fg }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.invoiceActionsRow}>
                      <TouchableOpacity
                        style={styles.invoiceActionBtn}
                        onPress={() => setSelectedInvoice(inv)}
                        activeOpacity={0.8}
                      >
                        <ExternalLink size={13} strokeWidth={2} color={colors.foreground} />
                        <Text style={styles.invoiceActionText}>Open</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.invoiceDownloadBtn}
                        onPress={() => void handleDownloadInvoice(inv)}
                        activeOpacity={0.8}
                      >
                        <Download size={13} strokeWidth={2} color={colors.primaryHover} />
                        <Text style={styles.invoiceDownloadText}>Download</Text>
                      </TouchableOpacity>

                      {isPendingTopup ? (
                        <TouchableOpacity
                          style={styles.cancelPill}
                          onPress={() => void handleCancelInvoice(inv.id)}
                          disabled={cancellingId === inv.id}
                        >
                          <Text style={styles.cancelPillText}>
                            {cancellingId === inv.id ? 'Cancelling…' : 'Cancel'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </View>
      )}

      {tab === 'profile' && (
        <View style={styles.section}>
          <View style={styles.inputWithIcon}>
            <Building2 size={16} strokeWidth={1.9} color={colors.muted} />
            <TextInput
              style={styles.innerInput}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Company / Organization Name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TextInput
            style={styles.inputBox}
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="Street Address"
            placeholderTextColor="#9CA3AF"
          />
          <View style={styles.twoColRow}>
            <TextInput
              style={[styles.inputBox, { flex: 1 }]}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor="#9CA3AF"
            />
            <View style={{ flex: 1 }}>
              <CountryPickerField
                value={country}
                onChange={(countryName) => setCountry(countryName)}
                placeholder="Select country"
                title="Select billing country"
              />
            </View>
          </View>
          <TextInput
            style={styles.inputBox}
            value={phone}
            onChangeText={setPhone}
            placeholder="Billing Phone"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
          />

          <View style={styles.switchRow}>
            <CreditCard size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>Email PDF Receipts</Text>
              <Text style={styles.rowSub}>Send invoice PDF after each payment</Text>
            </View>
            <Switch
              value={taxInvoiceEmail}
              onValueChange={setTaxInvoiceEmail}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, savingProfile && styles.primaryBtnDisabled]}
            onPress={() => void handleSaveBillingProfile()}
            disabled={savingProfile}
          >
            <Text style={styles.primaryBtnText}>
              {savingProfile ? 'Saving…' : 'Save Billing Details'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Interactive Inline Receipt Viewer Modal */}
      <Modal
        visible={Boolean(selectedInvoice)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Receipt size={18} strokeWidth={2} color={colors.foreground} />
                <Text style={styles.modalTitle}>Invoice Receipt</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedInvoice(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {selectedInvoice ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBody}
              >
                {(() => {
                  const badge = getInvoiceBadge(selectedInvoice);
                  const cashUsed = Number(selectedInvoice.cashCreditUsed || 0);
                  const promoUsed = Number(selectedInvoice.promoCreditUsed || 0);
                  const billedName =
                    billing.companyName || billing.billingAccountName || user?.name || 'Tiwlo Account';
                  return (
                    <>
                      <View style={styles.receiptHero}>
                        <View style={styles.receiptHeroTop}>
                          <Text style={styles.receiptHeroLabel}>Total Amount</Text>
                          <View style={[styles.invoiceStatusPill, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.invoiceStatusText, { color: badge.fg }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.receiptAmount}>
                          {formatMoney(selectedInvoice.amount, selectedInvoice.currency)}
                        </Text>
                        <Text style={styles.receiptDesc}>
                          {selectedInvoice.description ||
                            formatOrderType(selectedInvoice.orderType) ||
                            'Tiwlo Cloud billing transaction'}
                        </Text>
                      </View>

                      <View style={styles.receiptDetailsCard}>
                        <View style={styles.receiptDetailRow}>
                          <Text style={styles.receiptDetailKey}>Invoice ID</Text>
                          <Text style={styles.receiptDetailVal}>{selectedInvoice.id}</Text>
                        </View>
                        <View style={styles.hairline} />
                        <View style={styles.receiptDetailRow}>
                          <Text style={styles.receiptDetailKey}>Issued Date</Text>
                          <Text style={styles.receiptDetailVal}>
                            {formatDate(selectedInvoice.createdAt)}
                          </Text>
                        </View>
                        {selectedInvoice.paidAt ? (
                          <>
                            <View style={styles.hairline} />
                            <View style={styles.receiptDetailRow}>
                              <Text style={styles.receiptDetailKey}>Paid Date</Text>
                              <Text style={styles.receiptDetailVal}>
                                {formatDate(selectedInvoice.paidAt)}
                              </Text>
                            </View>
                          </>
                        ) : null}
                        {selectedInvoice.planName || selectedInvoice.planId ? (
                          <>
                            <View style={styles.hairline} />
                            <View style={styles.receiptDetailRow}>
                              <Text style={styles.receiptDetailKey}>Plan</Text>
                              <Text style={styles.receiptDetailVal}>
                                {selectedInvoice.planName || selectedInvoice.planId}
                              </Text>
                            </View>
                          </>
                        ) : null}
                        {selectedInvoice.orderType ? (
                          <>
                            <View style={styles.hairline} />
                            <View style={styles.receiptDetailRow}>
                              <Text style={styles.receiptDetailKey}>Type</Text>
                              <Text style={styles.receiptDetailVal}>
                                {formatOrderType(selectedInvoice.orderType)}
                              </Text>
                            </View>
                          </>
                        ) : null}
                        <View style={styles.hairline} />
                        <View style={styles.receiptDetailRow}>
                          <Text style={styles.receiptDetailKey}>Billed To</Text>
                          <Text style={styles.receiptDetailVal}>{billedName}</Text>
                        </View>
                        {(cashUsed > 0 || promoUsed > 0) && (
                          <>
                            <View style={styles.hairline} />
                            <View style={styles.receiptDetailRow}>
                              <Text style={styles.receiptDetailKey}>Cash Credits Used</Text>
                              <Text style={styles.receiptDetailVal}>
                                {formatMoney(cashUsed, selectedInvoice.currency)}
                              </Text>
                            </View>
                            <View style={styles.hairline} />
                            <View style={styles.receiptDetailRow}>
                              <Text style={styles.receiptDetailKey}>Promo Credits Used</Text>
                              <Text style={styles.receiptDetailVal}>
                                {formatMoney(promoUsed, selectedInvoice.currency)}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>

                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={() => void handleDownloadInvoice(selectedInvoice)}
                        >
                          <Download size={16} strokeWidth={2.1} color={colors.ink} />
                          <Text style={styles.primaryBtnText}>Download / Share Receipt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryModalBtn}
                          onPress={() => void handleOpenInvoiceUrl(selectedInvoice.id)}
                        >
                          <ExternalLink size={15} strokeWidth={2} color={colors.foreground} />
                          <Text style={styles.secondaryModalBtnText}>Open Web Invoice</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  balanceHeader: {
    gap: 10,
    paddingBottom: 4,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.muted,
    flex: 1,
  },
  gatewayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gatewayBadgeReady: {
    backgroundColor: colors.primarySoft,
  },
  gatewayBadgeMuted: {
    backgroundColor: colors.surface,
  },
  gatewayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gatewayBadgeTextReady: {
    color: colors.primaryHover,
  },
  gatewayBadgeTextMuted: {
    color: colors.muted,
  },
  statusPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  balanceVal: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.6,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  summaryCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryCardPromo: {
    backgroundColor: colors.primarySoft,
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCardLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
  },
  summaryCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  summaryCardValuePromo: {
    color: colors.primaryHover,
  },
  summaryCardHint: {
    fontSize: 10.5,
    color: colors.primaryHover,
    fontWeight: '500',
  },
  promoStrip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  promoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  promoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  promoBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  promoMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  promoHeadline: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  promoDesc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  promoCta: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCtaText: {
    fontSize: 13,
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
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  presetGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPillActive: {
    backgroundColor: colors.primarySoft,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  presetTextActive: {
    color: colors.primaryHover,
  },
  customAmountWrap: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  currencySuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  gatewaySection: {
    gap: 8,
  },
  gatewayPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gatewayPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  gatewayPillActive: {
    backgroundColor: colors.primarySoft,
  },
  gatewayPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  gatewayPillTextActive: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  noGatewayCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  noGatewayTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning,
  },
  noGatewaySub: {
    fontSize: 12,
    color: colors.foreground,
    lineHeight: 17,
  },
  quoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  quoteLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteLoadingText: {
    fontSize: 12.5,
    color: colors.muted,
  },
  quoteErrorText: {
    fontSize: 12.5,
    color: colors.danger,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteLabel: {
    fontSize: 12.5,
    color: colors.muted,
  },
  quoteVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  quoteTotalVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.primaryHover,
  },
  quoteRateText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  voucherRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voucherInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voucherInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  redeemBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  costItem: {
    gap: 6,
  },
  costHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  costVal: {
    fontSize: 12.5,
    color: colors.muted,
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
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
  planRow: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 6,
  },
  planRowActive: {
    backgroundColor: colors.primarySoft,
  },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  planDesc: {
    fontSize: 12.5,
    color: colors.muted,
  },
  planFeatures: {
    gap: 4,
    marginTop: 4,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featText: {
    fontSize: 12.5,
    color: colors.foreground,
    fontWeight: '500',
  },
  invoiceBlock: {
    paddingVertical: 10,
    gap: 10,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  invoiceStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  invoiceStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  invoiceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 30,
  },
  invoiceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  invoiceActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  invoiceDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  invoiceDownloadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  cancelPill: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.danger,
  },
  inputWithIcon: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 13.5,
    color: colors.foreground,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 14,
    paddingBottom: 8,
  },
  receiptHero: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  receiptHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  receiptAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  receiptDesc: {
    fontSize: 12.5,
    color: colors.muted,
  },
  receiptDetailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  receiptDetailKey: {
    fontSize: 12.5,
    color: colors.muted,
    fontWeight: '500',
  },
  receiptDetailVal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalActions: {
    gap: 8,
  },
  secondaryModalBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryModalBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.foreground,
  },
});
