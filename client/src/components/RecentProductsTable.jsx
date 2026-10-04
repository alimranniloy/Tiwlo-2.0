import React, { useState } from 'react';
import {
  Box,
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  Printer
} from 'lucide-react';

export default function RecentProductsTable({
  products,
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
    'Clothing',
    'Footwear',
    'Electronics',
    'Accessories',
    'Beauty & Health',
    'Home & Living'
  ];

  // Helper for category badge styling
  const getCategoryBadgeClass = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'clothing':
        return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40';
      case 'footwear':
        return 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40';
      case 'electronics':
        return 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40';
      case 'accessories':
        return 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-800/40';
      case 'beauty & health':
        return 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-800/40';
      case 'home & living':
        return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40';
      default:
        return 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300';
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
    <div className="bg-white dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700/80 rounded-2xl p-3.5 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] mb-7">
      {/* Table Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 mb-5">
        <div className="flex items-start space-x-2.5">
          <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
            <Box className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Products
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              Latest added products to your inventory
            </p>
          </div>
        </div>

        {/* Filter / Search Bar in Table */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            {/* Search Table */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50/80 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={tableCategory}
                onChange={(e) => setTableCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50/80 dark:bg-gray-700/50 border border-slate-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center self-end sm:self-auto p-0.5 bg-slate-100 dark:bg-gray-700 rounded-xl border border-slate-200 dark:border-gray-600 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {viewMode === 'list' ? (
        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs min-w-[660px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700/70 text-slate-400 dark:text-slate-400 font-semibold">
                <th className="pb-3 pl-1 font-medium w-16">Image</th>
                <th className="pb-3 font-medium">Product Name</th>
                <th className="pb-3 font-medium">SKU</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3 font-medium">Price</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 pr-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/40">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No products found. Add a product using the button above.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-gray-700/30 transition-colors group"
                  >
                    {/* Image */}
                    <td className="py-3 pl-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-gray-700 overflow-hidden border border-slate-200/70 dark:border-gray-600 flex items-center justify-center shrink-0">
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
                    <td className="py-3 font-bold text-slate-800 dark:text-white">
                      {product.name}
                    </td>

                    {/* SKU */}
                    <td className="py-3 font-medium text-slate-500 dark:text-slate-400 font-mono">
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
                    <td className="py-3 font-semibold text-slate-700 dark:text-slate-200">
                      {product.stock}
                    </td>

                    {/* Price */}
                    <td className="py-3 font-bold text-slate-800 dark:text-white">
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
                        className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center justify-center transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === product.id && (
                        <div
                          onMouseLeave={() => setActiveMenuId(null)}
                          className="absolute right-0 top-10 w-44 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-xl py-1.5 z-40 animate-in fade-in duration-100 text-left"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onEditProduct(product);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                          >
                            <Edit className="w-3.5 h-3.5 mr-2 text-blue-500" />
                            Edit Product
                          </button>
                          {onOpenPrintBarcode && (
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onOpenPrintBarcode(product);
                              }}
                              className="w-full flex items-center px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition font-medium"
                            >
                              <Printer className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                              Print Barcode
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onQuickStockChange(product.id, 10);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                          >
                            <Plus className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                            Add Stock (+10)
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onQuickStockChange(product.id, -10);
                            }}
                            className="w-full flex items-center px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                          >
                            <Minus className="w-3.5 h-3.5 mr-2 text-amber-500" />
                            Reduce Stock (-10)
                          </button>
                          <div className="border-t border-slate-100 dark:border-gray-700 my-1"></div>
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
              className="border border-slate-200/80 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition bg-slate-50/50 dark:bg-gray-700/20 relative group"
            >
              <div className="w-full h-32 rounded-xl bg-slate-100 dark:bg-gray-700 overflow-hidden mb-3">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                    {product.name}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">{product.sku}</p>
                </div>
                {getStatusBadge(product.status, product.stock)}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60 dark:border-gray-700">
                <div>
                  <span className="text-[10px] text-slate-400 block">Stock / Price</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    {product.stock} units • ${Number(product.price).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {onOpenPrintBarcode && (
                    <button
                      onClick={() => onOpenPrintBarcode(product)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
                      title="Print Barcode"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteProduct(product)}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
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
    </div>
  );
}
