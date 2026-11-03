import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, product, onConfirmDelete }) {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-100 dark:border-rose-900 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-700 text-neutral-400 hover:text-neutral-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3">
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            Delete Product?
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-neutral-800 dark:text-neutral-200">"{product.name}"</span> ({product.sku})? This will permanently remove it from your inventory records.
          </p>

          <div className="mt-4 p-3 bg-neutral-50 dark:bg-gray-700/40 rounded-xl border border-neutral-200/70 dark:border-gray-600 flex items-center space-x-3 text-xs">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-white dark:bg-gray-700 shrink-0">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-neutral-800 dark:text-white">{product.name}</p>
              <p className="text-[11px] text-neutral-400">Stock: {product.stock} • ${Number(product.price).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-5 mt-4 border-t border-neutral-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(product.id);
              onClose();
            }}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition flex items-center space-x-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Yes, Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
