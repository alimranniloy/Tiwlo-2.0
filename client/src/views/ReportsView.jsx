import React, { useState } from 'react';
import { amountToCents, calculateInventoryValuation } from '../../../shared/accountingHelpers.mjs';
import { useStoreSettings } from '../context/StoreSettingsContext.jsx';
import { formatStoreCurrency } from '../themes/TiwiMart/storefrontUtils.js';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  BarChart2,
  TrendingUp,
  Package,
  Layers,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function ReportsView({
  products = [],
  categories = [],
  stats,
  showToast,
  onBackToDashboard
}) {
  const [reportType, setReportType] = useState('inventory-valuation');
  const [timeRange, setTimeRange] = useState('This Month');
  const { storeSettings } = useStoreSettings();
  const currencyCode = String(storeSettings.currency || 'USD').match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';

  const valuation = calculateInventoryValuation(products);
  const totalUnits = valuation?.totalUnits ?? 0;
  const totalRetailVal = valuation ? valuation.retailValueCents / 100 : null;
  const totalCostVal = valuation?.costValueCents == null ? null : valuation.costValueCents / 100;
  const totalGrossMargin = valuation?.potentialProfitCents == null ? null : valuation.potentialProfitCents / 100;
  const getCostPrice = product => product.costPrice == null ? null : amountToCents(product.costPrice);
  const getRetailPrice = product => amountToCents(product.price ?? 0);
  const getInventoryLine = product => {
    const stock = Number(product.stock) || 0;
    const costCents = getCostPrice(product);
    const retailCents = getRetailPrice(product);
    return {
      costCents,
      costValueCents: costCents === null ? null : stock * costCents,
      retailCents,
      retailValueCents: retailCents === null ? null : stock * retailCents
    };
  };

  const lowStockProducts = products.filter(p => p.stock < (p.minStock || 50));

  // CSV Exporter
  const handleExportReportCSV = () => {
    let headers = [];
    let rows = [];
    let filename = '';

    if (reportType === 'inventory-valuation') {
      headers = ['Product Name', 'SKU', 'Category', 'Stock Units', `Unit Cost (${currencyCode})`, `Retail Price (${currencyCode})`, `Total Cost Valuation (${currencyCode})`, `Total Retail Valuation (${currencyCode})`, `Margin (${currencyCode})`];
      rows = products.map(p => {
        const line = getInventoryLine(p);
        const margin = line.costValueCents === null || line.retailValueCents === null
          ? ''
          : ((line.retailValueCents - line.costValueCents) / 100).toFixed(2);
        return [
          `"${String(p.name || '').replaceAll('"', '""')}"`,
          p.sku,
          `"${String(p.category || '').replaceAll('"', '""')}"`,
          p.stock,
          line.costCents === null ? '' : (line.costCents / 100).toFixed(2),
          line.retailCents === null ? '' : (line.retailCents / 100).toFixed(2),
          line.costValueCents === null ? '' : (line.costValueCents / 100).toFixed(2),
          line.retailValueCents === null ? '' : (line.retailValueCents / 100).toFixed(2),
          margin
        ];
      });
      filename = `stockpro_inventory_valuation_report.csv`;
    } else if (reportType === 'low-stock-reorder') {
      headers = ['Product Name', 'SKU', 'Category', 'Current Stock', 'Min Stock Point', 'Suggested Reorder Qty', 'Supplier'];
      rows = lowStockProducts.map(p => [
        `"${String(p.name || '').replaceAll('"', '""')}"`,
        p.sku,
        `"${String(p.category || '').replaceAll('"', '""')}"`,
        p.stock,
        p.minStock || 30,
        Math.max(50, ((p.minStock || 30) * 2) - p.stock),
        `"${String(p.supplierName || 'Not assigned').replaceAll('"', '""')}"`
      ]);
      filename = `stockpro_low_stock_reorder_sheet.csv`;
    } else {
      headers = ['Category', 'Product Count', 'Total Stock Units', `Retail Valuation (${currencyCode})`];
      rows = categories.map(c => {
        const catProds = products.filter(p => String(p.category || '').toLowerCase() === String(c.name || '').toLowerCase());
        const units = catProds.reduce((sum, p) => sum + (p.stock || 0), 0);
        const categoryValuation = calculateInventoryValuation(catProds);
        const val = categoryValuation ? (categoryValuation.retailValueCents / 100).toFixed(2) : '';
        return [`"${String(c.name || '').replaceAll('"', '""')}"`, catProds.length, units, val];
      });
      filename = `stockpro_category_performance_report.csv`;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast && showToast(`Report exported to ${filename}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Reports & Executive BI Ledger
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Generate formal accounting reports, inventory asset valuations, and restock schedules.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportReportCSV}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Switcher & Filter Bar */}
      <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto max-w-full">
          <button
            onClick={() => setReportType('inventory-valuation')}
            className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              reportType === 'inventory-valuation'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Stock Valuation Audit
          </button>
          <button
            onClick={() => setReportType('low-stock-reorder')}
            className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              reportType === 'low-stock-reorder'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Low Stock & Reorder Plan
          </button>
          <button
            onClick={() => setReportType('category-matrix')}
            className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              reportType === 'category-matrix'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Category Distribution Matrix
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="This Month">Current Accounting Month</option>
            <option value="This Quarter">Fiscal Q3 2025</option>
            <option value="Full Year">Year-to-Date (YTD)</option>
          </select>
        </div>
      </div>

      {/* REPORT CONTENT AREA */}
      {reportType === 'inventory-valuation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Total Units Audited</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Total Retail Valuation</span>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalRetailVal === null ? 'Unavailable' : formatStoreCurrency(totalRetailVal, storeSettings)}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Recorded Cost Valuation</span>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-1">{totalCostVal === null ? 'Incomplete' : formatStoreCurrency(totalCostVal, storeSettings)}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Estimated Gross Margin</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalGrossMargin === null ? '—' : formatStoreCurrency(totalGrossMargin, storeSettings)}</p>
            </div>
          </div>
          {valuation?.unvaluedProductCount > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {valuation.unvaluedProductCount} stocked product(s) have no valid cost price, so total cost and margin cannot be calculated reliably.
          </p>}

          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[740px]">
              <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Item & SKU</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Stock Units</th>
                  <th className="py-3.5 px-4">Unit Cost</th>
                  <th className="py-3.5 px-4">Retail Price</th>
                  <th className="py-3.5 px-4">Total Cost ({currencyCode})</th>
                  <th className="py-3.5 px-4">Total Retail ({currencyCode})</th>
                  <th className="py-3.5 px-4 text-right">Potential Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {products.map((p) => {
                  const line = getInventoryLine(p);
                  const totalCost = line.costValueCents === null ? null : line.costValueCents / 100;
                  const totalRetail = line.retailValueCents === null ? null : line.retailValueCents / 100;
                  const margin = totalCost === null || totalRetail === null ? null : totalRetail - totalCost;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{p.category}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{p.stock}</td>
                      <td className="py-3.5 px-4 text-slate-500">{line.costCents === null ? 'Not recorded' : formatStoreCurrency(line.costCents / 100, storeSettings)}</td>
                      <td className="py-3.5 px-4 text-slate-900 dark:text-white">{line.retailCents === null ? 'Invalid price' : formatStoreCurrency(line.retailCents / 100, storeSettings)}</td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{totalCost === null ? '—' : formatStoreCurrency(totalCost, storeSettings)}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-600 dark:text-blue-400">{totalRetail === null ? '—' : formatStoreCurrency(totalRetail, storeSettings)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {margin === null ? '—' : formatStoreCurrency(margin, storeSettings)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'low-stock-reorder' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-gray-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Critical Reorder List ({lowStockProducts.length} items below minimum safety threshold)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Item & SKU</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Current Stock</th>
                <th className="py-3.5 px-4">Min. Threshold</th>
                <th className="py-3.5 px-4">Deficit</th>
                <th className="py-3.5 px-4">Suggested Reorder Qty</th>
                <th className="py-3.5 px-4 text-right">Vendor Partner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {lowStockProducts.map((p) => {
                const deficit = (p.minStock || 30) - p.stock;
                const suggestedQty = Math.max(50, ((p.minStock || 30) * 2) - p.stock);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{p.name} ({p.sku})</td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{p.category}</td>
                    <td className="py-3.5 px-4 font-bold text-rose-600">{p.stock} units</td>
                    <td className="py-3.5 px-4 text-slate-500">{p.minStock || 30} units</td>
                    <td className="py-3.5 px-4 font-bold text-amber-600">-{deficit}</td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">+{suggestedQty} units</td>
                    <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-300">
                      {p.supplierName || 'Primary Supplier'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {reportType === 'category-matrix' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[620px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Category Name</th>
                <th className="py-3.5 px-4">Active SKUs</th>
                <th className="py-3.5 px-4">Total Stock Volume</th>
                <th className="py-3.5 px-4">Stock Share (%)</th>
                <th className="py-3.5 px-4 text-right">Retail Value ({currencyCode})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {categories.map((c) => {
                const prods = products.filter(p => String(p.category || '').toLowerCase() === String(c.name || '').toLowerCase());
                const units = prods.reduce((sum, p) => sum + (p.stock || 0), 0);
                const categoryValuation = calculateInventoryValuation(prods);
                const percent = totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color || '#3B82F6' }}></span>
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{prods.length} products</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{units} units</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: c.color || '#3B82F6' }}></div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">{percent}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      {categoryValuation ? formatStoreCurrency(categoryValuation.retailValueCents / 100, storeSettings) : 'Unavailable'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
