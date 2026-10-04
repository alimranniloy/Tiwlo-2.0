import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';

export default function GenerateReportModal({ isOpen, onClose, stats, products }) {
  const [reportType, setReportType] = useState('inventory_valuation');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      // Create CSV content and download
      const headers = ['Product ID', 'Name', 'SKU', 'Category', 'Stock Units', 'Unit Price ($)', 'Status'];
      const rows = products.map((p) => [
        p.id,
        `"${p.name}"`,
        p.sku,
        p.category,
        p.stock,
        p.price,
        p.status
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `StockPro_${reportType}_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloading(false);
      setDownloaded(true);
      setTimeout(() => {
        setDownloaded(false);
        onClose();
      }, 1000);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Generate Inventory Report
              </h3>
              <p className="text-xs text-slate-400">Export audited analytics in PDF or CSV format</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 pt-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            >
              <option value="inventory_valuation">Complete Inventory Valuation ($248,650)</option>
              <option value="low_stock_audit">Low Stock & Reorder Alert List</option>
              <option value="sales_summary">Sales Performance & Revenue (Sep 2025)</option>
            </select>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-gray-700/40 rounded-xl border border-slate-200 dark:border-gray-600 space-y-1 text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Total Catalog items:</span>
              <span className="font-bold">{products.length} products</span>
            </div>
            <div className="flex justify-between">
              <span>Total Units in Stock:</span>
              <span className="font-bold">{stats?.totalStock || '36,482'}</span>
            </div>
            <div className="flex justify-between">
              <span>Format:</span>
              <span className="font-bold text-rose-500">CSV Spreadsheet / Excel</span>
            </div>
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
              onClick={handleDownload}
              disabled={downloading}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 transition flex items-center space-x-1.5"
            >
              {downloaded ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Report Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloading ? 'Exporting...' : 'Download Report'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
