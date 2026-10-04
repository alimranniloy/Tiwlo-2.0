import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  List,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Barcode,
  Download,
  MapPin,
  TrendingUp,
  Tag,
  DollarSign,
  ArrowLeft,
  Sparkles,
  Image as ImageIcon,
  Printer
} from 'lucide-react';

export default function ProductsView({
  products,
  categories,
  subcategories,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onQuickStockChange,
  onOpenBarcodeModal,
  onOpenPrintBarcode,
  onBackToDashboard
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All Subcategories');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Filter subcategories based on selected category
  const filteredSubcategories = useMemo(() => {
    if (selectedCategory === 'All Categories') return subcategories;
    const cat = categories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
    if (!cat) return subcategories;
    return subcategories.filter(s => s.categoryId === cat.id || s.categoryName.toLowerCase() === cat.name.toLowerCase());
  }, [subcategories, categories, selectedCategory]);

  // Filtered & Sorted products
  const displayedProducts = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.subCategory || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'All Categories') {
      result = result.filter(p => (p.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    if (selectedSubcategory !== 'All Subcategories') {
      result = result.filter(p => (p.subCategory || '').toLowerCase() === selectedSubcategory.toLowerCase());
    }

    if (selectedStatus !== 'All Status') {
      result = result.filter(p => (p.status || '').toLowerCase() === selectedStatus.toLowerCase());
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'stock-asc') {
      result.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    } else if (sortBy === 'stock-desc') {
      result.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [products, search, selectedCategory, selectedSubcategory, selectedStatus, sortBy]);

  // Statistics
  const totalCount = products.length;
  const inStockCount = products.filter(p => p.stock >= (p.minStock || 50)).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock < (p.minStock || 50)).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'SKU', 'Barcode', 'Category', 'SubCategory', 'Stock', 'Min Stock', 'Price', 'Cost', 'Location', 'Status'];
    const rows = displayedProducts.map(p => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku,
      p.barcode || '',
      `"${p.category || ''}"`,
      `"${p.subCategory || ''}"`,
      p.stock,
      p.minStock || 30,
      p.price,
      p.costPrice || 0,
      `"${p.location || ''}"`,
      p.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stockpro_products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header (Google-Inspired Clean UI) */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(60,64,67,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs shrink-0 cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                <Package className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Product Catalog & SKU Center
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Complete inventory catalog with multi-image support, live SKU tracking, barcode scanner, and categories.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onAddProduct}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Products</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">{totalCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Catalog items</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">In Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">{inStockCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Healthy supply</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Low Stock Alert</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">{lowStockCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Reorder suggested</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">{outOfStockCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Immediate action</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inventory Value</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            ${Math.round(totalValue).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">At retail price</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full md:min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by name, SKU, barcode, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2 text-xs w-full md:w-auto">
          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedSubcategory('All Subcategories');
            }}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="All Categories">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Subcategory */}
          <select
            value={selectedSubcategory}
            onChange={(e) => setSelectedSubcategory(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="All Subcategories">All Subcategories</option>
            {filteredSubcategories.map((s) => (
              <option key={s.id || s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="All Status">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="stock-desc">Sort: Stock (High-Low)</option>
            <option value="stock-asc">Sort: Stock (Low-High)</option>
            <option value="price-desc">Sort: Price (High-Low)</option>
            <option value="price-asc">Sort: Price (Low-High)</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center ml-auto sm:ml-0 bg-slate-100 dark:bg-gray-800 p-1 rounded-xl border border-slate-200 dark:border-gray-700 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid Cards View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table or Grid */}
      {displayedProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No products match your criteria</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or filters to find what you're looking for, or add a new product.
          </p>
          <button
            onClick={onAddProduct}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
          >
            Create Product
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Product Info</th>
                  <th className="py-3.5 px-4">SKU & Barcode</th>
                  <th className="py-3.5 px-4">Category / Subcategory</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Price / Cost</th>
                  <th className="py-3.5 px-4">Stock Units</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {displayedProducts.map((p) => {
                  const isLow = p.stock > 0 && p.stock < (p.minStock || 50);
                  const isOut = p.stock === 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150 group"
                    >
                      {/* Product Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative shrink-0">
                            <img
                              src={p.image || (p.images && p.images[0]) || '/default-product.svg'}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-gray-700 shadow-xs"
                            />
                            {p.images && p.images.length > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-bold px-1 rounded-md shadow-xs ring-1 ring-white dark:ring-gray-900">
                                +{p.images.length}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white leading-tight">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {p.sold || 0} units sold
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* SKU & Barcode */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                            {p.sku}
                          </span>
                          {p.barcode && (
                            <button
                              type="button"
                              onClick={() => onOpenPrintBarcode ? onOpenPrintBarcode(p) : (onOpenBarcodeModal && onOpenBarcodeModal(p.sku))}
                              className="flex items-center space-x-1 text-[10px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-mono hover:underline cursor-pointer group/bc text-left"
                              title="Click to Print Barcode Labels"
                            >
                              <Barcode className="w-3 h-3 text-slate-400 group-hover/bc:text-blue-500" />
                              <span>{p.barcode}</span>
                              <Printer className="w-2.5 h-2.5 opacity-0 group-hover/bc:opacity-100 text-blue-500 transition-opacity" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                            {p.category || 'General'}
                          </span>
                          {p.subCategory && (
                            <p className="text-[10px] text-slate-400 font-medium pl-1">
                              ↳ {p.subCategory}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 text-xs">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{p.location || 'Aisle 1, Rack A'}</span>
                        </div>
                      </td>

                      {/* Price / Cost */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            ${parseFloat(p.price || 0).toFixed(2)}
                          </p>
                          {p.costPrice && (
                            <p className="text-[10px] text-slate-400">
                              Cost: ${parseFloat(p.costPrice).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Stock Adjustment (+ / -) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onQuickStockChange(p.id, -1)}
                            disabled={p.stock <= 0}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30 transition"
                            title="Decrease stock by 1"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-800 dark:text-white min-w-[28px] text-center">
                            {p.stock}
                          </span>
                          <button
                            onClick={() => onQuickStockChange(p.id, 1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 transition"
                            title="Increase stock by 1"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isOut
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60'
                              : isLow
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          ></span>
                          {p.status || (isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onOpenPrintBarcode ? onOpenPrintBarcode(p) : (onOpenBarcodeModal && onOpenBarcodeModal(p.sku))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                            title="Print Barcode Labels"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onOpenBarcodeModal && onOpenBarcodeModal(p.sku)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
                            title="View Barcode"
                          >
                            <Barcode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayedProducts.map((p) => {
            const isLow = p.stock > 0 && p.stock < (p.minStock || 50);
            const isOut = p.stock === 0;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-4 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Image & Badges */}
                  <div className="relative mb-3 rounded-2xl overflow-hidden aspect-4/3 bg-slate-100 dark:bg-gray-800">
                    <img
                      src={p.image || '/default-product.svg'}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xs ${
                          isOut
                            ? 'bg-rose-500/90 text-white'
                            : isLow
                            ? 'bg-amber-500/90 text-white'
                            : 'bg-emerald-500/90 text-white'
                        }`}
                      >
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className="font-mono text-[10px] font-bold bg-slate-900/70 text-white px-2 py-0.5 rounded-md backdrop-blur-md">
                        {p.sku}
                      </span>
                    </div>

                    {p.images && p.images.length > 1 && (
                      <div className="absolute bottom-2 right-2">
                        <span className="text-[10px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded-md backdrop-blur-md flex items-center gap-1">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>{p.images.length}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Category */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                        {p.category}
                      </span>
                      {p.subCategory && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                          {p.subCategory}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1 mt-1">
                      {p.name}
                    </h3>
                  </div>

                  {/* Location & Barcode */}
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[120px]">{p.location || 'Aisle 1'}</span>
                    </span>
                    {p.barcode && (
                      <button
                        type="button"
                        onClick={() => onOpenPrintBarcode ? onOpenPrintBarcode(p) : (onOpenBarcodeModal && onOpenBarcodeModal(p.sku))}
                        className="font-mono text-[10px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                        title="Print Barcode"
                      >
                        <Barcode className="w-3 h-3" />
                        <span>{p.barcode}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Price, Stock, Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      ${parseFloat(p.price || 0).toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium">Stock: {p.stock} units</p>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onOpenPrintBarcode ? onOpenPrintBarcode(p) : (onOpenBarcodeModal && onOpenBarcodeModal(p.sku))}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 text-slate-500 transition"
                      title="Print Barcode"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEditProduct(p)}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 text-slate-500 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(p)}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/40 text-slate-500 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
