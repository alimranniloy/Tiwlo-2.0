'use client'

import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { pickAdminRequest, usePickAdminData, type AdminOrder } from '@/lib/pick-admin-api'

const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`
const badgeFor: Record<string, string> = {
  placed: 'badge-info',
  preparing: 'badge-warning',
  in_transit: 'badge-info',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  payment_failed: 'badge-danger',
  pending_payment: 'badge-warning',
  payment_review: 'badge-warning',
}

export const OrdersView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<{ orders: AdminOrder[] }>('/orders')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [actionError, setActionError] = useState('')
  const orders = data?.orders || []
  const statuses = ['all', ...new Set(orders.map((order) => order.status))]
  const filtered = useMemo(() => orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    const matchesText = `${order.id} ${order.customerName} ${order.customerPhone} ${order.customerEmail}`.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesText
  }), [orders, search, statusFilter])

  const advanceOrder = async (order: AdminOrder, status: string) => {
    setUpdatingId(order.id)
    setActionError('')
    try {
      await pickAdminRequest(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update this order.')
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div>
        <h2 className="text-lg font-bold text-ink">PICK Orders</h2>
        <p className="mt-1 text-sm text-ink/55">Order, item, customer, and payment details from the live PICK database.</p>
      </div>
      {(error || actionError) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError || error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      <div className="ios-card flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-ink/40" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, phone…" className="h-9 w-full pl-9" /></div>
        <span className="text-sm text-ink/55">{loading ? 'Loading…' : `${filtered.length} orders`}</span>
        <div className="flex max-w-full gap-2 overflow-x-auto">{statuses.map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === status ? 'bg-ink text-white' : 'bg-[#f2f2f7] text-ink/60'}`}>{status === 'all' ? 'All statuses' : status.replaceAll('_', ' ')}</button>)}</div>
      </div>
      <section className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Order & time</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Total / payment</th><th className="px-4 py-3 text-right">Status</th></tr></thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3"><strong className="font-mono text-xs">#{order.id}</strong><div className="mt-1 text-xs text-ink/50">{new Date(order.createdAt).toLocaleString()}</div><div className="text-[11px] text-ink/45">{order.orderType}</div></td>
                  <td className="px-4 py-3"><strong>{order.customerName || '—'}</strong><div className="text-xs text-ink/55">{order.customerPhone}</div><div className="text-xs text-ink/45">{order.customerEmail}</div></td>
                  <td className="px-4 py-3">{order.items.length ? order.items.map((item, index) => <div key={`${item.name}-${index}`} className="text-xs">{item.name} × {item.quantity} {item.unit}</div>) : <span className="text-xs text-ink/45">Parcel order</span>}</td>
                  <td className="max-w-56 px-4 py-3 text-xs"><div>{order.deliveryArea || 'Area not provided'}</div><div className="mt-1 text-ink/55">{order.deliveryAddress}</div></td>
                  <td className="px-4 py-3"><strong>{money(order.total)}</strong><div className="text-xs text-ink/55">{order.paymentMethod} · {order.paymentStatus}</div></td>
                  <td className="px-4 py-3 text-right"><span className={`badge ${badgeFor[order.status] || 'badge-neutral'}`}>{order.status.replaceAll('_', ' ')}</span>
                    {order.orderType === 'grocery' && (
                      <div className="mt-2">
                        {order.status === 'placed' && <button disabled={updatingId === order.id} onClick={() => void advanceOrder(order, 'preparing')} className="rounded-lg bg-[#f2f2f7] px-2 py-1 text-[11px] font-semibold disabled:opacity-50">Mark preparing</button>}
                        {order.status === 'preparing' && <button disabled={updatingId === order.id} onClick={() => void advanceOrder(order, 'in_transit')} className="rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">Mark in transit</button>}
                        {order.status === 'in_transit' && <button disabled={updatingId === order.id} onClick={() => void advanceOrder(order, 'delivered')} className="rounded-lg bg-[#f2f2f7] px-2 py-1 text-[11px] font-semibold disabled:opacity-50">Mark delivered</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !error && !filtered.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/50">No matching PICK orders are stored yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
