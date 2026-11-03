import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  Minus,
  Printer
} from 'lucide-react';

export default function RecentProductsTable({
  products,
  categories: availableCategories = [],
  onEditProduct,
  onDeleteProduct,
  onQuickStockChange,
  tableSearch,
  setTableSearch,
  tableCategory,
  setTableCategory,
  onOpenPrintBarcode
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const categories = [
    'All Categories',
    ...new Set(availableCategories
      .map(category => typeof category === 'string' ? category : category?.name)
      .filter(category => typeof category === 'string' && category.trim()))
  ];

  // Helper for category badge styling
  const getCategoryBadgeClass = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'clothing':
        return 'bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800/40';
      case 'footwear':
        return 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40';
      case 'electronics':
        return 'bg-neutral-50 dark:bg-neutral-900/30 text-neutral-600 dark:text-neutral-400 border border-neutral-100 dark:border-neutral-800/40';
      case 'accessories':
        return 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-800/40';
      case 'beauty & health':
        return 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40';
      case 'home & living':
        return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40';
      default:
        return 'bg-neutral-100 dark:bg-gray-700 text-neutral-600 dark:text-neutral-300';
    }
  };

  // Helper for status badge styling
  const getStatusBadge = (status, stock) => {
    const isLow = status === 'Low Stock' || (stock > 0 && stock < 50);
    const isOut = status === 'Out of Stock' || stock === 0;

    if (isOut) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40">
          Out of Stock
        </span>
      );
    }
    if (isLow) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
          Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
        In Stock
      </span>
    );
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      {/* Table Header Controls */}
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex items-start space-x-2.5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-neutral-950">
              Recent Products
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Latest added products to your inventory
            </p>
          </div>
        </div>

        {/* Filter / Search Bar in Table */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setTableCategory(category)}
                aria-pressed={tableCategory === category}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  tableCategory === category
                    ? 'bg-[#121212] text-white'
                    : 'bg-[#f1f1f1] text-neutral-700 hover:bg-[#e8e8e8]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative flex-1 lg:w-64 lg:flex-none">
              <span className="sr-only">Search products</span>
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search products..."
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                className="h-9 w-full rounded-full bg-[#f1f1f1] pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-black/10"
              />
            </label>
            <div className="flex rounded-full bg-[#f1f1f1] p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`flex size-7 items-center justify-center rounded-full transition ${
                  viewMode === 'list' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                }`}
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`flex size-7 items-center justify-center rounded-full transition ${
                  viewMode === 'grid' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'
                }`}
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {viewMode === 'list' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                <th className="w-16 pb-3 pl-1 font-semibold">Image</th>
                <th className="pb-3 font-semibold">Product Name</th>
                <th className="pb-3 font-semibold">SKU</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Stock</th>
                <th className="pb-3 font-semibold">Price</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 pr-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-neutral-400">
                    No products found. Add a product using the button above.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="group transition-colors hover:bg-neutral-50"
                  >
                    {/* Image */}
                    <td className="py-3 pl-1">
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-gray-700 overflow-hidden border border-neutral-200/70 dark:border-gray-600 flex items-center justify-center shrink-0">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            e.target.src = '/default-product.svg';
                          }}
                        />
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 font-bold text-neutral-800 dark:text-white">
                      {product.name}
                    </td>

                    {/* SKU */}
                    <td className="py-3 font-medium text-neutral-500 dark:text-neutral-400 font-mono">
                      {product.sku}
                    </td>

                    {/* Category */}
                    <td className="py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getCategoryBadgeClass(
                          product.category
                        )}`}
                      >
                        {product.category}
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="py-3 font-semibold text-neutral-700 dark:text-neutral-200">
                      {product.stock}
                    </td>

                    {/* Price */}
                    <td className="py-3 font-bold text-neutral-800 dark:text-white">
                      ${Number(product.price).toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="py-3">
                      {getStatusBadge(product.status, product.stock)}
                    </td>

                    {/* Action */}
                    <td className="py-3 pr-2 text-right relative">
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === product.id ? null : product.id)
                        }
                        className="w-7 h-7 rounded-lg hover:bg-neutral-100 dark:hover:bg-gray-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 inline-flex items-center justify-center transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === product.id && (
                        <div
                          onMouseLeave={() => setActiveMenuId(null)}
                          className="absolute right-0 top-10 w-44 bg-white dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 rounded-xl shadow-xl py-1.5 z-40 animate-in fade-in duration-100 text-left"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onEditProduct(product);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-700 transition"
                          >
                            <Edit className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                            Edit Product
                          </button>
                          {onOpenPrintBarcode && (
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onOpenPrintBarcode(product);
                              }}
                              className="w-full flex items-center px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-700 transition font-medium"
                            >
                              <Printer className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                              Print Barcode
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onQuickStockChange(product.id, 10);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-700 transition"
                          >
                            <Plus className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                            Add Stock (+10)
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onQuickStockChange(product.id, -10);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-gray-700 transition"
                          >
                            <Minus className="w-3.5 h-3.5 mr-2 text-amber-500" />
                            Reduce Stock (-10)
                          </button>
                          <div className="border-t border-neutral-100 dark:border-gray-700 my-1"></div>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onDeleteProduct(product);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete Product
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-neutral-200/80 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition bg-neutral-50/50 dark:bg-gray-700/20 relative group"
            >
              <div className="w-full h-32 rounded-xl bg-neutral-100 dark:bg-gray-700 overflow-hidden mb-3">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-white">
                    {product.name}
                  </h4>
                  <p className="text-[11px] font-mono text-neutral-400">{product.sku}</p>
                </div>
                {getStatusBadge(product.status, product.stock)}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-200/60 dark:border-gray-700">
                <div>
                  <span className="text-[10px] text-neutral-400 block">Stock / Price</span>
                  <span className="text-xs font-bold text-neutral-800 dark:text-white">
                    {product.stock} units • ${Number(product.price).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {onOpenPrintBarcode && (
                    <button
                      onClick={() => onOpenPrintBarcode(product)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition"
                      title="Print Barcode"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteProduct(product)}
                    className="text-neutral-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                    title="Delete product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
