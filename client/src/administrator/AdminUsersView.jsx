import React, { useCallback, useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminUsersView({ onBackToDashboard, showToast, currentUser }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const isSuperAdminActor = currentUser?.role === 'super_admin' ||
    currentUser?.email?.toLowerCase() === 'tiwloltd@gmail.com';

  // Modals state
  const [editUserTarget, setEditUserTarget] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', email: '', role: 'owner', planId: 'free' });
  const [banUserTarget, setBanUserTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async (targetPage = 1) => {
    try {
      const token = localStorage.getItem('stockpro_session');
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: '20', // Strictly 20 per page as instructed
        q: search.trim(),
        role: roleFilter,
        status: statusFilter
      });

      const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status}).`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setFetchError('');
    } catch (err) {
      console.error('[Admin Users] Fetch error:', err);
      setUsers([]);
      setFetchError('Live user data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setLoading(true);
    setPage(newPage);
    fetchUsers(newPage);
  };

  // Ban / Unban User
  const handleBanToggle = async (user, isBanning, reason) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ isBanned: isBanning, reason })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'User status updated');
        setBanUserTarget(null);
        setBanReason('');
        // Instant sync in state
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...data.user } : u));
      } else {
        showToast?.(data.error || 'Failed to update user ban status', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error updating ban status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit User Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editUserTarget) return;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/users/${editUserTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(isSuperAdminActor
          ? editFormData
          : Object.fromEntries(Object.entries(editFormData).filter(([key]) => key !== 'role')))
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.('User updated successfully');
        setEditUserTarget(null);
        setLoading(true);
        fetchUsers(page);
      } else {
        showToast?.(data.error || 'Failed to update user', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error updating user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User
  const handleDeleteSubmit = async () => {
    if (!deleteUserTarget) return;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/users/${deleteUserTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'User deleted');
        setDeleteUserTarget(null);
        setLoading(true);
        fetchUsers(page);
      } else {
        showToast?.(data.error || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Error deleting user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              System Users Management
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {total} Total Users
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            View, search, edit, ban, or delete user accounts across the entire platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              fetchUsers(page);
            }}
            className="p-1.5 px-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Search & Filter Controls */}
        <div className="p-3 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
              }}
              placeholder="Search by Tiwi ID (TIW-xxxx), email, or name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="banned">Suspended / Banned</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setLoading(true);
                setRoleFilter(e.target.value);
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="owner">Store Owners</option>
              <option value="super_admin">Super Admins</option>
              <option value="staff">Staff Members</option>
              <option value="customer">Customers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        {/* Users Table (Tight Padding) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-3">Tiwi ID</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-center">Stores</th>
                <th className="py-2.5 px-3">Plan</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading users (20 per page)...</span>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-rose-500">{fetchError}</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSuperAdmin = u.role === 'super_admin' || u.email?.toLowerCase() === 'tiwloltd@gmail.com';
                  const canManageUser = !isSuperAdmin && (u.role !== 'admin' || isSuperAdminActor);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* User Info */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                              {u.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tiwi ID */}
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-400 text-[11px]">
                        {u.tiwiId}
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuperAdmin
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            : u.role === 'owner'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {isSuperAdmin ? 'Super Admin' : u.role === 'owner' ? 'Store Owner' : u.role}
                        </span>
                      </td>

                      {/* Stores Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {u.storeCount || 0}
                        </span>
                      </td>

                      {/* Plan */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        {u.planName}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isBanned
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}>
                          {u.isBanned ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            disabled={!canManageUser}
                            onClick={() => {
                              setEditUserTarget(u);
                              setEditFormData({
                                name: u.name,
                                email: u.email,
                                role: u.role,
                                planId: u.planId
                              });
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Ban / Suspend button */}
                          {canManageUser && (
                            <button
                              onClick={() => {
                                if (u.isBanned) {
                                  handleBanToggle(u, false);
                                } else {
                                  setBanUserTarget(u);
                                  setBanReason('');
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                                u.isBanned
                                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                  : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                              }`}
                              title={u.isBanned ? 'Restore User Access' : 'Suspend User Account'}
                            >
                              {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                          )}

                          {/* Delete button */}
                          {canManageUser && (
                            <button
                              onClick={() => setDeleteUserTarget(u)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Strict 20 Items/Page Pagination Bar */}
        <div className="p-3 px-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min(total, (page - 1) * 20 + 1)}</span> to{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min(total, page * 20)}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span> users (Max 20/page)
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-[11px]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                onClick={() => handlePageChange(pNum)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                  page === pNum
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pNum}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-[11px]"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit User: {editUserTarget.name}
              </h3>
              <button onClick={() => setEditUserTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    value={editFormData.role}
                    disabled={!isSuperAdminActor}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-60"
                  >
                    <option value="owner">Store Owner</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Plan</label>
                  <select
                    value={editFormData.planId}
                    onChange={(e) => setEditFormData({
                      ...editFormData,
                      planId: e.target.value,
                      planName: ({
                        free: 'Free Starter',
                        growth: 'Growth Retailer',
                        pro: 'Pro Business',
                        enterprise: 'Enterprise VIP'
                      })[e.target.value]
                    })}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="free">Free Starter</option>
                    <option value="growth">Growth Retailer</option>
                    <option value="pro">Pro Business</option>
                    <option value="enterprise">Enterprise VIP</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditUserTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban / Suspend Confirmation Modal */}
      {banUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend / Ban User
                </h3>
                <p className="text-[11px] text-slate-400">
                  {banUserTarget.name} ({banUserTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              When suspended, the user will be instantly logged out and shown the disabled account notice screen upon sign-in. You can unsuspend at any time to immediately restore their access.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for suspension:
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Violation of platform policies, abusive behavior, suspected compromised account..."
                rows={2}
                className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBanUserTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleBanToggle(banUserTarget, true, banReason)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
              >
                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Permanently Delete User?
                </h3>
                <p className="text-[11px] text-slate-400">
                  {deleteUserTarget.name} ({deleteUserTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This action cannot be undone. The user account and their active sessions will be permanently removed from the system database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteSubmit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
