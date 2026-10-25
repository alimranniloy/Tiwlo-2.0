import React from 'react';
import { ArrowLeft, LayoutGrid, Store } from 'lucide-react';
import GreetingBar from './components/GreetingBar';
import StatCards from './components/StatCards';
import InventoryOverviewChart from './components/InventoryOverviewChart';
import StockMovementChart from './components/StockMovementChart';
import TopSellingProducts from './components/TopSellingProducts';
import QuickActions from './components/QuickActions';
import RecentActivity from './components/RecentActivity';
import RecentProductsTable from './components/RecentProductsTable';
import BottomBanners from './components/BottomBanners';
import StoreSetupChecklist from './components/StoreSetupChecklist';

export default function EcommerceDashboard({
  stats,
  dataLoadError,
  onReloadData,
  filteredProducts,
  tableSearch,
  setTableSearch,
  tableCategory,
  setTableCategory,
  activities,
  onNavigateTab,
  onEditProduct,
  onDeleteProduct,
  onQuickStockChange,
  onOpenPrintBarcode,
  onAddProduct,
  onNewPurchase,
  onNewSale,
  onScanBarcode,
  onImportCsv,
  onGenerateReport,
  onDeleteActivity,
  onBackToCloud,
  currentStore,
  products,
  categories,
  inventoryLoading,
  onVisitSite
}) {
  return (
    <div className="space-y-7 animate-in fade-in duration-150">
      {dataLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <span>Some dashboard data could not be loaded: {dataLoadError}</span>
          <button
            type="button"
            onClick={onReloadData}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
          >
            Retry
          </button>
        </div>
      )}
      {/* Top Banner to switch back to Main Control Center */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-white dark:bg-gray-800/80 border border-slate-200/80 dark:border-gray-700/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Store className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {currentStore?.storeName || 'Your Store'}
            </h2>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-gray-600">
              {currentStore?.tiwiId || ''}
            </span>
          </div>
        </div>

        {onBackToCloud && (
          <button
            onClick={onBackToCloud}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-gray-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Main Control Center</span>
            <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-slate-400" />
          </button>
        )}
      </div>

      <StoreSetupChecklist
        products={products}
        categories={categories}
        inventoryLoading={inventoryLoading}
        onNavigateTab={onNavigateTab}
        onVisitSite={onVisitSite}
      />

      <GreetingBar />
      <StatCards stats={stats} />

      {/* Middle Row: Charts & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4">
          <InventoryOverviewChart
            totalStock={stats?.totalStock ?? '—'}
            categories={stats?.categoryDistribution || []}
            onCategorySelect={(cat) => setTableCategory(cat)}
          />
        </div>
        <div className="lg:col-span-4">
          <StockMovementChart data={stats?.stockMovement} />
        </div>
        <div className="lg:col-span-4">
          <TopSellingProducts
            products={stats?.topSellingProducts}
            onViewAll={() => onNavigateTab('products')}
          />
        </div>
      </div>

      {/* Lower Grid: Products Table + Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <RecentProductsTable
            products={filteredProducts}
            tableSearch={tableSearch}
            setTableSearch={setTableSearch}
            tableCategory={tableCategory}
            setTableCategory={setTableCategory}
            onEditProduct={onEditProduct}
            onDeleteProduct={onDeleteProduct}
            onQuickStockChange={onQuickStockChange}
            onOpenPrintBarcode={onOpenPrintBarcode}
          />
        </div>

        <div className="lg:col-span-4 space-y-5">
          <QuickActions
            onAddProduct={onAddProduct}
            onNewPurchase={onNewPurchase}
            onNewSale={onNewSale}
            onScanBarcode={onScanBarcode}
            onImportCsv={onImportCsv}
            onGenerateReport={onGenerateReport}
          />

          <RecentActivity
            activities={activities}
            onDeleteActivity={onDeleteActivity}
          />
        </div>
      </div>

      {/* Bottom 3 Banners */}
      <BottomBanners
        onExploreFeatures={() => onNavigateTab('inventory')}
        onViewReport={() => onNavigateTab('reports')}
        onUpgrade={() => onNavigateTab('pricing')}
      />
    </div>
  );
}
