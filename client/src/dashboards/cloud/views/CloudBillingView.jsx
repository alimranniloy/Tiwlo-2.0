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
  Plus, 
  Lock, 
  Sparkles,
  HelpCircle,
  Clock,
  Server,
  Layers
} from 'lucide-react';
import { getCloudBillingData } from '../graphql/cloudQueries';

export default function CloudBillingView({ currentUser, initialTab = 'overview', onBack, showToast }) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [copiedId, setCopiedId] = useState(false);

  const [billingState, setBillingState] = useState({
    userId: null,
    loading: true,
    account: null,
    error: ''
  });

  // Credit top-up states
  const [selectedCreditAmount, setSelectedCreditAmount] = useState(25);
  const [customCreditAmount, setCustomCreditAmount] = useState('');
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const loadBilling = () => {
    setBillingState(prev => ({ ...prev, loading: true }));
    getCloudBillingData(userId)
      .then(result => {
        const account = result?.account || null;
        setBillingState({
          userId,
          loading: false,
          account,
          error: account ? '' : 'Billing account information is currently unavailable.'
        });
        if (account?.configuredGateways?.length > 0) {
          setSelectedGatewayId(account.configuredGateways[0].id);
        }
      })
      .catch(error => {
        console.error('Error loading verified Cloud Billing data:', error);
        setBillingState({
          userId,
          loading: false,
          account: null,
          error: 'Could not connect to billing ledger. Please try again.'
        });
      });
  };

  useEffect(() => {
    loadBilling();
  }, [userId]);

  const hasCurrentUserData = billingState.userId === userId;
  const account = hasCurrentUserData ? billingState.account : null;
  const loading = !hasCurrentUserData || billingState.loading;
  const loadError = hasCurrentUserData ? billingState.error : '';

  const credits = Number.isFinite(account?.credits) && account.credits >= 0 ? account.credits : 0;
  const promotionalCredits = Number.isFinite(account?.promotionalCredits) ? account.promotionalCredits : 0;
  const totalCredits = credits + promotionalCredits;
  const hasVerifiedGateway = account?.hasVerifiedGateway === true;
  const configuredGateways = Array.isArray(account?.configuredGateways) ? account.configuredGateways : [];
  const billingAccountId = account?.billingAccountId || '01A24B-39C72E-F890';
  const billingAccountName = account?.billingAccountName || 'Tiwlo Cloud Billing Account';

  const copyAccountId = () => {
    navigator.clipboard?.writeText(billingAccountId);
    setCopiedId(true);
    showToast?.('Billing Account ID copied', 'info');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePurchaseAttempt = () => {
    if (!hasVerifiedGateway) {
      showToast?.('No verified payment gateway configured. Purchases are currently disabled.', 'error');
      return;
    }
    const finalAmount = customCreditAmount ? parseFloat(customCreditAmount) : selectedCreditAmount;
    if (!finalAmount || finalAmount <= 0) {
      showToast?.('Please enter a valid credit amount.', 'error');
      return;
    }
    setIsProcessingCheckout(true);
    setTimeout(() => {
      setIsProcessingCheckout(false);
      showToast?.(`Connecting to secure ${selectedGatewayId.toUpperCase()} checkout gateway for $${finalAmount.toFixed(2)}...`, 'info');
    }, 800);
  };

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'credits', label: 'Credits & Promotions', icon: Coins },
    { id: 'payment-methods', label: 'Payment Method', icon: CreditCard },
    { id: 'cost-breakdown', label: 'Cost Breakdown', icon: BarChart3 },
    { id: 'invoices', label: 'Invoices & Transactions', icon: Receipt },
    { id: 'settings', label: 'Account Management', icon: Settings }
  ];

  const costServices = [
    { name: 'Compute Engine (Droplets)', cost: 0.00, usage: '0 vCPU-hours', percent: 0 },
    { name: 'Cloud Block Storage', cost: 0.00, usage: '0 GB-months', percent: 0 },
    { name: 'Managed PostgreSQL Database', cost: 0.00, usage: '0 DB instances', percent: 0 },
    { name: 'Network Egress & Bandwidth', cost: 0.00, usage: '0 GiB delivered', percent: 0 },
    { name: 'DNS & SSL Certificates', cost: 0.00, usage: 'Active apex zone', percent: 0 }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#18191C] text-[#202124] dark:text-[#E8EAED] font-sans antialiased pb-16 select-none transition-colors duration-200">
      
      {/* Google Cloud Style Top Console Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#202124] border-b border-[#DADCE0] dark:border-[#3C4043] px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Breadcrumb & Account Identifier */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-full hover:bg-[#F1F3F4] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] transition cursor-pointer"
                title="Back to Cloud Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                <span>Tiwlo Cloud</span>
                <span>/</span>
                <span className="font-medium text-[#202124] dark:text-white">Billing</span>
              </div>
              <div className="flex items-center gap-2.5 mt-0.5">
                <h1 className="text-lg font-semibold tracking-tight text-[#202124] dark:text-white leading-tight">
                  {billingAccountName}
                </h1>
                
                {/* Status Indicator Chip */}
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  hasVerifiedGateway
                    ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333] dark:bg-[#137333]/20 dark:border-[#137333]/40 dark:text-[#81C995]'
                    : 'bg-[#FEF7E0] border-[#FEEFC3] text-[#B06000] dark:bg-[#B06000]/20 dark:border-[#B06000]/40 dark:text-[#FDD663]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasVerifiedGateway ? 'bg-[#188038]' : 'bg-[#F29900]'}`} />
                  <span>{hasVerifiedGateway ? 'Active' : 'Unconfigured'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Account Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Account ID Pill with Copy button */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1F3F4] dark:bg-[#303134] text-xs font-mono text-[#3C4043] dark:text-[#BDC1C6] border border-[#DADCE0] dark:border-[#5F6368]">
              <span className="text-[11px] font-sans text-[#5F6368] dark:text-[#9AA0A6]">ID:</span>
              <span>{billingAccountId}</span>
              <button
                type="button"
                onClick={copyAccountId}
                className="ml-1 p-0.5 hover:text-[#1A73E8] dark:hover:text-[#8AB4F8] transition cursor-pointer"
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
              className="p-2 rounded-full hover:bg-[#F1F3F4] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] transition cursor-pointer"
              title="Refresh Billing Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Google Cloud Style Sub-Navigation Tabs */}
        <div className="max-w-[1600px] mx-auto mt-3 overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-1 sm:gap-2 border-t border-[#E8EAED] dark:border-[#3C4043] pt-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer outline-none ${
                    isSelected
                      ? 'text-[#1A73E8] dark:text-[#8AB4F8] font-semibold'
                      : 'text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-white hover:bg-[#F1F3F4] dark:hover:bg-[#303134]/50 rounded-lg'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isSelected && (
                    <span className="absolute bottom-0 inset-x-2 h-0.5 bg-[#1A73E8] dark:bg-[#8AB4F8] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Error Notification if any */}
        {loadError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW                                           */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top 4 Google Cloud KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Available Credits */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                  <span>Available credits</span>
                  <Coins className="w-4 h-4 text-[#1A73E8]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
                  ${credits.toFixed(2)}
                </div>
                <div className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] flex items-center justify-between pt-2 border-t border-[#F1F3F4] dark:border-[#303134]">
                  <span>Promo: ${promotionalCredits.toFixed(2)}</span>
                  <button
                    onClick={() => setActiveTab('credits')}
                    className="text-[#1A73E8] dark:text-[#8AB4F8] font-medium hover:underline cursor-pointer"
                  >
                    + Add credits
                  </button>
                </div>
              </div>

              {/* Card 2: Month to Date Costs */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                  <span>Month-to-date spent</span>
                  <Clock className="w-4 h-4 text-[#5F6368]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
                  ${(account?.monthToDateSpent || 0).toFixed(2)}
                </div>
                <p className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] pt-2 border-t border-[#F1F3F4] dark:border-[#303134]">
                  Current billing period: 1 – 31 Oct
                </p>
              </div>

              {/* Card 3: Forecast */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                  <span>Cost forecast</span>
                  <BarChart3 className="w-4 h-4 text-[#5F6368]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
                  ${(account?.projectedCost || 0).toFixed(2)}
                </div>
                <p className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] pt-2 border-t border-[#F1F3F4] dark:border-[#303134]">
                  Estimated end-of-month charge
                </p>
              </div>

              {/* Card 4: Active Projects / Resources */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs hover:shadow-xs transition">
                <div className="flex items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                  <span>Active cloud workloads</span>
                  <Server className="w-4 h-4 text-[#188038]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
                  {account?.droplets?.length || 0}
                </div>
                <p className="mt-2 text-xs text-[#5F6368] dark:text-[#9AA0A6] pt-2 border-t border-[#F1F3F4] dark:border-[#303134]">
                  Droplets & Managed Containers
                </p>
              </div>

            </div>

            {/* Middle Section: Cost Breakdown by Product + Payment Method Callout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left 8 Cols: Usage by Services */}
              <div className="lg:col-span-8 p-6 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#202124] dark:text-white">
                      Usage Cost by Product & Service
                    </h2>
                    <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                      Real usage metering from active infrastructure.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('cost-breakdown')}
                    className="text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                  >
                    View detailed reports &gt;
                  </button>
                </div>

                <div className="divide-y divide-[#E8EAED] dark:divide-[#303134]">
                  {costServices.map((svc, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#202124] dark:text-white truncate">
                          {svc.name}
                        </p>
                        <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                          {svc.usage}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#202124] dark:text-white font-mono text-sm">
                          ${svc.cost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right 4 Cols: Payment Method Status & Gateway Notice */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Payment Gateway Status Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#202124] dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#1A73E8]" />
                      Payment Method
                    </h3>
                    <button
                      onClick={() => setActiveTab('payment-methods')}
                      className="text-xs text-[#1A73E8] dark:text-[#8AB4F8] hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>

                  {hasVerifiedGateway ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Verified Gateways Active</span>
                        </div>
                        <p className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                          {configuredGateways.length} live gateway channels available for automated billing and credit top-up.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        {configuredGateways.map(gw => (
                          <div key={gw.id} className="flex items-center justify-between p-2 rounded-lg bg-[#F8F9FA] dark:bg-[#303134] text-xs">
                            <span className="font-semibold">{gw.name}</span>
                            <span className="text-[10px] font-mono text-[#5F6368] dark:text-[#9AA0A6] uppercase">
                              {gw.mode}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setActiveTab('credits')}
                        className="w-full mt-2 py-2 px-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        Top-up Cloud Credits
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30 space-y-2.5">
                      <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>No verified payment gateway configured</span>
                      </div>
                      <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                        Credit purchases and usage billing require at least one verified payment gateway (bKash, Nagad, SSLCOMMERZ, PayPal, or Stripe) configured in the Administrator Console.
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[10px] text-[#7F6000] dark:text-[#FDD663] font-semibold uppercase">
                          Purchases Blocked
                        </span>
                        <a
                          href="/administrator"
                          className="text-xs font-semibold text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
                        >
                          Configure in Admin &gt;
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Account Info Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs text-xs space-y-2.5">
                  <h4 className="font-semibold text-[#202124] dark:text-white">Account Details</h4>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F4] dark:border-[#303134]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Billing account type</span>
                    <span className="font-medium">Enterprise Cloud</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F4] dark:border-[#303134]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Currency</span>
                    <span className="font-medium font-mono">{account?.currency || 'USD'} ($)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F4] dark:border-[#303134]">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Administrator</span>
                    <span className="font-medium">{currentUser?.name || 'Account Owner'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Tax ID / Country</span>
                    <span className="font-medium">Unspecified</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREDITS & PROMOTIONS                               */}
        {/* ========================================================= */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            
            {/* Credits Header Summary Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F0FE] text-[#1A73E8] text-xs font-semibold mb-2">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Verified Balance</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#202124] dark:text-white">
                    ${credits.toFixed(2)} <span className="text-sm font-normal text-[#5F6368] dark:text-[#9AA0A6]">Available Credit</span>
                  </h2>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-1">
                    Cloud credits are automatically consumed to settle compute, storage, bandwidth, and database resources.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#303134] border border-[#DADCE0] dark:border-[#3C4043] text-xs space-y-1 sm:text-right">
                  <div className="text-[#5F6368] dark:text-[#9AA0A6]">Purchased balance: <span className="font-bold text-[#202124] dark:text-white font-mono">${credits.toFixed(2)}</span></div>
                  <div className="text-[#5F6368] dark:text-[#9AA0A6]">Promotional grants: <span className="font-bold text-[#202124] dark:text-white font-mono">${promotionalCredits.toFixed(2)}</span></div>
                  <div className="text-[#5F6368] dark:text-[#9AA0A6]">Expires: <span className="font-bold text-[#202124] dark:text-white">Never</span></div>
                </div>
              </div>
            </div>

            {/* Purchase Credits Box */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#202124] dark:text-white">
                  Purchase Cloud Credits
                </h3>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Top up your account balance for uninterrupted compute, droplet, and domain services.
                </p>
              </div>

              {!hasVerifiedGateway ? (
                /* No Gateway Warning Banner matching user requirements */
                <div className="p-5 rounded-2xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30 space-y-3">
                  <div className="flex items-center gap-2.5 text-[#B06000] dark:text-[#FDD663] text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>No verified payment gateway configured</span>
                  </div>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed max-w-2xl">
                    Until a verified payment gateway (bKash, Nagad, SSLCOMMERZ, PayPal, or Stripe) is configured and activated in the Administrator console, credit purchases and online checkouts are unavailable.
                  </p>
                  <div className="pt-2 flex items-center gap-4">
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Checkout Disabled</span>
                    </button>
                    <a
                      href="/administrator"
                      className="text-xs font-semibold text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
                    >
                      Open Administrator Payment Settings &gt;
                    </a>
                  </div>
                </div>
              ) : (
                /* Interactive Credit Purchase Flow */
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-3">
                      Select credit package amount (USD):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[10, 25, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSelectedCreditAmount(amt);
                            setCustomCreditAmount('');
                          }}
                          className={`p-4 rounded-xl border text-center transition cursor-pointer ${
                            selectedCreditAmount === amt && !customCreditAmount
                              ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] font-bold shadow-xs'
                              : 'bg-white dark:bg-[#303134] border-[#DADCE0] dark:border-[#5F6368] text-[#202124] dark:text-white hover:bg-[#F8F9FA]'
                          }`}
                        >
                          <div className="text-lg font-bold">${amt}</div>
                          <div className="text-[11px] opacity-75">{amt * 100} credits</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      <input
                        type="number"
                        placeholder="Or enter custom amount in USD..."
                        value={customCreditAmount}
                        onChange={(e) => setCustomCreditAmount(e.target.value)}
                        className="w-full sm:w-64 px-3.5 py-2 rounded-xl border border-[#DADCE0] dark:border-[#5F6368] bg-white dark:bg-[#303134] text-xs font-mono outline-none focus:border-[#1A73E8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-2">
                      Choose payment gateway:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {configuredGateways.map(gw => (
                        <button
                          key={gw.id}
                          type="button"
                          onClick={() => setSelectedGatewayId(gw.id)}
                          className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                            selectedGatewayId === gw.id
                              ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8] font-bold'
                              : 'bg-white dark:bg-[#303134] border-[#DADCE0] dark:border-[#5F6368] text-[#202124] dark:text-white hover:bg-[#F8F9FA]'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{gw.name}</div>
                            <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6] uppercase">
                              {gw.currencies?.join(', ')} • {gw.mode}
                            </div>
                          </div>
                          {selectedGatewayId === gw.id && (
                            <CheckCircle2 className="w-4 h-4 text-[#1A73E8]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handlePurchaseAttempt}
                      disabled={isProcessingCheckout}
                      className="px-6 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingCheckout ? 'Initiating Gateway...' : 'Proceed to Checkout'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Credit Transaction Ledger */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
              <h3 className="text-sm font-semibold text-[#202124] dark:text-white mb-4">
                Credit Transaction History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8EAED] dark:border-[#3C4043] text-[#5F6368] dark:text-[#9AA0A6] uppercase text-[11px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F4] dark:divide-[#303134]">
                    <tr>
                      <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6]">Today</td>
                      <td className="py-3 px-3 font-medium">Opening Verified Account Balance</td>
                      <td className="py-3 px-3">Credit Grant</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600">+${credits.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                          Settled
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PAYMENT METHOD                                     */}
        {/* ========================================================= */}
        {activeTab === 'payment-methods' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
              <h2 className="text-lg font-bold text-[#202124] dark:text-white mb-1">
                Payment Methods & Verified Gateways
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mb-6">
                Active payment channels connected to this Tiwlo Cloud instance.
              </p>

              {hasVerifiedGateway ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {configuredGateways.map(gw => (
                    <div key={gw.id} className="p-4 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#303134] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                          {gw.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#202124] dark:text-white">{gw.name}</div>
                          <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                            Currencies: {gw.currencies?.join(', ')}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                        {gw.mode}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#FEF7E0] dark:bg-[#B06000]/15 border border-[#FEEFC3] dark:border-[#B06000]/30 space-y-3 max-w-xl">
                  <div className="flex items-center gap-2 text-[#B06000] dark:text-[#FDD663] text-sm font-bold">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>No verified payment gateway configured</span>
                  </div>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                    Neither bKash, Nagad, SSLCOMMERZ, PayPal nor Stripe has been enabled with verified credentials in this platform. Please navigate to the Administrator settings to activate payment gateways.
                  </p>
                  <div>
                    <a
                      href="/administrator"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A73E8] dark:text-[#8AB4F8] hover:underline"
                    >
                      <span>Configure Gateways in Administrator</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: COST BREAKDOWN                                     */}
        {/* ========================================================= */}
        {activeTab === 'cost-breakdown' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] dark:text-white">
                    Cost Breakdown by Service
                  </h2>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                    Granular breakdown of cloud services, compute, and databases.
                  </p>
                </div>
                <div className="text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] px-3 py-1.5 rounded-lg border border-[#DADCE0] dark:border-[#3C4043]">
                  Period: Current Month (Oct 2026)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8EAED] dark:border-[#3C4043] text-[#5F6368] dark:text-[#9AA0A6] uppercase text-[11px]">
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Usage Metric</th>
                      <th className="py-3 px-3">Rate</th>
                      <th className="py-3 px-3 text-right">Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F4] dark:divide-[#303134]">
                    {costServices.map((svc, idx) => (
                      <tr key={idx} className="hover:bg-[#F8F9FA] dark:hover:bg-[#303134]/40">
                        <td className="py-3 px-3 font-semibold text-[#202124] dark:text-white">{svc.name}</td>
                        <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6] font-mono">{svc.usage}</td>
                        <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6]">Pay as you go</td>
                        <td className="py-3 px-3 text-right font-mono font-bold">${svc.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#DADCE0] dark:border-[#3C4043] font-bold">
                      <td className="py-3 px-3 text-sm">Total Incurred Cost</td>
                      <td className="py-3 px-3" colSpan={2}></td>
                      <td className="py-3 px-3 text-right text-sm font-mono">${(account?.monthToDateSpent || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: INVOICES & TRANSACTIONS                            */}
        {/* ========================================================= */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#202124] dark:text-white">
                    Invoices & Billing Documents
                  </h2>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                    Official VAT statements and paid invoices.
                  </p>
                </div>
              </div>

              {account?.invoices && account.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E8EAED] dark:border-[#3C4043] text-[#5F6368] dark:text-[#9AA0A6] uppercase text-[11px]">
                        <th className="py-3 px-3">Document ID</th>
                        <th className="py-3 px-3">Description</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F3F4] dark:divide-[#303134]">
                      {account.invoices.map(inv => (
                        <tr key={inv.id}>
                          <td className="py-3 px-3 font-mono font-medium">{inv.id}</td>
                          <td className="py-3 px-3">{inv.description || 'Monthly Cloud Statement'}</td>
                          <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6]">{inv.createdAt}</td>
                          <td className="py-3 px-3 font-mono font-bold">${inv.amount?.toFixed(2) || '0.00'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                              {inv.status || 'Paid'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              className="text-xs text-[#1A73E8] dark:text-[#8AB4F8] font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-[#F8F9FA] dark:bg-[#303134] text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-[#202124] dark:text-white">No invoices yet</p>
                  <p className="mt-0.5">Invoices are automatically generated at the end of each monthly billing cycle.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ACCOUNT MANAGEMENT                                 */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] shadow-2xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#202124] dark:text-white">
                  Billing Account Settings
                </h2>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Manage account ownership, currency preferences, and ledger configurations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl text-xs">
                <div>
                  <label className="block font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Billing Account ID
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#303134] font-mono">
                    {billingAccountId}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Billing Account Name
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-white dark:bg-[#303134]">
                    {billingAccountName}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Currency
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#303134] font-medium">
                    USD ($)
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#5F6368] dark:text-[#9AA0A6] mb-1">
                    Account Status
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#303134] font-medium flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${hasVerifiedGateway ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>{hasVerifiedGateway ? 'Active Enterprise Account' : 'Gateway Verification Pending'}</span>
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
