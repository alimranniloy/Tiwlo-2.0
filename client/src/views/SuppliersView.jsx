import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Clock,
  Star,
  Edit2,
  Trash2,
  X,
  PackageCheck,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function SuppliersView({
  suppliers = [],
  categories = [],
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onBackToDashboard
}) {
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);

  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: 'Electronics',
    leadTimeDays: 5,
    status: 'Active'
  });

  const filteredSuppliers = suppliers.filter(s =>
    (s.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.contactPerson || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.companyName) return;

    if (editingSupplier) {
      await onUpdateSupplier(editingSupplier.id, form);
      setEditingSupplier(null);
    } else {
      await onAddSupplier(form);
      setIsAddModalOpen(false);
    }

    setForm({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      category: 'Electronics',
      leadTimeDays: 5,
      status: 'Active'
    });
  };

  const avgLeadTime = suppliers.length
    ? Math.round(suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 5), 0) / suppliers.length)
    : 5;

  if (isAddModalOpen || editingSupplier) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingSupplier(null);
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Suppliers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingSupplier ? 'Edit Supplier Details' : 'Add New Supplier Partner'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingSupplier ? `Editing details for ${editingSupplier.companyName}` : 'Add vendor profile for purchasing, lead time, and supply management'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Tech Global"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Vance"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Category Focus
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="sales@apex.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  placeholder="+1 555-..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.leadTimeDays}
                  onChange={(e) => setForm({ ...form, leadTimeDays: parseInt(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Warehouse / Facility Address
              </label>
              <input
                type="text"
                placeholder="e.g. 402 Silicon Way, Austin, TX"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                <Truck className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Suppliers & Vendors Directory
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Manage supply chain partners, order lead times, vendor categories, and direct contact details.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setForm({
              companyName: '',
              contactPerson: '',
              email: '',
              phone: '',
              address: '',
              category: categories[0]?.name || 'Electronics',
              leadTimeDays: 5,
              status: 'Active'
            });
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Suppliers</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{suppliers.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Approved partners</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Supply Lines</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {suppliers.filter(s => s.status === 'Active').length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Currently fulfilling</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Lead Time</span>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">
            {avgLeadTime} days
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">PO to dock arrival</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Partner Rating</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-500 mt-1.5 flex items-center space-x-1">
            <span>4.8</span>
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">On-time delivery score</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by vendor company, contact, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Contact Representative</th>
                <th className="py-3.5 px-4">Category Focus</th>
                <th className="py-3.5 px-4">Avg Lead Time</th>
                <th className="py-3.5 px-4">Rating</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {filteredSuppliers.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center text-xs">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {s.companyName}
                        </p>
                        <p className="text-[10px] text-slate-400">{s.address || 'Global Direct'}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">{s.contactPerson || 'Sales Desk'}</p>
                      <p className="text-[10px] text-slate-400">{s.email}</p>
                      <p className="text-[10px] text-slate-400">{s.phone}</p>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {s.category || 'General'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{s.leadTimeDays || 5} business days</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{s.rating || '4.8'}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {s.status || 'Active'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingSupplier(s);
                          setForm({
                            companyName: s.companyName,
                            contactPerson: s.contactPerson || '',
                            email: s.email || '',
                            phone: s.phone || '',
                            address: s.address || '',
                            category: s.category || 'Electronics',
                            leadTimeDays: s.leadTimeDays || 5,
                            status: s.status || 'Active'
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                        title="Edit Supplier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingSupplier(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* INLINE DELETE CONFIRMATION */}
      {deletingSupplier && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div>
            <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">Delete Supplier Partner?</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Are you sure you want to delete <strong>{deletingSupplier.companyName}</strong> from your supplier directory?
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setDeletingSupplier(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDeleteSupplier(deletingSupplier.id);
                setDeletingSupplier(null);
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
