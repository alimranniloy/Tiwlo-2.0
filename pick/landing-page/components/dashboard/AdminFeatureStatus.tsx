'use client'

import React from 'react'
import { usePickAdminData } from '@/lib/pick-admin-api'

interface FeatureStatus {
  connected: boolean
  message: string
}

export function AdminFeatureStatus({ path, title, description }: {
  path: string
  title: string
  description: string
}) {
  const { data, loading, error, reload } = usePickAdminData<FeatureStatus>(path)

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div><h2 className="text-lg font-bold text-ink">{title}</h2><p className="mt-1 text-sm text-ink/55">{description}</p></div>
      {error && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      <section className="ios-card max-w-3xl p-6">
        <span className={`badge ${data?.connected ? 'badge-success' : 'badge-warning'}`}>{loading ? 'Checking service…' : data?.connected ? 'Connected' : 'Not connected'}</span>
        <p className="mt-4 text-sm leading-6 text-ink/70">{data?.message || 'Checking whether PICK has a connected service for this feature.'}</p>
        {!loading && !error && !data?.connected && <p className="mt-3 text-xs text-ink/45">This section does not display sample records or report actions as successful unless the connected service confirms them.</p>}
      </section>
    </div>
  )
}
