import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useRef, useState } from 'react';
import { 
  CreditCard, 
  Coins, 
  Receipt, 
  BarChart3, 
  Settings, 
  LayoutDashboard, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ShieldAlert, 
  ExternalLink, 
  Download, 
  Lock, 
  Sparkles,
  Server,
  ChevronRight,
  TrendingUp,
  Activity,
  Sliders,
  Plus,
  MapPin,
  Pencil,
  Save,
  X,
  Phone,
  Gift
} from 'lucide-react';
import { getCloudBillingData, redeemCloudVoucher, startCloudCreditCheckout } from '../graphql/cloudQueries';
import { COUNTRY_OPTIONS } from '../../../utils/accountFormOptions';
import { openMaterialDialog } from '../../../components/MaterialDialogProvider.jsx';
import CloudInvoicePage from '../invoice/CloudInvoicePage.jsx';

const FORM_FIELD = 'mt-1.5 w-full rounded-xl border border-[#dcdcdc] bg-white px-3.5 py-2.5 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#858585] focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white dark:focus:ring-[#494949]/40';

function isFreeTrialInvoice(inv) {
  const st = String(inv?.status || '').trim().toLowerCase();
  const orderType = String(inv?.orderType || '').trim().toLowerCase();
  return Boolean(inv?.isFreeTrial) ||
    ['free trial', 'trial', 'free_trial'].includes(st) ||
    orderType === 'free_trial' ||
    (Number(inv?.amount) === 0 && String(inv?.planId || '').trim().toLowerCase() === 'free');
}

function getInvoiceStatusMeta(inv) {
  const raw = String(inv?.status || '').trim();
  const st = raw.toLowerCase();
  if (isFreeTrialInvoice(inv)) {
    return {
      label: 'Free Trial',
      className: 'bg-[#E6F4EA] text-[#137333] dark:bg-[#12351F] dark:text-[#81C995]',
      textClass: 'text-[#137333] dark:text-[#81C995]'
    };
  }
  if (['paid', 'verified'].includes(st)) {
    return {
      label: raw || 'Paid',
      className: 'bg-[#E6F4EA] text-[#137333] dark:bg-[#12351F] dark:text-[#81C995]',
      textClass: 'text-[#137333] dark:text-[#81C995]'
    };
  }
  if (st === 'pending') {
    return {
      label: 'Pending',
      className: 'bg-[#FEF7E0] text-[#8D5B00] dark:bg-[#3A2D10] dark:text-[#FDD663]',
      textClass: 'text-[#B06000] dark:text-[#FDD663]'
    };
  }
  if (['failed', 'cancelled', 'canceled', 'expired'].includes(st)) {
    return {
      label: raw || 'Failed',
      className: 'bg-[#FCE8E6] text-[#B3261E] dark:bg-[#3C2020] dark:text-[#F28B82]',
      textClass: 'text-[#B3261E] dark:text-[#F28B82]'
    };
  }
  return {
    label: raw || 'Unknown',
    className: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200',
    textClass: 'text-neutral-600 dark:text-neutral-300'
  };
}

function formatInvoiceOrderType(orderType) {
  if (!orderType) return '';
  const clean = String(orderType).trim().toLowerCase();
  const labels = {
    credit_topup: 'Credit Top-up',
    voucher_redeem: 'Voucher Credit',
    subscription_charge: 'Subscription',
    store_creation: 'Store Activation',
    free_trial: 'Free Starter Trial',
    plan_upgrade: 'Plan Upgrade',
    plan_renewal: 'Plan Renewal',
    addon_purchase: 'Store Add-on',
    discord_subscription: 'Discord Bot',
    whatsapp_subscription: 'WhatsApp Bot'
  };
  return labels[clean] || clean.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatInvoiceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function CloudBillingView({ currentUser, initialTab = 'overview', onBack, showToast }) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [invoiceId, setInvoiceId] = useState(() => {
    const match = window.location.pathname.match(/^\/billing\/invoices\/([^/]+)\/?$/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch { return ''; }
  });
  const [copiedId, setCopiedId] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
  const voucherInputRef = useRef(null);

  const handleOpenAddCoupon = () => {
    setActiveTab('credits');
    setTimeout(() => {
      voucherInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      voucherInputRef.current?.focus();
    }, 60);
  };
  const [creditTopupAmount, setCreditTopupAmount] = useState('25');
  const [startingCheckoutProvider, setStartingCheckoutProvider] = useState('');
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState('');
  const [creditCheckoutError, setCreditCheckoutError] = useState('');
  const [creditCheckoutNotice, setCreditCheckoutNotice] = useState('');
  const [isEditingBillingAddress, setIsEditingBillingAddress] = useState(false);
  const [isSavingBillingAddress, setIsSavingBillingAddress] = useState(false);
  const [billingAddressError, setBillingAddressError] = useState('');
  const [billingAddressSaved, setBillingAddressSaved] = useState(false);
  const [countryOptions, setCountryOptions] = useState([]);
  const [phoneDialCode, setPhoneDialCode] = useState('+880');
  const [phoneNationalNumber, setPhoneNationalNumber] = useState('');
  const [billingAccountType, setBillingAccountType] = useState('personal');
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [isSavingBillingProfile, setIsSavingBillingProfile] = useState(false);
  const [billingProfileError, setBillingProfileError] = useState('');
  const [billingProfileSaved, setBillingProfileSaved] = useState(false);
  const [billingAddressForm, setBillingAddressForm] = useState({
    address: '', city: '', country: '', phone: '', postalCode: ''
  });

  useEffect(() => {
    fetch('/api/public/shipping/countries')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setCountryOptions(Array.isArray(data.countries) ? data.countries : []))
      .catch(() => setCountryOptions(COUNTRY_OPTIONS.map(({ code, name }) => ({ code, name }))));
  }, []);

  const [billingState, setBillingState] = useState({
    userId: null,
    loading: true,
    account: null,
    error: ''
  });
  const [promoStatus, setPromoStatus] = useState(null);

  const loadBilling = async () => {
    if (!userId) {
      setBillingState({ userId: null, loading: false, account: null, error: 'Sign in to view your cloud billing account.' });
      return;
    }
    setBillingState(prev => ({ ...prev, loading: true }));
    try {
      const [result, promoRes] = await Promise.all([
        getCloudBillingData(userId),
        fetch('/api/cloud/billing/promotions/status', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ]);
      if (promoRes?.success) {
        setPromoStatus(promoRes);
      }
      const account = result?.account || null;
      if (account?.billingAddress) {
        const storedPhone = account.billingAddress.phone || '';
        const dialCodes = [...new Set(COUNTRY_OPTIONS.map(option => option.dial))].sort((a, b) => b.length - a.length);
        const matchedDialCode = dialCodes.find(dial => storedPhone.trim().startsWith(dial)) || '+880';
        setBillingAddressForm({
          address: account.billingAddress.address || '',
          city: account.billingAddress.city || '',
          country: account.billingAddress.country || '',
          phone: storedPhone,
          postalCode: account.billingAddress.postalCode || ''
        });
        setPhoneDialCode(matchedDialCode);
        setPhoneNationalNumber(storedPhone.trim().startsWith(matchedDialCode) ? storedPhone.trim().slice(matchedDialCode.length).trim() : storedPhone);
      }
      setBillingAccountType(account?.accountType === 'business' ? 'business' : 'personal');
      setBillingCompanyName(account?.companyName || '');
      setBillingState({
        userId,
        loading: false,
        account,
        error: account ? '' : 'Billing account information is currently unavailable.'
      });
    } catch (error) {
      console.error('Error loading Cloud Billing data:', error);
      setBillingState({
        userId,
        loading: false,
        account: null,
        error: error.message || 'Could not connect to billing ledger. Please try again.'
      });
    }
  };

  const handleCancelInvoice = async (invoice) => {
    const canCancel = String(invoice?.status || '').toLowerCase() === 'pending' && String(invoice?.id || '').startsWith('ctu-');
    if (cancellingInvoiceId || !canCancel) return;
    const confirmed = await openMaterialDialog({
      type: 'confirm',
      title: 'Cancel this checkout?',
      message: "Your Tiwlo billing session will be marked cancelled immediately. This may not close the payment provider's hosted page.",
      details: 'If you already completed payment with the provider, its verified confirmation will still be applied to your credit balance.',
      confirmLabel: 'Cancel checkout',
      cancelLabel: 'Keep checkout'
    });
    if (!confirmed) return;

    setCancellingInvoiceId(invoice.id);
    try {
      const response = await fetch(`/api/cloud/billing/credits/${encodeURIComponent(invoice.id)}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not cancel this checkout.');
      showToast?.(result.notificationSent === false
        ? 'Checkout cancelled, but the confirmation email could not be sent.'
        : result.cancelReason === 'expired' ? 'Checkout expired.'
          : result.status === 'cancelled' && result.notificationSent === true ? 'Checkout cancelled. Confirmation email sent.'
            : result.status === 'cancelled' ? 'Checkout was already cancelled.'
            : `Checkout status: ${result.status}.`, result.notificationSent === false ? 'error' : 'success');
      await loadBilling();
    } catch (error) {
      showToast?.(error.message || 'Could not cancel this checkout.', 'error');
    } finally {
      setCancellingInvoiceId('');
    }
  };

  useEffect(() => {
    loadBilling();
  }, [userId]);

  useEffect(() => {
    const syncInvoiceRoute = () => {
      const match = window.location.pathname.match(/^\/billing\/invoices\/([^/]+)\/?$/);
      if (!match) {
        setInvoiceId('');
        return;
      }
      try {
        setInvoiceId(decodeURIComponent(match[1]));
        setActiveTab('invoices');
      } catch {
        setInvoiceId('');
      }
    };
    window.addEventListener('popstate', syncInvoiceRoute);
    return () => window.removeEventListener('popstate', syncInvoiceRoute);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('cloud_credit_payment');
    if (!result) return;
    setActiveTab('credits');
    setCreditCheckoutNotice({
      success: 'Payment verified. Your cloud credits have been added.',
      pending: 'The provider has not confirmed this payment yet. Refresh billing in a moment.',
      cancelled: 'Checkout was cancelled. Any provider-confirmed payment will still be applied to your credit balance.',
      failed: 'The provider could not confirm this payment. If you were charged, contact billing support.',
      invalid: 'This payment return could not be verified. Contact billing support if you were charged.'
    }[result] || 'Payment status could not be confirmed.');
    loadBilling();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}`);
  }, []);

  const hasCurrentUserData = billingState.userId === userId;
  const account = hasCurrentUserData ? billingState.account : null;
  const loading = !hasCurrentUserData || billingState.loading;

  const credits = Number.isFinite(account?.credits) && account.credits >= 0 ? account.credits : null;
  const promotionalCredits = Number.isFinite(account?.promotionalCredits) ? account.promotionalCredits : null;
  const totalCreditBalance = credits === null && promotionalCredits === null
    ? null
    : (credits ?? 0) + (promotionalCredits ?? 0);
  const hasConfiguredGateway = account?.hasConfiguredGateway === true;
  const configuredGateways = Array.isArray(account?.configuredGateways) ? account.configuredGateways : [];
  const creditCheckoutGateways = Array.isArray(account?.creditCheckoutGateways) ? account.creditCheckoutGateways : [];
  const hasBdtCheckout = creditCheckoutGateways.some(gateway => gateway.currencies?.includes('BDT'));
  const billingAccountId = account?.billingAccountId || '';
  const billingAccountName = account?.billingAccountName || '';
  const costServices = Array.isArray(account?.costBreakdown) ? account.costBreakdown : [];
  const formatMoney = (amount, currency = account?.currency || 'USD') => {
    if (!Number.isFinite(amount)) return 'Unavailable';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[360px] w-full max-w-7xl items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        Loading billing account…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto flex min-h-[360px] w-full max-w-7xl items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <h1 className="text-base font-semibold text-neutral-950 dark:text-white">Billing unavailable</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {billingState.error || 'Sign in to view your cloud billing account.'}
          </p>
          {userId && (
            <button
              type="button"
              onClick={loadBilling}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-neutral-950 px-4 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (invoiceId) {
    const invoice = account.invoices?.find(item => item.id === invoiceId) || null;
    return (
      <CloudInvoicePage
        invoice={invoice}
        account={account}
        isCancelling={cancellingInvoiceId === invoiceId}
        onCancel={handleCancelInvoice}
        onBack={() => {
          window.history.replaceState(null, '', '/billing');
          setInvoiceId('');
          setActiveTab('invoices');
        }}
      />
    );
  }

  const copyAccountId = () => {
    navigator.clipboard?.writeText(billingAccountId);
    setCopiedId(true);
    showToast?.('Billing Account ID copied', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRedeemVoucher = async (event) => {
    event.preventDefault();
    const code = voucherCode.trim();
    if (!code || isRedeemingVoucher) return;
    setIsRedeemingVoucher(true);
    try {
      const result = await redeemCloudVoucher(code);
      setVoucherCode('');
      const durationNote = result.rewardType === 'standard_credit' || !result.validityDays
        ? ''
        : ` (valid ${result.validityDays} days)`;
      showToast?.(`Promotional code applied: ${formatMoney(Number(result.addedCredits))} added${durationNote}.`, 'success');
      await loadBilling();
    } catch (error) {
      const msg = String(error?.message || '');
      if (/suspended:|blocked due to/i.test(msg)) {
        try {
          const banInfo = { email: currentUser?.email || '', banReason: msg };
          sessionStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
          localStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
        } catch {}
        window.location.href = '/account-disabled';
        return;
      }
      showToast?.(msg || 'Could not redeem promotional code.', 'error');
    } finally {
      setIsRedeemingVoucher(false);
    }
  };

  const handleStartCreditCheckout = async (provider) => {
    if (startingCheckoutProvider) return;
    setCreditCheckoutError('');
    setStartingCheckoutProvider(provider);
    try {
      const isLocalCurrency = ['bkash', 'sslcommerz'].includes(provider);
      let acceptedQuote = null;
      if (isLocalCurrency) {
        const quoteResponse = await fetch('/api/cloud/billing/credits/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ amount: Number(creditTopupAmount), provider })
        });
        const quoteData = await quoteResponse.json();
        if (!quoteResponse.ok || !quoteData?.quote) throw new Error(quoteData?.error || 'Could not get the current BDT payment amount.');
        const quote = quoteData.quote;
        acceptedQuote = quote;
        const accepted = await openMaterialDialog({
          type: 'confirm',
          title: 'Confirm BDT payment',
          message: `You will receive ${formatMoney(quote.creditAmount, 'USD')} in Cloud credits and pay ${formatMoney(quote.paymentAmount, 'BDT')}.`,
          details: `Reference rate: 1 USD = ${Number(quote.exchangeRate).toFixed(4)} BDT · ${quote.rateDate || 'Latest available'}\n${quote.rateSource || 'Market reference rate'}\nYour bank or gateway may apply its own fees or exchange rate.`,
          confirmLabel: 'Continue to payment',
          cancelLabel: 'Review amount'
        });
        if (!accepted) {
          setStartingCheckoutProvider('');
          return;
        }
      }
      const checkout = await startCloudCreditCheckout({
        amount: Number(creditTopupAmount),
        provider,
        expectedPaymentAmount: acceptedQuote?.paymentAmount,
        expectedRateDate: acceptedQuote?.rateDate
      });
      if (checkout.notificationSent === false) {
        await openMaterialDialog({
          type: 'alert',
          title: 'Checkout is ready',
          message: 'We could not send the checkout email to your verified account address. The secure checkout is ready in your browser.',
          details: `Reference: ${checkout.topupId}\nYou can continue now; this checkout expires in 24 hours.`,
        });
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setCreditCheckoutError(error.message || 'Could not open secure payment checkout.');
      setStartingCheckoutProvider('');
    }
  };

  const handleSaveBillingAddress = async (event) => {
    event.preventDefault();
    setBillingAddressError('');
    setBillingAddressSaved(false);
    setIsSavingBillingAddress(true);
    try {
      const response = await fetch('/api/cloud/billing/address', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingAddress: { ...billingAddressForm, phone: [phoneDialCode, phoneNationalNumber.trim()].filter(Boolean).join(' ') } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not save billing address.');
      }
      const savedAddress = data.billingAddress;
      setBillingAddressForm(savedAddress);
      setBillingState(previous => ({
        ...previous,
        account: previous.account ? { ...previous.account, billingAddress: savedAddress } : previous.account
      }));
      setIsEditingBillingAddress(false);
      setBillingAddressSaved(true);
      showToast?.('Billing address updated.', 'success');
    } catch (error) {
      setBillingAddressError(error.message || 'Could not save billing address.');
    } finally {
      setIsSavingBillingAddress(false);
    }
  };

  const handleSaveBillingProfile = async (event) => {
    event.preventDefault();
    setBillingProfileError('');
    setBillingProfileSaved(false);
    setIsSavingBillingProfile(true);
    try {
      const response = await fetch('/api/cloud/billing/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: billingAccountType, companyName: billingCompanyName })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save billing profile.');
      setBillingState(previous => ({ ...previous, account: previous.account ? { ...previous.account, ...data.profile } : previous.account }));
      setBillingProfileSaved(true);
      showToast?.('Billing profile updated.', 'success');
    } catch (error) {
      setBillingProfileError(error.message || 'Could not save billing profile.');
    } finally {
      setIsSavingBillingProfile(false);
    }
  };

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'credits', label: 'Credits & Top-up', icon: Coins },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'cost-breakdown', label: 'Cost Breakdown', icon: BarChart3 },
    { id: 'invoices', label: 'Invoices & Ledger', icon: Receipt },
    { id: 'settings', label: 'Account Settings', icon: Settings }
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-16 text-neutral-950 antialiased dark:text-neutral-100">
      {/* Clean Shadcn Page Header */}
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3 sm:items-center">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 cursor-pointer dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                title="Back to Cloud Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Tiwlo Cloud</span>
                <span>/</span>
                <span className="text-neutral-950 dark:text-neutral-200">Billing</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl dark:text-white">
                  {billingAccountName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    hasConfiguredGateway
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${hasConfiguredGateway ? 'bg-emerald-600' : 'bg-neutral-400'}`} />
                  {hasConfiguredGateway ? 'Gateway configured' : 'Unconfigured'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 font-mono text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              <span className="font-sans text-[11px] font-medium text-neutral-500 dark:text-neutral-400">ID:</span>
              <span>{billingAccountId}</span>
              <button
                type="button"
                onClick={copyAccountId}
                className="ml-1 text-neutral-500 transition hover:text-neutral-950 cursor-pointer dark:hover:text-white"
                title="Copy Billing ID"
              >
                {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={loadBilling}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 cursor-pointer dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              title="Refresh Billing Ledger"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Clean Shadcn Segmented Tabs */}
        <div className="flex items-center overflow-x-auto pb-0.5">
          <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-neutral-900">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? 'border border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white'
                      : 'border border-transparent text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="space-y-6">
        {promoStatus?.config?.enabled && promoStatus?.eligible && (() => {
          const cfg = promoStatus.config;
          const minUsd = Number(cfg.minDepositUsd ?? 1);
          const bonusUsd = Number(cfg.bonusAmountUsd ?? 50);
          const days = Number(cfg.validityDays ?? 30);
          const formatTokenized = (raw) => String(raw || '')
            .replaceAll('{min}', `$${minUsd.toFixed(2)}`)
            .replaceAll('{deposit}', `$${minUsd.toFixed(2)}`)
            .replaceAll('{bonus}', `$${bonusUsd.toFixed(2)}`)
            .replaceAll('{days}', String(days));

          return (
            <div className="flex flex-col justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
                  <Gift className="h-4 w-4 text-neutral-900 dark:text-[#1ed760]" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
                      {cfg.badgeText || 'New Account Offer'}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      ${minUsd.toFixed(0)} Credit → ${bonusUsd.toFixed(0)} Gift · {days} Days
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {formatTokenized(cfg.headline) || `Load $${minUsd.toFixed(2)} credit to get $${bonusUsd.toFixed(2)} gift for ${days} days`}
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {formatTokenized(cfg.description) || `New accounts that load at least $${minUsd.toFixed(2)} USD receive $${bonusUsd.toFixed(2)} USD in gift credits valid for ${days} days.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreditTopupAmount(String(minUsd));
                  setActiveTab('credits');
                }}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653] cursor-pointer"
              >
                Add ${minUsd % 1 === 0 ? minUsd.toFixed(0) : minUsd.toFixed(2)} &amp; Get ${bonusUsd % 1 === 0 ? bonusUsd.toFixed(0) : bonusUsd.toFixed(2)} Gift
              </button>
            </div>
          );
        })()}
        
        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW (Pure Crisp White, Clean Google Material) */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top Stat Cards — PURE WHITE SURFACES (No dark/blackish tints!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Card 1: Available Balance + Credit Balance below */}
              <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium">Available Balance</span>
                  <div className="w-7 h-7 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 flex items-center justify-center">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-2xl sm:text-3xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                      {credits === null ? 'Unavailable' : formatMoney(credits)}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-2 py-0.5 rounded-md">
                      {account.currency}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credits')}
                    className="shrink-0 text-xs font-semibold text-neutral-950 dark:text-[#1ed760] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Add Funds</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-neutral-500 dark:text-neutral-400">Credit Balance</span>
                      <span className="font-semibold text-neutral-950 dark:text-white">
                        {totalCreditBalance === null ? 'Unavailable' : formatMoney(totalCreditBalance)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddCoupon}
                      className="shrink-0 text-xs font-semibold text-neutral-950 dark:text-[#1ed760] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Add Coupon</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500 dark:text-neutral-400">Promotional Gift</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {promotionalCredits === null ? 'Unavailable' : formatMoney(promotionalCredits)}
                    </span>
                  </div>
                  {promoStatus?.promotionalExpiresAt && Number(promotionalCredits) > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>Gift expires</span>
                      <span>{new Date(promoStatus.promotionalExpiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Current Month Incurred Spend */}
              <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium">Current Month Spend</span>
                  <div className="w-7 h-7 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl sm:text-3xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                    {formatMoney(account?.monthToDateSpent)}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 ml-1">
                    {account.currency}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>Billing Period</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>{account?.usageMeteringEnabled ? 'Metering active' : 'Metering unavailable'}</span>
                  </span>
                </div>
              </div>

              {/* Card 3: Projected Spend */}
              <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium">Forecasted Month End</span>
                  <div className="w-7 h-7 rounded-lg border border-neutral-200 bg-neutral-50 text-emerald-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl sm:text-3xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                    {formatMoney(account?.projectedCost)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
                  {Number.isFinite(account?.projectedCost) ? 'Estimated usage forecast' : 'Usage forecasting is not connected'}
                </div>
              </div>

              {/* Card 4: Active Workloads */}
              <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium">Cloud Droplets</span>
                  <div className="w-7 h-7 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 flex items-center justify-center">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl sm:text-3xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                    {account?.droplets?.length || 0}
                  </span>
                  <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400 ml-1">
                    droplets in this account
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
                  Registered cloud droplets
                </div>
              </div>

            </div>

            {/* Quick Actions Bar (Clean Shadcn UI) */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Quick Actions
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('credits')}
                  className="inline-flex h-8 items-center gap-1.5 px-3.5 rounded-lg bg-[#1ed760] hover:bg-[#16c653] text-black text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Top-up Credits</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payment-methods')}
                  className="inline-flex h-8 items-center gap-1.5 px-3.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Payment Methods</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cost-breakdown')}
                  className="inline-flex h-8 items-center gap-1.5 px-3.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Budget & Spending Alerts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  className="inline-flex h-8 items-center gap-1.5 px-3.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Invoices</span>
                </button>
              </div>
            </div>

            {!hasConfiguredGateway && (
              <div className="p-5 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        No platform payment gateway configured
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 max-w-2xl leading-relaxed">
                        No platform payment gateway is configured. Cloud credit checkout is also not connected.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment-methods')}
                    className="inline-flex h-8 shrink-0 items-center px-3.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 text-xs font-medium transition cursor-pointer"
                  >
                    View Payment Options &gt;
                  </button>
                </div>
              </div>
            )}

            {/* Middle Section: Usage by Service + Payment Gateways Callout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left 8 Cols: Usage by Services */}
              <div className="lg:col-span-8 p-5 sm:p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Usage by Cloud Services
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Current billing period resource consumption.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cost-breakdown')}
                    className="text-xs font-medium text-neutral-950 dark:text-[#1ed760] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Detailed Breakdown</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {costServices.length ? costServices.map((service) => (
                    <div key={service.service} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <p className="font-semibold text-neutral-950 dark:text-white truncate">{service.service}</p>
                      </div>
                      <span className="font-semibold text-neutral-950 dark:text-white text-sm">
                        {formatMoney(Number(service.amount))}
                      </span>
                    </div>
                  )) : (
                    <p className="py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                      Usage metering is not connected. No service charges are reported.
                    </p>
                  )}
                </div>
              </div>

              {/* Right 4 Cols: Payment Channels & Account Summary */}
              <div className="lg:col-span-4 space-y-5">
                
                {/* Payment Gateway Status Card */}
                <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                      <span>Payment Channels</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('payment-methods')}
                      className="text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>

                  {creditCheckoutGateways.length > 0 ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 text-xs">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Credit checkout ready</span>
                        </div>
                        <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400">
                          {creditCheckoutGateways.map(gateway => gateway.name).join(' and ')} can securely process Cloud credit top-ups.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {creditCheckoutGateways.map(gw => (
                          <div key={gw.id} className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 text-xs">
                            <span className="font-semibold text-neutral-950 dark:text-white">{gw.name}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                              {gw.mode}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('credits')}
                        className="w-full mt-2 h-9 px-4 rounded-lg bg-[#1ed760] hover:bg-[#16c653] text-black text-xs font-semibold transition cursor-pointer"
                      >
                        Top-up Cloud Credits
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/50 space-y-2.5">
                      <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        <span>Payment Gateway Required</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        No live USD checkout method is currently enabled. Contact billing support to enable live Stripe or PayPal.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payment-methods')}
                        className="text-xs font-semibold text-neutral-950 dark:text-neutral-200 hover:underline block pt-1"
                      >
                        Configure Payment Methods &gt;
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Details Quick Card */}
                <div className="p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-3">
                  <h4 className="font-semibold text-neutral-950 dark:text-white">Account Details</h4>
                  <div className="flex justify-between py-1.5 border-b border-[#f2f2f2] dark:border-[#2d2d2d]">
                    <span className="text-[#636363] dark:text-[#9f9f9f]">Account Type</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">Cloud</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#f2f2f2] dark:border-[#2d2d2d]">
                    <span className="text-[#636363] dark:text-[#9f9f9f]">Currency</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">{account.currency}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#f2f2f2] dark:border-[#2d2d2d]">
                    <span className="text-[#636363] dark:text-[#9f9f9f]">Billing Owner</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white truncate max-w-[150px]">{currentUser?.email || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#636363] dark:text-[#9f9f9f]">Account owner</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">{currentUser?.email || '—'}</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREDITS & TOP-UP (Pure White Google Material)      */}
        {/* ========================================================= */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            
            {/* Balance Card — Clean Shadcn UI */}
            <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 text-xs font-medium mb-2">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Available Balance</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl sm:text-4xl font-semibold text-neutral-950 dark:text-white tracking-tight">
                      {credits === null ? 'Unavailable' : formatMoney(credits)}
                    </span>
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      Available Wallet ({account.currency})
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xl">
                    Promotional gift credits are applied automatically first toward Cloud Stores, packages, and add-ons until expiry.
                  </p>
                </div>

                <div className="w-full sm:w-auto min-w-[240px] p-4 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 text-xs space-y-2 shrink-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-500 dark:text-neutral-400">Total Credit Balance</span>
                    <span className="font-semibold text-neutral-950 dark:text-white">
                      {totalCreditBalance === null ? 'Unavailable' : formatMoney(totalCreditBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-500 dark:text-neutral-400">Promotional Credit</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {promotionalCredits === null ? 'Unavailable' : formatMoney(promotionalCredits)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">Currency</span>
                    <span className="font-semibold text-neutral-950 dark:text-white">{account.currency}</span>
                  </div>
                  {promoStatus?.promotionalExpiresAt && Number(promotionalCredits) > 0 && (
                    <div className="flex items-center justify-between gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>Gift expires</span>
                      <span>{new Date(promoStatus.promotionalExpiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        voucherInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        voucherInputRef.current?.focus();
                      }}
                      className="text-xs font-semibold text-neutral-950 dark:text-[#1ed760] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Add Coupon</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Credits Box — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d] space-y-6">
              <div>
                <h3 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                  Add Cloud Credits
                </h3>
                <p className="text-xs text-[#636363] dark:text-[#9f9f9f] mt-0.5">
                  Credit purchase status for this account.
                </p>
              </div>

              {creditCheckoutNotice && (
                <div role="status" className={`p-4 rounded-xl border text-sm ${creditCheckoutNotice.startsWith('Payment verified') ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]' : 'bg-[#FEF7E0] border-[#FEEFC3] text-[#B06000]'}`}>
                  {creditCheckoutNotice}
                </div>
              )}

              {creditCheckoutGateways.length > 0 ? (
                <div className="space-y-4 max-w-xl">
                  <label className="block text-xs font-medium text-[#636363] dark:text-[#9f9f9f]">
                    Top-up amount (USD, minimum $1)
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="0.01"
                      required
                      value={creditTopupAmount}
                      onChange={event => setCreditTopupAmount(event.target.value)}
                      className={FORM_FIELD}
                    />
                  </label>
                  {creditCheckoutError && <p role="alert" className="text-xs text-rose-600">{creditCheckoutError}</p>}
                  <div className="flex flex-wrap gap-3">
                    {creditCheckoutGateways.map(gateway => (
                      <button
                        key={gateway.id}
                        type="button"
                        disabled={Boolean(startingCheckoutProvider)}
                        onClick={() => handleStartCreditCheckout(gateway.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#696969] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#505050] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Lock className="h-4 w-4" />
                        {startingCheckoutProvider === gateway.id ? 'Opening secure checkout…' : `Pay with ${gateway.name}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#636363] dark:text-[#9f9f9f]">
                    Your balance stays in USD. {hasBdtCheckout ? 'bKash and SSLCOMMERZ charge the converted BDT amount using the latest available reference rate. ' : ''}Credits are added only after the provider confirms payment.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30">
                  <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-sm font-semibold">
                    <Lock className="w-5 h-5 shrink-0" />
                    <span>Credit checkout is not configured</span>
                  </div>
                  <p className="mt-2 text-xs text-[#636363] dark:text-[#9f9f9f] leading-relaxed">
                    Enable a live Stripe or PayPal gateway for USD, or a live bKash or SSLCOMMERZ gateway for BDT. Test-mode payments cannot add credits. Nagad direct checkout is not connected yet.
                  </p>
                </div>
              )}
            </div>

            {/* Promo Voucher Box — Clean Shadcn UI */}
            <div className="p-6 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-900 dark:text-white" />
                <span>Redeem Promotional or Voucher Code</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Enter an assigned promotional code or voucher to add credits to this account.
              </p>
              <form onSubmit={handleRedeemVoucher} className="flex flex-wrap sm:flex-nowrap gap-2 max-w-md">
                <input
                  ref={voucherInputRef}
                  type="text"
                  value={voucherCode}
                  onChange={(event) => setVoucherCode(event.target.value)}
                  maxLength={64}
                  autoComplete="off"
                  placeholder="Enter coupon or voucher code"
                  className="flex-1 min-w-0 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-xs font-mono text-neutral-950 dark:text-white outline-none focus:border-neutral-950 dark:focus:border-white uppercase"
                />
                <button
                  type="submit"
                  disabled={isRedeemingVoucher || !voucherCode.trim()}
                  className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 text-white text-xs font-medium disabled:opacity-40 transition cursor-pointer shrink-0"
                >
                  {isRedeemingVoucher ? 'Redeeming…' : 'Redeem'}
                </button>
              </form>
              {Array.isArray(promoStatus?.claimedCoupons) && promoStatus.claimedCoupons.length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                  <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    Redeemed Coupons &amp; Promotional Credits
                  </p>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {promoStatus.claimedCoupons.map((coupon) => (
                      <div key={coupon.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-semibold text-neutral-950 dark:text-white">
                            {coupon.promoCode}
                          </span>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {coupon.rewardType === 'standard_credit' ? 'Standard Credit' : 'Promotional Credit'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            +{formatMoney(coupon.amountUsd)}
                          </span>
                          <span>
                            {coupon.expiresAt
                              ? `Expires ${new Date(coupon.expiresAt).toLocaleDateString()} (${coupon.validityDays}d)`
                              : 'No expiry'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Credit Transaction Ledger — PURE WHITE */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white mb-4">
                Credit Ledger History
              </h3>
              {Array.isArray(account.invoices) && account.invoices.length ? (
                <div className="divide-y divide-[#f2f2f2] dark:divide-[#2d2d2d]">
                  {account.invoices.map(invoice => {
                    const statusMeta = getInvoiceStatusMeta(invoice);
                    const isTrial = isFreeTrialInvoice(invoice);
                    const orderTypeLabel = formatInvoiceOrderType(invoice.orderType);
                    return (
                      <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-[#212121] dark:text-white">{invoice.description || 'Cloud credit transaction'}</p>
                            {orderTypeLabel && (
                              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                {orderTypeLabel}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[#636363] dark:text-[#9f9f9f]">{formatInvoiceDate(invoice.createdAt)} · {invoice.id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold tabular-nums text-[#212121] dark:text-white">
                              {formatMoney(Number(invoice.amount ?? 0), invoice.currency)}
                              {isTrial ? ' · Free Trial' : ''}
                            </p>
                            <p className={`text-[11px] font-medium ${statusMeta.textClass}`}>{statusMeta.label}</p>
                          </div>
                          <a
                            href={`/billing/invoices/${encodeURIComponent(invoice.id)}`}
                            onClick={(e) => {
                              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                e.preventDefault();
                                window.history.pushState(null, '', `/billing/invoices/${encodeURIComponent(invoice.id)}`);
                                setInvoiceId(invoice.id);
                              }
                            }}
                            className="inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          >
                            View Invoice
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center rounded-xl bg-[#fafafa] dark:bg-[#2d2d2d] text-xs text-[#636363] dark:text-[#9f9f9f]">
                  No credit transactions are available in the ledger.
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PAYMENT METHODS (Clean White Cards & Gateways)     */}
        {/* ========================================================= */}
        {activeTab === 'payment-methods' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white mb-1">
                Connected Payment Methods & Gateways
              </h2>
              <p className="text-xs text-[#636363] dark:text-[#9f9f9f] mb-6">
                Platform gateway credentials configured for cloud billing.
              </p>

              {hasConfiguredGateway ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {configuredGateways.map(gw => (
                    <div key={gw.id} className="p-4 rounded-xl border border-[#f0f0f0] dark:border-[#2d2d2d] bg-[#fafafa] dark:bg-[#2d2d2d] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#000000] text-white font-semibold flex items-center justify-center text-xs">
                          {gw.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#1F1F1F] dark:text-white">{gw.name}</div>
                          <div className="text-[11px] text-[#636363] dark:text-[#9f9f9f]">
                            Currencies: {gw.currencies?.join(', ')}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] text-[10px] font-semibold uppercase">
                        {gw.mode}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30 space-y-3 max-w-xl">
                  <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-sm font-semibold">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>No platform payment gateway configured</span>
                  </div>
                  <p className="text-xs text-[#636363] dark:text-[#9f9f9f] leading-relaxed">
                    A platform payment gateway is not configured. Enable live Stripe/PayPal for USD or bKash/SSLCOMMERZ for BDT credit purchases.
                  </p>
                  <div>
                    <a
                      href="/administrator"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#000000] dark:text-[#b0b0b0] hover:underline"
                    >
                      <span>Open Platform Gateways Management</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
              {hasConfiguredGateway && creditCheckoutGateways.length === 0 && (
                <p className="mt-4 text-xs text-[#636363] dark:text-[#9f9f9f]">
                  Configured channels are visible above. Cloud credit checkout requires a live Stripe/PayPal USD channel or a live bKash/SSLCOMMERZ BDT channel. Nagad direct checkout is not connected yet.
                </p>
              )}
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white">Auto-recharge unavailable</h3>
              <p className="mt-1 text-xs text-[#636363] dark:text-[#9f9f9f]">
                Automatic payments are not connected. No recharge rules have been saved.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: COST BREAKDOWN & BUDGETS (Clean White Material)     */}
        {/* ========================================================= */}
        {activeTab === 'cost-breakdown' && (
          <div className="space-y-6">
            
            {/* Service Breakdown Table — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                    Cost Breakdown by Cloud Service
                  </h2>
                  <p className="text-xs text-[#636363] dark:text-[#9f9f9f] mt-0.5">
                    Granular metering breakdown of compute, network, and storage.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#636363] dark:text-[#9f9f9f] px-3.5 py-1.5 rounded-full bg-[#f4f4f4] dark:bg-[#2d2d2d] border border-[#e2e2e2] dark:border-[#3f3f3f]">
                  Billing Period: Current Month
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] dark:border-[#2d2d2d] text-[#636363] dark:text-[#9f9f9f] uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Usage Metric</th>
                      <th className="py-3 px-3">Rate Model</th>
                      <th className="py-3 px-3 text-right">Incurred Cost ({account.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2f2f2] dark:divide-[#2d2d2d]">
                    {costServices.length ? costServices.map((service) => (
                      <tr key={service.service} className="hover:bg-[#fafafa] dark:hover:bg-[#2d2d2d]/40">
                        <td className="py-3.5 px-3 font-semibold text-[#1F1F1F] dark:text-white">{service.service}</td>
                        <td className="py-3.5 px-3 text-[#636363] dark:text-[#9f9f9f]">{service.percentage}% of recorded usage</td>
                        <td className="py-3.5 px-3 text-[#636363]">{account.currency}</td>
                        <td className="py-3.5 px-3 text-right font-semibold text-[#1F1F1F] dark:text-white">{formatMoney(Number(service.amount))}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-8 px-3 text-center text-[#636363] dark:text-[#9f9f9f]">
                          Usage metering is not connected. No service costs are available.
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-[#f0f0f0] dark:border-[#2d2d2d] font-semibold">
                      <td className="py-4 px-3 text-sm text-[#1F1F1F] dark:text-white">Total Incurred Cost</td>
                      <td className="py-4 px-3" colSpan={2}></td>
                      <td className="py-4 px-3 text-right text-sm text-[#000000] dark:text-[#b0b0b0]">{formatMoney(account?.monthToDateSpent)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cloud Spending Budget & Alert Thresholds — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white">Budget alerts unavailable</h3>
              <p className="mt-1 text-xs text-[#636363] dark:text-[#9f9f9f]">
                Usage metering and alert delivery are not connected. No budget or notification settings have been saved.
              </p>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: INVOICES & STATEMENTS (Pure White Material Table)  */}
        {/* ========================================================= */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1f1f1f] border border-[#f0f0f0] dark:border-[#2d2d2d]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                    Invoices & Billing Documents
                  </h2>
                  <p className="text-xs text-[#636363] dark:text-[#9f9f9f] mt-0.5">
                    Invoices recorded for this billing account.
                  </p>
                </div>
              </div>

              {account?.invoices && account.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#f0f0f0] dark:border-[#2d2d2d] text-[#636363] dark:text-[#9f9f9f] uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3 px-3">Document ID</th>
                        <th className="py-3 px-3">Description</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2f2f2] dark:divide-[#2d2d2d]">
                      {account.invoices.map(inv => {
                        const statusMeta = getInvoiceStatusMeta(inv);
                        const isTrial = isFreeTrialInvoice(inv);
                        const orderTypeLabel = formatInvoiceOrderType(inv.orderType);
                        const cashUsed = Number(inv.cashCreditUsed || 0);
                        const promoUsed = Number(inv.promoCreditUsed || 0);
                        return (
                          <tr key={inv.id}>
                            <td className="py-3.5 px-3 font-mono font-medium text-[#212121] dark:text-white">{inv.id}</td>
                            <td className="py-3.5 px-3">
                              <p className="font-medium text-[#212121] dark:text-white">{inv.description || '—'}</p>
                              {(orderTypeLabel || inv.planId || cashUsed > 0 || promoUsed > 0) && (
                                <p className="mt-0.5 text-[11px] text-[#636363] dark:text-[#9f9f9f]">
                                  {[
                                    orderTypeLabel,
                                    inv.planId ? `Plan: ${inv.planId}` : '',
                                    cashUsed > 0 || promoUsed > 0
                                      ? `Credits: ${cashUsed > 0 ? `$${cashUsed.toFixed(2)} cash` : ''}${cashUsed > 0 && promoUsed > 0 ? ' + ' : ''}${promoUsed > 0 ? `$${promoUsed.toFixed(2)} promo` : ''}`
                                      : ''
                                  ].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-[#636363] dark:text-[#9f9f9f]">{formatInvoiceDate(inv.createdAt)}</td>
                            <td className="py-3.5 px-3 font-semibold tabular-nums text-[#212121] dark:text-white">
                              <span>{formatMoney(Number(inv.amount ?? 0), inv.currency)}</span>
                              {isTrial && (
                                <span className="ml-1.5 text-[10px] font-semibold text-[#137333] dark:text-[#81C995]">
                                  Free Trial
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <a
                                href={`/billing/invoices/${encodeURIComponent(inv.id)}`}
                                onClick={(e) => {
                                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                                    e.preventDefault();
                                    window.history.pushState(null, '', `/billing/invoices/${encodeURIComponent(inv.id)}`);
                                    setInvoiceId(inv.id);
                                  }
                                }}
                                className="inline-flex items-center rounded-full px-3 py-1.5 font-medium text-[#696969] transition hover:bg-[#efefef] dark:text-[#c4c4c4] dark:hover:bg-[#2b2b2b]"
                              >
                                View Invoice
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center rounded-xl bg-[#fafafa] dark:bg-[#2d2d2d] text-xs text-[#636363] dark:text-[#9f9f9f]">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#000000]" />
                  <p className="font-semibold text-[#1F1F1F] dark:text-white">No invoices yet</p>
                  <p className="mt-0.5">Invoices will appear here when recorded in the billing database.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ACCOUNT SETTINGS (Clean White Preferences)        */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#000000] dark:text-[#b0b0b0]">Account</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-white">Billing account settings</h2>
                <p className="mt-1 text-sm text-[#636363] dark:text-[#9f9f9f]">Manage the real contact and address details attached to your billing account.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e6e6e6] bg-[#f8f8f8] px-3 py-1.5 text-xs font-medium text-[#575757] dark:border-[#3f3f3f] dark:bg-[#282828] dark:text-[#d8d8d8]">
                <span className="h-2 w-2 rounded-full bg-[#188038]" /> Account loaded
              </span>
            </div>

            <section className="rounded-2xl border border-[#eaeaea] bg-white dark:border-[#2d2d2d] dark:bg-[#1f1f1f]">
              <div className="border-b border-[#f0f0f0] px-5 py-4 sm:px-6 dark:border-[#2d2d2d]">
                <h3 className="text-base font-semibold text-[#212121] dark:text-white">Billing profile</h3>
                <p className="mt-1 text-sm text-[#636363] dark:text-[#9f9f9f]">Choose how your billing details appear on invoices.</p>
              </div>
              <form onSubmit={handleSaveBillingProfile} className="space-y-4 p-5 sm:p-6">
                {billingProfileError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{billingProfileError}</div>}
                {billingProfileSaved && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">Billing profile saved.</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[{ value: 'personal', title: 'Personal', detail: 'For individual use' }, { value: 'business', title: 'Business', detail: 'For a company or organization' }].map(option => (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${billingAccountType === option.value ? 'border-[#696969] bg-[#f8f8f8] dark:bg-[#1f1f1f]' : 'border-[#dcdcdc] dark:border-[#3f3f3f]'}`}>
                      <input type="radio" name="billingAccountType" value={option.value} checked={billingAccountType === option.value} onChange={() => { setBillingAccountType(option.value); setBillingProfileError(''); }} className="mt-0.5 accent-[#696969]" />
                      <span><span className="block text-sm font-semibold text-[#212121] dark:text-white">{option.title}</span><span className="mt-1 block text-xs text-[#636363] dark:text-[#9f9f9f]">{option.detail}</span></span>
                    </label>
                  ))}
                </div>
                {billingAccountType === 'business' && <label className="block max-w-xl text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">Company name <span className="text-rose-500">*</span><input required maxLength={255} value={billingCompanyName} onChange={event => setBillingCompanyName(event.target.value)} placeholder="Registered company name" className={FORM_FIELD} /></label>}
                <div className="flex justify-end border-t border-[#f0f0f0] pt-4 dark:border-[#2d2d2d]">
                  <button type="submit" disabled={isSavingBillingProfile} className="rounded-full bg-[#696969] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#5c5c5c] disabled:cursor-wait disabled:opacity-60">{isSavingBillingProfile ? 'Saving…' : 'Save billing profile'}</button>
                </div>
              </form>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <section className="overflow-hidden rounded-2xl border border-[#eaeaea] bg-white dark:border-[#2d2d2d] dark:bg-[#1f1f1f]">
                <div className="flex flex-col gap-4 border-b border-[#f0f0f0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-[#2d2d2d]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#efefef] text-[#000000] dark:bg-[#000000]/20 dark:text-[#b0b0b0]"><MapPin className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1F1F1F] dark:text-white">Billing address</h3>
                      <p className="mt-0.5 text-xs text-[#636363] dark:text-[#9f9f9f]">Used for account billing and invoice contact details.</p>
                    </div>
                  </div>
                  {!isEditingBillingAddress && (
                    <button type="button" onClick={() => {
                      setBillingAddressForm({ ...account.billingAddress });
                      setBillingAddressError('');
                      setBillingAddressSaved(false);
                      setIsEditingBillingAddress(true);
                    }} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e1e1e1] px-4 py-2 text-xs font-semibold text-[#000000] transition hover:bg-[#f8f8f8] dark:border-[#3f3f3f] dark:text-[#b0b0b0] dark:hover:bg-[#2d2d2d]">
                      <Pencil className="h-3.5 w-3.5" /> Edit address
                    </button>
                  )}
                </div>

                <div className="p-5 sm:p-7">
                  {billingAddressError && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{billingAddressError}</div>}
                  {billingAddressSaved && <div role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4" /> Address saved to your account.</div>}

                  {isEditingBillingAddress ? (
                    <form onSubmit={handleSaveBillingAddress} className="space-y-4">
                      <label className="block text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">Street address <span className="text-rose-500">*</span>
                        <textarea required maxLength={2000} rows={3} value={billingAddressForm.address} onChange={event => setBillingAddressForm(current => ({ ...current, address: event.target.value }))} placeholder="House, road, area or building" className="mt-1.5 w-full resize-y rounded-2xl border border-[#dcdcdc] bg-white px-4 py-3 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#858585] focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white dark:focus:ring-[#494949]/40" />
                      </label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">City <span className="text-rose-500">*</span>
                          <input required maxLength={100} value={billingAddressForm.city} onChange={event => setBillingAddressForm(current => ({ ...current, city: event.target.value }))} placeholder="City" className="mt-1.5 w-full rounded-xl border border-[#dcdcdc] bg-white px-3.5 py-2.5 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#858585] focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white dark:focus:ring-[#494949]/40" />
                        </label>
                        <label className="block text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">Country <span className="text-rose-500">*</span>
                          <select required value={billingAddressForm.country} onChange={event => setBillingAddressForm(current => ({ ...current, country: event.target.value }))} className={FORM_FIELD}>
                            <option value="">Choose a country</option>
                            {billingAddressForm.country && !countryOptions.some(option => option.name === billingAddressForm.country) && <option value={billingAddressForm.country}>{billingAddressForm.country}</option>}
                            {countryOptions.map(option => <option key={option.code} value={option.name}>{option.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">Postal code
                          <input maxLength={32} value={billingAddressForm.postalCode} onChange={event => setBillingAddressForm(current => ({ ...current, postalCode: event.target.value }))} placeholder="Postal code" className="mt-1.5 w-full rounded-xl border border-[#dcdcdc] bg-white px-3.5 py-2.5 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#858585] focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white dark:focus:ring-[#494949]/40" />
                        </label>
                        <label className="block text-xs font-semibold text-[#3f3f3f] dark:text-[#C4C7C5]">Contact phone
                          <span className="mt-1.5 flex gap-2">
                            <select aria-label="Phone country calling code" value={phoneDialCode} onChange={event => setPhoneDialCode(event.target.value)} className="w-[42%] min-w-0 rounded-xl border border-[#dcdcdc] bg-white px-3 py-2.5 text-sm font-normal text-[#212121] outline-none focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white">
                              {[...new Map(COUNTRY_OPTIONS.map(option => [option.dial, option])).values()].map(option => <option key={option.dial} value={option.dial}>{option.dial} · {option.name}</option>)}
                            </select>
                            <input type="tel" maxLength={24} value={phoneNationalNumber} onChange={event => setPhoneNationalNumber(event.target.value)} placeholder="Phone number" className="min-w-0 flex-1 rounded-xl border border-[#dcdcdc] bg-white px-3.5 py-2.5 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#858585] focus:border-[#696969] focus:ring-2 focus:ring-[#e1e1e1] dark:border-[#3f3f3f] dark:bg-[#212121] dark:text-white dark:focus:ring-[#494949]/40" />
                          </span>
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#f0f0f0] pt-4 dark:border-[#2d2d2d]">
                        <button type="button" disabled={isSavingBillingAddress} onClick={() => {
                          setBillingAddressForm({ ...account.billingAddress });
                          setBillingAddressError('');
                          setIsEditingBillingAddress(false);
                        }} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-[#636363] transition hover:bg-[#F1F3F4] disabled:opacity-50 dark:text-[#C4C7C5] dark:hover:bg-[#2d2d2d]"><X className="h-4 w-4" /> Cancel</button>
                        <button type="submit" disabled={isSavingBillingAddress} className="inline-flex items-center gap-2 rounded-full bg-[#696969] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#5c5c5c] disabled:cursor-wait disabled:opacity-60">
                          <Save className="h-4 w-4" /> {isSavingBillingAddress ? 'Saving?' : 'Save address'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-2xl bg-[#fafafa] p-5 dark:bg-[#212121]">
                      {account.billingAddress?.address || account.billingAddress?.city || account.billingAddress?.country ? (
                        <div className="flex gap-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#696969]" />
                          <div className="space-y-1 text-sm text-[#3f3f3f] dark:text-[#E3E3E3]">
                            <p className="font-semibold text-[#212121] dark:text-white">{account.billingAddress.address}</p>
                            <p>{[account.billingAddress.city, account.billingAddress.postalCode].filter(Boolean).join(' ')}</p>
                            <p>{account.billingAddress.country}</p>
                            {account.billingAddress.phone && <p className="flex items-center gap-2 pt-2 text-xs text-[#636363] dark:text-[#9f9f9f]"><Phone className="h-3.5 w-3.5" />{account.billingAddress.phone}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="py-3 text-center">
                          <MapPin className="mx-auto h-6 w-6 text-[#858585]" />
                          <p className="mt-2 text-sm font-medium text-[#3f3f3f] dark:text-[#E3E3E3]">No billing address saved</p>
                          <p className="mt-1 text-xs text-[#636363] dark:text-[#9f9f9f]">Add the address from your account registration or update it here.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#eaeaea] bg-white p-5 sm:p-6 dark:border-[#2d2d2d] dark:bg-[#1f1f1f]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#efefef] text-[#000000] dark:bg-[#000000]/20 dark:text-[#b0b0b0]"><CreditCard className="h-4 w-4" /></div>
                    <div><h3 className="text-sm font-semibold text-[#212121] dark:text-white">Account details</h3><p className="text-[11px] text-[#636363] dark:text-[#9f9f9f]">Live account information</p></div>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3 border-b border-[#f2f2f2] pb-3 dark:border-[#2d2d2d]"><dt className="text-[#636363] dark:text-[#9f9f9f]">Account name</dt><dd className="max-w-[60%] text-right font-medium text-[#212121] dark:text-white">{billingAccountName}</dd></div>
                    <div className="flex items-start justify-between gap-3 border-b border-[#f2f2f2] pb-3 dark:border-[#2d2d2d]"><dt className="text-[#636363] dark:text-[#9f9f9f]">Account ID</dt><dd className="max-w-[60%] break-all text-right font-mono text-[10px] font-medium text-[#212121] dark:text-white">{billingAccountId}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-[#636363] dark:text-[#9f9f9f]">Currency</dt><dd className="font-medium text-[#212121] dark:text-white">{account.currency}</dd></div>
                  </dl>
                </div>
                <div className="rounded-3xl border border-[#eaeaea] bg-[#f8f8f8] p-5 dark:border-[#343434] dark:bg-[#1f1f1f]">
                  <h3 className="text-xs font-semibold text-[#1F1F1F] dark:text-white">Account contact</h3>
                  <p className="mt-1 break-all text-sm text-[#3f3f3f] dark:text-[#dcdcdc]">{currentUser?.email || 'Email unavailable'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#636363] dark:text-[#9f9f9f]">Your billing address is saved to your account profile and can be changed whenever your details change.</p>
                </div>
              </aside>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
