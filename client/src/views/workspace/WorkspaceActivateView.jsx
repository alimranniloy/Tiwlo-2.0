import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Image,
  MessageCircle,
  RotateCw,
  ShoppingBag,
  Upload,
  X
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

function ProductIcon({ product, className = 'w-6 h-6' }) {
  if (product?.iconType === 'discord') return <Bot className={className} />;
  if (product?.iconType === 'whatsapp') return <MessageCircle className={className} />;
  return <ShoppingBag className={className} />;
}

export default function WorkspaceActivateView({ onBack, onNavigate, showToast }) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  useEffect(() => {
    let mounted = true;
    WorkspaceAPI.getMarketplaceCatalog()
      .then((catalog) => {
        if (mounted) setProducts(Array.isArray(catalog) ? catalog : []);
      })
      .catch((err) => {
        if (mounted) setLoadError(err.message || 'Could not load activation options.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => {
    if (iconPreview.startsWith('blob:')) URL.revokeObjectURL(iconPreview);
  }, [iconPreview]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!selectedProduct) {
      setSubmitError('Select a Marketplace product to continue.');
      return;
    }
    if (!serviceName.trim()) {
      setSubmitError('Service name is required so you can identify it in Workspace.');
      return;
    }

    setSaving(true);
    try {
      const logoUrl = iconFile ? await WorkspaceAPI.uploadWorkspaceIcon(iconFile) : null;
      const activation = await WorkspaceAPI.activateMarketplaceProduct(selectedProduct.id, {
        serviceName: serviceName.trim(),
        logoUrl
      });
      if (!activation?.service?.id) {
        throw new Error('The product was not added to Workspace. Please try again.');
      }
      showToast?.(`${serviceName.trim()} is now enabled in Workspace.`);
      onNavigate?.('workspace');
    } catch (err) {
      setSubmitError(err.message || 'Could not enable this product in Workspace.');
    } finally {
      setSaving(false);
    }
  };

  const handleIconChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    setSubmitError('');
    if (!file) {
      setIconFile(null);
      setIconPreview('');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
      setSubmitError('Choose a JPG, PNG, WebP, GIF, or AVIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Icon images must be 5 MB or smaller.');
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans">
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workspace</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Add product</span>
        </button>
        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Add a product to Workspace
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Choose a Marketplace product and give this Workspace service a recognizable name.
        </p>
      </div>

      {(loadError || submitError) && (
        <div role="alert" className="p-4 rounded-2xl text-[13px] border bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]">
          {loadError || submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <label htmlFor="workspace-product" className="block text-[13px] font-medium text-[#1F1F1F]">
            Marketplace product <span className="text-[#B3261E]">*</span>
          </label>
          <select
            id="workspace-product"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            required
            disabled={loading || products.length === 0}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-3 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none disabled:opacity-60"
          >
            <option value="" disabled>
              {loading ? 'Loading products…' : 'Select a Marketplace product'}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.category || 'Product'} · {product.price || 'Free'}
              </option>
            ))}
          </select>
          {!loading && products.length === 0 && !loadError && (
            <p className="text-[12px] text-[#747775]">No published Marketplace products are currently available.</p>
          )}
        </div>

        {selectedProduct && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-[#E0E2EC] bg-[#F8FAFD]">
            {selectedProduct.logoUrl ? (
              <img src={selectedProduct.logoUrl} alt="" className="w-11 h-11 rounded-xl object-contain bg-white" />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: selectedProduct.iconBg || '#0B57D0' }}
              >
                <ProductIcon product={selectedProduct} className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F1F1F]">{selectedProduct.name}</p>
              <p className="text-xs text-[#5F6368] mt-0.5">{selectedProduct.description}</p>
              <p className="text-[11px] text-[#747775] mt-1">
                Product identity will stay linked to the service in Workspace.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="workspace-service-name" className="block text-[13px] font-medium text-[#1F1F1F]">
            Workspace service name <span className="text-[#B3261E]">*</span>
          </label>
          <input
            id="workspace-service-name"
            type="text"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            required
            maxLength={255}
            placeholder={selectedProduct ? `${selectedProduct.name} — e.g. Main community` : 'e.g. Main community Discord bot'}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-3 text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:bg-white focus:border-[#0B57D0] focus:outline-none"
          />
          <p className="text-[11px] text-[#747775]">
            This name identifies this installation; the selected product name is also shown separately.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">Service icon</label>
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F4F9] border border-[#E0E2EC] flex items-center justify-center overflow-hidden text-[#5F6368]">
              {iconPreview ? (
                <img src={iconPreview} alt="Selected service icon preview" className="w-full h-full object-cover" />
              ) : selectedProduct?.logoUrl ? (
                <img src={selectedProduct.logoUrl} alt="" className="w-full h-full object-contain" />
              ) : selectedProduct ? (
                <span className="w-full h-full flex items-center justify-center text-white" style={{ backgroundColor: selectedProduct.iconBg || '#0B57D0' }}>
                  <ProductIcon product={selectedProduct} className="w-6 h-6" />
                </span>
              ) : (
                <Image className="w-6 h-6" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#747775]/30 text-[12px] font-medium text-[#0B57D0] hover:bg-[#F2F6FC] cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload icon
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={handleIconChange} />
              </label>
              {iconFile && (
                <button
                  type="button"
                  onClick={() => {
                    setIconFile(null);
                    setIconPreview('');
                  }}
                  aria-label="Remove uploaded icon"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:bg-[#F0F4F9]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[#747775]">Optional. JPG, PNG, WebP, GIF, or AVIF up to 5 MB. Otherwise the product icon is used.</p>
        </div>

        <div className="rounded-xl border border-[#DADCE0] bg-[#F8FAFD] p-4 text-[12px] text-[#5F6368]">
          This enables the product entry in Workspace for configuration and management. It does not claim that an external provider has deployed or connected it.
        </div>

        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.('marketplace')}
            className="text-[#0B57D0] hover:underline font-medium inline-flex items-center gap-1.5 text-[12px] cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Browse Marketplace
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading || !products.length}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Enabling…' : 'Enable in Workspace'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
