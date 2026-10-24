import React, { useState } from 'react';
import { X, Star, ShoppingBag, Check } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency, getProductDiscount, productDescriptionText } from '../storefrontUtils';

export default function TiwiQuickViewModal({ product, isOpen, onClose, onAddToCart }) {
  const { storeSettings } = useStoreSettings();
  const [added, setAdded] = useState(false);

  if (!isOpen || !product) return null;

  const handleAdd = () => {
    onAddToCart?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const discount = getProductDiscount(product);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col md:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Image Column */}
        <div className="md:w-1/2 p-6 bg-slate-50 flex items-center justify-center">
          <img
            src={product.image || product.images?.[0]}
            alt={product.name}
            className="max-h-64 object-contain drop-shadow-lg"
          />
        </div>

        {/* Right Info Column */}
        <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded-full">
                {product.category || 'General'}
              </span>
              {discount && (
                <span className="bg-[#ef4444] text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                  -{discount.percent}%
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mt-2 leading-tight">
              {product.name}
            </h3>

            {/* Rating */}
            {(product.rating != null || product.reviews != null) && <div className="flex items-center space-x-2 mt-1 text-xs text-slate-500">
              {product.rating != null && (
              <div className="flex items-center text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
              </div>
              )}
              {product.rating != null && <span className="font-bold text-slate-800">{product.rating}</span>}
              {product.reviews != null && <span>({product.reviews} reviews)</span>}
            </div>}

            {/* Price */}
            <div className="flex items-baseline space-x-2.5 mt-3">
              <span className="text-2xl font-black text-slate-900">
                {formatStoreCurrency(product.price, storeSettings)}
              </span>
              {discount && (
                <span className="text-sm text-slate-400 line-through">
                  {formatStoreCurrency(discount.originalPrice, storeSettings)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed line-clamp-3">
              {productDescriptionText(product.description) || 'No product description has been provided.'}
            </p>

            {/* Meta */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
              <p><span className="font-semibold text-slate-700">SKU:</span> {product.sku}</p>
              {product.stock != null && <p><span className="font-semibold text-slate-700">Stock Status:</span> <span className="text-slate-600 font-bold">{product.status || (Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock')} ({Number(product.stock)} units)</span></p>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleAdd}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-md ${
                added
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#2563eb] hover:bg-blue-700 text-white'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
