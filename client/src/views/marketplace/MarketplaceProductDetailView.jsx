import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  Check,
  Shield,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function MarketplaceProductDetailView({ productId, onBack }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const catalog = await WorkspaceAPI.getMarketplaceCatalog();
        const found = (catalog || []).find((p) => String(p.id) === String(productId));
        setProduct(found || null);
      } catch (err) {
        setMsg({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (productId) loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#444746]">Loading solution specifications...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-[#B3261E] mx-auto" />
        <h2 className="text-lg font-medium text-[#1F1F1F]">Solution Not Found</h2>
        <p className="text-[13px] text-[#444746]">The requested solution could not be located in the catalog.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white text-[13px] font-medium rounded-full transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Google Subheader with Breadcrumbs */}
      <div className="flex items-center justify-between border-b border-[#E0E2EC] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
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

      {/* 2. Modern Google Product Hero Card */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {product.logoUrl ? <img src={product.logoUrl} alt="" className="w-16 h-16 rounded-2xl object-contain shrink-0" /> : (
              <div className="w-16 h-16 rounded-2xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
                <Shield className="w-8 h-8 stroke-[1.8]" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">{product.name}</h1>
                {product.verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B57D0] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 fill-[#0B57D0] text-white" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#444746] mt-1">
                Published by <span className="text-[#1F1F1F] font-medium">{product.developer || 'Publisher not specified'}</span>
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3 text-[12px] text-[#444746]">
                {product.rating != null && <span className="inline-flex items-center gap-1 font-medium text-[#1F1F1F]"><Star className="w-3.5 h-3.5 fill-[#F29900] text-[#F29900]" />{Number(product.rating).toFixed(1)}</span>}
                {product.installCount != null && <span>{Number(product.installCount).toLocaleString()} installations</span>}
                <span className="capitalize">{product.category || 'Extension'}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Deployment Panel */}
          <div className="bg-[#F8FAFD] border border-[#E0E2EC] rounded-2xl p-5 min-w-[280px]">
            <div className="text-xs text-[#444746]">Pricing Model</div>
            <div className="text-2xl font-normal text-[#1F1F1F] mt-0.5">
              {product.price || 'Pricing not specified'}
            </div>
            <p className="text-[11px] text-[#444746] mt-1">
              {product.description}
            </p>

            <p className="mt-4 text-[12px] text-[#747775]">
              Activation is unavailable because no deployment provider is connected.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Feedback Banner */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-[13px] flex items-center gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]'
              : 'bg-[#C4EED0] text-[#072711] border-[#A7E8BD]'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 4. Specifications & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 space-y-4 shadow-xs">
            <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F1F3F8] pb-3">
              Overview & Capabilities
            </h2>
            <p className="text-[13px] text-[#444746] leading-relaxed">
              {product.description || 'No product description has been provided.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {(Array.isArray(product.features) ? product.features : []).map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px] text-[#1F1F1F]">
                  <Check className="w-4 h-4 text-[#072711] shrink-0" />
                  <span>{typeof feat === 'string' ? feat : feat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 space-y-3.5 text-[13px] shadow-xs">
            <h3 className="text-[14px] font-medium text-[#1F1F1F] border-b border-[#F1F3F8] pb-2">
              Metadata
            </h3>
            <div className="flex justify-between">
              <span className="text-[#444746]">Category</span>
              <span className="text-[#1F1F1F] font-medium capitalize">{product.category || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#444746]">Publisher</span>
              <span className="text-[#1F1F1F] font-medium">{product.developer || 'Publisher not specified'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
