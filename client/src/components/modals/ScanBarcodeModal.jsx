import React, { useState, useEffect } from 'react';
import { X, ScanLine, CheckCircle2 } from 'lucide-react';

export default function ScanBarcodeModal({ isOpen, onClose, onSelectBarcodeProduct, initialSku }) {
  const [barcode, setBarcode] = useState('TS-001');
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (initialSku) {
      setBarcode(initialSku);
    }
  }, [initialSku]);

  if (!isOpen) return null;

  const handleScan = () => {
    setScanned(true);
    setTimeout(() => {
      onSelectBarcodeProduct(barcode);
      onClose();
      setScanned(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-150 text-center">
        <div className="flex justify-end">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center">
          <ScanLine className="w-8 h-8 animate-pulse" />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Barcode / Optical Scanner
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Point optical scanner or input SKU / barcode code manually
        </p>

        <div className="relative border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-2xl p-6 bg-amber-50/20 dark:bg-amber-950/10 mb-4">
          <div className="h-1 bg-red-500 shadow-sm shadow-red-500 animate-bounce mb-3"></div>
          <span className="font-mono text-sm font-bold tracking-widest text-slate-800 dark:text-slate-200">
            ||| | |||| | ||| |||||
          </span>
          <p className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2">
            {barcode}
          </p>
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.toUpperCase())}
            placeholder="Type SKU or Barcode..."
            className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl uppercase font-mono text-slate-900 dark:text-white"
          />
          <button
            onClick={handleScan}
            disabled={scanned}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition"
          >
            {scanned ? 'Found!' : 'Simulate Scan'}
          </button>
        </div>
      </div>
    </div>
  );
}
