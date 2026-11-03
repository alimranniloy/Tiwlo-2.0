import React, { useState } from 'react';
import { X, Check, ShoppingCart } from 'lucide-react';

export default function NewPurchaseModal({ isOpen, onClose, products, onRecordPurchase }) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [supplier, setSupplier] = useState('Global Trade Co.');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onRecordPurchase({
      productId: selectedProductId || (products[0]?.id || null),
      quantity,
      supplier
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-neutral-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-gray-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                New Purchase Order
              </h3>
              <p className="text-xs text-neutral-400">Restock products and update inventory units</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-700 text-neutral-400 hover:text-neutral-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
              Select Product to Restock
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-xl text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="">-- Choose Item --</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.stock} units)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Restock Units
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-xl text-neutral-800 dark:text-white font-semibold focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
                Supplier
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-gray-700 border border-neutral-200 dark:border-gray-600 rounded-xl text-neutral-800 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-neutral-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Create Purchase Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
