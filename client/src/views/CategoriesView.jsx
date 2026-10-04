import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Layers,
  Tag,
  Edit2,
  Trash2,
  ChevronRight,
  Package,
  Boxes,
  Palette,
  Sparkles,
  Shirt,
  Footprints,
  Cpu,
  Home,
  Watch,
  X,
  Check,
  ArrowLeft
} from 'lucide-react';

export default function CategoriesView({
  categories = [],
  subcategories = [],
  products = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubcategory,
  onUpdateSubcategory,
  onDeleteSubcategory,
  onBackToDashboard
}) {
  const [activeTab, setActiveTab] = useState('categories'); // 'categories' | 'subcategories' | 'hierarchy'
  const [search, setSearch] = useState('');
  const [filterParentCat, setFilterParentCat] = useState('All');

  // Modals state
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);

  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [deletingSub, setDeletingSub] = useState(null);

  // Form states
  const [catForm, setCatForm] = useState({ name: '', description: '', color: '#3B82F6', icon: 'FolderTree' });
  const [subForm, setSubForm] = useState({ categoryId: '', name: '', description: '' });

  const totalProductsCount = products.length;
  const totalUnits = categories.reduce((sum, c) => sum + (c.totalUnits || 0), 0);

  // Filtered categories
  const filteredCategories = categories.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  // Filtered subcategories
  const filteredSubcategories = subcategories.filter(s => {
    const matchesSearch =
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.categoryName || '').toLowerCase().includes(search.toLowerCase());
    const matchesParent = filterParentCat === 'All' || s.categoryId === filterParentCat || s.categoryName === filterParentCat;
    return matchesSearch && matchesParent;
  });

  // Handle Save Category
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name) return;

    if (editingCat) {
      await onUpdateCategory(editingCat.id, catForm);
      setEditingCat(null);
    } else {
      await onAddCategory(catForm);
      setIsAddCatModalOpen(false);
    }
    setCatForm({ name: '', description: '', color: '#3B82F6', icon: 'FolderTree' });
  };

  // Handle Save Subcategory
  const handleSaveSubcategory = async (e) => {
    e.preventDefault();
    if (!subForm.categoryId || !subForm.name) return;

    if (editingSub) {
      await onUpdateSubcategory(editingSub.id, subForm);
      setEditingSub(null);
    } else {
      await onAddSubcategory(subForm);
      setIsAddSubModalOpen(false);
    }
    setSubForm({ categoryId: '', name: '', description: '' });
  };

  // Available icon choices
  const iconOptions = [
    { name: 'FolderTree', label: 'Default' },
    { name: 'Cpu', label: 'Tech' },
    { name: 'Shirt', label: 'Fashion' },
    { name: 'Footprints', label: 'Shoes' },
    { name: 'Home', label: 'Living' },
    { name: 'Sparkles', label: 'Beauty' },
    { name: 'Watch', label: 'Accessories' }
  ];

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'
  ];

  if (isAddCatModalOpen || editingCat) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => {
              setIsAddCatModalOpen(false);
              setEditingCat(null);
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Categories"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingCat ? 'Edit Category' : 'Create New Category'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingCat ? `Editing settings for ${editingCat.name}` : 'Set up a top-level classification category'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Smart Wearables"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Description
              </label>
              <textarea
                rows="3"
                placeholder="Brief category summary"
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Theme Color Badge
              </label>
              <div className="flex items-center space-x-2">
                {colorOptions.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCatForm({ ...catForm, color: c })}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition border-2 cursor-pointer"
                    style={{
                      backgroundColor: c,
                      borderColor: catForm.color === c ? '#000000' : 'transparent'
                    }}
                  >
                    {catForm.color === c && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddCatModalOpen(false);
                  setEditingCat(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {editingCat ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (isAddSubModalOpen || editingSub) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => {
              setIsAddSubModalOpen(false);
              setEditingSub(null);
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Categories"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingSub ? 'Edit Subcategory' : 'Add New Subcategory'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingSub ? `Editing subcategory ${editingSub.name}` : 'Attach a targeted subcategory to a parent category'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleSaveSubcategory} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Parent Category *
              </label>
              <select
                required
                value={subForm.categoryId}
                onChange={(e) => setSubForm({ ...subForm, categoryId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              >
                <option value="">Select Parent Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Subcategory Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wireless Audio"
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Description
              </label>
              <textarea
                rows="3"
                placeholder="Brief subcategory details"
                value={subForm.description}
                onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddSubModalOpen(false);
                  setEditingSub(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {editingSub ? 'Save Changes' : 'Create Subcategory'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner (Google-Inspired Clean UI) */}
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
                <FolderTree className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Categories & Subcategories Architecture
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Organize inventory items hierarchically into parent categories and targeted subcategories.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              setSubForm({
                categoryId: categories[0]?.id || '',
                name: '',
                description: ''
              });
              setIsAddSubModalOpen(true);
            }}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-700 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Subcategory</span>
          </button>

          <button
            onClick={() => {
              setCatForm({ name: '', description: '', color: '#3B82F6', icon: 'FolderTree' });
              setIsAddCatModalOpen(true);
            }}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Categories</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{categories.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Primary groups</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Subcategories</span>
            <Tag className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{subcategories.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Nested segments</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cataloged Items</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{totalProductsCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Assigned to categories</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Stock Units</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{totalUnits.toLocaleString()}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Across all categories</div>
        </div>
      </div>

      {/* Navigation Tabs & Search */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-gray-800/80 p-1 rounded-xl overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('subcategories')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === 'subcategories'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Subcategories ({subcategories.length})
          </button>
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === 'hierarchy'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Hierarchy Tree View
          </button>
        </div>

        {/* Search & Parent Filter */}
        <div className="flex items-center space-x-2 text-xs w-full md:w-auto md:flex-1 md:max-w-md justify-start md:justify-end">
          {activeTab === 'subcategories' && (
            <select
              value={filterParentCat}
              onChange={(e) => setFilterParentCat(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none flex-1 sm:flex-none"
            >
              <option value="All">All Parent Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 md:flex-none md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category or sub..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: CATEGORIES CARDS & LIST */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCategories.map((cat) => {
            const catSubs = subcategories.filter(s => s.categoryId === cat.id || s.categoryName === cat.name);

            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-5 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Header: Color badge + actions */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs font-bold"
                        style={{ backgroundColor: cat.color || '#3B82F6' }}
                      >
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                          {cat.name}
                        </h3>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">
                          /{cat.slug}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingCat(cat);
                          setCatForm({
                            name: cat.name,
                            description: cat.description || '',
                            color: cat.color || '#3B82F6',
                            icon: cat.icon || 'FolderTree'
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCat(cat)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {cat.description || 'No description provided.'}
                  </p>

                  {/* Subcategories tags list */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                      Subcategories ({catSubs.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {catSubs.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No subcategories linked</span>
                      ) : (
                        catSubs.map(s => (
                          <span
                            key={s.id}
                            className="inline-flex items-center text-[10px] font-medium bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md"
                          >
                            {s.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                    <span>{cat.productCount || 0} Products</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-white">{cat.totalUnits || 0}</span> units in stock
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: SUBCATEGORIES TABLE */}
      {activeTab === 'subcategories' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Subcategory Name</th>
                  <th className="py-3.5 px-4">Parent Category</th>
                  <th className="py-3.5 px-4">Slug Code</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Linked Products</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {filteredSubcategories.map((sub) => {
                  const parent = categories.find(c => c.id === sub.categoryId || c.name.toLowerCase() === sub.categoryName.toLowerCase());

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <Tag className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-white">
                            {sub.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-xs"
                          style={{ backgroundColor: parent?.color || '#3B82F6' }}
                        >
                          {sub.categoryName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {sub.slug || sub.name.toLowerCase().replace(/\s+/g, '-')}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {sub.description || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                          {sub.productCount || 0} items
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingSub(sub);
                              setSubForm({
                                categoryId: sub.categoryId || parent?.id || '',
                                name: sub.name,
                                description: sub.description || ''
                              });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                            title="Edit Subcategory"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingSub(sub)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                            title="Delete Subcategory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* TAB 3: HIERARCHY TREE VIEW */}
      {activeTab === 'hierarchy' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-gray-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Full Category Hierarchy & Linked Products
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tree view linking parent categories to nested subcategories and inventory products.
            </p>
          </div>

          <div className="space-y-4">
            {categories.map((cat) => {
              const catSubs = subcategories.filter(s => s.categoryId === cat.id || s.categoryName === cat.name);
              const catProds = products.filter(p => (p.category || '').toLowerCase() === cat.name.toLowerCase());

              return (
                <div
                  key={cat.id}
                  className="border border-slate-200/70 dark:border-gray-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-gray-800/30"
                >
                  {/* Parent Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs"
                        style={{ backgroundColor: cat.color || '#3B82F6' }}
                      >
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {cat.name}
                        </span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">
                          ({catSubs.length} subcategories, {catProds.length} products)
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Total stock: {cat.totalUnits || 0} units
                    </span>
                  </div>

                  {/* Nested Subcategories */}
                  <div className="pl-6 mt-3 space-y-3 border-l-2 border-slate-200 dark:border-gray-700 ml-4">
                    {catSubs.map((sub) => {
                      const subProds = catProds.filter(p => (p.subCategory || '').toLowerCase() === sub.name.toLowerCase());

                      return (
                        <div key={sub.id} className="bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-slate-200/50 dark:border-gray-700/60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                {sub.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({subProds.length} products)
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{sub.slug}</span>
                          </div>

                          {/* List of products in subcategory */}
                          {subProds.length > 0 && (
                            <div className="mt-2 pl-4 flex flex-wrap gap-2">
                              {subProds.map((prod) => (
                                <div
                                  key={prod.id}
                                  className="flex items-center space-x-2 bg-slate-50 dark:bg-gray-700 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-gray-600 text-[11px]"
                                >
                                  <img
                                    src={prod.image || '/default-product.svg'}
                                    alt={prod.name}
                                    className="w-4 h-4 rounded-full object-cover"
                                  />
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {prod.name}
                                  </span>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">
                                    {prod.stock} in stock
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INLINE DELETE CONFIRMATION: CATEGORY */}
      {deletingCat && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div>
            <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">Delete Category?</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Are you sure you want to delete <strong className="text-rose-950 dark:text-white">{deletingCat.name}</strong>? This will un-link associated subcategories.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setDeletingCat(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDeleteCategory(deletingCat.id);
                setDeletingCat(null);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* INLINE DELETE CONFIRMATION: SUBCATEGORY */}
      {deletingSub && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div>
            <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">Delete Subcategory?</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Are you sure you want to delete <strong className="text-rose-950 dark:text-white">{deletingSub.name}</strong>?
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setDeletingSub(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDeleteSubcategory(deletingSub.id);
                setDeletingSub(null);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
