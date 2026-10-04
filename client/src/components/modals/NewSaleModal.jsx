import React, { useState } from 'react';
import { X, Check, ShoppingBag } from 'lucide-react';

export default function NewSaleModal({ isOpen, onClose, products, onRecordSale }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const selectedProduct = products?.find((p) => p.id === selectedProductId);
  const unitPrice = customPrice !== '' ? parseFloat(customPrice) : selectedProduct ? selectedProduct.price : 25.0;
  const total = (unitPrice * quantity).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onRecordSale({
      productId: selectedProductId || (products[0]?.id || null),
      quantity,
      totalAmount: parseFloat(total)
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Sale Order
              </h3>
              <p className="text-xs text-slate-400">Record customer checkout and decrement stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find((item) => item.id === e.target.value);
                if (p) setCustomPrice(p.price);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            >
              <option value="">-- Choose from Inventory --</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock}) - ${Number(p.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Quantity Sold
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct ? selectedProduct.stock : 9999}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Unit Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="25.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Total Calculation Display */}
          <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800/40 flex items-center justify-between">
            <span className="font-semibold text-purple-900 dark:text-purple-300">Total Invoice:</span>
            <span className="text-base font-extrabold text-purple-700 dark:text-purple-400">
              ${total}
            </span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-500/20 transition flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? 'Processing...' : 'Complete Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
