'use client'

import React from 'react'
import { ArrowUpRight, CheckCircle2, Clock, ShoppingBag, TrendingUp } from 'lucide-react'
import { usePickAdminData, type AdminOrder } from '@/lib/pick-admin-api'
import type { DashboardTab } from './Sidebar'

interface OverviewData {
  metrics: {
    ordersToday: number
    orderValueToday: number
    paidToday: number
    openOrders: number
    pendingPayments: number
  }
  hourly: { hour: string; orders: number; value: number }[]
  recentOrders: AdminOrder[]
}

const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`

function SalesChart({ hourly }: { hourly: OverviewData['hourly'] }) {
  if (!hourly.length || hourly.every((item) => item.orders === 0)) {
    return <p className="py-16 text-center text-sm text-ink/50">No PICK orders were recorded in the last 24 hours.</p>
  }
  const width = 640
  const height = 220
  const max = Math.max(1, ...hourly.map((item) => item.value))
  const points = hourly.map((item, index) => [
    (index / Math.max(1, hourly.length - 1)) * width,
    height - (item.value / max) * height,
  ] as const)
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height + 4}`} className="h-56 w-full" role="img" aria-label="PICK order value by hour">
        <defs>
          <linearGradient id="pick-order-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d1d1f" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1d1d1f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="#1d1d1f" strokeOpacity="0.07" strokeDasharray="4 6" />
        ))}
        <path d={area} fill="url(#pick-order-fill)" />
        <path d={line} fill="none" stroke="#1d1d1f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-ink/40">
        {hourly.filter((_, index) => index % Math.max(1, Math.ceil(hourly.length / 6)) === 0).map((item) => (
          <span key={item.hour}>{new Date(item.hour).toLocaleTimeString([], { hour: 'numeric' })}</span>
        ))}
      </div>
    </div>
  )
}

const statusClass: Record<string, string> = {
  placed: 'badge-info',
  preparing: 'badge-warning',
  in_transit: 'badge-info',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  pending_payment: 'badge-warning',
  payment_failed: 'badge-danger',
}

export const OverviewView: React.FC<{ onNavigateTab: (tab: DashboardTab) => void }> = ({ onNavigateTab }) => {
  const { data, loading, error, reload } = usePickAdminData<OverviewData>('/overview')
  const metrics = data?.metrics

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          {error}<button onClick={reload} className="font-semibold underline">Retry</button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today's order value", value: money(metrics?.orderValueToday || 0), sub: `${metrics?.ordersToday ?? 0} orders recorded today`, icon: TrendingUp, dark: true },
          { label: 'Verified payments today', value: money(metrics?.paidToday || 0), sub: 'Only server-verified online payments', icon: CheckCircle2 },
          { label: 'Open orders', value: String(metrics?.openOrders ?? 0), sub: 'Placed, preparing, or in transit', icon: ShoppingBag },
          { label: 'Pending payments', value: String(metrics?.pendingPayments ?? 0), sub: 'Awaiting provider verification', icon: Clock },
        ].map((item) => (
          <div key={item.label} className={`rounded-[1.75rem] p-5 ${item.dark ? 'bg-ink text-white' : 'ios-card text-ink'}`}>
            <span className={`flex size-10 items-center justify-center rounded-xl ${item.dark ? 'bg-white text-ink' : 'bg-[#f2f2f7] text-ink'}`}>
              <item.icon size={18} />
            </span>
            <p className={`mt-5 text-xs font-medium ${item.dark ? 'text-white/55' : 'text-ink/50'}`}>{item.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{loading ? '—' : item.value}</p>
            <p className={`mt-1 text-xs ${item.dark ? 'text-white/45' : 'text-ink/45'}`}>{item.sub}</p>
          </div>
        ))}
      </div>

      <section className="ios-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Order value by hour</h2>
            <p className="text-xs text-ink/50">PICK orders recorded during the last 24 hours</p>
          </div>
          <span className="badge badge-neutral">Database records</span>
        </div>
        {loading ? <p className="py-16 text-center text-sm text-ink/50">Loading PICK order data…</p> : <SalesChart hourly={data?.hourly || []} />}
      </section>

      <section className="overflow-hidden ios-card">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent PICK orders</h2>
            <p className="text-xs text-ink/50">Most recently saved orders</p>
          </div>
          <button onClick={() => onNavigateTab('orders')} className="flex items-center gap-1 text-xs font-semibold text-ink/60 hover:text-ink">
            View orders <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="bg-paper text-[11px] uppercase tracking-wider text-ink/45">
                <th className="px-6 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Total</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders || []).map((order) => (
                <tr key={order.id} className="border-t border-black/5">
                  <td className="px-6 py-3 font-mono text-xs">#{order.id}</td>
                  <td className="px-3 py-3">{order.customerName || order.customerEmail}</td>
                  <td className="px-3 py-3 font-semibold">{money(order.total)}</td>
                  <td className="px-6 py-3"><span className={`badge ${statusClass[order.status] || 'badge-neutral'}`}>{order.status.replaceAll('_', ' ')}</span></td>
                </tr>
              ))}
              {!loading && !error && !data?.recentOrders.length && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-ink/50">No PICK orders are in the database yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
