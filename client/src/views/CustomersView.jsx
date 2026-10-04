import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  DollarSign,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function CustomersView({
  customers = [],
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onBackToDashboard
}) {
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Dhaka',
    status: 'Active'
  });

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.city || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) return;

    if (editingCustomer) {
      await onUpdateCustomer(editingCustomer.id, form);
      setEditingCustomer(null);
    } else {
      await onAddCustomer(form);
      setIsAddModalOpen(false);
    }

    setForm({ name: '', email: '', phone: '', address: '', city: 'Dhaka', status: 'Active' });
  };

  const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);

  if (isAddModalOpen || editingCustomer) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingCustomer(null);
            }}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Customers"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {editingCustomer ? 'Edit Customer Account' : 'Add New Customer'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingCustomer ? `Editing details for ${editingCustomer.name}` : 'Create a new customer profile for order management'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) ..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
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
                Street Address
              </label>
              <input
                type="text"
                placeholder="e.g. 123 Main St, Apt 4"
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
                  setEditingCustomer(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                {editingCustomer ? 'Save Changes' : 'Create Customer'}
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
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Customers Directory
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Maintain client accounts, order velocity, shipping addresses, and lifetime revenue.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setForm({ name: '', email: '', phone: '', address: '', city: 'Dhaka', status: 'Active' });
            setIsAddModalOpen(true);
          }}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Customers</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{customers.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Active client accounts</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Orders Placed</span>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">{totalOrders}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Purchases across all users</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Lifetime Value</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            ${Math.round(totalSpent).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Gross client spend</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg. Spend / Customer</span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
            ${customers.length ? Math.round(totalSpent / customers.length) : 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Average revenue per buyer</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, email, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">City & Address</th>
                <th className="py-3.5 px-4">Orders Placed</th>
                <th className="py-3.5 px-4">Total Spent</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {filteredCustomers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {c.name}
                        </p>
                        <p className="text-[10px] text-slate-400">ID: {c.id}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
                      {c.email && (
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{c.city || c.address || 'Dhaka'}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-white">
                    {c.totalOrders || 0} orders
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    ${parseFloat(c.totalSpent || 0).toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {c.status || 'Active'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingCustomer(c);
                          setForm({
                            name: c.name,
                            email: c.email || '',
                            phone: c.phone || '',
                            address: c.address || '',
                            city: c.city || 'Dhaka',
                            status: c.status || 'Active'
                          });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCustomer(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                        title="Delete Customer"
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
      {deletingCustomer && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div>
            <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm">Delete Customer Account?</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              Are you sure you want to remove <strong>{deletingCustomer.name}</strong> from your customer directory?
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setDeletingCustomer(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await onDeleteCustomer(deletingCustomer.id);
                setDeletingCustomer(null);
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
