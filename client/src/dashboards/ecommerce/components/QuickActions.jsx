import React from 'react';
import {
  Barcode,
  FileUp,
  FileText,
  Plus,
  ShoppingCart,
  Truck,
} from 'lucide-react';

const actions = [
  { id: 'product', title: 'Add Product', icon: Plus, key: 'onAddProduct' },
  { id: 'purchase', title: 'New Purchase', icon: Truck, key: 'onNewPurchase' },
  { id: 'sale', title: 'New Sale', icon: ShoppingCart, key: 'onNewSale' },
  { id: 'barcode', title: 'Scan Barcode', icon: Barcode, key: 'onScanBarcode' },
  { id: 'import', title: 'Import CSV', icon: FileUp, key: 'onImportCsv' },
  { id: 'report', title: 'Generate Report', icon: FileText, key: 'onGenerateReport' },
];

export default function QuickActions(props) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {actions.map(({ id, title, icon: Icon, key }, index) => (
        <button
          key={id}
          type="button"
          onClick={props[key]}
          className={`group flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-2xl p-4 text-center text-xs font-bold ring-1 transition ${
            index === 0
              ? 'bg-[#1ed760] text-black ring-[#1ed760] hover:bg-[#18c755]'
              : 'bg-white text-neutral-900 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800 dark:hover:bg-neutral-800'
          }`}
        >
          <span className={`flex size-10 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
            index === 0 ? 'bg-black text-white' : 'bg-[#f1f1f1] text-neutral-900 dark:bg-neutral-800 dark:text-white'
          }`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {title}
        </button>
      ))}
    </nav>
  );
}
