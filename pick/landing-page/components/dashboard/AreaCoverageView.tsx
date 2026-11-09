'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { usePickAdminData, pickAdminRequest } from '@/lib/pick-admin-api'
import type { CoverageMapLocation, CoverageMapZone } from './CoverageMap'

const CoverageMap = dynamic(() => import('./CoverageMap').then((module) => module.CoverageMap), {
  ssr: false,
  loading: () => <div className="flex h-[340px] items-center justify-center bg-paper text-sm text-ink/50 md:h-[460px]">Loading service map…</div>,
})

interface CoverageWaitlistEntry {
  userId: string
  name: string
  email: string
  phone: string
  address: string
  area: string
  latitude: number
  longitude: number
  createdAt: string
}

interface CoverageData {
  zones: CoverageMapZone[]
  locations: CoverageMapLocation[]
  waitlist: CoverageWaitlistEntry[]
  areas: { area: string; customers: number; covered: number; uncovered: number }[]
  summary: {
    activeZones: number
    coveredLocations: number
    uncoveredLocations: number
    waitlistCount: number
  }
}

interface CoveragePoint {
  latitude: number
  longitude: number
}

const emptySummary: CoverageData['summary'] = {
  activeZones: 0,
  coveredLocations: 0,
  uncoveredLocations: 0,
  waitlistCount: 0,
}

export const AreaCoverageView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<CoverageData>('/coverage')
  const [selectedPoint, setSelectedPoint] = useState<CoveragePoint | null>(null)
  const [editingZone, setEditingZone] = useState<CoverageMapZone | null>(null)
  const [nameEn, setNameEn] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [radiusMeters, setRadiusMeters] = useState('5000')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const summary = data?.summary || emptySummary

  const startNewZone = () => {
    setEditingZone(null)
    setSelectedPoint(null)
    setNameEn('')
    setNameBn('')
    setRadiusMeters('5000')
    setActionError('')
  }

  const editZone = (zone: CoverageMapZone) => {
    setEditingZone(zone)
    setNameEn(zone.nameEn)
    setNameBn(zone.nameBn)
    setRadiusMeters(String(zone.radiusMeters))
    setSelectedPoint({ latitude: zone.centerLatitude, longitude: zone.centerLongitude })
    setActionError('')
  }

  const saveZone = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedPoint) {
      setActionError('Click the map to choose the center of this delivery area.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const body = JSON.stringify({
        nameEn,
        nameBn,
        centerLatitude: selectedPoint.latitude,
        centerLongitude: selectedPoint.longitude,
        radiusMeters: Number(radiusMeters),
      })
      await pickAdminRequest(
        editingZone
          ? `/coverage/zones/${encodeURIComponent(editingZone.id)}`
          : '/coverage/zones',
        { method: editingZone ? 'PATCH' : 'POST', body },
      )
      startNewZone()
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this coverage area.')
    } finally {
      setSaving(false)
    }
  }

  const toggleZone = async (zone: CoverageMapZone) => {
    setActionError('')
    try {
      await pickAdminRequest(`/coverage/zones/${encodeURIComponent(zone.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !zone.active }),
      })
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update this coverage area.')
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div>
        <h2 className="text-lg font-bold text-ink">PICK Delivery Coverage</h2>
        <p className="mt-1 text-sm text-ink/55">Manage real service circles and see customer GPS locations checked against them.</p>
      </div>
      {(error || actionError) && (
        <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError || error}
          <button onClick={() => { void reload() }} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {!loading && summary.activeZones === 0 && (
        <section className="ios-card border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-950">No service areas are active</h3>
          <p className="mt-1 text-sm leading-6 text-amber-900/75">
            Customers will see “not available” until an administrator draws and activates a real PICK delivery area below.
          </p>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Active service areas', summary.activeZones],
          ['Customers in coverage', summary.coveredLocations],
          ['Customers outside coverage', summary.uncoveredLocations],
          ['Waitlist requests', summary.waitlistCount],
        ].map(([label, count]) => (
          <div className="ios-card p-5" key={label}>
            <p className="text-sm text-ink/55">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{loading ? '—' : count}</p>
          </div>
        ))}
      </div>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4">
          <h3 className="font-semibold">Service map</h3>
          <p className="mt-1 text-xs leading-5 text-ink/50">
            Green circles are active coverage. Customer pins are checked with the same radius rules used by the PICK app.
            Click the map to place or move an area center.
          </p>
        </div>
        <CoverageMap
          zones={data?.zones || []}
          locations={data?.locations || []}
          selectedPoint={selectedPoint}
          previewRadius={Number(radiusMeters) || 0}
          onSelectPoint={setSelectedPoint}
        />
        <div className="flex flex-wrap gap-4 border-t border-black/5 px-5 py-3 text-xs text-ink/55">
          <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-green-500" />Covered customer</span>
          <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-red-500" />Outside service</span>
          <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-blue-500" />New area preview</span>
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
          <div>
            <h3 className="font-semibold">{editingZone ? 'Edit delivery area' : 'Draw a delivery area'}</h3>
            <p className="mt-1 text-xs text-ink/50">Choose the center on the map, then set the radius used for real location checks.</p>
          </div>
          {editingZone && <button type="button" onClick={startNewZone} className="rounded-full bg-[#f2f2f7] px-4 py-2 text-sm">New area</button>}
        </div>
        <form onSubmit={saveZone} className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium">Name (English)
            <input required maxLength={128} value={nameEn} onChange={(event) => setNameEn(event.target.value)} className="mt-1 h-10 w-full" />
          </label>
          <label className="text-sm font-medium">Name (বাংলা)
            <input required maxLength={128} value={nameBn} onChange={(event) => setNameBn(event.target.value)} className="mt-1 h-10 w-full" />
          </label>
          <label className="text-sm font-medium">Radius (metres)
            <input required type="number" min={100} max={50000} step={100} value={radiusMeters} onChange={(event) => setRadiusMeters(event.target.value)} className="mt-1 h-10 w-full" />
          </label>
          <div className="flex items-end text-xs leading-5 text-ink/55">
            {selectedPoint
              ? `Center: ${selectedPoint.latitude.toFixed(5)}, ${selectedPoint.longitude.toFixed(5)}`
              : 'No center selected. Click the map first.'}
          </div>
          <button
            type="submit"
            disabled={saving || !selectedPoint}
            className="h-10 self-end rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingZone ? 'Save area' : 'Add service area'}
          </button>
        </form>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4"><h3 className="font-semibold">Configured service areas</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Area</th><th className="px-4 py-3">Map center</th><th className="px-4 py-3">Radius</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {(data?.zones || []).map((zone) => (
                <tr key={zone.id} className="border-t border-black/5">
                  <td className="px-4 py-3"><strong>{zone.nameEn}</strong><div className="text-xs text-ink/50">{zone.nameBn}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{zone.centerLatitude.toFixed(5)}, {zone.centerLongitude.toFixed(5)}</td>
                  <td className="px-4 py-3">{zone.radiusMeters.toLocaleString()} m</td>
                  <td className="px-4 py-3">{zone.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3 text-right"><div className="inline-flex gap-2">
                    <button onClick={() => editZone(zone)} className="rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-xs font-semibold">Edit</button>
                    <button onClick={() => void toggleZone(zone)} className="rounded-lg bg-[#f2f2f7] px-3 py-1.5 text-xs font-semibold">{zone.active ? 'Deactivate' : 'Activate'}</button>
                  </div></td>
                </tr>
              ))}
              {!loading && !error && !data?.zones.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/50">No delivery circles configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4"><h3 className="font-semibold">Customer location checks</h3><p className="mt-1 text-xs text-ink/50">Locations are geocoded by Tiwlo’s Google Maps API and checked against the active circles above.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Google area / address</th><th className="px-4 py-3">Coverage result</th><th className="px-4 py-3">Last location share</th></tr></thead>
            <tbody>
              {(data?.locations || []).map((location) => (
                <tr key={location.userId} className="border-t border-black/5">
                  <td className="px-4 py-3"><strong>{location.name || 'PICK customer'}</strong><div className="text-xs text-ink/50">{location.email}</div></td>
                  <td className="max-w-sm px-4 py-3"><strong>{location.area || 'Area unavailable'}</strong><div className="truncate text-xs text-ink/50">{location.address}</div></td>
                  <td className="px-4 py-3">{location.coverage.available ? `Covered · ${location.coverage.zone?.nameEn}` : 'Not available'}</td>
                  <td className="px-4 py-3 text-xs text-ink/55">{new Date((location as CoverageMapLocation & { updatedAt?: string }).updatedAt || '').toLocaleString()}</td>
                </tr>
              ))}
              {!loading && !error && !data?.locations.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-ink/50">No customer locations have been shared yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4"><h3 className="font-semibold">Coverage waitlist</h3><p className="mt-1 text-xs text-ink/50">Customers who requested a notification when service reaches their location.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Requested area</th><th className="px-4 py-3">Joined</th></tr></thead>
            <tbody>
              {(data?.waitlist || []).map((entry) => (
                <tr key={entry.userId} className="border-t border-black/5">
                  <td className="px-4 py-3"><strong>{entry.name || 'PICK customer'}</strong><div className="text-xs text-ink/50">{entry.email}</div></td>
                  <td className="px-4 py-3">{entry.phone || entry.email}</td>
                  <td className="px-4 py-3">{entry.area || 'Area unavailable'}<div className="max-w-sm truncate text-xs text-ink/50">{entry.address}</div></td>
                  <td className="px-4 py-3 text-xs text-ink/55">{new Date(entry.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!loading && !error && !data?.waitlist.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-ink/50">No one has joined the coverage waitlist yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4"><h3 className="font-semibold">Google-mapped areas</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Area from Google</th><th className="px-4 py-3 text-right">Customers covered</th><th className="px-4 py-3 text-right">Outside coverage</th></tr></thead>
            <tbody>
              {(data?.areas || []).map((area) => <tr key={area.area} className="border-t border-black/5"><td className="px-4 py-3">{area.area}</td><td className="px-4 py-3 text-right">{area.covered}</td><td className="px-4 py-3 text-right">{area.uncovered}</td></tr>)}
              {!loading && !error && !data?.areas.length && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-ink/50">No Google-geocoded customer areas to show.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
