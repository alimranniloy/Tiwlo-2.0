'use client'

import React, { useEffect, useState } from 'react'
import { pickAdminRequest, usePickAdminData } from '@/lib/pick-admin-api'

interface PickSettings {
  groceryDeliveryFee: number | null
  paymentProviders: { id: string; name: string; currency: string }[]
}

export const SettingsView: React.FC = () => {
  const { data, loading, error, reload } = usePickAdminData<PickSettings>('/settings')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (data?.groceryDeliveryFee !== null && data?.groceryDeliveryFee !== undefined) {
      setDeliveryFee(String(data.groceryDeliveryFee))
    }
  }, [data?.groceryDeliveryFee])

  const saveDeliveryFee = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setActionError('')
    try {
      const result = await pickAdminRequest<{ groceryDeliveryFee: number }>('/settings/grocery-delivery-fee', {
        method: 'PUT',
        body: JSON.stringify({ deliveryFee: Number(deliveryFee) }),
      })
      setDeliveryFee(String(result.groceryDeliveryFee))
      setMessage('Delivery fee saved. PICK checkout now uses this value.')
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this setting.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div><h2 className="text-lg font-bold text-ink">PICK Checkout Settings</h2><p className="mt-1 text-sm text-ink/55">These values are read or written by the Tiwlo PICK API, not kept only in the browser.</p></div>
      {(error || actionError) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError || error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      {message && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}

      <form onSubmit={saveDeliveryFee} className="ios-card max-w-2xl space-y-4 p-5">
        <div><h3 className="font-semibold">Grocery delivery fee</h3><p className="mt-1 text-sm text-ink/55">The fee is calculated by Tiwlo when the app loads checkout and creates an order.</p></div>
        <label className="block text-sm font-medium">Delivery fee (৳)<input required type="number" min="0" max="1000000" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} placeholder={data?.groceryDeliveryFee === null ? 'Not configured' : undefined} disabled={loading} className="mt-1 h-10 w-full max-w-sm" /></label>
        <button disabled={saving || loading} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save delivery fee'}</button>
      </form>

      <section className="ios-card max-w-2xl p-5">
        <h3 className="font-semibold">Available live payment methods</h3>
        <p className="mt-1 text-sm text-ink/55">Provider credentials remain in Tiwlo Admin. Only methods that are enabled for live BDT checkout are listed here.</p>
        <ul className="mt-4 divide-y divide-black/5">
          {(data?.paymentProviders || []).map((provider) => <li key={provider.id} className="flex items-center justify-between py-3 text-sm"><span className="font-medium">{provider.name}</span><span className="badge badge-success">{provider.currency} · live</span></li>)}
          {!loading && !error && !data?.paymentProviders.length && <li className="py-4 text-sm text-ink/50">No supported live BDT gateway is currently enabled in Tiwlo Admin.</li>}
        </ul>
      </section>
    </div>
  )
}
