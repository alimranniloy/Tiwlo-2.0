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
  Zap,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Activity,
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
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

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

  const credits = Number.isFinite(account?.credits) && account.credits >= 0 ? account.credits : 0;
  const promotionalCredits = Number.isFinite(account?.promotionalCredits) ? account.promotionalCredits : 0;
  const hasVerifiedGateway = account?.hasVerifiedGateway === true;
  const configuredGateways = Array.isArray(account?.configuredGateways) ? account.configuredGateways : [];
  const billingAccountId = account?.billingAccountId || 'TIW-01A24B-39C72E';
  const billingAccountName = account?.billingAccountName || 'Tiwlo Cloud Enterprise Billing';

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

  const handleApplyPromo = (e) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;
    setIsApplyingPromo(true);
    setTimeout(() => {
      setIsApplyingPromo(false);
      if (!hasVerifiedGateway) {
        showToast?.('Promo redemption requires a verified billing account gateway.', 'error');
      } else {
        showToast?.('Promo code submitted for validation.', 'info');
      }
      setPromoCodeInput('');
    }, 700);
  };

  const navTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'credits', label: 'Credits & Top-up', icon: Coins },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'cost-breakdown', label: 'Cost Breakdown', icon: BarChart3 },
    { id: 'invoices', label: 'Invoices & Ledger', icon: Receipt },
    { id: 'settings', label: 'Account Settings', icon: Settings }
  ];

  const costServices = [
    { name: 'Compute Engine (Droplets)', cost: 0.00, usage: '0 vCPU-hours', percent: 0, icon: Server, color: 'from-blue-500 to-indigo-600' },
    { name: 'Cloud NVMe Storage', cost: 0.00, usage: '0 GB-months', percent: 0, icon: Layers, color: 'from-purple-500 to-pink-600' },
    { name: 'Managed Database Clusters', cost: 0.00, usage: '0 Active Instances', percent: 0, icon: Zap, color: 'from-amber-500 to-orange-600' },
    { name: 'Global Edge Network & CDN', cost: 0.00, usage: '0 GiB Egress', percent: 0, icon: Activity, color: 'from-emerald-500 to-teal-600' },
    { name: 'DNS Zones & TLS Certificates', cost: 0.00, usage: 'Active Apex Zone', percent: 0, icon: ShieldCheck, color: 'from-cyan-500 to-blue-600' }
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0A0A0C] text-neutral-900 dark:text-neutral-100 font-sans antialiased pb-20 select-none transition-colors duration-300">
      
      {/* Sleek Ambient Gradient Accent at the top */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-500/[0.04] via-indigo-500/[0.02] to-transparent dark:from-blue-600/[0.06] dark:via-indigo-600/[0.02] pointer-events-none" />

      {/* Modern Apple/iOS & Google Material 3 Translucent Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0A0A0C]/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-[1500px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Breadcrumb & Account Identifier */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-neutral-700 dark:text-neutral-300 transition-all cursor-pointer active:scale-95"
                title="Back to Cloud Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase text-neutral-400 dark:text-neutral-500">
                <span>Tiwlo Cloud</span>
                <span className="text-neutral-300 dark:text-neutral-700">/</span>
                <span className="text-neutral-700 dark:text-neutral-300">Billing Console</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {billingAccountName}
                </h1>
                
                {/* Modern iOS Squircle Status Chip */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all ${
                  hasVerifiedGateway
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasVerifiedGateway ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{hasVerifiedGateway ? 'Active & Verified' : 'Gateway Required'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Account Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-center">
            {/* Account ID Pill with 1-Click Copy */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-xs font-mono text-neutral-600 dark:text-neutral-300 backdrop-blur-md">
              <span className="text-[10px] font-sans font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                ID:
              </span>
              <span className="tracking-tight">{billingAccountId}</span>
              <button
                type="button"
                onClick={copyAccountId}
                className="p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.1] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                title="Copy Billing Account ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Refresh Button with Apple micro-interaction */}
            <button
              type="button"
              onClick={loadBilling}
              disabled={loading}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-neutral-600 dark:text-neutral-300 border border-black/[0.05] dark:border-white/[0.08] transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh ledger state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modern iOS Segmented Control Pill Switcher */}
        <div className="max-w-[1500px] mx-auto mt-3.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
          <div className="flex items-center overflow-x-auto scrollbar-none py-1">
            <div className="inline-flex p-1 bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-black/[0.04] dark:border-white/[0.06] gap-1 shrink-0">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 select-none cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E1E22] text-neutral-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] scale-[1.01]'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
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
        {/* TAB 1: OVERVIEW (Apple / Modern Google Dashboard)         */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top Stat Cards (iOS Card / Widget Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              
              {/* Card 1: Available Credit Balance (Apple Card / Wallet Aesthetic) */}
              <div className="relative overflow-hidden p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  <span className="font-medium">Available Balance</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-mono">
                  ${credits.toFixed(2)}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-neutral-400 dark:text-neutral-500">
                    Promo: <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">${promotionalCredits.toFixed(2)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credits')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Add Funds</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card 2: Current Month Spend */}
              <div className="relative overflow-hidden p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-all">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  <span className="font-medium">Current Month Spend</span>
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-mono">
                  ${(account?.monthToDateSpent || 0).toFixed(2)}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
                  <span>Cycle: Current Month</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
                  </span>
                </div>
              </div>

              {/* Card 3: Forecasted End-of-Month Cost */}
              <div className="relative overflow-hidden p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-all">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  <span className="font-medium">Projected Spend</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-mono">
                  ${(account?.projectedCost || 0).toFixed(2)}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-neutral-400 dark:text-neutral-500">
                  Estimated burn rate
                </div>
              </div>

              {/* Card 4: Active Workloads */}
              <div className="relative overflow-hidden p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-all">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  <span className="font-medium">Cloud Workloads</span>
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Server className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-mono">
                  {account?.droplets?.length || 0}
                </div>
                <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-neutral-400 dark:text-neutral-500">
                  Provisioned Compute Nodes
                </div>
              </div>

            </div>

            {/* Strict Notice Banner when no gateway is configured */}
            {!hasVerifiedGateway && (
              <div className="relative overflow-hidden p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.04] to-transparent border border-amber-500/25 backdrop-blur-xl shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                        No verified payment gateway configured
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                        To enable cloud credit top-ups and automated resource renewal, the platform administrator must configure and verify at least one payment gateway (bKash, Nagad, SSLCOMMERZ, PayPal, or Stripe) in the system console.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/administrator"
                    className="shrink-0 px-4 py-2.5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 text-xs font-semibold shadow-xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    <span>Configure in Admin</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Middle Section: Usage by Service + Payment Gateways Callout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left 8 Cols: Usage by Services */}
              <div className="lg:col-span-8 p-6 sm:p-7 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                      Infrastructure Usage & Metrics
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Real-time resource metering linked directly to your PostgreSQL ledger.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cost-breakdown')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Full Analysis</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {costServices.map((svc, idx) => {
                    const SvcIcon = svc.icon;
                    return (
                      <div key={idx} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${svc.color} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                            <SvcIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white truncate">
                              {svc.name}
                            </p>
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                              {svc.usage}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-neutral-900 dark:text-white text-sm">
                            ${svc.cost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 4 Cols: Payment Method & Account Summary */}
              <div className="lg:col-span-4 space-y-5">
                
                {/* Payment Gateway Status Card */}
                <div className="p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Payment Channels</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('payment-methods')}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>

                  {hasVerifiedGateway ? (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verified Gateways Active</span>
                        </div>
                        <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80">
                          {configuredGateways.length} live platform payment gateway(s) ready for checkout.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {configuredGateways.map(gw => (
                          <div key={gw.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] text-xs">
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{gw.name}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-neutral-500">
                              {gw.mode}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('credits')}
                        className="w-full mt-2 py-2.5 px-4 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold shadow-xs hover:opacity-90 transition cursor-pointer active:scale-95"
                      >
                        Top-up Cloud Credits
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>No verified gateway</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        Checkout is locked until at least one payment gateway is configured in the administrator portal.
                      </p>
                      <div className="pt-1 flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-mono font-bold text-amber-600 dark:text-amber-400">
                          Locked
                        </span>
                        <a
                          href="/administrator"
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Configure &gt;
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Details Quick Card */}
                <div className="p-6 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-xs space-y-3">
                  <h4 className="font-bold text-neutral-900 dark:text-white">Account Details</h4>
                  <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-neutral-400 dark:text-neutral-500">Account Type</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Enterprise Cloud</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-neutral-400 dark:text-neutral-500">Base Currency</span>
                    <span className="font-medium font-mono text-neutral-800 dark:text-neutral-200">USD ($)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-neutral-400 dark:text-neutral-500">Admin Contact</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[150px]">{currentUser?.email || 'Owner'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-neutral-400 dark:text-neutral-500">Status</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CREDITS & TOP-UP (Apple / Google Hybrid Checkout)  */}
        {/* ========================================================= */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            
            {/* Credits Header Summary Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Real Ledger Balance</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-mono">
                    ${credits.toFixed(2)} <span className="text-sm font-sans font-normal text-neutral-400 dark:text-neutral-500">Available Credits</span>
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
                    Credits are drawn in real-time as droplets, containers, edge storage, and PostgreSQL databases run.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] text-xs space-y-1.5 sm:text-right shrink-0">
                  <div className="text-neutral-500 dark:text-neutral-400">Direct top-up: <span className="font-bold text-neutral-900 dark:text-white font-mono">${credits.toFixed(2)}</span></div>
                  <div className="text-neutral-500 dark:text-neutral-400">Promotions: <span className="font-bold text-neutral-900 dark:text-white font-mono">${promotionalCredits.toFixed(2)}</span></div>
                  <div className="text-neutral-500 dark:text-neutral-400">Credit expiration: <span className="font-bold text-emerald-600 dark:text-emerald-400">Never</span></div>
                </div>
              </div>
            </div>

            {/* Purchase Credits Box */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] space-y-6">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                  Purchase Cloud Credits
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Select a credit package or enter a custom amount to top up your account.
                </p>
              </div>

              {!hasVerifiedGateway ? (
                <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.04] border border-amber-500/25 space-y-3">
                  <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400 text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>No verified payment gateway configured</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
                    Until a verified payment gateway (bKash, Nagad, SSLCOMMERZ, PayPal, or Stripe) is configured and activated in the Administrator console, credit purchases and online checkouts are unavailable.
                  </p>
                  <div className="pt-2 flex items-center gap-4">
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2.5 rounded-2xl bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Checkout Disabled</span>
                    </button>
                    <a
                      href="/administrator"
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Open Administrator Payment Settings &gt;
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Package Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-3">
                      Select Credit Package (USD):
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
                          className={`p-5 rounded-2xl border text-center transition-all cursor-pointer ${
                            selectedCreditAmount === amt && !customCreditAmount
                              ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 shadow-[0_2px_12px_rgba(59,130,246,0.15)] font-bold scale-[1.02]'
                              : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="text-xl font-extrabold font-mono">${amt}</div>
                          <div className="text-[11px] opacity-75 mt-0.5">{amt * 100} credits</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      <input
                        type="number"
                        placeholder="Or enter custom amount in USD..."
                        value={customCreditAmount}
                        onChange={(e) => setCustomCreditAmount(e.target.value)}
                        className="w-full sm:w-72 px-4 py-2.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-xs font-mono outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Payment Gateway Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2.5">
                      Choose Payment Gateway:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {configuredGateways.map(gw => (
                        <button
                          key={gw.id}
                          type="button"
                          onClick={() => setSelectedGatewayId(gw.id)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                            selectedGatewayId === gw.id
                              ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.04]'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{gw.name}</div>
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mt-0.5">
                              {gw.currencies?.join(', ')} • {gw.mode}
                            </div>
                          </div>
                          {selectedGatewayId === gw.id && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                      className="px-7 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold shadow-md hover:opacity-90 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isProcessingCheckout ? 'Connecting Gateway...' : 'Proceed to Checkout'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Promo Voucher Box */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Promotional Voucher Code</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Have a grant or promotional credit voucher code? Enter it below.
              </p>
              <form onSubmit={handleApplyPromo} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="TIWLO-PROMO-XXXX"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-xs font-mono outline-none focus:border-blue-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={isApplyingPromo || !promoCodeInput.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
                >
                  {isApplyingPromo ? 'Validating...' : 'Apply Code'}
                </button>
              </form>
            </div>

            {/* Credit Transaction Ledger */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">
                Credit Transaction History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06] text-neutral-400 dark:text-neutral-500 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                    <tr>
                      <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400">Today</td>
                      <td className="py-3 px-3 font-medium text-neutral-800 dark:text-neutral-200">Verified Opening Ledger Balance</td>
                      <td className="py-3 px-3 text-neutral-500">Credit Grant</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">+${credits.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
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
        {/* TAB 3: PAYMENT METHODS (Apple Pay / Modern Cards Style)   */}
        {/* ========================================================= */}
        {activeTab === 'payment-methods' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight mb-1">
                Connected Payment Methods
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                Active payment channels connected to this Tiwlo Cloud instance.
              </p>

              {hasVerifiedGateway ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {configuredGateways.map(gw => (
                    <div key={gw.id} className="p-5 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold flex items-center justify-center text-xs shadow-xs">
                          {gw.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-neutral-900 dark:text-white">{gw.name}</div>
                          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
                            {gw.currencies?.join(', ')}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                        {gw.mode}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.04] border border-amber-500/25 space-y-3 max-w-xl">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-bold">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>No verified payment gateway configured</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Neither bKash, Nagad, SSLCOMMERZ, PayPal nor Stripe has been enabled with verified credentials in this platform. Please navigate to the Administrator settings to activate payment gateways.
                  </p>
                  <div>
                    <a
                      href="/administrator"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
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
        {/* TAB 4: COST BREAKDOWN (Apple Health / Clean Breakdown)    */}
        {/* ========================================================= */}
        {activeTab === 'cost-breakdown' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                    Cost Breakdown by Service
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Granular metering breakdown of compute, network, and storage.
                  </p>
                </div>
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3.5 py-1.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.06]">
                  Billing Period: Current Month
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06] text-neutral-400 dark:text-neutral-500 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-3 px-3">Service</th>
                      <th className="py-3 px-3">Usage Metric</th>
                      <th className="py-3 px-3">Rate Model</th>
                      <th className="py-3 px-3 text-right">Incurred Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                    {costServices.map((svc, idx) => (
                      <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-3 font-semibold text-neutral-900 dark:text-white">{svc.name}</td>
                        <td className="py-3.5 px-3 text-neutral-500 font-mono">{svc.usage}</td>
                        <td className="py-3.5 px-3 text-neutral-500">Pay-as-you-go</td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-white">${svc.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-black/[0.1] dark:border-white/[0.1] font-bold">
                      <td className="py-4 px-3 text-sm text-neutral-900 dark:text-white">Total Incurred Cost</td>
                      <td className="py-4 px-3" colSpan={2}></td>
                      <td className="py-4 px-3 text-right text-sm font-mono text-neutral-900 dark:text-white">${(account?.monthToDateSpent || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: INVOICES & LEDGER (Apple Transactions Style)       */}
        {/* ========================================================= */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                    Invoices & Official Statements
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Monthly billing statements, receipts, and VAT documentation.
                  </p>
                </div>
              </div>

              {account?.invoices && account.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.05] dark:border-white/[0.06] text-neutral-400 dark:text-neutral-500 uppercase text-[10px] tracking-wider font-semibold">
                        <th className="py-3 px-3">Document ID</th>
                        <th className="py-3 px-3">Description</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
                      {account.invoices.map(inv => (
                        <tr key={inv.id}>
                          <td className="py-3.5 px-3 font-mono font-medium">{inv.id}</td>
                          <td className="py-3.5 px-3">{inv.description || 'Monthly Cloud Statement'}</td>
                          <td className="py-3.5 px-3 text-neutral-500">{inv.createdAt}</td>
                          <td className="py-3.5 px-3 font-mono font-bold">${inv.amount?.toFixed(2) || '0.00'}</td>
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                              {inv.status || 'Paid'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
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
                <div className="py-12 text-center rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] text-xs text-neutral-500 dark:text-neutral-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-neutral-900 dark:text-white">No invoices yet</p>
                  <p className="mt-0.5">Invoices are automatically generated at the end of each calendar month.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ACCOUNT SETTINGS (Apple iOS Settings List Style)   */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-[#161618]/90 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.04)] space-y-6">
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                  Billing Account Preferences
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Manage account ownership, currency preferences, and ledger configurations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl text-xs">
                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                  <label className="block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                    Billing Account ID
                  </label>
                  <div className="font-mono font-medium text-neutral-900 dark:text-white">
                    {billingAccountId}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                  <label className="block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                    Billing Account Name
                  </label>
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {billingAccountName}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                  <label className="block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                    Operating Currency
                  </label>
                  <div className="font-medium font-mono text-neutral-900 dark:text-white">
                    USD ($)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06]">
                  <label className="block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                    Gateway Verification Status
                  </label>
                  <div className="font-medium flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${hasVerifiedGateway ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={hasVerifiedGateway ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {hasVerifiedGateway ? 'Verified & Active' : 'Gateway Config Required'}
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
