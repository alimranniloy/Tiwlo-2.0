'use client'

import React, { useState } from 'react'
import { Edit2 } from 'lucide-react'
import { pickAdminRequest, usePickAdminData, type AdminOrder } from '@/lib/pick-admin-api'

interface ParcelVehicle {
  id: string
  nameEn: string
  nameBn: string
  etaMinutes: number
  maxWeightKg: number
  price: number
  active: boolean
}

interface ParcelData {
  orders: AdminOrder[]
  vehicles: ParcelVehicle[]
}

const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`

export const ParcelView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<ParcelData>('/parcels')
  const [creating, setCreating] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<ParcelVehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState({ id: '', nameEn: '', nameBn: '', etaMinutes: '', maxWeightKg: '', price: '' })

  const addVehicle = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setActionError('')
    try {
      await pickAdminRequest(editingVehicle ? `/parcel/vehicles/${encodeURIComponent(editingVehicle.id)}` : '/parcel/vehicles', { method: editingVehicle ? 'PATCH' : 'POST', body: JSON.stringify({
        ...form,
        etaMinutes: Number(form.etaMinutes),
        maxWeightKg: Number(form.maxWeightKg),
        price: Number(form.price),
      }) })
      setForm({ id: '', nameEn: '', nameBn: '', etaMinutes: '', maxWeightKg: '', price: '' })
      setEditingVehicle(null)
      setCreating(false)
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this vehicle.')
    } finally {
      setSaving(false)
    }
  }

  const toggleVehicle = async (vehicle: ParcelVehicle) => {
    setActionError('')
    try {
      await pickAdminRequest(`/parcel/vehicles/${encodeURIComponent(vehicle.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !vehicle.active }),
      })
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not update this vehicle.')
    }
  }

  const openVehicleForm = (vehicle?: ParcelVehicle) => {
    setEditingVehicle(vehicle || null)
    setForm(vehicle ? {
      id: vehicle.id,
      nameEn: vehicle.nameEn,
      nameBn: vehicle.nameBn,
      etaMinutes: String(vehicle.etaMinutes),
      maxWeightKg: String(vehicle.maxWeightKg),
      price: String(vehicle.price),
    } : { id: '', nameEn: '', nameBn: '', etaMinutes: '', maxWeightKg: '', price: '' })
    setActionError('')
    setCreating(true)
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div><h2 className="text-lg font-bold text-ink">PICK Parcel Service</h2><p className="mt-1 text-sm text-ink/55">Parcel orders, customer details, and vehicle prices stored in PICK.</p></div>
      {(error || actionError) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError || error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      <section className="ios-card overflow-hidden">
        <div className="border-b border-black/5 px-5 py-4"><h3 className="font-semibold">Parcel orders</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Order / time</th><th className="px-4 py-3">Sender</th><th className="px-4 py-3">Recipient / destination</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Fee / payment</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>
              {(data?.orders || []).map((order) => {
                const parcel = order.parcelDetails
                return <tr key={order.id} className="border-t border-black/5 align-top">
                  <td className="px-4 py-3 font-mono text-xs">#{order.id}<div className="mt-1 font-sans text-ink/50">{new Date(order.createdAt).toLocaleString()}</div></td>
                  <td className="px-4 py-3"><strong>{parcel?.sender?.name || order.customerName}</strong><div className="text-xs text-ink/55">{parcel?.sender?.phone || order.customerPhone}</div><div className="max-w-56 text-xs text-ink/45">{parcel?.sender?.address || 'Sender address not saved'}</div></td>
                  <td className="px-4 py-3"><strong>{parcel?.recipient?.name || '—'}</strong><div className="text-xs text-ink/55">{parcel?.recipient?.phone || ''}</div><div className="max-w-56 text-xs text-ink/45">{parcel?.recipient?.address || order.deliveryAddress}</div></td>
                  <td className="px-4 py-3">{parcel?.package?.categoryName || '—'}<div className="text-xs text-ink/55">{parcel?.package?.weight ? `${parcel.package.weight} kg` : 'Weight not saved'} · {parcel?.vehicle?.nameEn || 'Vehicle not saved'}</div></td>
                  <td className="px-4 py-3 font-semibold">{money(order.total)}<div className="text-xs font-normal text-ink/55">{order.paymentMethod} · {order.paymentStatus}</div></td>
                  <td className="px-4 py-3">{order.status.replaceAll('_', ' ')}</td>
                </tr>
              })}
              {!loading && !error && !data?.orders.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink/50">No parcel orders have been placed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ios-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4"><div><h3 className="font-semibold">Parcel vehicles & rates</h3><p className="text-xs text-ink/50">Changes here are used by the PICK mobile parcel checkout.</p></div><button onClick={() => openVehicleForm()} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">Add vehicle</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-paper text-xs text-ink/50"><tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">ETA</th><th className="px-4 py-3">Max weight</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>
          {(data?.vehicles || []).map((vehicle) => <tr key={vehicle.id} className="border-t border-black/5"><td className="px-4 py-3"><strong>{vehicle.nameEn}</strong><div className="text-xs text-ink/55">{vehicle.nameBn} · {vehicle.id}</div></td><td className="px-4 py-3">{vehicle.etaMinutes} min</td><td className="px-4 py-3">{vehicle.maxWeightKg} kg</td><td className="px-4 py-3">{money(vehicle.price)}</td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-2"><button onClick={() => openVehicleForm(vehicle)} aria-label={`Edit ${vehicle.nameEn}`} className="rounded-lg bg-[#f2f2f7] p-2"><Edit2 size={15} /></button><button onClick={() => void toggleVehicle(vehicle)} className={`rounded-full px-3 py-1 text-xs font-semibold ${vehicle.active ? 'bg-[#f2f2f7] text-ink' : 'bg-red-50 text-red-700'}`}>{vehicle.active ? 'Active' : 'Inactive'}</button></div></td></tr>)}
          {!loading && !error && !data?.vehicles.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/50">No parcel vehicle prices are configured in PICK.</td></tr>}
        </tbody></table></div>
      </section>

      {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="parcel-vehicle-title"><form onSubmit={addVehicle} className="ios-card w-full max-w-xl space-y-4 p-6"><h3 id="parcel-vehicle-title" className="text-lg font-semibold">{editingVehicle ? 'Edit parcel vehicle' : 'Add parcel vehicle'}</h3><div className="grid gap-3 sm:grid-cols-2">{[
        ['id', 'Vehicle ID'], ['nameEn', 'Name (English)'], ['nameBn', 'Name (বাংলা)'], ['etaMinutes', 'ETA minutes'], ['maxWeightKg', 'Maximum weight (kg)'], ['price', 'Price (৳)'],
      ].map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input required disabled={key === 'id' && Boolean(editingVehicle)} maxLength={key === 'id' ? 64 : 255} type={['etaMinutes', 'maxWeightKg', 'price'].includes(key) ? 'number' : 'text'} min={['etaMinutes', 'maxWeightKg', 'price'].includes(key) ? '0' : undefined} step={key === 'maxWeightKg' || key === 'price' ? '0.01' : '1'} value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 h-10 w-full" /></label>)}</div>{actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => { setCreating(false); setEditingVehicle(null) }} className="rounded-full bg-[#f2f2f7] px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save vehicle rate'}</button></div></form></div>}
    </div>
  )
}
