import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceActivateView({ onBack, onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const catalog = await WorkspaceAPI.getMarketplaceCatalog();
        setProducts(catalog || []);
      } catch (err) {
        setLoadError(err.message || 'Could not load activation options.');
      }
    }
    init();
  }, []);

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
          Browse published products. Activation remains unavailable until a deployment provider is connected.
        </p>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl text-[13px] border bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]">
          {loadError}
        </div>
      )}

      {/* 2. Modern Google Material 3 Form Card */}
      <form onSubmit={(event) => event.preventDefault()} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-6 shadow-none">
        {/* Solution to Deploy */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Select Solution
          </label>
          <select
            value=""
            disabled
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
          >
            <option value="" disabled>Select a Marketplace product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category || 'General'}) — {p.price || 'Free'}
              </option>
            ))}
          </select>
          {products.length === 0 && <p className="text-[12px] text-[#747775]">No published Marketplace products are currently available.</p>}
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

        <p className="text-[12px] text-[#747775]">A deployment provider is not configured, so products cannot be marked active or added to Workspace.</p>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full cursor-pointer"
          >
            Cancel
          </button>
          <button type="button" disabled className="px-6 py-2.5 text-[13px] font-medium text-[#747775] bg-[#F0F4F9] rounded-full cursor-not-allowed">
            Activation unavailable
          </button>
        </div>
      </form>
    </div>
  );
}
