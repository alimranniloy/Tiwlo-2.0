import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Layers,
  Server
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceActivateView({ onBack, onNavigate }) {
  const [servers, setServers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('prod_sentinel');
  const [selectedServerName, setSelectedServerName] = useState('Production Cluster');
  const [plan, setPlan] = useState('Free');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const [srvList, catalog] = await Promise.all([
          WorkspaceAPI.getConnectedServers(),
          WorkspaceAPI.getMarketplaceCatalog()
        ]);
        setServers(srvList || []);
        setProducts(catalog || []);
        if (catalog && catalog.length > 0) {
          setSelectedProductId(catalog[0].id);
        }
        if (srvList && srvList.length > 0) {
          setSelectedServerName(srvList[0].name);
        }
      } catch (err) {
        console.warn('Could not load activation form data:', err);
      }
    }
    init();
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const selectedProd = products.find((p) => String(p.id) === String(selectedProductId)) || {
        name: 'Sentinel AutoMod',
        category: 'Moderation',
        icon: 'shield'
      };

      await WorkspaceAPI.activateWorkspaceService({
        name: selectedProd.name,
        type: selectedProd.category || 'general',
        plan: plan === 'Free' ? 'Free Community' : `${plan} Tier`,
        serverName: selectedServerName,
        icon: selectedProd.icon || 'shield'
      });

      setMsg({ text: `Provisioned and activated "${selectedProd.name}" successfully!`, type: 'success' });
      setTimeout(() => {
        onNavigate?.('workspace');
      }, 800);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to activate service', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Material 3 Header */}
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workspace</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Activate service</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Activate Workspace Service
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Deploy an extension, automation bot, or governance service to your target environment.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-2xl text-[13px] font-medium flex items-center gap-2.5 border ${
            msg.type === 'success'
              ? 'bg-[#C4EED0]/30 text-[#072711] border-[#C4EED0]'
              : 'bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#B3261E]" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Modern Google Material 3 Form Card */}
      <form onSubmit={handleActivate} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-6 shadow-none">
        {/* Solution to Deploy */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Select Solution
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category || 'General'}) — {p.price || 'Free'}
              </option>
            ))}
          </select>
          <div className="flex justify-between items-center text-[12px] pt-1">
            <span className="text-[#747775]">Need more solutions?</span>
            <button
              type="button"
              onClick={() => onNavigate?.('marketplace')}
              className="text-[#0B57D0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Marketplace Catalog</span>
            </button>
          </div>
        </div>

        {/* Target Server */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Target Environment / Server
          </label>
          <select
            value={selectedServerName}
            onChange={(e) => setSelectedServerName(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.region || 'Global'})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#747775]">
            The service daemon will be registered and scheduled on this target node.
          </p>
        </div>

        {/* Plan Tier */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Allocation Tier
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
          >
            <option value="Free">Free Community (Up to 1,000 monthly events)</option>
            <option value="Standard">Standard Tier (Up to 25,000 monthly events)</option>
            <option value="Pro">Pro Enterprise (Unlimited events with dedicated queue)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Activating Service...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Activate Service</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
