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
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workspace</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Activate service</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Activate Workspace Service
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Deploy an extension, automation bot, or governance service to your target environment.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-lg text-[13px] font-medium flex items-center gap-2.5 border ${
            msg.type === 'success'
              ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
              : 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#C5221F]" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Google Cloud Form Card */}
      <form onSubmit={handleActivate} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-6">
        {/* Solution to Deploy */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Select Solution
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category || 'General'}) — {p.price || 'Free'}
              </option>
            ))}
          </select>
          <div className="flex justify-between items-center text-[12px] pt-1">
            <span className="text-[#5F6368]">Need more solutions?</span>
            <button
              type="button"
              onClick={() => onNavigate?.('marketplace')}
              className="text-[#1A73E8] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Marketplace Catalog</span>
            </button>
          </div>
        </div>

        {/* Target Server */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Target Environment / Server
          </label>
          <select
            value={selectedServerName}
            onChange={(e) => setSelectedServerName(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} ({s.region || 'Global'})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[#5F6368]">
            The service daemon will be registered and scheduled on this target node.
          </p>
        </div>

        {/* Plan Tier */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Allocation Tier
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          >
            <option value="Free">Free Community (Up to 1,000 monthly events)</option>
            <option value="Standard">Standard Tier (Up to 25,000 monthly events)</option>
            <option value="Pro">Pro Enterprise (Unlimited events with dedicated queue)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F1F3F4] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
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
