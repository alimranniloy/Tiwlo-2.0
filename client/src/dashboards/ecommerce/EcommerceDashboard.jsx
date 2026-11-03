import React from 'react';
import GreetingBar from './components/GreetingBar';
import StatCards from './components/StatCards';
import InventoryOverviewChart from './components/InventoryOverviewChart';
import StockMovementChart from './components/StockMovementChart';
import TopSellingProducts from './components/TopSellingProducts';
import QuickActions from './components/QuickActions';
import RecentActivity from './components/RecentActivity';
import RecentProductsTable from './components/RecentProductsTable';
import StoreSetupChecklist from './components/StoreSetupChecklist';

export default function EcommerceDashboard({
  stats,
  dataLoadError,
  onReloadData,
  currentUser,
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
  products,
  categories,
  inventoryLoading,
  onVisitSite
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {dataLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Some dashboard data could not be loaded: {dataLoadError}</span>
          <button
            type="button"
            onClick={onReloadData}
            className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold transition hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <GreetingBar currentUser={currentUser} />
      <QuickActions
        onAddProduct={onAddProduct}
        onNewPurchase={onNewPurchase}
        onNewSale={onNewSale}
        onScanBarcode={onScanBarcode}
        onImportCsv={onImportCsv}
        onGenerateReport={onGenerateReport}
      />
      <StatCards stats={stats} />

      <StoreSetupChecklist
        products={products}
        categories={categories}
        inventoryLoading={inventoryLoading}
        onNavigateTab={onNavigateTab}
        onVisitSite={onVisitSite}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <InventoryOverviewChart
          totalStock={stats?.totalStock ?? '—'}
          categories={stats?.categoryDistribution || []}
          onCategorySelect={setTableCategory}
        />
        <StockMovementChart data={stats?.stockMovement} />
      </div>

      <RecentProductsTable
        products={filteredProducts}
        categories={categories}
        tableSearch={tableSearch}
        setTableSearch={setTableSearch}
        tableCategory={tableCategory}
        setTableCategory={setTableCategory}
        onEditProduct={onEditProduct}
        onDeleteProduct={onDeleteProduct}
        onQuickStockChange={onQuickStockChange}
        onOpenPrintBarcode={onOpenPrintBarcode}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TopSellingProducts
          products={stats?.topSellingProducts}
          onViewAll={() => onNavigateTab('products')}
        />
        <RecentActivity
          activities={activities}
          onDeleteActivity={onDeleteActivity}
        />
      </div>
    </div>
  );
}
