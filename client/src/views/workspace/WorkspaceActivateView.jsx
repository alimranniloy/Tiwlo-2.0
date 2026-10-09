import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceActivateView({ onBack, onNavigate }) {
  const [servers, setServers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('prod_sentinel');
  const [selectedServerName, setSelectedServerName] = useState('Creative Hub');
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
      const selectedProd = products.find((p) => p.id === selectedProductId) || {
        name: 'Sentinel',
        category: 'Moderation',
        iconType: 'shield'
      };

      await WorkspaceAPI.activateWorkspaceService({
        serviceId: selectedProd.id,
        name: selectedProd.name,
        category: selectedProd.category,
        iconType: selectedProd.iconType || 'shield',
        serverName: selectedServerName,
        plan,
        usageLabel: '0 of 1,000'
      });

      setMsg({ text: `${selectedProd.name} activated successfully in workspace!`, type: 'success' });
      setTimeout(() => {
        onNavigate?.('workspace');
      }, 1000);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to activate service', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-7 pb-16">
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Activate Service
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Deploy an add-on or bot service to one of your connected workspace servers.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleActivate} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            Select Add-on / Service
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category}) — by {p.developer}
              </option>
            ))}
            <option value="custom_autoroles">Auto Roles (Automation)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            Target Connected Server
          </label>
          <select
            value={selectedServerName}
            onChange={(e) => setSelectedServerName(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="Creative Hub">Creative Hub</option>
            <option value="Design Collective">Design Collective</option>
            <option value="Gaming Lounge">Gaming Lounge</option>
            {servers.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
            Plan Tier
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="Free">Free (Standard)</option>
            <option value="Pro">Pro Tier ($5 / month)</option>
            <option value="Growth">Growth Tier ($8 / month)</option>
            <option value="Starter">Starter Tier ($4 / month)</option>
          </select>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-gray-100">
          <button
            type="button"
            onClick={() => onNavigate?.('workspace')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <span>Cancel</span>
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{submitting ? 'Activating...' : 'Activate Now'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
