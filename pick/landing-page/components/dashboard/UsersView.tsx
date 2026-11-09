'use client'

import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { usePickAdminData, type AdminUser } from '@/lib/pick-admin-api'

export const UsersView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<{ users: AdminUser[] }>('/users')
  const [search, setSearch] = useState('')
  const users = data?.users || []
  const filtered = useMemo(() => users.filter((user) =>
    `${user.name} ${user.phone} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  ), [search, users])

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-lg font-bold text-ink">PICK App Customers</h2><p className="mt-1 text-sm text-ink/55">Tiwlo accounts with a PICK profile and their stored order history.</p></div>
        <span className="text-sm text-ink/55">{loading ? 'Loading…' : `${users.length} accounts`}</span>
      </div>
      {(error) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      <section className="ios-card flex items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-ink/40" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, phone, or email…" className="h-9 w-full pl-9" /></div>
      </section>
      <section className="ios-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone / email</th><th className="px-4 py-3">Saved address</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Order value</th><th className="px-4 py-3">Joined</th></tr></thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-t border-black/5">
                  <td className="px-4 py-3 font-semibold">{user.name || '—'}</td>
                  <td className="px-4 py-3"><div>{user.phone || '—'}</div><div className="text-xs text-ink/55">{user.email}</div></td>
                  <td className="max-w-64 px-4 py-3"><div className="text-xs">{user.area || 'Area not provided'}</div><div className="truncate text-xs text-ink/55">{user.address || 'No saved address'}</div></td>
                  <td className="px-4 py-3">{user.totalOrders}</td>
                  <td className="px-4 py-3 font-semibold">৳{Number(user.orderValue).toLocaleString('en-BD')}</td>
                  <td className="px-4 py-3 text-xs text-ink/55">{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!loading && !error && !filtered.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/50">No PICK customer accounts match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
