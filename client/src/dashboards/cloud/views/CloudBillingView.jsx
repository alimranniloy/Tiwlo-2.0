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
  Plus
} from 'lucide-react';
import { getCloudBillingData, redeemCloudVoucher } from '../graphql/cloudQueries';

export default function CloudBillingView({ currentUser, initialTab = 'overview', onBack, showToast }) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [copiedId, setCopiedId] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeemingVoucher, setIsRedeemingVoucher] = useState(false);

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

  const hasCurrentUserData = billingState.userId === userId;
  const account = hasCurrentUserData ? billingState.account : null;
  const loading = !hasCurrentUserData || billingState.loading;

  const credits = Number.isFinite(account?.credits) && account.credits >= 0 ? account.credits : null;
  const promotionalCredits = Number.isFinite(account?.promotionalCredits) ? account.promotionalCredits : null;
  const hasConfiguredGateway = account?.hasConfiguredGateway === true;
  const configuredGateways = Array.isArray(account?.configuredGateways) ? account.configuredGateways : [];
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
                        ? 'bg-white dark:bg-[#1E1F22] text-[#0B57D0] dark:text-[#8AB4F8] shadow-2xs font-semibold'
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

                  {hasConfiguredGateway ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-[#E6F4EA] text-xs">
                        <div className="flex items-center gap-2 text-[#137333] font-semibold mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                    <span>Payment Gateway Configured</span>
                        </div>
                        <p className="text-[11px] text-[#137333]/90">
                          {configuredGateways.length} platform gateway(s) have credentials. Cloud checkout is not connected.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {configuredGateways.map(gw => (
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
                        Cloud checkout is not connected, and no platform payment gateway is configured.
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
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Ledger Status</span>
                    <span className="font-medium text-[#1F1F1F] dark:text-white">PostgreSQL connected</span>
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
                    <span>PostgreSQL Billing Balance</span>
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

              <div className="p-5 rounded-xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30">
                <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-sm font-semibold">
                  <Lock className="w-5 h-5 shrink-0" />
                  <span>Credit checkout unavailable</span>
                </div>
                <p className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                  Payment gateways may be configured, but cloud credit checkout is not connected. No payment will be submitted and no credits will be added.
                </p>
              </div>
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
              <div className="py-10 text-center rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                No credit transactions are available in the ledger.
              </div>
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
                    A platform payment gateway is not configured. Cloud credit checkout remains unavailable even when gateway credentials are configured.
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
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31] space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[#1F1F1F] dark:text-white">
                  Billing Account Preferences
                </h2>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Manage account ownership, currency preferences, and ledger configurations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl text-xs">
                <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] border border-[#EDF0F5] dark:border-[#383A3F]">
                  <label className="block text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Billing Account ID
                  </label>
                  <div className="font-mono font-medium text-[#1F1F1F] dark:text-white">
                    {billingAccountId}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] border border-[#EDF0F5] dark:border-[#383A3F]">
                  <label className="block text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Billing Account Name
                  </label>
                  <div className="font-medium text-[#1F1F1F] dark:text-white">
                    {billingAccountName}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] border border-[#EDF0F5] dark:border-[#383A3F]">
                  <label className="block text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Operating Currency
                  </label>
                  <div className="font-medium text-[#1F1F1F] dark:text-white">
                    {account.currency}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFD] dark:bg-[#2C2D31] border border-[#EDF0F5] dark:border-[#383A3F]">
                  <label className="block text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Platform Gateway Credentials
                  </label>
                  <div className="font-medium flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${hasConfiguredGateway ? 'bg-[#188038]' : 'bg-[#F29900]'}`} />
                    <span className={hasConfiguredGateway ? 'text-[#137333] dark:text-[#81C995]' : 'text-[#B06000] dark:text-[#FDD663]'}>
                      {hasConfiguredGateway ? 'Credentials configured' : 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
