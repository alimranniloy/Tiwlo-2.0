import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  Check,
  Shield,
  RotateCw,
  AlertCircle,
  Bot,
  MessageCircle,
  CreditCard,
  Wallet
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';
import { applicationFetch as fetch } from '../../api/graphqlTransport.js';

export default function MarketplaceProductDetailView({ productId, currentUser, onBack, onNavigate }) {
  const [product, setProduct] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [msg, setMsg] = useState(null);

  // Paid subscription state for Discord & WhatsApp Bot packages
  const [packages, setPackages] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [activeSub, setActiveSub] = useState(null);
  const [creditsBalance, setCreditsBalance] = useState(null);

  const paidServiceType =
    productId === 'tiwlo-discord-bot-manager' ? 'discord'
      : productId === 'tiwlo-whatsapp-automation' ? 'whatsapp'
      : null;

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const catalog = await WorkspaceAPI.getMarketplaceCatalog();
        const found = (catalog || []).find((p) => String(p.id) === String(productId));
        if (cancelled) return;
        setProduct(found || null);
        setServiceName(found?.name || '');

        if (paidServiceType) {
          const [pkgs, subRes, billingRes] = await Promise.all([
            WorkspaceAPI.getServicePackages(paidServiceType).catch(() => []),
            WorkspaceAPI.getServiceSubscription(paidServiceType).catch(() => null),
            fetch('/api/cloud/billing', { credentials: 'include' })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          ]);
          if (cancelled) return;
          setPackages(Array.isArray(pkgs) ? pkgs : []);
          const currentSub = subRes?.subscription?.isActive ? subRes.subscription : null;
          setActiveSub(currentSub);
          if (currentSub?.planId) {
            setSelectedPlanId(currentSub.planId);
          } else if (Array.isArray(pkgs) && pkgs.length > 0) {
            const popular = pkgs.find((p) => p.badge) || pkgs[0];
            setSelectedPlanId(popular.planId);
          }
          const rawCredits = billingRes?.credits ?? billingRes?.account?.credits;
          if (rawCredits !== undefined && rawCredits !== null) {
            setCreditsBalance(Number(rawCredits || 0));
          }
        }
      } catch (err) {
        if (!cancelled) setMsg({ text: err.message, type: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (productId) loadData();
    return () => {
      cancelled = true;
    };
  }, [productId, paidServiceType, currentUser?.id]);

  const selectedPlan = packages.find((p) => p.planId === selectedPlanId) || null;
  const needsPlanPurchase = Boolean(paidServiceType && !activeSub);

  const handleEnable = async () => {
    setMsg(null);
    if (!serviceName.trim()) {
      setMsg({ text: 'Enter a name for this Workspace service.', type: 'error' });
      return;
    }
    if (needsPlanPurchase && !selectedPlanId) {
      setMsg({ text: 'Select a paid subscription package using Tiwlo Credits.', type: 'error' });
      return;
    }
    setEnabling(true);
    try {
      const payload = { serviceName: serviceName.trim() };
      if (paidServiceType && (!activeSub || (selectedPlanId && selectedPlanId !== activeSub.planId))) {
        payload.planId = selectedPlanId;
      }
      await WorkspaceAPI.activateMarketplaceProduct(product.id, payload);
      onNavigate?.('workspace');
    } catch (error) {
      if (Array.isArray(error.packages) && error.packages.length > 0) {
        setPackages(error.packages);
        if (!selectedPlanId) setSelectedPlanId(error.packages[0].planId);
      }
      setMsg({ text: error.message || 'Could not enable this product in Workspace.', type: 'error' });
    } finally {
      setEnabling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#e2e2e2] rounded-2xl p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#000000] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#444746]">Loading solution specifications...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white border border-[#e2e2e2] rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-[#B3261E] mx-auto" />
        <h2 className="text-lg font-medium text-[#1F1F1F]">Solution Not Found</h2>
        <p className="text-[13px] text-[#444746]">The requested solution could not be located in the catalog.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#000000] hover:bg-[#3c3c3c] text-white text-[13px] font-medium rounded-full transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans bg-white">
      {/* Subheader */}
      <div className="flex items-center justify-between border-b border-[#e2e2e2] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#000000] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <div className="flex items-center gap-2 text-[12px] text-[#444746]">
          <span>Marketplace</span>
          <span>/</span>
          <span className="text-[#1F1F1F] font-medium">{product.name}</span>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white border border-[#e2e2e2] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            {product.logoUrl ? <img src={product.logoUrl} alt="" className="w-16 h-16 rounded-2xl object-contain shrink-0" /> : (
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                  product.iconType === 'discord' ? 'bg-[#1ED760] text-black'
                    : product.iconType === 'whatsapp' ? 'bg-[#25D366] text-white'
                    : 'bg-[#efefef] text-[#000000]'
                }`}
              >
                {product.iconType === 'discord'
                  ? <Bot className="w-8 h-8 stroke-[1.8]" />
                  : product.iconType === 'whatsapp'
                    ? <MessageCircle className="w-8 h-8 stroke-[1.8]" />
                    : <Shield className="w-8 h-8 stroke-[1.8]" />}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">{product.name}</h1>
                {product.verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#000000] bg-[#efefef] px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-[#000000] text-white" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#444746] mt-1">
                Published by <span className="text-[#1F1F1F] font-medium">{product.developer || 'Tiwlo Official'}</span>
              </p>

              <div className="flex items-center gap-4 mt-3 text-[12px] text-[#444746]">
                {product.rating != null && <span className="inline-flex items-center gap-1 font-medium text-[#1F1F1F]"><Star className="w-3.5 h-3.5 fill-[#F29900] text-[#F29900]" />{Number(product.rating).toFixed(1)}</span>}
                {product.installCount != null && <span>{Number(product.installCount).toLocaleString()} installations</span>}
                <span className="capitalize">{product.category || 'Extension'}</span>
              </div>

              {paidServiceType && (
                <div className="mt-4 rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 px-3.5 py-2.5 text-xs text-emerald-950">
                  {paidServiceType === 'discord'
                    ? 'Powered by Tiwlo Official Discord AI Bot — paid subscription via Tiwlo Credits required (no custom bot creation needed).'
                    : 'Paid WhatsApp Business Automation subscription via Tiwlo Credits required to launch QR sessions & AI replies.'}
                </div>
              )}
            </div>
          </div>

          {/* Pricing & Deployment Panel */}
          <div className="bg-[#fafafa] border border-[#e2e2e2] rounded-2xl p-5 w-full lg:w-[360px] shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-[#444746]">Pricing Model</div>
              {creditsBalance !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700">
                  <Wallet className="w-3.5 h-3.5 text-[#1ED760]" />
                  Credits: ${creditsBalance.toFixed(2)}
                </span>
              )}
            </div>

            <div className="text-2xl font-normal text-[#1F1F1F] mt-0.5">
              {selectedPlan
                ? `$${Number(selectedPlan.price || 0).toFixed(2)}/mo`
                : (product.price || 'Paid Subscription')}
            </div>

            {paidServiceType && activeSub && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#1ED760]/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Plan: {activeSub.planName}
              </div>
            )}

            {paidServiceType && packages.length > 0 && (
              <div className="mt-4 space-y-2">
                <label className="block text-[12px] font-medium text-[#444746]">
                  Select Subscription Package (Tiwlo Credits)
                </label>
                <div className="space-y-1.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPlanId === pkg.planId;
                    const isCurrent = activeSub?.planId === pkg.planId;
                    return (
                      <button
                        key={pkg.planId}
                        type="button"
                        onClick={() => setSelectedPlanId(pkg.planId)}
                        className={`w-full rounded-xl border p-2.5 text-left transition ${
                          isSelected
                            ? 'border-[#1ED760] bg-[#1ED760]/10 ring-1 ring-[#1ED760]'
                            : 'border-[#e2e2e2] bg-white hover:border-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                          <span>
                            {pkg.planName} {isCurrent ? '(Active)' : ''}
                          </span>
                          <span className="tabular-nums text-emerald-800">
                            ${Number(pkg.price || 0).toFixed(2)}/mo
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {paidServiceType === 'discord'
                            ? `${pkg.maxServersPerBot} server(s) · ${Number(pkg.monthlyCommandsLimit || 0).toLocaleString()} AI cmds/mo`
                            : `${pkg.maxSessions} session(s) · ${Number(pkg.monthlyMessagesLimit || 0).toLocaleString()} msgs/mo`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label htmlFor="marketplace-service-name" className="block mt-4 text-[12px] font-medium text-[#444746]">
              Workspace service name
            </label>
            <input
              id="marketplace-service-name"
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              maxLength={255}
              className="mt-1.5 w-full rounded-xl border border-[#e2e2e2] bg-white px-3 py-2 text-[13px] text-[#1F1F1F] focus:border-[#000000] focus:outline-none"
            />
            <p className="mt-2 text-[11px] text-[#636363]">
              {paidServiceType
                ? 'Activating charges your Tiwlo Credits for the selected plan unless you already hold that active plan.'
                : 'Enablement adds this product to your Workspace.'}
            </p>
            <button
              type="button"
              onClick={handleEnable}
              disabled={enabling || !serviceName.trim() || (needsPlanPurchase && !selectedPlanId)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-black bg-[#1ED760] hover:bg-[#19c354] rounded-full transition-colors cursor-pointer disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              {enabling
                ? 'Processing Credits…'
                : (paidServiceType && (!activeSub || selectedPlanId !== activeSub.planId) && selectedPlan)
                  ? `Pay $${Number(selectedPlan.price || 0).toFixed(2)} Credits & Enable`
                  : 'Enable in Workspace'}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-[13px] flex items-center justify-between gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]'
              : 'bg-[#C4EED0] text-[#072711] border-[#A7E8BD]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          {msg.type === 'error' && paidServiceType && (
            <a href="/cloud/billing" className="text-xs font-semibold underline shrink-0">
              Top Up Credits →
            </a>
          )}
        </div>
      )}

      {/* Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#e2e2e2] rounded-2xl p-6 space-y-4 shadow-xs">
            <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#f3f3f3] pb-3">
              Overview &amp; Capabilities
            </h2>
            <p className="text-[13px] text-[#444746] leading-relaxed">
              {product.description || 'No product description has been provided.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {(Array.isArray(product.features) ? product.features : []).map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px] text-[#1F1F1F]">
                  <Check className="w-4 h-4 text-[#1ED760] shrink-0" />
                  <span>{typeof feat === 'string' ? feat : feat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-[#e2e2e2] rounded-2xl p-6 space-y-3.5 text-[13px] shadow-xs">
            <h3 className="text-[14px] font-medium text-[#1F1F1F] border-b border-[#f3f3f3] pb-2">
              Metadata
            </h3>
            <div className="flex justify-between">
              <span className="text-[#444746]">Category</span>
              <span className="text-[#1F1F1F] font-medium capitalize">{product.category || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#444746]">Publisher</span>
              <span className="text-[#1F1F1F] font-medium">{product.developer || 'Tiwlo Official'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#444746]">Billing</span>
              <span className="text-[#1F1F1F] font-medium">{paidServiceType ? 'Tiwlo Credits (Monthly)' : (product.price || 'Standard')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
