import React from 'react';
import {
  Store,
  Plus,
  ExternalLink,
  MapPin,
  LayoutDashboard,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function MyOnlineStoreView({
  currentUser,
  userStores = [],
  currentStore,
  onSelectStore,
  onOpenStoreDashboard,
  onOpenCreateStore
}) {
  // Safe fallback if user has no stores yet
  const stores = userStores.length > 0 ? userStores : (currentStore ? [currentStore] : []);

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. FULL-WIDTH PANORAMIC OCEAN BANNER (Compact & Clean) */}
      {/* ======================================================== */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-lg min-h-[160px] flex items-center">
        {/* Full-width Ocean Background Image spanning the entire section */}
        <img
          src="/waves/ocean_waves_blue.jpg"
          alt="Ocean Waves Background"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Dark Vignette / Frosted Overlay for high readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-slate-950/70" />

        {/* Content Container */}
        <div className="relative z-10 w-full px-4 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-1.5 max-w-xl">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              My Online Store
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
              Create and manage your online storefronts, POS terminals, and multi-channel inventory.
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onOpenCreateStore}
              className="px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-blue-600 stroke-[3]" />
              <span>Create New Store</span>
            </button>

            {currentStore && (
              <button
                onClick={onOpenStoreDashboard}
                className="px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/20 text-white text-xs font-semibold border border-white/25 backdrop-blur-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Launch {currentStore.storeName || 'Store'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STORES SECTION HEADER & QUICK '+' ACTION */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Your Active Storefronts</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {stores.length} {stores.length === 1 ? 'Store' : 'Stores'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Isolated to your account ({currentUser?.email || currentUser?.tiwiId || 'Active Account'}).
          </p>
        </div>

        <button
          onClick={onOpenCreateStore}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add New Store</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 3. STORE CARDS GRID */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {stores.map((st, idx) => {
          const isActive = currentStore?.tiwiId === st.tiwiId;
          const billing = st.billingDetails || {};

          return (
            <div
              key={st.tiwiId || idx}
              className={`relative rounded-3xl p-5 transition-all duration-200 flex flex-col justify-between ${
                isActive
                  ? 'bg-white dark:bg-[#111827] border-2 border-blue-500/80 shadow-lg shadow-blue-500/5'
                  : 'bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-2xs hover:shadow-sm'
              }`}
            >
              <div>
                {/* Top Row: App Icon & Default Badge */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Store className="w-5 h-5" />
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      Active Default
                    </span>
                  )}
                </div>

                {/* Store Name & Category */}
                <div className="space-y-1 mb-3.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {st.storeName || 'Unnamed Store'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300">
                      {st.tiwiId || ''}
                    </span>
                    <span className="text-xs text-slate-400">
                      {st.category || 'General Retail'}
                    </span>
                  </div>
                </div>

                {/* Subdomain URL & Billing Address */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60 mb-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Domain:</span>
                    <a
                      href={st.subdomain ? `https://${st.subdomain}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span className="truncate max-w-[150px]">{st.subdomain || 'No domain assigned'}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  {(billing.city || billing.country || billing.address) && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/50 dark:border-gray-700/50">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {[billing.address, billing.city, billing.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button: Launch Store Console with clean Dashboard icon */}
              <div className="pt-2 border-t border-slate-100 dark:border-gray-800/80">
                <button
                  onClick={() => {
                    onSelectStore?.(st);
                    onOpenStoreDashboard?.();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Launch Store Console</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Clean "Add Another Store" Card */}
        <div
          onClick={onOpenCreateStore}
          className="rounded-3xl p-6 border-2 border-dashed border-slate-200 dark:border-gray-800 hover:border-blue-500/60 dark:hover:border-blue-500/60 bg-slate-50/40 dark:bg-gray-800/20 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:border-blue-500/40 shadow-2xs mb-2.5 transition-colors">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
            Create Another Store
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[180px]">
            Launch a separate branch with its own catalog and database.
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. VISUAL FEATURE MODULES (Graphics Cards with Real Images) */}
      {/* ======================================================== */}
      <div className="pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3.5">
          Store Capabilities & Ecosystem
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Point of Sale Terminal */}
          <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-2xs flex flex-col">
            <div className="h-36 overflow-hidden relative">
              <img
                src="/pos-banner-terminal.jpg"
                alt="Point of Sale Terminal"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
            <div className="p-4 space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Point of Sale (POS)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Barcode scanning, quick cart checkout, and thermal receipt printing.
              </p>
            </div>
          </div>

          {/* Card 2: Storefront & Catalog */}
          <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-2xs flex flex-col">
            <div className="h-36 overflow-hidden relative">
              <img
                src="/seller-booth.jpg"
                alt="Storefront and Catalog"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
            <div className="p-4 space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Storefront & Catalog
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Organized categories, subdomains, and customer order management.
              </p>
            </div>
          </div>

          {/* Card 3: Logistics & Fulfillment */}
          <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-2xs flex flex-col">
            <div className="h-36 overflow-hidden relative">
              <img
                src="/hero-shipping.jpg"
                alt="Logistics & Dispatch"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
            <div className="p-4 space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Orders & Fulfillment
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Integrated order tracking, invoice receipts, and inventory control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
