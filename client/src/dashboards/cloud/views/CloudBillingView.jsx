import React, { useEffect, useState } from 'react';
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
  Phone
} from 'lucide-react';
import { getCloudBillingData, redeemCloudVoucher, startCloudCreditCheckout } from '../graphql/cloudQueries';
import { COUNTRY_OPTIONS } from '../../../utils/accountFormOptions';

const FORM_FIELD = 'mt-1.5 w-full rounded-xl border border-[#DADCE0] bg-white px-3.5 py-2.5 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#80868B] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white dark:focus:ring-[#174EA6]/40';

export default function CloudBillingView({ currentUser, initialTab = 'overview', onBack, showToast }) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [copiedId, setCopiedId] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);
  const [creditTopupAmount, setCreditTopupAmount] = useState('25');
  const [startingCheckoutProvider, setStartingCheckoutProvider] = useState('');
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

  const loadBilling = async () => {
    if (!userId) {
      setBillingState({ userId: null, loading: false, account: null, error: 'Sign in to view your cloud billing account.' });
      return;
    }
    setBillingState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getCloudBillingData(userId);
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

  useEffect(() => {
    loadBilling();
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('cloud_credit_payment');
    if (!result) return;
    setActiveTab('credits');
    setCreditCheckoutNotice({
      success: 'Payment verified. Your cloud credits have been added.',
      pending: 'Payment is still being verified. Refresh billing in a moment.',
      cancelled: 'Checkout was cancelled. No credits were added.',
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
      <div className="min-h-screen bg-white dark:bg-[#131314] flex items-center justify-center text-sm text-[#5F6368] dark:text-[#9AA0A6]">
        Loading billing account…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#131314] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-[#EDF0F5] dark:border-[#2C2D31] p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-[#B06000]" />
          <h1 className="text-base font-semibold text-[#1F1F1F] dark:text-white">Billing unavailable</h1>
          <p className="mt-2 text-sm text-[#5F6368] dark:text-[#9AA0A6]">
            {billingState.error || 'Sign in to view your cloud billing account.'}
          </p>
          {userId && (
            <button
              type="button"
              onClick={loadBilling}
              className="mt-4 px-4 py-2 rounded-full bg-[#0B57D0] text-white text-sm font-medium"
            >
              Retry
            </button>
          )}
        </div>
      </div>
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
      showToast?.(`Voucher applied: ${formatMoney(Number(result.addedCredits))} added to your balance.`, 'success');
      await loadBilling();
    } catch (error) {
      showToast?.(error.message || 'Could not redeem voucher.', 'error');
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
        const accepted = window.confirm(
          `You will receive ${formatMoney(quote.creditAmount, 'USD')} Cloud credits and pay ${formatMoney(quote.paymentAmount, 'BDT')}.\n\n` +
          `Reference rate: 1 USD = ${Number(quote.exchangeRate).toFixed(4)} BDT (${quote.rateDate || 'latest available'}).\n` +
          `${quote.rateSource || 'Market reference rate'}; your bank or gateway may apply its own fees or rate. Continue?`
        );
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
    <div className="min-h-screen bg-white dark:bg-[#131314] text-[#1F1F1F] dark:text-[#E3E3E3] font-sans antialiased pb-20 select-none transition-colors duration-200">
      
      {/* Top Clean Console Bar (Google Cloud & Apple macOS Flat Clean Header) */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#1E1F22] border-b border-[#EDF0F5] dark:border-[#2C2D31] px-4 sm:px-8 py-3.5 transition-colors">
        <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Breadcrumb & Platform Identifier */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] dark:hover:bg-[#383A3F] text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
                title="Back to Cloud Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-[#5F6368] dark:text-[#9AA0A6]">
                <span>Tiwlo Cloud</span>
                <span className="text-[#C4C7C5] dark:text-[#444746]">/</span>
                <span className="text-[#0B57D0] dark:text-[#8AB4F8]">Billing</span>
              </div>
              <div className="flex items-center gap-2.5 mt-0.5">
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[#1F1F1F] dark:text-white">
                  {billingAccountName}
                </h1>
                
                {/* Clean Status Chip */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                  hasConfiguredGateway
                    ? 'bg-[#E6F4EA] text-[#137333] dark:bg-[#137333]/20 dark:text-[#81C995]'
                    : 'bg-[#FEF7E0] text-[#B06000] dark:bg-[#B06000]/20 dark:text-[#FDD663]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasConfiguredGateway ? 'bg-[#188038]' : 'bg-[#F29900]'}`} />
                  <span>{hasConfiguredGateway ? 'Gateway configured' : 'Unconfigured'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Account ID & Action Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-center">
            {/* Account ID Pill with 1-Click Copy */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0F4F9] dark:bg-[#2C2D31] border border-[#E0E2EC] dark:border-[#3C4043] text-xs font-mono text-[#444746] dark:text-[#C4C7C5]">
              <span className="text-[10px] font-sans font-medium text-[#5F6368] dark:text-[#9AA0A6]">ID:</span>
              <span>{billingAccountId}</span>
              <button
                type="button"
                onClick={copyAccountId}
                className="ml-1 p-0.5 hover:text-[#0B57D0] dark:hover:text-[#8AB4F8] transition cursor-pointer"
                title="Copy Billing ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#188038]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadBilling}
              disabled={loading}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] dark:hover:bg-[#383A3F] border border-[#E0E2EC] dark:border-[#3C4043] text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer disabled:opacity-50"
              title="Refresh Billing Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Clean Google Material 3 / macOS Segmented Pill Switcher */}
        <div className="max-w-[1500px] mx-auto mt-3.5 pt-2 border-t border-[#EDF0F5] dark:border-[#2C2D31]">
          <div className="flex items-center overflow-x-auto scrollbar-none py-1">
            <div className="inline-flex p-1 bg-[#F0F4F9] dark:bg-[#2C2D31] rounded-full border border-[#E0E2EC] dark:border-[#3C4043] gap-1 shrink-0">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-150 select-none cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E1F22] text-[#0B57D0] dark:text-[#8AB4F8] font-semibold'
                        : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F] dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1500px] mx-auto px-4 sm:px-8 mt-6">
        
        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW (Pure Crisp White, Clean Google Material) */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top Stat Cards — PURE WHITE SURFACES (No dark/blackish tints!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Card 1: Available Credit Balance */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <span className="font-medium">Available Balance</span>
                  <div className="w-7 h-7 rounded-full bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                {/* Clean Currency Display */}
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                    {credits === null ? 'Unavailable' : formatMoney(credits)}
                  </span>
                  <span className="text-[11px] font-medium text-[#0B57D0] dark:text-[#8AB4F8] ml-1 bg-[#E8F0FE] dark:bg-[#0B57D0]/20 px-2 py-0.5 rounded-full">
                    {account.currency}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F2F5] dark:border-[#2C2D31] flex items-center justify-between text-xs">
                  <span className="text-[#5F6368] dark:text-[#9AA0A6]">
                    Promo: <span className="font-medium text-[#1F1F1F] dark:text-white">{promotionalCredits === null ? 'Unavailable' : formatMoney(promotionalCredits)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credits')}
                    className="text-xs font-semibold text-[#0B57D0] dark:text-[#8AB4F8] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Add Funds</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card 2: Current Month Incurred Spend */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <span className="font-medium">Current Month Spend</span>
                  <div className="w-7 h-7 rounded-full bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                    {formatMoney(account?.monthToDateSpent)}
                  </span>
                  <span className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6] ml-1">
                    {account.currency}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F2F5] dark:border-[#2C2D31] flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <span>Billing Period</span>
                  <span className="inline-flex items-center gap-1 text-[#137333] dark:text-[#81C995] font-medium">
                    <span>{account?.usageMeteringEnabled ? 'Metering active' : 'Metering unavailable'}</span>
                  </span>
                </div>
              </div>

              {/* Card 3: Projected Spend */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <span className="font-medium">Forecasted Month End</span>
                  <div className="w-7 h-7 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                    {formatMoney(account?.projectedCost)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F2F5] dark:border-[#2C2D31] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  {Number.isFinite(account?.projectedCost) ? 'Estimated usage forecast' : 'Usage forecasting is not connected'}
                </div>
              </div>

              {/* Card 4: Active Workloads */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <span className="font-medium">Cloud Droplets</span>
                  <div className="w-7 h-7 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                    <Server className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                    {account?.droplets?.length || 0}
                  </span>
                  <span className="text-xs font-normal text-[#5F6368] dark:text-[#9AA0A6] ml-1">
                    droplets in this account
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F2F5] dark:border-[#2C2D31] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  Registered cloud droplets
                </div>
              </div>

            </div>

            {/* Quick Actions Bar (Pure White Google Material Style) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#5F6368] dark:text-[#9AA0A6] uppercase tracking-wider">
                  Quick Actions:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('credits')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-medium transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Top-up Credits</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payment-methods')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] text-[#0B57D0] dark:text-[#8AB4F8] text-xs font-medium transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Payment Methods</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cost-breakdown')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] text-[#444746] dark:text-[#C4C7C5] text-xs font-medium transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Budget & Spending Alerts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] text-[#444746] dark:text-[#C4C7C5] text-xs font-medium transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Invoices</span>
                </button>
              </div>
            </div>

            {/* User-Perspective Status Card (NO "Configure in Admin" wording!) */}
            {!hasConfiguredGateway && (
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FEEFC3] dark:bg-[#B06000]/30 text-[#B06000] dark:text-[#FDD663] flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#B06000] dark:text-[#FDD663]">
                        No platform payment gateway configured
                      </h3>
                      <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5 max-w-2xl leading-relaxed">
                        No platform payment gateway is configured. Cloud credit checkout is also not connected.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment-methods')}
                    className="shrink-0 px-4 py-2 rounded-full bg-white dark:bg-[#1E1F22] border border-[#E0E2EC] dark:border-[#3C4043] text-[#0B57D0] dark:text-[#8AB4F8] hover:bg-[#F8FAFD] text-xs font-semibold transition cursor-pointer"
                  >
                    View Payment Options &gt;
                  </button>
                </div>
              </div>
            )}

            {/* Middle Section: Usage by Service + Payment Gateways Callout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left 8 Cols: Usage by Services (Pure White Surface) */}
              <div className="lg:col-span-8 p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                      Usage by Cloud Services
                    </h2>
                    <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                      Current billing period resource consumption.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cost-breakdown')}
                    className="text-xs font-medium text-[#0B57D0] dark:text-[#8AB4F8] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Detailed Breakdown</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-[#F0F2F5] dark:divide-[#2C2D31]">
                  {costServices.length ? costServices.map((service) => (
                    <div key={service.service} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <p className="font-semibold text-[#1F1F1F] dark:text-white truncate">{service.service}</p>
                      </div>
                      <span className="font-semibold text-[#1F1F1F] dark:text-white text-sm">
                        {formatMoney(Number(service.amount))}
                      </span>
                    </div>
                  )) : (
                    <p className="py-6 text-center text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                      Usage metering is not connected. No service charges are reported.
                    </p>
                  )}
                </div>
              </div>

              {/* Right 4 Cols: Payment Channels & Account Summary (Pure White) */}
              <div className="lg:col-span-4 space-y-5">
                
                {/* Payment Gateway Status Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#0B57D0]" />
                      <span>Payment Channels</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('payment-methods')}
                      className="text-xs font-medium text-[#0B57D0] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>

                  {creditCheckoutGateways.length > 0 ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-[#E6F4EA] text-xs">
                        <div className="flex items-center gap-2 text-[#137333] font-semibold mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                    <span>Credit checkout ready</span>
                        </div>
                        <p className="text-[11px] text-[#137333]/90">
                          {creditCheckoutGateways.map(gateway => gateway.name).join(' and ')} can securely process Cloud credit top-ups.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {creditCheckoutGateways.map(gw => (
                          <div key={gw.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs">
                            <span className="font-semibold text-[#1F1F1F] dark:text-white">{gw.name}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white dark:bg-[#1E1F22] text-[#5F6368] dark:text-[#9AA0A6] border border-[#E0E2EC] dark:border-[#3C4043]">
                              {gw.mode}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('credits')}
                        className="w-full mt-2 py-2 px-4 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-medium transition cursor-pointer"
                      >
                        Top-up Cloud Credits
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FEF7E0] dark:bg-[#B06000]/15 space-y-2.5">
                      <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>Payment Gateway Required</span>
                      </div>
                      <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                      No live USD checkout method is currently enabled. Contact billing support to enable live Stripe or PayPal.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payment-methods')}
                        className="text-xs font-semibold text-[#0B57D0] dark:text-[#8AB4F8] hover:underline block pt-1"
                      >
                        Configure Payment Methods &gt;
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Details Quick Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31] text-xs space-y-3">
                  <h4 className="font-semibold text-[#1F1F1F] dark:text-white">Account Details</h4>
                  <div className="flex justify-between py-1.5 border-b border-[#F0F2F5] dark:border-[#2C2D31]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Account Type</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">Cloud</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F0F2F5] dark:border-[#2C2D31]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Currency</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">{account.currency}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F0F2F5] dark:border-[#2C2D31]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Billing Owner</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white truncate max-w-[150px]">{currentUser?.email || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Account owner</span>
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
            
            {/* Balance Card — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#0B57D0] text-xs font-semibold mb-2">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Account Credit Balance</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl sm:text-4xl font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                      {credits === null ? 'Unavailable' : formatMoney(credits)}
                    </span>
                    <span className="text-xs font-normal text-[#5F6368] dark:text-[#9AA0A6] ml-2">
                      Available Cloud Credits
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-1.5 max-w-xl">
                    Cloud usage metering is not connected, so this balance will not be deducted automatically.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs space-y-1.5 sm:text-right shrink-0">
                  <div className="text-[#5F6368] dark:text-[#9AA0A6]">Currency: <span className="font-semibold text-[#1F1F1F] dark:text-white">{account.currency}</span></div>
                  <div className="text-[#5F6368] dark:text-[#9AA0A6]">Promotional balance: <span className="font-semibold text-[#1F1F1F] dark:text-white">{promotionalCredits === null ? 'Unavailable' : formatMoney(promotionalCredits)}</span></div>
                </div>
              </div>
            </div>

            {/* Purchase Credits Box — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31] space-y-6">
              <div>
                <h3 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                  Add Cloud Credits
                </h3>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
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
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6]">
                    Top-up amount (USD, minimum $5)
                    <input
                      type="number"
                      min="5"
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
                        className="inline-flex items-center gap-2 rounded-full bg-[#1A73E8] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1558B0] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Lock className="h-4 w-4" />
                        {startingCheckoutProvider === gateway.id ? 'Opening secure checkout…' : `Pay with ${gateway.name}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                    Your balance stays in USD. {hasBdtCheckout ? 'bKash and SSLCOMMERZ charge the converted BDT amount using the latest available reference rate. ' : ''}Credits are added only after the provider confirms payment.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30">
                  <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-sm font-semibold">
                    <Lock className="w-5 h-5 shrink-0" />
                    <span>Credit checkout is not configured</span>
                  </div>
                  <p className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                    Enable a live Stripe or PayPal gateway for USD, or a live bKash or SSLCOMMERZ gateway for BDT. Test-mode payments cannot add credits. Nagad direct checkout is not connected yet.
                  </p>
                </div>
              )}
            </div>

            {/* Promo Voucher Box — PURE WHITE */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0B57D0]" />
                <span>Redeem Cloud Voucher</span>
              </h3>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-3">
                Enter a valid unused voucher to add its recorded amount to this account.
              </p>
              <form onSubmit={handleRedeemVoucher} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(event) => setVoucherCode(event.target.value)}
                  maxLength={64}
                  autoComplete="off"
                  placeholder="Voucher code"
                  className="flex-1 px-4 py-2 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono outline-none focus:border-[#0B57D0] uppercase"
                />
                <button
                  type="submit"
                  disabled={isRedeemingVoucher || !voucherCode.trim()}
                  className="px-5 py-2 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-medium disabled:opacity-40 transition cursor-pointer"
                >
                  {isRedeemingVoucher ? 'Redeeming…' : 'Redeem'}
                </button>
              </form>
            </div>

            {/* Credit Transaction Ledger — PURE WHITE */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white mb-4">
                Credit Ledger History
              </h3>
              {Array.isArray(account.invoices) && account.invoices.length ? (
                <div className="divide-y divide-[#F0F2F5] dark:divide-[#2C2D31]">
                  {account.invoices.map(invoice => (
                    <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                      <div>
                        <p className="font-medium text-[#202124] dark:text-white">{invoice.description || 'Cloud credit transaction'}</p>
                        <p className="mt-1 text-[#5F6368] dark:text-[#9AA0A6]">{new Date(invoice.createdAt).toLocaleString()} · {invoice.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#202124] dark:text-white">{formatMoney(Number(invoice.amount), invoice.currency)}</p>
                        <p className={invoice.status === 'Paid' || invoice.status === 'Verified' ? 'text-[#137333]' : 'text-[#B06000]'}>{invoice.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
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
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white mb-1">
                Connected Payment Methods & Gateways
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-6">
                Platform gateway credentials configured for cloud billing.
              </p>

              {hasConfiguredGateway ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {configuredGateways.map(gw => (
                    <div key={gw.id} className="p-4 rounded-xl border border-[#EDF0F5] dark:border-[#2C2D31] bg-[#F8FAFD] dark:bg-[#2C2D31] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0B57D0] text-white font-semibold flex items-center justify-center text-xs">
                          {gw.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#1F1F1F] dark:text-white">{gw.name}</div>
                          <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
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
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                    A platform payment gateway is not configured. Enable live Stripe/PayPal for USD or bKash/SSLCOMMERZ for BDT credit purchases.
                  </p>
                  <div>
                    <a
                      href="/administrator"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B57D0] dark:text-[#8AB4F8] hover:underline"
                    >
                      <span>Open Platform Gateways Management</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
              {hasConfiguredGateway && creditCheckoutGateways.length === 0 && (
                <p className="mt-4 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  Configured channels are visible above. Cloud credit checkout requires a live Stripe/PayPal USD channel or a live bKash/SSLCOMMERZ BDT channel. Nagad direct checkout is not connected yet.
                </p>
              )}
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white">Auto-recharge unavailable</h3>
              <p className="mt-1 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
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
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                    Cost Breakdown by Cloud Service
                  </h2>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                    Granular metering breakdown of compute, network, and storage.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] px-3.5 py-1.5 rounded-full bg-[#F0F4F9] dark:bg-[#2C2D31] border border-[#E0E2EC] dark:border-[#3C4043]">
                  Billing Period: Current Month
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EDF0F5] dark:border-[#2C2D31] text-[#5F6368] dark:text-[#9AA0A6] uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Usage Metric</th>
                      <th className="py-3 px-3">Rate Model</th>
                      <th className="py-3 px-3 text-right">Incurred Cost ({account.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#2C2D31]">
                    {costServices.length ? costServices.map((service) => (
                      <tr key={service.service} className="hover:bg-[#F8FAFD] dark:hover:bg-[#2C2D31]/40">
                        <td className="py-3.5 px-3 font-semibold text-[#1F1F1F] dark:text-white">{service.service}</td>
                        <td className="py-3.5 px-3 text-[#5F6368] dark:text-[#9AA0A6]">{service.percentage}% of recorded usage</td>
                        <td className="py-3.5 px-3 text-[#5F6368]">{account.currency}</td>
                        <td className="py-3.5 px-3 text-right font-semibold text-[#1F1F1F] dark:text-white">{formatMoney(Number(service.amount))}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-8 px-3 text-center text-[#5F6368] dark:text-[#9AA0A6]">
                          Usage metering is not connected. No service costs are available.
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-[#EDF0F5] dark:border-[#2C2D31] font-semibold">
                      <td className="py-4 px-3 text-sm text-[#1F1F1F] dark:text-white">Total Incurred Cost</td>
                      <td className="py-4 px-3" colSpan={2}></td>
                      <td className="py-4 px-3 text-right text-sm text-[#0B57D0] dark:text-[#8AB4F8]">{formatMoney(account?.monthToDateSpent)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cloud Spending Budget & Alert Thresholds — PURE WHITE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <h3 className="text-sm font-semibold text-[#1F1F1F] dark:text-white">Budget alerts unavailable</h3>
              <p className="mt-1 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
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
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                    Invoices & Billing Documents
                  </h2>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                    Invoices recorded for this billing account.
                  </p>
                </div>
              </div>

              {account?.invoices && account.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#EDF0F5] dark:border-[#2C2D31] text-[#5F6368] dark:text-[#9AA0A6] uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3 px-3">Document ID</th>
                        <th className="py-3 px-3">Description</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F2F5] dark:divide-[#2C2D31]">
                      {account.invoices.map(inv => (
                        <tr key={inv.id}>
                          <td className="py-3.5 px-3 font-mono font-medium">{inv.id}</td>
                          <td className="py-3.5 px-3">{inv.description || '—'}</td>
                          <td className="py-3.5 px-3 text-[#5F6368]">{inv.createdAt}</td>
                          <td className="py-3.5 px-3 font-semibold">{formatMoney(inv.amount, inv.currency)}</td>
                          <td className="py-3.5 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${inv.status?.toLowerCase() === 'paid' ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                              {inv.status || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0B57D0]" />
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B57D0] dark:text-[#8AB4F8]">Account</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-white">Billing account settings</h2>
                <p className="mt-1 text-sm text-[#5F6368] dark:text-[#9AA0A6]">Manage the real contact and address details attached to your billing account.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#DCE7F8] bg-[#F5F8FE] px-3 py-1.5 text-xs font-medium text-[#345B9A] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#BFDBFE]">
                <span className="h-2 w-2 rounded-full bg-[#188038]" /> Account loaded
              </span>
            </div>

            <section className="rounded-2xl border border-[#E5EAF2] bg-white dark:border-[#2C2D31] dark:bg-[#1E1F22]">
              <div className="border-b border-[#EDF0F5] px-5 py-4 sm:px-6 dark:border-[#2C2D31]">
                <h3 className="text-base font-semibold text-[#202124] dark:text-white">Billing profile</h3>
                <p className="mt-1 text-sm text-[#5F6368] dark:text-[#9AA0A6]">Choose how your billing details appear on invoices.</p>
              </div>
              <form onSubmit={handleSaveBillingProfile} className="space-y-4 p-5 sm:p-6">
                {billingProfileError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{billingProfileError}</div>}
                {billingProfileSaved && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">Billing profile saved.</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  {[{ value: 'personal', title: 'Personal', detail: 'For individual use' }, { value: 'business', title: 'Business', detail: 'For a company or organization' }].map(option => (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${billingAccountType === option.value ? 'border-[#1A73E8] bg-[#F5F8FE] dark:bg-[#172033]' : 'border-[#DADCE0] dark:border-[#3C4043]'}`}>
                      <input type="radio" name="billingAccountType" value={option.value} checked={billingAccountType === option.value} onChange={() => { setBillingAccountType(option.value); setBillingProfileError(''); }} className="mt-0.5 accent-[#1A73E8]" />
                      <span><span className="block text-sm font-semibold text-[#202124] dark:text-white">{option.title}</span><span className="mt-1 block text-xs text-[#5F6368] dark:text-[#9AA0A6]">{option.detail}</span></span>
                    </label>
                  ))}
                </div>
                {billingAccountType === 'business' && <label className="block max-w-xl text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">Company name <span className="text-rose-500">*</span><input required maxLength={255} value={billingCompanyName} onChange={event => setBillingCompanyName(event.target.value)} placeholder="Registered company name" className={FORM_FIELD} /></label>}
                <div className="flex justify-end border-t border-[#EDF0F5] pt-4 dark:border-[#2C2D31]">
                  <button type="submit" disabled={isSavingBillingProfile} className="rounded-full bg-[#1A73E8] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1765CC] disabled:cursor-wait disabled:opacity-60">{isSavingBillingProfile ? 'Saving…' : 'Save billing profile'}</button>
                </div>
              </form>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
              <section className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-white dark:border-[#2C2D31] dark:bg-[#1E1F22]">
                <div className="flex flex-col gap-4 border-b border-[#EDF0F5] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-[#2C2D31]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#0B57D0]/20 dark:text-[#8AB4F8]"><MapPin className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1F1F1F] dark:text-white">Billing address</h3>
                      <p className="mt-0.5 text-xs text-[#5F6368] dark:text-[#9AA0A6]">Used for account billing and invoice contact details.</p>
                    </div>
                  </div>
                  {!isEditingBillingAddress && (
                    <button type="button" onClick={() => {
                      setBillingAddressForm({ ...account.billingAddress });
                      setBillingAddressError('');
                      setBillingAddressSaved(false);
                      setIsEditingBillingAddress(true);
                    }} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D8E2F1] px-4 py-2 text-xs font-semibold text-[#0B57D0] transition hover:bg-[#F5F8FE] dark:border-[#3C4043] dark:text-[#8AB4F8] dark:hover:bg-[#2C2D31]">
                      <Pencil className="h-3.5 w-3.5" /> Edit address
                    </button>
                  )}
                </div>

                <div className="p-5 sm:p-7">
                  {billingAddressError && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{billingAddressError}</div>}
                  {billingAddressSaved && <div role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="h-4 w-4" /> Address saved to your account.</div>}

                  {isEditingBillingAddress ? (
                    <form onSubmit={handleSaveBillingAddress} className="space-y-4">
                      <label className="block text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">Street address <span className="text-rose-500">*</span>
                        <textarea required maxLength={2000} rows={3} value={billingAddressForm.address} onChange={event => setBillingAddressForm(current => ({ ...current, address: event.target.value }))} placeholder="House, road, area or building" className="mt-1.5 w-full resize-y rounded-2xl border border-[#DADCE0] bg-white px-4 py-3 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#80868B] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white dark:focus:ring-[#174EA6]/40" />
                      </label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">City <span className="text-rose-500">*</span>
                          <input required maxLength={100} value={billingAddressForm.city} onChange={event => setBillingAddressForm(current => ({ ...current, city: event.target.value }))} placeholder="City" className="mt-1.5 w-full rounded-xl border border-[#DADCE0] bg-white px-3.5 py-2.5 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#80868B] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white dark:focus:ring-[#174EA6]/40" />
                        </label>
                        <label className="block text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">Country <span className="text-rose-500">*</span>
                          <select required value={billingAddressForm.country} onChange={event => setBillingAddressForm(current => ({ ...current, country: event.target.value }))} className={FORM_FIELD}>
                            <option value="">Choose a country</option>
                            {billingAddressForm.country && !countryOptions.some(option => option.name === billingAddressForm.country) && <option value={billingAddressForm.country}>{billingAddressForm.country}</option>}
                            {countryOptions.map(option => <option key={option.code} value={option.name}>{option.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">Postal code
                          <input maxLength={32} value={billingAddressForm.postalCode} onChange={event => setBillingAddressForm(current => ({ ...current, postalCode: event.target.value }))} placeholder="Postal code" className="mt-1.5 w-full rounded-xl border border-[#DADCE0] bg-white px-3.5 py-2.5 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#80868B] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white dark:focus:ring-[#174EA6]/40" />
                        </label>
                        <label className="block text-xs font-semibold text-[#3C4043] dark:text-[#C4C7C5]">Contact phone
                          <span className="mt-1.5 flex gap-2">
                            <select aria-label="Phone country calling code" value={phoneDialCode} onChange={event => setPhoneDialCode(event.target.value)} className="w-[42%] min-w-0 rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-normal text-[#202124] outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white">
                              {[...new Map(COUNTRY_OPTIONS.map(option => [option.dial, option])).values()].map(option => <option key={option.dial} value={option.dial}>{option.dial} · {option.name}</option>)}
                            </select>
                            <input type="tel" maxLength={24} value={phoneNationalNumber} onChange={event => setPhoneNationalNumber(event.target.value)} placeholder="Phone number" className="min-w-0 flex-1 rounded-xl border border-[#DADCE0] bg-white px-3.5 py-2.5 text-sm font-normal text-[#202124] outline-none transition placeholder:text-[#80868B] focus:border-[#1A73E8] focus:ring-2 focus:ring-[#D2E3FC] dark:border-[#3C4043] dark:bg-[#202124] dark:text-white dark:focus:ring-[#174EA6]/40" />
                          </span>
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EDF0F5] pt-4 dark:border-[#2C2D31]">
                        <button type="button" disabled={isSavingBillingAddress} onClick={() => {
                          setBillingAddressForm({ ...account.billingAddress });
                          setBillingAddressError('');
                          setIsEditingBillingAddress(false);
                        }} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-[#5F6368] transition hover:bg-[#F1F3F4] disabled:opacity-50 dark:text-[#C4C7C5] dark:hover:bg-[#2C2D31]"><X className="h-4 w-4" /> Cancel</button>
                        <button type="submit" disabled={isSavingBillingAddress} className="inline-flex items-center gap-2 rounded-full bg-[#1A73E8] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1765CC] disabled:cursor-wait disabled:opacity-60">
                          <Save className="h-4 w-4" /> {isSavingBillingAddress ? 'Saving?' : 'Save address'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-2xl bg-[#F8FAFD] p-5 dark:bg-[#202124]">
                      {account.billingAddress?.address || account.billingAddress?.city || account.billingAddress?.country ? (
                        <div className="flex gap-3">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1A73E8]" />
                          <div className="space-y-1 text-sm text-[#3C4043] dark:text-[#E3E3E3]">
                            <p className="font-semibold text-[#202124] dark:text-white">{account.billingAddress.address}</p>
                            <p>{[account.billingAddress.city, account.billingAddress.postalCode].filter(Boolean).join(' ')}</p>
                            <p>{account.billingAddress.country}</p>
                            {account.billingAddress.phone && <p className="flex items-center gap-2 pt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]"><Phone className="h-3.5 w-3.5" />{account.billingAddress.phone}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="py-3 text-center">
                          <MapPin className="mx-auto h-6 w-6 text-[#80868B]" />
                          <p className="mt-2 text-sm font-medium text-[#3C4043] dark:text-[#E3E3E3]">No billing address saved</p>
                          <p className="mt-1 text-xs text-[#5F6368] dark:text-[#9AA0A6]">Add the address from your account registration or update it here.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-[#E5EAF2] bg-white p-5 sm:p-6 dark:border-[#2C2D31] dark:bg-[#1E1F22]">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F0FE] text-[#0B57D0] dark:bg-[#0B57D0]/20 dark:text-[#8AB4F8]"><CreditCard className="h-4 w-4" /></div>
                    <div><h3 className="text-sm font-semibold text-[#202124] dark:text-white">Account details</h3><p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Live account information</p></div>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3 border-b border-[#F0F2F5] pb-3 dark:border-[#2C2D31]"><dt className="text-[#5F6368] dark:text-[#9AA0A6]">Account name</dt><dd className="max-w-[60%] text-right font-medium text-[#202124] dark:text-white">{billingAccountName}</dd></div>
                    <div className="flex items-start justify-between gap-3 border-b border-[#F0F2F5] pb-3 dark:border-[#2C2D31]"><dt className="text-[#5F6368] dark:text-[#9AA0A6]">Account ID</dt><dd className="max-w-[60%] break-all text-right font-mono text-[10px] font-medium text-[#202124] dark:text-white">{billingAccountId}</dd></div>
                    <div className="flex items-center justify-between gap-3"><dt className="text-[#5F6368] dark:text-[#9AA0A6]">Currency</dt><dd className="font-medium text-[#202124] dark:text-white">{account.currency}</dd></div>
                  </dl>
                </div>
                <div className="rounded-3xl border border-[#E5EAF2] bg-[#F5F8FE] p-5 dark:border-[#26364E] dark:bg-[#172033]">
                  <h3 className="text-xs font-semibold text-[#1F1F1F] dark:text-white">Account contact</h3>
                  <p className="mt-1 break-all text-sm text-[#3C4043] dark:text-[#DADCE0]">{currentUser?.email || 'Email unavailable'}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#5F6368] dark:text-[#9AA0A6]">Your billing address is saved to your account profile and can be changed whenever your details change.</p>
                </div>
              </aside>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
