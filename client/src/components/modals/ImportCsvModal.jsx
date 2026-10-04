import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, FileText } from 'lucide-react';

export default function ImportCsvModal({ isOpen, onClose, onImportBatch }) {
  const [dragActive, setDragActive] = useState(false);
  const [imported, setImported] = useState(false);

  if (!isOpen) return null;

  const handleSimulateImport = () => {
    setImported(true);
    setTimeout(() => {
      // simulate batch of items
      onImportBatch([
        {
          name: 'Classic Denim Jacket',
          sku: 'DJ-010',
          category: 'Clothing',
          stock: 64,
          price: 69.99,
          image: '/default-product.svg'
        },
        {
          name: 'Wireless Bluetooth Earbuds',
          sku: 'EB-011',
          category: 'Electronics',
          stock: 90,
          price: 49.99,
          image: '/default-product.svg'
        }
      ]);
      setImported(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import CSV / Excel
              </h3>
              <p className="text-xs text-slate-400">Bulk upload products and stock balances</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 text-center">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleSimulateImport(); }}
            className={`border-2 border-dashed rounded-2xl p-8 transition-colors ${
              dragActive
                ? 'border-cyan-500 bg-cyan-50/20'
                : 'border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-700/20'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-cyan-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Drag & Drop your CSV inventory file here
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Supports .csv, .xlsx up to 10MB</p>
            <button
              onClick={handleSimulateImport}
              disabled={imported}
              className="mt-4 px-4 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800 rounded-xl transition"
            >
              {imported ? 'Uploading & Parsing...' : 'Select File or Demo Import'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Template format: [Name, SKU, Category, Stock, Price]</span>
            <a href="#download" onClick={(e) => { e.preventDefault(); alert("Template downloaded: stockpro_template.csv"); }} className="text-blue-500 hover:underline">
              Download Template
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
