'use client'

import React, { useMemo, useState } from 'react'
import { usePickAdminData } from '@/lib/pick-admin-api'

interface FinanceData {
  summary: {
    paidCount: number
    paidTotal: number
    pendingCount: number
    pendingTotal: number
    cashOrders: number
    deliveredCodTotal: number
  }
  transactions: {
    orderId: string
    orderType: string
    paymentMethod: string
    paymentProvider: string | null
    paymentStatus: string
    transactionId: string | null
    amount: number
    createdAt: string
  }[]
}

const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`

export const FinanceView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<FinanceData>('/finance')
  const [gateway, setGateway] = useState('all')
  const rows = data?.transactions || []
  const gateways = useMemo(() => ['all', ...new Set(rows.map((row) => row.paymentProvider || row.paymentMethod))], [rows])
  const filtered = rows.filter((row) => gateway === 'all' || (row.paymentProvider || row.paymentMethod) === gateway)

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div><h2 className="text-lg font-bold text-ink">PICK Payment Records</h2><p className="mt-1 text-sm text-ink/55">Amounts and payment states stored on PICK orders. No gateway balance or rider payout is available here.</p></div>
      {error && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Verified online payments', money(data?.summary.paidTotal || 0), `${data?.summary.paidCount || 0} orders`],
          ['Pending online payments', money(data?.summary.pendingTotal || 0), `${data?.summary.pendingCount || 0} orders`],
          ['COD orders', String(data?.summary.cashOrders || 0), 'Payment collection is not reconciled in PICK'],
          ['Delivered COD order value', money(data?.summary.deliveredCodTotal || 0), 'Order value, not confirmed settlement'],
        ].map(([label, value, detail]) => <div key={label} className="ios-card p-5"><p className="text-xs font-medium text-ink/55">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{loading ? '—' : value}</p><p className="mt-1 text-xs text-ink/45">{detail}</p></div>)}
      </div>
      <section className="ios-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
          <div><h3 className="font-semibold text-ink">Order payment ledger</h3><p className="text-xs text-ink/50">Provider references are shown only when stored by the verified payment flow.</p></div>
          <select value={gateway} onChange={(event) => setGateway(event.target.value)} className="h-9 rounded-lg">{gateways.map((item) => <option key={item} value={item}>{item === 'all' ? 'All methods' : item}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Order / time</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Provider reference</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3 text-right">Payment status</th></tr></thead>
            <tbody>
              {filtered.map((row) => <tr key={row.orderId} className="border-t border-black/5"><td className="px-4 py-3 font-mono text-xs">#{row.orderId}<div className="mt-1 font-sans text-ink/50">{new Date(row.createdAt).toLocaleString()}</div></td><td className="px-4 py-3">{row.orderType}</td><td className="px-4 py-3">{row.paymentProvider || row.paymentMethod}</td><td className="px-4 py-3 font-mono text-xs">{row.transactionId || '—'}</td><td className="px-4 py-3 font-semibold">{money(row.amount)}</td><td className="px-4 py-3 text-right"><span className={`badge ${row.paymentStatus === 'paid' ? 'badge-success' : row.paymentStatus === 'pending' ? 'badge-warning' : 'badge-neutral'}`}>{row.paymentStatus}</span></td></tr>)}
              {!loading && !error && !filtered.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/50">No payment records are stored in PICK yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
