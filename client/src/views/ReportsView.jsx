import React, { useState } from 'react';
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

  // Compute live calculations
  const totalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalRetailVal = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0);
  const getCostPrice = (product) => product.costPrice ?? (Number(product.price || 0) * 0.5);
  const totalCostVal = products.reduce((acc, p) => acc + ((p.stock || 0) * getCostPrice(p)), 0);
  const totalGrossMargin = totalRetailVal - totalCostVal;

  const lowStockProducts = products.filter(p => p.stock < (p.minStock || 50));

  // CSV Exporter
  const handleExportReportCSV = () => {
    let headers = [];
    let rows = [];
    let filename = '';

    if (reportType === 'inventory-valuation') {
      headers = ['Product Name', 'SKU', 'Category', 'Stock Units', 'Unit Cost ($)', 'Retail Price ($)', 'Total Cost Valuation ($)', 'Total Retail Valuation ($)', 'Margin ($)'];
      rows = products.map(p => [
        `"${p.name}"`,
        p.sku,
        `"${p.category}"`,
        p.stock,
        getCostPrice(p),
        p.price,
        ((p.stock || 0) * getCostPrice(p)).toFixed(2),
        ((p.stock || 0) * (p.price || 0)).toFixed(2),
        (((p.stock || 0) * (p.price || 0)) - ((p.stock || 0) * getCostPrice(p))).toFixed(2)
      ]);
      filename = `stockpro_inventory_valuation_report.csv`;
    } else if (reportType === 'low-stock-reorder') {
      headers = ['Product Name', 'SKU', 'Category', 'Current Stock', 'Min Stock Point', 'Suggested Reorder Qty', 'Supplier'];
      rows = lowStockProducts.map(p => [
        `"${p.name}"`,
        p.sku,
        `"${p.category}"`,
        p.stock,
        p.minStock || 30,
        Math.max(50, ((p.minStock || 30) * 2) - p.stock),
        `"${p.supplierName || 'Primary Supplier'}"`
      ]);
      filename = `stockpro_low_stock_reorder_sheet.csv`;
    } else {
      headers = ['Category', 'Product Count', 'Total Stock Units', 'Estimated Valuation ($)'];
      rows = categories.map(c => {
        const catProds = products.filter(p => p.category.toLowerCase() === c.name.toLowerCase());
        const units = catProds.reduce((sum, p) => sum + (p.stock || 0), 0);
        const val = catProds.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
        return [`"${c.name}"`, catProds.length, units, val.toFixed(2)];
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
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">${Math.round(totalRetailVal).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Total Cost Valuation</span>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-1">${Math.round(totalCostVal).toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs text-slate-400 font-medium">Projected Gross Profit</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${Math.round(totalGrossMargin).toLocaleString()}</p>
            </div>
          </div>

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
                  <th className="py-3.5 px-4">Total Cost ($)</th>
                  <th className="py-3.5 px-4">Total Retail ($)</th>
                  <th className="py-3.5 px-4 text-right">Potential Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {products.map((p) => {
                  const unitCost = p.costPrice || (p.price * 0.5);
                  const totalCost = (p.stock || 0) * unitCost;
                  const totalRetail = (p.stock || 0) * (p.price || 0);
                  const margin = totalRetail - totalCost;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{p.category}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">{p.stock}</td>
                      <td className="py-3.5 px-4 text-slate-500">${unitCost.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-slate-900 dark:text-white">${parseFloat(p.price || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">${totalCost.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-600 dark:text-blue-400">${totalRetail.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +${margin.toFixed(2)}
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
                <th className="py-3.5 px-4 text-right">Retail Value ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {categories.map((c) => {
                const prods = products.filter(p => p.category.toLowerCase() === c.name.toLowerCase());
                const units = prods.reduce((sum, p) => sum + (p.stock || 0), 0);
                const val = prods.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
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
                      ${Math.round(val).toLocaleString()}
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
