import React from 'react';
import {
  Plus,
  ShoppingCart,
  Tag,
  ScanLine,
  UploadCloud,
  FileSpreadsheet,
  SlidersHorizontal
} from 'lucide-react';

export default function QuickActions({
  onAddProduct,
  onNewPurchase,
  onNewSale,
  onScanBarcode,
  onImportCsv,
  onGenerateReport
}) {
  const actions = [
    {
      id: 'add_product',
      title: 'Add Product',
      icon: Plus,
      iconContainer: 'bg-blue-600 text-white shadow-md shadow-blue-500/20',
      action: onAddProduct
    },
    {
      id: 'new_purchase',
      title: 'New Purchase',
      icon: ShoppingCart,
      iconContainer: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40',
      action: onNewPurchase
    },
    {
      id: 'new_sale',
      title: 'New Sale',
      icon: Tag,
      iconContainer: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40',
      action: onNewSale
    },
    {
      id: 'scan_barcode',
      title: 'Scan Barcode',
      icon: ScanLine,
      iconContainer: 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40',
      action: onScanBarcode
    },
    {
      id: 'import_csv',
      title: 'Import CSV',
      icon: UploadCloud,
      iconContainer: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/40',
      action: onImportCsv
    },
    {
      id: 'generate_report',
      title: 'Generate Report',
      icon: FileSpreadsheet,
      iconContainer: 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40',
      action: onGenerateReport
    }
  ];

  return (
    <div className="aura-quick-actions-card p-5">
      <div className="relative z-1">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-4">
          <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Quick Actions
          </h3>
        </div>

        {/* Grid of 6 buttons */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={act.action}
                className="flex flex-col items-center justify-center p-3.5 bg-slate-50/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700/80 border border-slate-200/80 dark:border-gray-700/80 rounded-xl transition duration-150 group hover:shadow-xs cursor-pointer text-center"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${act.iconContainer}`}
                >
                  <Icon className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-2.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {act.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
