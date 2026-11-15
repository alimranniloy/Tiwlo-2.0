import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Coins,
  CreditCard,
  ExternalLink,
  Plus,
  Receipt,
  RotateCw,
  Search,
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';
import { getCloudBillingData } from '../../dashboards/cloud/graphql/cloudQueries';

export default function WorkspaceBillingView({
  currentUser,
  onBack,
  onNavigate,
  onOpenCloudBilling,
}) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [services, setServices] = useState([]);
  const [billingAccount, setBillingAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadBilling = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [workspace, billingRes] = await Promise.all([
        WorkspaceAPI.getWorkspace(),
        userId ? getCloudBillingData(userId).catch(() => null) : Promise.resolve(null),
      ]);

      setServices(
        (workspace?.services || []).filter(
          (service) => !['store', 'droplet'].includes(service.workspaceItemType)
        )
      );
      setBillingAccount(billingRes?.account || null);
    } catch (err) {
      setError(err.message || 'Could not load integrated Workspace billing history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBilling(false);
  }, [userId]);

  const invoices = Array.isArray(billingAccount?.invoices) ? billingAccount.invoices : [];
  const gateways = Array.isArray(billingAccount?.configuredGateways)
    ? billingAccount.configuredGateways.filter((g) => g.enabled)
    : [];
  const filteredInvoices = invoices.filter((inv) => {
    const st = String(inv.status || '').toLowerCase();
    if (statusFilter !== 'all' && st !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(inv.id || '').toLowerCase().includes(q) ||
      String(inv.description || '').toLowerCase().includes(q) ||
      st.includes(q)
    );
  });

  const formatMoney = (amount, currency = billingAccount?.currency || 'USD') => {
    const num = Number(amount || 0);
    return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Workspace</span>
              <span>/</span>
              <span>Integrated Billing History</span>
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Integrated Billing History
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Live GraphQL ledger combining cloud wallet balance, invoices, configured gateways, and activated Workspace services.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadBilling(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {onOpenCloudBilling && (
            <button
              type="button"
              onClick={() => onOpenCloudBilling('overview')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Manage Wallet</span>
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('marketplace')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] px-4 py-2 text-xs font-semibold text-black hover:bg-[#19c354] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Browse Marketplace</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Wallet Credits</span>
            <Coins className="h-4 w-4 text-[#1ED760]" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {billingAccount ? formatMoney(billingAccount.credits) : '—'}
          </div>
          <p className="mt-1 text-xs text-neutral-500 tabular-nums">
            Promo credits: {billingAccount ? formatMoney(billingAccount.promotionalCredits) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Month-to-Date Spend</span>
            <Receipt className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {billingAccount ? formatMoney(billingAccount.monthToDateSpent) : '—'}
          </div>
          <p className="mt-1 text-xs text-neutral-500 tabular-nums">
            Projected: {billingAccount ? formatMoney(billingAccount.projectedCost) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Payment Gateways</span>
            <CreditCard className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-neutral-950 dark:text-white truncate">
            {gateways.length > 0 ? gateways.map((g) => g.name || g.id).join(', ') : 'None enabled'}
          </div>
          <p className="mt-1 text-xs text-neutral-500 truncate">
            {billingAccount?.paymentGatewayStatusMessage || `${gateways.length} active checkout provider(s)`}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
            <span>Activated Services</span>
            <CheckCircle2 className="h-4 w-4 text-[#1ED760]" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
            {services.length}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {invoices.length} invoice record(s) found
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 dark:border-neutral-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Invoices &amp; Credit Topups ({filteredInvoices.length})
            </h2>
            <p className="text-xs text-neutral-500">Official platform billing records tied to your billing ID {billingAccount?.billingAccountId || currentUser?.tiwiId || '—'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice ID or description..."
                className="h-8 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 pl-8 pr-3 text-xs outline-none focus:border-neutral-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 text-xs outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-neutral-400">Loading real billing history...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-10 text-center text-xs text-neutral-500">
            No invoices match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/50 text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-5 font-semibold">Invoice ID</th>
                  <th className="py-3 px-5 font-semibold">Description</th>
                  <th className="py-3 px-5 font-semibold">Amount</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {filteredInvoices.map((inv) => {
                  const paid = String(inv.status || '').toLowerCase() === 'paid';
                  return (
                    <tr key={inv.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                      <td className="py-3.5 px-5 font-mono font-medium text-neutral-900 dark:text-white">{inv.id}</td>
                      <td className="py-3.5 px-5 text-neutral-700 dark:text-neutral-300">{inv.description || 'Platform charge'}</td>
                      <td className="py-3.5 px-5 font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          paid
                            ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {inv.status || 'pending'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-neutral-500 tabular-nums">
                        {inv.paidAt || inv.createdAt ? new Date(inv.paidAt || inv.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activated Marketplace Services */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        <div className="border-b border-neutral-200/80 dark:border-neutral-800 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Activated Workspace Add-on Services ({services.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-400">Loading services...</div>
        ) : services.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No third-party Marketplace add-on services are active right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/50 text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-5 font-semibold">Service</th>
                  <th className="py-3 px-5 font-semibold">Server / Target</th>
                  <th className="py-3 px-5 font-semibold">Plan</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className="py-3.5 px-5 font-medium text-neutral-950 dark:text-white">{service.name}</td>
                    <td className="py-3.5 px-5 text-neutral-600 dark:text-neutral-400">{service.serverName || '—'}</td>
                    <td className="py-3.5 px-5 text-neutral-600 dark:text-neutral-400">{service.plan || '—'}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                        {service.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
