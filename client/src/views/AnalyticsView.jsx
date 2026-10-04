import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Clock,
  Package,
  Layers,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function AnalyticsView({ products = [], stats, onBackToDashboard }) {
  // Sort fast moving
  const fastMoving = [...products]
    .sort((a, b) => (b.sold || 0) - (a.sold || 0))
    .slice(0, 5);

  const slowMoving = [...products]
    .filter(p => p.stock > 50)
    .sort((a, b) => (a.sold || 0) - (b.sold || 0))
    .slice(0, 5);

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
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Real-time Inventory Analytics
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Turnover velocity metrics, inventory stock trends, and product demand forecasting.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Turnover Velocity</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">5.2x / yr</div>
          <div className="text-[11px] text-emerald-600 flex items-center space-x-1 mt-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+14% vs benchmark</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Stock Out Risk</span>
          <div className="text-2xl font-bold text-amber-500 mt-1">4.2%</div>
          <div className="text-[11px] text-emerald-600 flex items-center space-x-1 mt-0.5">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>-2.1% low risk</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gross Margin ROI</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">184%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">GMROI Health Score</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fulfillment Efficiency</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">99.4%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Same-day dispatch</div>
        </div>
      </div>

      {/* Movement Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fast Moving Items */}
        <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Top Velocity (Fast Movers)</h3>
          </div>

          <div className="space-y-3">
            {fastMoving.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-gray-800/60">
                <div className="flex items-center space-x-3">
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-xl object-cover" />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.category} • SKU: {p.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-emerald-600">+{p.sold || 0} sold</span>
                  <p className="text-[10px] text-slate-400">Stock: {p.stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slow Moving / Overstock Candidates */}
        <div className="bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">High Days of Inventory (Slow Movers)</h3>
          </div>

          <div className="space-y-3">
            {slowMoving.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-gray-800/60">
                <div className="flex items-center space-x-3">
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-xl object-cover" />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.category} • SKU: {p.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-blue-600">{p.stock} in stock</span>
                  <p className="text-[10px] text-slate-400">{p.sold || 0} sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
