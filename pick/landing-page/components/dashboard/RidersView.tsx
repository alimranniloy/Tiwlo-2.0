'use client'

import React, { useState } from 'react'
import { pickAdminRequest, usePickAdminData } from '@/lib/pick-admin-api'

interface AdminRider {
  id: string
  name: string
  email: string
  phone: string
  address: string
  area: string
  vehicleType: string
  vehicleName: string
  vehicleCapacityKg: number
  vehicleRegistration: string
  applicationStatus: 'pending' | 'approved' | 'rejected'
  applicationNote: string
  reviewedAt: string | null
  isOnDuty: boolean
  latitude: number | null
  longitude: number | null
  locationUpdatedAt: string | null
  appliedAt: string
}

interface DeliveryPolicy {
  vehicleType: string
  nameEn: string
  maxCapacityKg: number
  pickupRangeMeters: number
  deliveryRangeMeters: number
  active: boolean
}

interface RiderData {
  connected: boolean
  riders: AdminRider[]
  counts: { pending: number; approved: number; rejected: number; online: number }
}

interface PolicyData {
  policies: DeliveryPolicy[]
}

const numberField = 'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink/40'

function formatLocation(rider: AdminRider) {
  if (rider.latitude === null || rider.longitude === null) return 'No recent GPS'
  return `${rider.latitude.toFixed(5)}, ${rider.longitude.toFixed(5)}`
}

export const RidersView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<RiderData>('/riders')
  const { data: policyData, loading: policiesLoading, error: policyError, reload: reloadPolicies } =
    usePickAdminData<PolicyData>('/delivery-policies')
  const [pendingRiderId, setPendingRiderId] = useState('')
  const [pendingPolicyType, setPendingPolicyType] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [editedPolicies, setEditedPolicies] = useState<Record<string, DeliveryPolicy>>({})

  const reviewRider = async (rider: AdminRider, applicationStatus: 'approved' | 'rejected') => {
    setPendingRiderId(rider.id)
    setActionError('')
    setNotice('')
    try {
      await pickAdminRequest(`/riders/${encodeURIComponent(rider.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationStatus, applicationNote: rider.applicationNote })
      })
      setNotice(`${rider.name || rider.email} was ${applicationStatus}.`)
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update this rider.')
    } finally {
      setPendingRiderId('')
    }
  }

  const savePolicy = async (policy: DeliveryPolicy) => {
    setPendingPolicyType(policy.vehicleType)
    setActionError('')
    setNotice('')
    try {
      await pickAdminRequest(`/delivery-policies/${encodeURIComponent(policy.vehicleType)}`, {
        method: 'PUT',
        body: JSON.stringify({
          maxCapacityKg: policy.maxCapacityKg,
          pickupRangeMeters: policy.pickupRangeMeters,
          deliveryRangeMeters: policy.deliveryRangeMeters
        })
      })
      setNotice(`${policy.nameEn} delivery limits were saved.`)
      setEditedPolicies((current) => {
        const next = { ...current }
        delete next[policy.vehicleType]
        return next
      })
      await reloadPolicies()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this vehicle policy.')
    } finally {
      setPendingPolicyType('')
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <header>
        <h2 className="text-lg font-bold text-ink">PICK Delivery Riders</h2>
        <p className="mt-1 text-sm text-ink/55">Review Tiwlo-linked applications and tune vehicle capacity and local delivery ranges.</p>
      </header>

      {(error || policyError || actionError) && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError || error || policyError}
          <button onClick={() => { reload(); reloadPolicies() }} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Pending review', data?.counts.pending ?? 0],
          ['Approved', data?.counts.approved ?? 0],
          ['On duty', data?.counts.online ?? 0],
          ['Rejected', data?.counts.rejected ?? 0]
        ].map(([label, count]) => (
          <div key={label} className="ios-card p-4">
            <p className="text-xs font-medium text-ink/55">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{loading ? '—' : count}</p>
          </div>
        ))}
      </section>

      <section className="ios-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <div>
            <h3 className="font-semibold text-ink">Applications and fleet</h3>
            <p className="mt-1 text-xs text-ink/50">{data?.connected ? 'Connected to the PICK delivery service.' : 'Loading delivery service.'}</p>
          </div>
          <button onClick={reload} className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink">Refresh</button>
        </div>
        {loading ? <p className="p-5 text-sm text-ink/55">Loading riders…</p> : !data?.riders.length ? (
          <p className="p-5 text-sm text-ink/55">No delivery-partner applications yet.</p>
        ) : (
          <div className="divide-y divide-ink/10">
            {data.riders.map((rider) => (
              <article key={rider.id} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-ink">{rider.name || 'Tiwlo user'}</h4>
                    <span className={`badge ${rider.applicationStatus === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                      {rider.applicationStatus}
                    </span>
                    {rider.isOnDuty && <span className="badge badge-success">On duty</span>}
                  </div>
                  <p className="mt-1 truncate text-sm text-ink/60">{rider.email} · {rider.phone}</p>
                  <p className="mt-1 text-xs text-ink/45">{rider.address}{rider.area ? ` · ${rider.area}` : ''}</p>
                </div>
                <div className="text-sm text-ink/70">
                  <p>{rider.vehicleName} · up to {rider.vehicleCapacityKg} kg</p>
                  {rider.vehicleRegistration && <p className="mt-1 text-xs text-ink/50">Registration: {rider.vehicleRegistration}</p>}
                  <p className="mt-1 text-xs text-ink/50">{formatLocation(rider)}</p>
                  {rider.applicationNote && <p className="mt-1 text-xs text-ink/55">Review note: {rider.applicationNote}</p>}
                </div>
                {rider.applicationStatus === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      disabled={pendingRiderId === rider.id}
                      onClick={() => reviewRider(rider, 'approved')}
                      className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >Approve</button>
                    <button
                      disabled={pendingRiderId === rider.id}
                      onClick={() => reviewRider(rider, 'rejected')}
                      className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                    >Reject</button>
                  </div>
                ) : <span className="text-xs text-ink/45">Applied {new Date(rider.appliedAt).toLocaleDateString()}</span>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-ink/10 px-4 py-3">
          <h3 className="font-semibold text-ink">Vehicle capacity and service ranges</h3>
          <p className="mt-1 text-xs text-ink/50">Distances are straight-line estimates. Pickup and delivery pins must be in the same active coverage zone.</p>
        </div>
        {policiesLoading ? <p className="p-5 text-sm text-ink/55">Loading vehicle policies…</p> : (
          <div className="divide-y divide-ink/10">
            {policyData?.policies.map((policy) => {
              const edited = editedPolicies[policy.vehicleType] || policy
              return (
                <div key={policy.vehicleType} className="grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-ink">{policy.nameEn}</p>
                  <p className="text-xs text-ink/50">{policy.vehicleType}</p>
                </div>
                {([
                  ['maxCapacityKg', 'Capacity (kg)'],
                  ['pickupRangeMeters', 'Pickup range (m)'],
                  ['deliveryRangeMeters', 'Delivery range (m)']
                ] as const).map(([field, label]) => (
                  <label key={field} className="text-xs font-medium text-ink/60">
                    {label}
                    <input
                      className={`${numberField} mt-1`}
                      type="number"
                      min={field === 'maxCapacityKg' ? 0.1 : 100}
                      step={field === 'maxCapacityKg' ? 0.1 : 100}
                      value={edited[field]}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        if (!Number.isFinite(nextValue)) return
                        setEditedPolicies((current) => ({
                          ...current,
                          [policy.vehicleType]: { ...edited, [field]: nextValue }
                        }))
                      }}
                    />
                  </label>
                ))}
                <button
                  disabled={pendingPolicyType === policy.vehicleType}
                  onClick={() => savePolicy(edited)}
                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:col-start-4"
                >Save limits</button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
