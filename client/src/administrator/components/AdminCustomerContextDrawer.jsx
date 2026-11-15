import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CreditCard,
  History,
  Loader2,
  ShieldAlert,
  Store,
  User,
  X,
} from 'lucide-react';
import { supportFetch as fetch } from '../../utils/supportFetch';
import PaginationBar from '../../components/PaginationBar';

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Strictly READ-ONLY Customer 360 Context Drawer for Support Tickets (ZERO ban/destructive actions).
 */
export default function AdminCustomerContextDrawer({
  open,
  ticketId,
  apiBase = '/api',
  onClose,
}) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview'); // 'overview' | 'orders' | 'invoices' | 'stores' | 'comms' | 'logs'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadContext = useCallback(async () => {
    if (!open || !ticketId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/admin/support/tickets/${encodeURIComponent(ticketId)}/customer-context`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not load customer context');
      }
      setContext(json.context || json);
    } catch (err) {
      setError(err.message || 'Unavailable');
    } finally {
      setLoading(false);
    }
  }, [open, ticketId, apiBase]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    setPage(1);
  }, [tab, pageSize, ticketId]);

  if (!open) return null;

  const user = context?.user || {};
  const billingId = context?.billingId || user?.billingId || user?.tiwiId || context?.tiwiId || '—';
  const orders = Array.isArray(context?.orders) ? context.orders : [];
  const invoices = Array.isArray(context?.invoices) ? context.invoices : Array.isArray(context?.payments) ? context.payments : [];
  const stores = Array.isArray(context?.stores) ? context.stores : [];
  const services = Array.isArray(context?.services) ? context.services : [];
  const risk = context?.multiAccountRisk || context?.risk || {};
  const signals = Array.isArray(risk?.signals) ? risk.signals : [];
  const comms = Array.isArray(context?.communicationHistory) ? context.communicationHistory : [];
  const activityLogs = Array.isArray(context?.activityLogs) ? context.activityLogs : [];

  const activeList =
    tab === 'orders'
      ? orders
      : tab === 'invoices'
        ? invoices
        : tab === 'stores'
          ? [...stores, ...services]
          : tab === 'comms'
            ? comms
            : tab === 'logs'
              ? activityLogs
              : [];

  const pagedList = activeList.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Read-Only Customer Context
                </h2>
                <span className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
                  Read-Only Audit View
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Billing ID: <span className="font-mono font-semibold">{billingId}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-5 py-2.5">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'orders', label: `Orders (${orders.length})` },
            { id: 'invoices', label: `Invoices (${invoices.length})` },
            { id: 'stores', label: `Stores & Services (${stores.length + services.length})` },
            { id: 'comms', label: `Comms (${comms.length})` },
            { id: 'logs', label: `Activity (${activityLogs.length})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                tab === item.id
                  ? 'bg-[#1ED760] text-neutral-950 font-semibold'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#1ED760]" />
              <span>Loading customer context...</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-4 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : tab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3.5 space-y-1.5 text-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Identity</p>
                  <p className="font-semibold text-neutral-950 dark:text-white">{user.name || 'Customer'}</p>
                  <p className="text-neutral-600 dark:text-neutral-300">{user.email || '—'}</p>
                  <p className="font-mono text-[11px] text-neutral-500">Billing ID: {billingId}</p>
                </div>

                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Multi-Account Risk</p>
                    <ShieldAlert className="h-4 w-4 text-neutral-500" />
                  </div>
                  <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">
                    Score: {risk?.score ?? user?.riskScore ?? 0} / 100
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {signals.length > 0 ? signals.join(' · ') : 'No multi-account risk signals detected'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-3">
                  <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{orders.length}</p>
                  <p className="text-[11px] text-neutral-500">Orders</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-3">
                  <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{stores.length}</p>
                  <p className="text-[11px] text-neutral-500">Stores</p>
                </div>
                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-3">
                  <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{invoices.length}</p>
                  <p className="text-[11px] text-neutral-500">Invoices</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
              {pagedList.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500">No records in this section.</div>
              ) : (
                <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                  {tab === 'orders' &&
                    pagedList.map((ord, idx) => (
                      <div key={ord.id || idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {ord.order_number || ord.orderNumber || `#${ord.id}`}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Expires: {fmtDate(ord.expires_at || ord.expiresAt)} · {ord.payment_method || ord.paymentMethod || 'Card'}
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {ord.currency || 'USD'} {Number(ord.total || 0).toFixed(2)}
                          </p>
                          <span className="text-[10px] uppercase font-semibold text-neutral-500">
                            {ord.status || 'active'}
                          </span>
                        </div>
                      </div>
                    ))}

                  {tab === 'invoices' &&
                    pagedList.map((inv, idx) => (
                      <div key={inv.id || idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-[#1ED760]" />
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {inv.invoiceNumber || inv.reference || `Invoice #${inv.id || idx + 1}`}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              {fmtDate(inv.created_at || inv.createdAt)} · {inv.method || inv.gateway || 'Gateway'}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                          {inv.currency || 'USD'} {Number(inv.amount || inv.total || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}

                  {tab === 'stores' &&
                    pagedList.map((st, idx) => (
                      <div key={st.id || idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-[#1ED760]" />
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {st.name || st.storeName || st.serviceName || 'Store / Service'}
                            </p>
                            <p className="text-[11px] text-neutral-500">{st.subdomain || st.domain || st.type || 'Platform'}</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-600 dark:text-neutral-300">
                          {st.status || (st.active === false ? 'Deactivated' : 'Active')}
                        </span>
                      </div>
                    ))}

                  {tab === 'comms' &&
                    pagedList.map((cm, idx) => (
                      <div key={cm.id || idx} className="p-3.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5 text-[#1ED760]" />
                            {cm.channel || cm.type || 'Support'} — {cm.subject || cm.summary || 'Message'}
                          </span>
                          <span className="text-[11px] text-neutral-400">{fmtDate(cm.createdAt || cm.timestamp)}</span>
                        </div>
                        {cm.preview && <p className="text-[11px] text-neutral-500">{cm.preview}</p>}
                      </div>
                    ))}

                  {tab === 'logs' &&
                    pagedList.map((lg, idx) => (
                      <div key={lg.id || idx} className="p-3.5 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Activity className="h-3.5 w-3.5 text-[#1ED760] shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                              {lg.action || lg.event || lg.description || 'Activity'}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">{lg.ip || lg.detail || ''}</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-neutral-400 shrink-0">
                          {fmtDate(lg.createdAt || lg.timestamp)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={activeList.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="records"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
