import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Plus,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Download,
  Calendar,
  AlertCircle,
  FileText,
  Server,
  Database,
  Sparkles,
  Globe,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Gift,
  HelpCircle,
  DollarSign,
  ChevronRight,
  Receipt,
  X,
  Sliders,
  Filter,
  Layers,
  Search,
  Bell,
  Printer,
  ChevronDown,
  Trash2
} from 'lucide-react';
import {
  getCloudBillingData,
  addCloudCredits,
  redeemCloudVoucher,
  createCloudBudget,
  deleteCloudBudget
} from '../graphql/cloudQueries';
import { generateInvoicePdf } from '../utils/invoicePdfGenerator';

export default function CloudBillingView({
  currentUser,
  onBack,
  showToast,
  initialTab = 'overview'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copiedBillingId, setCopiedBillingId] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [showCreateBudgetModal, setShowCreateBudgetModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const rawTiwiId = currentUser?.tiwiId || currentUser?.storeId || '';

  // Real Database Billing Account State
  const [billingAccount, setBillingAccount] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [realDroplets, setRealDroplets] = useState([]);

  // Tokenized Credit Balance State
  const [creditsBalance, setCreditsBalance] = useState(() => currentUser?.credits ?? 0);
  const [selectedBundle, setSelectedBundle] = useState(50);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Voucher Redeemer State
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Budgets State
  const [budgetsList, setBudgetsList] = useState([]);
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('50.00');

  // Invoices & Transactions State
  const [invoicesList, setInvoicesList] = useState([]);

  // Load Real Billing Account Data from Backend Database
  const loadBillingAccount = async () => {
    try {
      setLoadingBilling(true);
      const res = await getCloudBillingData(userId);
      if (res?.account) {
        setBillingAccount(res.account);
        setCreditsBalance(res.account.credits ?? 0);
        setBudgetsList(res.account.budgets || []);
        setInvoicesList(res.account.invoices || []);
        setRealDroplets(res.account.droplets || []);
        if (currentUser) {
          currentUser.credits = res.account.credits ?? 0;
        }
      }
    } catch (err) {
      console.warn('Error loading billing account from DB:', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    loadBillingAccount();
  }, [userId]);

  const billingAccountId = billingAccount?.billingAccountId || `BA-TIWLO-${rawTiwiId.replace(/[^a-zA-Z0-9]/g, '')}-TCP`;

  const copyBillingId = () => {
    navigator.clipboard?.writeText(billingAccountId);
    setCopiedBillingId(true);
    showToast?.(`Copied Billing Account ID: ${billingAccountId}`);
    setTimeout(() => setCopiedBillingId(false), 2000);
  };

  // Redeem Promo Voucher Handler (Backend DB Integrated with Anti-Abuse Tracking)
  const handleRedeemPromo = async (e) => {
    e.preventDefault();
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode) {
      showToast?.('Please enter a promotional credit voucher code', 'error');
      return;
    }
    setPromoLoading(true);
    try {
      const res = await redeemCloudVoucher(userId, cleanCode);
      if (res.success) {
        setCreditsBalance(res.newBalance);
        if (currentUser) currentUser.credits = res.newBalance;
        if (res.grant) {
          setInvoicesList((prev) => [res.grant, ...prev]);
        }
        showToast?.(`Success! Voucher "${cleanCode}" applied. +${res.addedCredits.toLocaleString()} Tiwlo Cloud Credits added.`);
        setPromoCode('');
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to redeem voucher', 'error');
    } finally {
      setPromoLoading(false);
    }
  };

  // Purchase Credits Top-Up Handler (Backend DB Integrated)
  const handlePurchaseCredits = async () => {
    setIsPurchasing(true);
    try {
      const res = await addCloudCredits(userId, selectedBundle, 'Visa ending in 4242');
      if (res.success) {
        setCreditsBalance(res.newBalance);
        if (currentUser) currentUser.credits = res.newBalance;
        if (res.invoice) {
          setInvoicesList((prev) => [res.invoice, ...prev]);
        }
        setShowAddCreditsModal(false);
        showToast?.(`Payment confirmed! Added ${res.addedCredits.toLocaleString()} credits to ${billingAccountId}.`);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to process credit top-up', 'error');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Create Budget Handler (Backend DB Integrated)
  const handleCreateBudget = async (e) => {
    e.preventDefault();
    if (!newBudgetName.trim()) {
      showToast?.('Please specify a budget name', 'error');
      return;
    }
    const target = parseFloat(newBudgetAmount) || 50;
    try {
      const res = await createCloudBudget(userId, {
        name: newBudgetName.trim(),
        targetAmount: target,
        alertEmail: currentUser?.email || 'admin@tiwlo.com'
      });
      if (res.budget) {
        setBudgetsList((prev) => [...prev, res.budget]);
        setShowCreateBudgetModal(false);
        setNewBudgetName('');
        showToast?.(`Budget "${res.budget.name}" created with monthly cap of $${target.toFixed(2)} USD.`);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to create budget', 'error');
    }
  };

  // Delete Budget Handler (Backend DB Integrated)
  const handleDeleteBudget = async (budgetId) => {
    try {
      await deleteCloudBudget(userId, budgetId);
      setBudgetsList((prev) => prev.filter((b) => b.id !== budgetId));
      showToast?.('Budget alert removed successfully.');
    } catch (err) {
      showToast?.(err.message || 'Failed to remove budget', 'error');
    }
  };

  // Real PDF Invoice Generator & Downloader
  const handleDownloadInvoicePdf = (inv) => {
    if (!inv) return;
    try {
      generateInvoicePdf(inv, currentUser, billingAccountId);
      showToast?.(`Official statement PDF for ${inv.id} downloaded!`);
    } catch (err) {
      console.error('PDF generation error:', err);
      showToast?.('Error generating PDF invoice', 'error');
    }
  };

  // Dynamic Infrastructure & Cost Calculation based on real user droplets
  const runningDropletsCount = realDroplets.filter((d) => d.status === 'Running').length;
  const computeVcpuHours = runningDropletsCount * 2 * 24 * 30;
  const computeGross = runningDropletsCount * 5.04;
  const storageTotalGb = realDroplets.reduce((acc, d) => acc + (parseInt(d.storage) || 40), 0);
  const storageGross = storageTotalGb * 0.02;
  const tiwiTokensCount = realDroplets.length > 0 ? 150000 : 0;
  const tiwiTokensGross = realDroplets.length > 0 ? 0.22 : 0.00;
  const vpcGross = realDroplets.length > 0 ? 0.28 : 0.00;
  const totalMtdGross = parseFloat((computeGross + storageGross + tiwiTokensGross + vpcGross).toFixed(2));
  const creditOffset = Math.min(totalMtdGross, (creditsBalance > 0 ? totalMtdGross : 0));
  const netMtdCost = Math.max(0, parseFloat((totalMtdGross - creditOffset).toFixed(2)));

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'reports', label: 'Reports & Cost Analysis' },
    { id: 'cost-table', label: 'Cost Table & SKUs' },
    { id: 'budgets', label: 'Budgets & Alerts' },
    { id: 'credits', label: 'Promotional Credits' },
    { id: 'payment-methods', label: 'Payment Methods' },
    { id: 'invoices', label: 'Invoices & Statements' },
    { id: 'account-management', label: 'Account Management' }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#18191C] text-[#202124] dark:text-[#E8EAED] font-sans pb-16 transition-colors">
      {/* 1. Google Cloud Console Header Bar (Pure Tiwlo Branding, NO 4-Color Stripe) */}
      <div className="bg-white dark:bg-[#202124] border-b border-[#DADCE0] dark:border-[#3C4043] px-4 sm:px-8 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Breadcrumbs & Title */}
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-full hover:bg-[#F1F3F4] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#F1F3F4] transition cursor-pointer shrink-0"
                title="Back to Cloud Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="min-w-0">
              {/* Breadcrumb line */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                <span>Billing accounts</span>
                <span className="text-[#80868B]">›</span>
                <span className="truncate font-medium text-[#202124] dark:text-[#E8EAED]">
                  Tiwlo Cloud Billing ({billingAccountId})
                </span>
              </div>

              {/* Title & Account Chip */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-normal text-[#202124] dark:text-[#F1F3F4] tracking-tight flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-[#F1F3F4] dark:bg-[#303134] border border-[#DADCE0] dark:border-[#5F6368] flex items-center justify-center p-0.5 shrink-0">
                    <img src="/tiwlo-icon.png" alt="Tiwlo" className="w-full h-full object-contain dark:hidden" />
                    <img src="/tiwlo-icon-dark.png" alt="Tiwlo" className="w-full h-full object-contain hidden dark:block" />
                  </div>
                  <span>Billing Overview</span>
                </h1>

                {/* Status Chip */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333] dark:bg-[#133E26] dark:text-[#81C995] border border-[#CEEAD6] dark:border-[#1E5638]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse"></span>
                  Active (Standard Enterprise Tier)
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddCreditsModal(true)}
              className="py-2 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] font-medium text-xs shadow-xs hover:shadow transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credits</span>
            </button>

            <button
              type="button"
              onClick={() => showToast?.('Exporting billing ledger as CSV statement...')}
              className="py-2 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#1A73E8] dark:text-[#8AB4F8] font-medium text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => showToast?.('Meters synchronized with Tiwlo Cloud infrastructure')}
              className="p-2 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Sub-Tabs Navigation (Google Cloud Console Horizontal Tabs) */}
        <div className="max-w-[1600px] mx-auto mt-4 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-transparent">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#1A73E8] text-[#1A73E8] dark:text-[#8AB4F8] font-semibold'
                    : 'border-transparent text-[#5F6368] dark:text-[#9AA0A6] hover:text-[#202124] dark:hover:text-[#F1F3F4] hover:border-[#DADCE0]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Body Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* Top 2 Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Meter Card (Col 7) */}
              <div className="lg:col-span-7 bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] dark:text-[#9AA0A6]">
                      Costs Month-to-Date
                    </span>
                    <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                      Sep 1, 2026 – Sep 30, 2026 (Per-second compute metering)
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#188038] dark:text-[#81C995] bg-[#E6F4EA] dark:bg-[#133E26] px-2.5 py-0.5 rounded-full border border-[#CEEAD6] dark:border-[#1E5638] font-medium">
                    {totalMtdGross > 0 ? `${((creditOffset / totalMtdGross) * 100).toFixed(0)}% Credit Offset` : '100% Credit Offset'}
                  </span>
                </div>

                {/* Big Cost Amount */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-light text-[#202124] dark:text-[#F1F3F4] font-sans tracking-tight">
                      ${netMtdCost.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                      USD Net Due (Gross: ${totalMtdGross.toFixed(2)})
                    </span>
                  </div>
                  <div className="text-right text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                    Forecasted month end: <strong className="text-[#202124] dark:text-[#F1F3F4] font-semibold">${(totalMtdGross * 1.25).toFixed(2)} USD</strong>
                  </div>
                </div>

                {/* Promotional Credit Buffer Box */}
                <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-[#FEF7E0] dark:bg-[#332B00] text-[#B06000] dark:text-[#FDD663] flex items-center justify-center shrink-0">
                        <Gift className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#202124] dark:text-[#F1F3F4]">
                        Available Tiwlo Cloud Credits
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono text-[#188038] dark:text-[#81C995]">
                      {creditsBalance.toLocaleString()} CREDITS (${(creditsBalance * 0.01).toFixed(2)} USD)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full bg-[#E8EAED] dark:bg-[#3C4043] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1A73E8] dark:bg-[#8AB4F8] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(8, creditsBalance > 0 ? 100 : 8))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                      <span>Remaining Buffer: 100% (Active)</span>
                      <span>Valid across all Droplets & Tiwi AI</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] leading-relaxed">
                    Promotional and prepaid credits automatically offset all vCPU-hours, storage snapshots, and Tiwi AI neural queries before any card is charged.
                  </p>
                </div>

                {/* 30-Day Trend Chart */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] dark:text-[#9AA0A6] mb-2">
                    Daily Usage Trend (Last 30 Days)
                  </div>
                  <div className="h-16 flex items-end gap-1 sm:gap-1.5 pt-2 px-1">
                    {Array.from({ length: 30 }).map((_, idx) => {
                      const heights = [10, 15, 8, 12, 20, 14, 18, 12, 16, 22, 15, 12, 14, 18, 25, 30, 22, 18, 24, 28, 32, 26, 20, 24, 28, 30, 25, 20, 18, 22];
                      const height = heights[idx % heights.length];
                      return (
                        <div
                          key={idx}
                          className="flex-1 bg-[#E8F0FE] hover:bg-[#1A73E8] dark:bg-[#1A305A] dark:hover:bg-[#8AB4F8] rounded-t-sm transition-colors cursor-pointer group relative"
                          style={{ height: `${height}%` }}
                          title={`Day ${idx + 1}: $0.00`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#5F6368] dark:text-[#9AA0A6] mt-1.5 px-0.5">
                    <span>Sep 1</span>
                    <span>Sep 15</span>
                    <span>Sep 30</span>
                  </div>
                </div>
              </div>

              {/* Right Account Info Card (Col 5) */}
              <div className="lg:col-span-5 bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                    <h2 className="text-xs font-semibold text-[#202124] dark:text-[#F1F3F4]">
                      Billing Account Details
                    </h2>
                  </div>
                  <span className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">
                    Standard Tier
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Billing Account Name</span>
                    <p className="font-medium text-[#202124] dark:text-[#F1F3F4] mt-0.5">Tiwlo Cloud Billing</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Billing Account ID</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="font-mono text-xs bg-[#F1F3F4] dark:bg-[#303134] text-[#202124] dark:text-[#E8EAED] px-2 py-0.5 rounded font-semibold">
                        {billingAccountId}
                      </code>
                      <button
                        type="button"
                        onClick={copyBillingId}
                        className="p-1 rounded hover:bg-[#F1F3F4] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] transition cursor-pointer"
                        title="Copy Billing ID"
                      >
                        {copiedBillingId ? <Check className="w-3.5 h-3.5 text-[#188038]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Payments Profile ID</span>
                    <p className="font-mono text-xs text-[#202124] dark:text-[#F1F3F4] mt-0.5">9284-0193-4819</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Default Currency</span>
                    <p className="font-medium text-[#202124] dark:text-[#F1F3F4] mt-0.5">USD - United States Dollar ($)</p>
                  </div>

                  <div className="pt-2 border-t border-[#E8EAED] dark:border-[#3C4043]">
                    <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Payment Method</span>
                    <div className="flex items-center justify-between mt-1 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-5 rounded bg-white dark:bg-gray-800 border border-[#DADCE0] dark:border-[#5F6368] flex items-center justify-center text-[10px] font-bold text-blue-600 font-mono">
                          VISA
                        </div>
                        <div>
                          <div className="text-xs font-medium text-[#202124] dark:text-[#F1F3F4]">
                            Visa ending in 4242
                          </div>
                          <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">
                            Auto-charge on 1st of month
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-[#188038] dark:text-[#81C995] bg-[#E6F4EA] dark:bg-[#133E26] px-2 py-0.5 rounded-full">
                        Primary
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('payment-methods')}
                    className="flex-1 py-2 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#1A73E8] dark:text-[#8AB4F8] font-medium text-xs transition text-center cursor-pointer"
                  >
                    Manage Payment Methods
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('budgets')}
                    className="py-2 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] font-medium text-xs transition cursor-pointer"
                    title="Set Budget Alert"
                  >
                    Set Alerts
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Infrastructure Resource Table */}
            <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
                <div>
                  <h3 className="text-sm font-semibold text-[#202124] dark:text-[#F1F3F4]">
                    Infrastructure Services Breakdown
                  </h3>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                    Real-time consumption meters across Tiwlo Cloud regions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">Cycle:</span>
                  <select
                    className="text-xs bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] rounded-lg px-2.5 py-1 text-[#202124] dark:text-[#E8EAED] focus:outline-hidden"
                    defaultValue="september-2026"
                  >
                    <option value="september-2026">September 2026 (Current)</option>
                    <option value="august-2026">August 2026</option>
                    <option value="july-2026">July 2026</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#E8EAED] dark:border-[#3C4043] text-[#5F6368] dark:text-[#9AA0A6] font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Service Name</th>
                      <th className="py-2.5 px-3">SKU & Rate</th>
                      <th className="py-2.5 px-3">Usage Measured</th>
                      <th className="py-2.5 px-3">Gross Cost</th>
                      <th className="py-2.5 px-3">Credit Offset</th>
                      <th className="py-2.5 px-3 text-right">Net Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] dark:divide-[#3C4043]">
                    <tr className="hover:bg-[#F8F9FA] dark:hover:bg-[#282A2D] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[#E8F0FE] dark:bg-[#1A305A] text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center shrink-0">
                            <Server className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#202124] dark:text-[#F1F3F4]">Cloud Compute Engine (Droplets & VMs)</div>
                            <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">
                              {runningDropletsCount} Active droplet{runningDropletsCount !== 1 ? 's' : ''} running • Linux Ubuntu/Debian
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6] font-mono text-[11px]">$0.007/hr</td>
                      <td className="py-3 px-3 font-mono">{computeVcpuHours.toLocaleString()} vCPU-hrs</td>
                      <td className="py-3 px-3 font-mono">${computeGross.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[#188038] dark:text-[#81C995]">
                        {computeGross > 0 ? `-$${computeGross.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-right">$0.00</td>
                    </tr>

                    <tr className="hover:bg-[#F8F9FA] dark:hover:bg-[#282A2D] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[#E6F4EA] dark:bg-[#133E26] text-[#137333] dark:text-[#81C995] flex items-center justify-center shrink-0">
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#202124] dark:text-[#F1F3F4]">Cloud Object Storage & NVMe Volumes</div>
                            <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">NVMe SSD Disks & Automated Backups</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6] font-mono text-[11px]">$0.020/GB-mo</td>
                      <td className="py-3 px-3 font-mono">{storageTotalGb} GB-mo</td>
                      <td className="py-3 px-3 font-mono">${storageGross.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[#188038] dark:text-[#81C995]">
                        {storageGross > 0 ? `-$${storageGross.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-right">$0.00</td>
                    </tr>

                    <tr className="hover:bg-[#F8F9FA] dark:hover:bg-[#282A2D] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[#FEF7E0] dark:bg-[#332B00] text-[#B06000] dark:text-[#FDD663] flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#202124] dark:text-[#F1F3F4]">Tiwi AI Neural Token Platform</div>
                            <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">Model Inference & Context Embeddings</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6] font-mono text-[11px]">$0.0015/1k tok</td>
                      <td className="py-3 px-3 font-mono">{tiwiTokensCount.toLocaleString()} tokens</td>
                      <td className="py-3 px-3 font-mono">${tiwiTokensGross.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[#188038] dark:text-[#81C995]">
                        {tiwiTokensGross > 0 ? `-$${tiwiTokensGross.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-right">$0.00</td>
                    </tr>

                    <tr className="hover:bg-[#F8F9FA] dark:hover:bg-[#282A2D] transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[#FCE8E6] dark:bg-[#3C1A1A] text-[#C5221F] dark:text-[#F28B82] flex items-center justify-center shrink-0">
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#202124] dark:text-[#F1F3F4]">Virtual Private Cloud & Global Egress</div>
                            <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">Dedicated IPv4 & IPv6 Bandwidth</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6] font-mono text-[11px]">$0.010/GB</td>
                      <td className="py-3 px-3 font-mono">{(realDroplets.length * 28.5).toFixed(1)} GB</td>
                      <td className="py-3 px-3 font-mono">${vpcGross.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[#188038] dark:text-[#81C995]">
                        {vpcGross > 0 ? `-$${vpcGross.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-right">$0.00</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t-2 border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#282A2D]">
                      <td colSpan={3} className="py-3 px-3 text-[#202124] dark:text-[#F1F3F4]">
                        Total Month-to-Date Charges
                      </td>
                      <td className="py-3 px-3 font-mono">${totalMtdGross.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-[#188038] dark:text-[#81C995]">
                        {creditOffset > 0 ? `-$${creditOffset.toFixed(2)}` : '$0.00'}
                      </td>
                      <td className="py-3 px-3 font-mono text-right text-sm text-[#1A73E8] dark:text-[#8AB4F8]">
                        ${netMtdCost.toFixed(2)} USD
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Active Deployed Droplets Linked to Billing Account */}
              <div className="mt-4 pt-4 border-t border-[#E8EAED] dark:border-[#3C4043]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] dark:text-[#9AA0A6]">
                    Active Droplets Linked to Billing Account ({realDroplets.length})
                  </span>
                  <span className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                    Isolated per-user infrastructure
                  </span>
                </div>

                {realDroplets.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#DADCE0] dark:border-[#3C4043] rounded-xl text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                    No droplets deployed yet under this account. Create a droplet from the Cloud Dashboard to track live compute metrics.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {realDroplets.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#202124] dark:text-[#F1F3F4] flex items-center gap-1.5">
                            <span>{d.regionFlag || '🌐'}</span>
                            <span>{d.name}</span>
                          </div>
                          <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6] font-mono mt-0.5">
                            {d.specs} • {d.regionCode || d.region}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            d.status === 'Running'
                              ? 'text-[#188038] bg-[#E6F4EA] dark:bg-[#133E26]'
                              : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Invoices & Statements Table */}
            <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
                <div>
                  <h3 className="text-sm font-semibold text-[#202124] dark:text-[#F1F3F4]">
                    Recent Invoices & Payment Receipts
                  </h3>
                  <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                    Official tax invoices and credit grant statements
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (invoicesList[0]) {
                      handleDownloadInvoicePdf(invoicesList[0]);
                    } else {
                      showToast?.('No invoices available for download yet');
                    }
                  }}
                  className="py-1.5 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#1A73E8] dark:text-[#8AB4F8] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Latest PDF</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#E8EAED] dark:border-[#3C4043] text-[#5F6368] dark:text-[#9AA0A6] font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Document ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">Paid</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] dark:divide-[#3C4043]">
                    {invoicesList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                          No invoices recorded yet. Top up credits or deploy droplets to view transaction history.
                        </td>
                      </tr>
                    ) : (
                      invoicesList.slice(0, 5).map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#282A2D] transition">
                          <td className="py-3 px-3 font-mono font-medium text-[#1A73E8] dark:text-[#8AB4F8]">
                            {inv.id}
                          </td>
                          <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6]">{inv.date}</td>
                          <td className="py-3 px-3 font-medium text-[#202124] dark:text-[#F1F3F4]">
                            {inv.description}
                          </td>
                          <td className="py-3 px-3 text-[#5F6368] dark:text-[#9AA0A6]">{inv.period}</td>
                          <td className="py-3 px-3 font-mono">
                            {inv.isCreditGrant ? `+${inv.grantCredits} Credits` : `$${(inv.grossAmount || 0).toFixed(2)}`}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold">
                            ${(inv.netPaid || 0).toFixed(2)} USD
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              inv.isCreditGrant
                                ? 'bg-[#E6F4EA] text-[#137333] dark:bg-[#133E26] dark:text-[#81C995]'
                                : 'bg-blue-50 text-[#1A73E8] dark:bg-blue-950/40 dark:text-[#8AB4F8]'
                            }`}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoicePdf(inv)}
                                className="text-[#5F6368] hover:text-[#1A73E8] dark:text-[#9AA0A6] dark:hover:text-[#8AB4F8] font-medium inline-flex items-center gap-1 cursor-pointer transition"
                                title="Download PDF"
                              >
                                <Download className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                                <span>PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(inv)}
                                className="text-[#1A73E8] dark:text-[#8AB4F8] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: REPORTS & COST ANALYSIS */}
        {activeTab === 'reports' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
              <div>
                <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                  Cost Reports & Cloud Consumption Analytics
                </h3>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Interactive multi-dimensional cost reports across projects, services, and regions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">Group By:</span>
                <select className="text-xs bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] rounded-lg px-2.5 py-1 text-[#202124] dark:text-[#E8EAED]">
                  <option>Service</option>
                  <option>Project / Droplet</option>
                  <option>SKU</option>
                  <option>Region</option>
                </select>
              </div>
            </div>

            {/* Visual Bar Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043]">
                <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Compute Engine</div>
                <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#F1F3F4] mt-1">$0.00</div>
                <div className="text-[10px] text-[#188038] mt-1">100% Credit Covered</div>
              </div>
              <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043]">
                <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Cloud Storage</div>
                <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#F1F3F4] mt-1">$0.00</div>
                <div className="text-[10px] text-[#188038] mt-1">100% Credit Covered</div>
              </div>
              <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043]">
                <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Tiwi AI Tokens</div>
                <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#F1F3F4] mt-1">$0.00</div>
                <div className="text-[10px] text-[#188038] mt-1">100% Credit Covered</div>
              </div>
              <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043]">
                <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Virtual Private Cloud</div>
                <div className="text-xl font-bold font-mono text-[#202124] dark:text-[#F1F3F4] mt-1">$0.00</div>
                <div className="text-[10px] text-[#188038] mt-1">100% Credit Covered</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COST TABLE & SKUs */}
        {activeTab === 'cost-table' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
              Granular Resource Consumption Table
            </h3>
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              Detailed SKU-level meter pricing and usage tracking per compute core, memory block, and API call.
            </p>
            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Compute Core Utilization</span>
                <span className="font-mono text-[#188038]">0.0% (0 / 16 vCPUs active)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">NVMe Storage Allocation</span>
                <span className="font-mono text-[#188038]">0.0 GB of 250 GB provisioned</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Tiwi AI Token Throughput</span>
                <span className="font-mono text-[#188038]">0 tok / sec</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BUDGETS & ALERTS */}
        {activeTab === 'budgets' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
              <div>
                <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                  Budgets & Spending Threshold Alerts
                </h3>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Automated email notifications when monthly charges approach defined caps
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateBudgetModal(true)}
                className="py-2 px-3.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Budget</span>
              </button>
            </div>

            <div className="space-y-3">
              {budgetsList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#DADCE0] dark:border-[#3C4043] rounded-xl text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  No spending budget alerts configured yet. Create a budget to monitor cloud resources.
                </div>
              ) : (
                budgetsList.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-sm text-[#202124] dark:text-[#F1F3F4]">{b.name}</div>
                      <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                        Monthly Cap: <strong className="font-mono">${(b.targetAmount || 0).toFixed(2)} USD</strong> • Alerts at {(b.thresholds || [50, 90, 100]).join('%, ')}%
                      </div>
                      <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                        Alert Email: {b.alertEmail}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[#188038] bg-[#E6F4EA] dark:bg-[#133E26] px-2.5 py-1 rounded-full border border-[#CEEAD6] dark:border-[#1E5638]">
                        Monitoring Active
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteBudget(b.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete Budget Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: PROMOTIONAL CREDITS */}
        {activeTab === 'credits' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                Active Promotional Credit Grants
              </h3>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                These promotional credits offset all eligible Tiwlo Cloud infrastructure services.
              </p>
              <div className="p-4 rounded-xl border border-[#CEEAD6] dark:border-[#1E5638] bg-[#E6F4EA]/30 dark:bg-[#133E26]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#137333] dark:text-[#81C995]">
                    Welcome Cloud Free Tier Grant
                  </span>
                  <span className="font-mono font-bold text-sm text-[#188038] dark:text-[#81C995]">
                    {creditsBalance.toLocaleString()} CREDITS
                  </span>
                </div>
                <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                  Status: <strong>Active</strong> • Valid until December 31, 2026 • Offsets 100% of compute and Tiwi AI charges.
                </div>
              </div>
            </div>

            <div className="md:col-span-5 bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                Redeem Promo Code
              </h3>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                Have a promotional voucher or enterprise partner key? Enter it here to claim credits.
              </p>
              <form onSubmit={handleRedeemPromo} className="space-y-3">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. WELCOME2026 or CLOUD500"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] text-xs font-mono uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-[#1A73E8]"
                />
                <button
                  type="submit"
                  disabled={promoLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {promoLoading ? 'Validating Voucher...' : 'Redeem Credits'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENT METHODS */}
        {activeTab === 'payment-methods' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED] dark:border-[#3C4043]">
              <div>
                <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                  Registered Payment Methods
                </h3>
                <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                  Backup payment instruments for compute overages and balance replenishment
                </p>
              </div>
              <button
                type="button"
                onClick={() => showToast?.('Opening payment gateway modal...')}
                className="py-2 px-3.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Payment Method</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-[#1A73E8] bg-[#E8F0FE]/30 dark:bg-[#1A305A]/20 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-7 rounded bg-white dark:bg-gray-800 border border-[#DADCE0] dark:border-[#5F6368] flex items-center justify-center font-bold text-xs text-blue-600 font-mono shadow-xs">
                    VISA
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#202124] dark:text-[#F1F3F4]">
                      Visa ending in 4242
                    </h4>
                    <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">Expires 12/2028 • Default Payment Method</p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-[#188038] bg-[#E6F4EA] dark:bg-[#133E26] px-2 py-0.5 rounded-full">
                      Primary Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: INVOICES & STATEMENTS */}
        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
              All Billing Invoices & Statements
            </h3>
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              Historical tax invoices and credit ledger entries are retained for 7 years.
            </p>
            <div className="space-y-2">
              {invoicesList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#DADCE0] dark:border-[#3C4043] rounded-xl text-xs text-[#5F6368] dark:text-[#9AA0A6]">
                  No billing invoices or credit grants recorded yet. Add credits or deploy resources to begin.
                </div>
              ) : (
                invoicesList.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-[#202124] dark:text-[#F1F3F4] flex items-center gap-2">
                        <span>{inv.id}</span>
                        <span className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">({inv.date})</span>
                        <span className={`text-[9px] font-bold px-2 py-0.2 rounded-full ${
                          inv.isCreditGrant
                            ? 'bg-[#E6F4EA] text-[#137333] dark:bg-[#133E26] dark:text-[#81C995]'
                            : 'bg-blue-50 text-[#1A73E8] dark:bg-blue-950/40 dark:text-[#8AB4F8]'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">{inv.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoicePdf(inv)}
                        className="py-1 px-2.5 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-white dark:hover:bg-[#303134] text-[#202124] dark:text-[#E8EAED] font-medium inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        title="Download Official PDF"
                      >
                        <Download className="w-3 h-3 text-[#1A73E8] dark:text-[#8AB4F8]" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-1 px-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 8: ACCOUNT MANAGEMENT */}
        {activeTab === 'account-management' && (
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl p-6 shadow-xs space-y-5">
            <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
              Linked Cloud Infrastructure Projects & Roles
            </h3>
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              Resources associated with this Tiwlo Cloud Billing Account
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#202124] dark:text-[#F1F3F4]">Production Droplets (tiwlo-prod-cluster)</div>
                  <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">Project ID: prj-tiwlo-01 • 3 Active Droplets</div>
                </div>
                <span className="text-[10px] font-bold text-[#188038] bg-[#E6F4EA] dark:bg-[#133E26] px-2 py-0.5 rounded-full">
                  Billing Linked
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 mt-12 pt-6 border-t border-[#DADCE0] dark:border-[#3C4043] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5F6368] dark:text-[#9AA0A6] gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#34A853]" />
          <span>Tiwlo Cloud Enterprise Billing Infrastructure • SLA 99.99%</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hover:underline cursor-pointer" onClick={() => showToast?.('Opening Cloud Terms of Service...')}>Terms of Service</span>
          <span className="hover:underline cursor-pointer" onClick={() => showToast?.('Opening Cloud Privacy Policy...')}>Privacy Policy</span>
          <span className="hover:underline cursor-pointer text-[#1A73E8] dark:text-[#8AB4F8]" onClick={() => showToast?.('Opening Cloud Billing Documentation...')}>Billing FAQ & Docs ↗</span>
        </div>
      </div>

      {/* 5. Interactive "Add Cloud Credits" Modal (Pure Tiwlo Styling, NO Google Stripe) */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#202124] dark:text-[#F1F3F4]">
                      Add Tiwlo Cloud Credits
                    </h3>
                    <p className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                      Instant credit replenishment for Droplets & Tiwi AI
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCreditsModal(false)}
                  className="p-1 rounded-full text-[#5F6368] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bundle Selection Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368] dark:text-[#9AA0A6]">
                  Select Credit Bundle
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { amount: 10, credits: '1,000', bonus: null },
                    { amount: 25, credits: '2,750', bonus: '+10% Extra' },
                    { amount: 50, credits: '6,000', bonus: '+20% Popular' },
                    { amount: 100, credits: '13,000', bonus: '+30% Best Value' },
                  ].map((b) => {
                    const isSelected = selectedBundle === b.amount;
                    return (
                      <div
                        key={b.amount}
                        onClick={() => setSelectedBundle(b.amount)}
                        className={`p-3 rounded-xl border-2 transition cursor-pointer text-left relative ${
                          isSelected
                            ? 'border-[#1A73E8] bg-blue-50/60 dark:bg-blue-950/40'
                            : 'border-[#DADCE0] dark:border-[#3C4043] hover:border-slate-400 bg-white dark:bg-[#282A2D]'
                        }`}
                      >
                        {b.bonus && (
                          <span className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#188038] text-white">
                            {b.bonus}
                          </span>
                        )}
                        <div className="text-base font-bold text-[#202124] dark:text-[#F1F3F4] font-mono">
                          ${b.amount} USD
                        </div>
                        <div className="text-[11px] font-semibold text-[#1A73E8] dark:text-[#8AB4F8] mt-0.5">
                          {b.credits} Credits
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Selected */}
              <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded bg-white dark:bg-gray-800 border border-[#DADCE0] dark:border-[#5F6368] flex items-center justify-center font-bold text-[9px] text-blue-600 font-mono">
                    VISA
                  </div>
                  <span>Visa ending in 4242</span>
                </div>
                <span className="text-[10px] text-[#188038] font-semibold">Primary Card</span>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCreditsModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isPurchasing}
                  onClick={handlePurchaseCredits}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPurchasing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isPurchasing ? 'Processing...' : `Pay $${selectedBundle}.00`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Interactive "Create Budget" Modal */}
      {showCreateBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#202124] dark:text-[#F1F3F4]">
                Create Cloud Spending Budget
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateBudgetModal(false)}
                className="p-1 rounded-full text-[#5F6368] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1">Budget Name</label>
                <input
                  type="text"
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="e.g. Monthly Droplets Threshold"
                  className="w-full px-3 py-2 rounded-lg bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] focus:outline-hidden focus:ring-2 focus:ring-[#1A73E8]"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1">Target Amount (USD / Month)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#DADCE0] dark:border-[#3C4043] font-mono focus:outline-hidden focus:ring-2 focus:ring-[#1A73E8]"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#282A2D] border border-[#E8EAED] dark:border-[#3C4043] text-[11px] text-[#5F6368] dark:text-[#9AA0A6] space-y-1">
                <p>Trigger alerts will be automatically sent when consumption reaches:</p>
                <p>• <strong>50%</strong> (${((parseFloat(newBudgetAmount) || 50) * 0.5).toFixed(2)})</p>
                <p>• <strong>90%</strong> (${((parseFloat(newBudgetAmount) || 50) * 0.9).toFixed(2)})</p>
                <p>• <strong>100%</strong> (${((parseFloat(newBudgetAmount) || 50) * 1.0).toFixed(2)})</p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBudgetModal(false)}
                  className="flex-1 py-2 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-[#5F6368] dark:text-[#9AA0A6] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white font-medium shadow-xs"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Interactive "View Invoice / Statement" Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#202124] border border-[#DADCE0] dark:border-[#3C4043] rounded-2xl w-full max-w-xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E8EAED] dark:border-[#3C4043] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F1F3F4] dark:bg-[#303134] border border-[#DADCE0] dark:border-[#5F6368] flex items-center justify-center p-1 shrink-0">
                  <img src="/tiwlo-icon.png" alt="Tiwlo" className="w-full h-full object-contain dark:hidden" />
                  <img src="/tiwlo-icon-dark.png" alt="Tiwlo" className="w-full h-full object-contain hidden dark:block" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#202124] dark:text-[#F1F3F4]">
                    Tiwlo Cloud Official Invoice
                  </h3>
                  <p className="text-xs font-mono text-[#5F6368] dark:text-[#9AA0A6]">
                    {selectedInvoice.id} • {selectedInvoice.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-full text-[#5F6368] hover:bg-[#F1F3F4] dark:hover:bg-[#303134] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill To & Billing Account Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] uppercase tracking-wider">Billed To</span>
                <p className="font-semibold text-[#202124] dark:text-[#F1F3F4] mt-0.5">{currentUser?.name || currentUser?.storeName || 'Tiwlo Store'}</p>
                <p className="text-[#5F6368] dark:text-[#9AA0A6] font-mono">{currentUser?.email || 'admin@tiwlo.com'}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#5F6368] dark:text-[#9AA0A6] uppercase tracking-wider">Account ID</span>
                <p className="font-mono font-medium text-[#202124] dark:text-[#F1F3F4] mt-0.5">{billingAccountId}</p>
                <p className="text-[#5F6368] dark:text-[#9AA0A6]">Billing Period: {selectedInvoice.period}</p>
              </div>
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto border border-[#E8EAED] dark:border-[#3C4043] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FA] dark:bg-[#282A2D] border-b border-[#E8EAED] dark:border-[#3C4043] text-[11px] uppercase text-[#5F6368] dark:text-[#9AA0A6]">
                  <tr>
                    <th className="py-2 px-3">Service & Description</th>
                    <th className="py-2 px-3">Usage</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED] dark:divide-[#3C4043]">
                  {selectedInvoice.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#202124] dark:text-[#F1F3F4]">{it.service}</div>
                        <div className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">{it.desc}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{it.usage}</td>
                      <td className={`py-2.5 px-3 font-mono text-right ${it.amount < 0 ? 'text-[#188038] dark:text-[#81C995]' : ''}`}>
                        {it.amount < 0 ? `-$${Math.abs(it.amount).toFixed(2)}` : `$${it.amount.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#DADCE0] dark:border-[#3C4043] bg-[#F8F9FA] dark:bg-[#282A2D] font-bold">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-right">Total Net Paid:</td>
                    <td className="py-2.5 px-3 font-mono text-right text-sm text-[#188038] dark:text-[#81C995]">
                      ${selectedInvoice.netPaid.toFixed(2)} USD
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6]">
                Issued by Tiwlo Enterprise Cloud Systems Ltd.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="py-2 px-3 rounded-lg border border-[#DADCE0] dark:border-[#5F6368] hover:bg-[#F8F9FA] dark:hover:bg-[#303134] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadInvoicePdf(selectedInvoice);
                    setSelectedInvoice(null);
                  }}
                  className="py-2 px-3.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
