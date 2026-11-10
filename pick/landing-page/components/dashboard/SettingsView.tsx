'use client'

import React, { useEffect, useState } from 'react'
import { pickAdminRequest, usePickAdminData } from '@/lib/pick-admin-api'

interface PickSettings {
  groceryDeliveryFee: number | null
  groceryPickupLocation: { address: string; latitude: number; longitude: number } | null
  paymentProviders: { id: string; name: string; currency: string }[]
  appUpdates: Record<'pick' | 'delivery', {
    version: string
    playStoreEnabled: boolean
    playStoreUrl: string
    hasApk: boolean
  }>
}

type UpdateAppId = 'pick' | 'delivery'

const updateApps: { id: UpdateAppId; name: string; packageName: string }[] = [
  { id: 'pick', name: 'PICK Customer', packageName: 'com.pick.tiwlo' },
  { id: 'delivery', name: 'PICK Delivery', packageName: 'com.pick.delivery' },
]

export const SettingsView: React.FC<{
  section?: 'checkout' | 'app_updates' | 'all'
}> = ({ section = 'all' }) => {
  const { data, loading, error, reload } = usePickAdminData<PickSettings>('/settings')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupLatitude, setPickupLatitude] = useState('')
  const [pickupLongitude, setPickupLongitude] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [updateDrafts, setUpdateDrafts] = useState<Record<UpdateAppId, {
    version: string
    playStoreEnabled: boolean
    playStoreUrl: string
  }>>({
    pick: { version: '', playStoreEnabled: false, playStoreUrl: '' },
    delivery: { version: '', playStoreEnabled: false, playStoreUrl: '' },
  })
  const [apkFiles, setApkFiles] = useState<Record<UpdateAppId, File | null>>({
    pick: null,
    delivery: null,
  })
  const [busyUpdate, setBusyUpdate] = useState<UpdateAppId | null>(null)

  useEffect(() => {
    if (data?.groceryDeliveryFee !== null && data?.groceryDeliveryFee !== undefined) {
      setDeliveryFee(String(data.groceryDeliveryFee))
    }
  }, [data?.groceryDeliveryFee])

  useEffect(() => {
    if (data?.groceryPickupLocation) {
      setPickupAddress(data.groceryPickupLocation.address)
      setPickupLatitude(String(data.groceryPickupLocation.latitude))
      setPickupLongitude(String(data.groceryPickupLocation.longitude))
    }
  }, [data?.groceryPickupLocation])

  useEffect(() => {
    if (!data?.appUpdates) return
    setUpdateDrafts({
      pick: {
        version: data.appUpdates.pick?.version || '',
        playStoreEnabled: data.appUpdates.pick?.playStoreEnabled || false,
        playStoreUrl: data.appUpdates.pick?.playStoreUrl || '',
      },
      delivery: {
        version: data.appUpdates.delivery?.version || '',
        playStoreEnabled: data.appUpdates.delivery?.playStoreEnabled || false,
        playStoreUrl: data.appUpdates.delivery?.playStoreUrl || '',
      },
    })
  }, [data?.appUpdates])

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

  const savePickupLocation = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setActionError('')
    try {
      await pickAdminRequest('/settings/grocery-pickup-location', {
        method: 'PUT',
        body: JSON.stringify({
          address: pickupAddress,
          latitude: Number(pickupLatitude),
          longitude: Number(pickupLongitude),
        }),
      })
      setMessage('Grocery pickup location saved. Eligible delivery partners can now receive grocery orders.')
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this setting.')
    } finally {
      setSaving(false)
    }
  }

  const saveAppUpdate = async (event: React.FormEvent, appId: UpdateAppId) => {
    event.preventDefault()
    setBusyUpdate(appId)
    setMessage('')
    setActionError('')
    try {
      const draft = updateDrafts[appId]
      const formData = new FormData()
      formData.set('version', draft.version.trim())
      formData.set('playStoreEnabled', String(draft.playStoreEnabled))
      formData.set('playStoreUrl', draft.playStoreEnabled ? draft.playStoreUrl.trim() : '')
      if (apkFiles[appId]) formData.set('apk', apkFiles[appId] as File)
      await pickAdminRequest(`/settings/app-updates/${appId}`, {
        method: 'POST',
        body: formData,
      })
      setApkFiles((current) => ({ ...current, [appId]: null }))
      setMessage(`${appId === 'pick' ? 'PICK' : 'PICK Delivery'} update settings saved.`)
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not save this app update.')
    } finally {
      setBusyUpdate(null)
    }
  }

  const deleteApk = async (appId: UpdateAppId) => {
    setBusyUpdate(appId)
    setMessage('')
    setActionError('')
    try {
      await pickAdminRequest(`/settings/app-updates/${appId}/apk`, { method: 'DELETE' })
      setMessage(`${appId === 'pick' ? 'PICK' : 'PICK Delivery'} APK removed.`)
      await reload()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Could not remove this APK.')
    } finally {
      setBusyUpdate(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5 md:p-8">
      <div>
        <h2 className="text-lg font-bold text-ink">
          {section === 'app_updates' ? 'PICK App Updates' : 'PICK Checkout Settings'}
        </h2>
        <p className="mt-1 text-sm text-ink/55">
          {section === 'app_updates'
            ? 'Publish Android versions and installation options for each PICK app.'
            : 'These values are read or written by the Tiwlo PICK API, not kept only in the browser.'}
        </p>
      </div>
      {(error || actionError) && <div role="alert" className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError || error}<button onClick={reload} className="ml-3 font-semibold underline">Retry</button></div>}
      {message && <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}

      {section !== 'app_updates' && (
        <>
      <form onSubmit={saveDeliveryFee} className="ios-card max-w-2xl space-y-4 p-5">
        <div><h3 className="font-semibold">Grocery delivery fee</h3><p className="mt-1 text-sm text-ink/55">The fee is calculated by Tiwlo when the app loads checkout and creates an order.</p></div>
        <label className="block text-sm font-medium">Delivery fee (৳)<input required type="number" min="0" max="1000000" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} placeholder={data?.groceryDeliveryFee === null ? 'Not configured' : undefined} disabled={loading} className="mt-1 h-10 w-full max-w-sm" /></label>
        <button disabled={saving || loading} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save delivery fee'}</button>
      </form>

      <form onSubmit={savePickupLocation} className="ios-card max-w-2xl space-y-4 p-5">
        <div>
          <h3 className="font-semibold">Shared grocery pickup hub</h3>
          <p className="mt-1 text-sm text-ink/55">Grocery orders are offered to approved, on-duty partners only when the hub and customer are inside the same active coverage area and within the rider’s range. Existing grocery orders become eligible after this is saved.</p>
        </div>
        {!data?.groceryPickupLocation && !loading && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Not configured — grocery orders cannot be dispatched yet.</p>
        )}
        <label className="block text-sm font-medium">Pickup address
          <input required maxLength={500} value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} disabled={loading} className="mt-1 h-10 w-full" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Latitude
            <input required type="number" min="-90" max="90" step="any" value={pickupLatitude} onChange={(event) => setPickupLatitude(event.target.value)} disabled={loading} className="mt-1 h-10 w-full" />
          </label>
          <label className="block text-sm font-medium">Longitude
            <input required type="number" min="-180" max="180" step="any" value={pickupLongitude} onChange={(event) => setPickupLongitude(event.target.value)} disabled={loading} className="mt-1 h-10 w-full" />
          </label>
        </div>
        <button disabled={saving || loading} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save pickup hub'}</button>
      </form>

      <section className="ios-card max-w-2xl p-5">
        <h3 className="font-semibold">Available live payment methods</h3>
        <p className="mt-1 text-sm text-ink/55">Provider credentials remain in Tiwlo Admin. Only methods that are enabled for live BDT checkout are listed here.</p>
        <ul className="mt-4 divide-y divide-black/5">
          {(data?.paymentProviders || []).map((provider) => <li key={provider.id} className="flex items-center justify-between py-3 text-sm"><span className="font-medium">{provider.name}</span><span className="badge badge-success">{provider.currency} · live</span></li>)}
          {!loading && !error && !data?.paymentProviders.length && <li className="py-4 text-sm text-ink/50">No supported live BDT gateway is currently enabled in Tiwlo Admin.</li>}
        </ul>
      </section>
        </>
      )}

      {section !== 'checkout' && <section className="max-w-3xl space-y-4">
        <div>
          <h3 className="text-lg font-bold text-ink">App updates</h3>
          <p className="mt-1 text-sm text-ink/55">
            Android checks the required version on launch. A lower version must update before the app can be used.
          </p>
        </div>
        {updateApps.map((app) => {
          const draft = updateDrafts[app.id]
          const saved = data?.appUpdates?.[app.id]
          const busy = busyUpdate === app.id
          return (
            <form
              key={app.id}
              onSubmit={(event) => void saveAppUpdate(event, app.id)}
              className="ios-card space-y-4 p-5"
            >
              <div>
                <h4 className="font-semibold">{app.name}</h4>
                <p className="mt-1 text-xs text-ink/50">Android package: {app.packageName}</p>
              </div>
              <label className="block text-sm font-medium">
                Required version
                <input
                  required
                  maxLength={32}
                  pattern="\d+(\.\d+){0,3}"
                  title="Use a version such as 1.2.0"
                  value={draft.version}
                  onChange={(event) => setUpdateDrafts((current) => ({
                    ...current,
                    [app.id]: { ...current[app.id], version: event.target.value },
                  }))}
                  disabled={loading || busy}
                  placeholder="1.2.0"
                  className="mt-1 h-10 w-full max-w-sm"
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.playStoreEnabled}
                  onChange={(event) => setUpdateDrafts((current) => ({
                    ...current,
                    [app.id]: { ...current[app.id], playStoreEnabled: event.target.checked },
                  }))}
                  disabled={loading || busy}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">Use Google Play Store</span>
                  <span className="mt-0.5 block text-xs text-ink/50">
                    When enabled, Update opens this app&apos;s Play Store listing.
                  </span>
                </span>
              </label>
              {draft.playStoreEnabled && (
                <label className="block text-sm font-medium">
                  Google Play Store URL
                  <input
                    required
                    type="url"
                    value={draft.playStoreUrl}
                    onChange={(event) => setUpdateDrafts((current) => ({
                      ...current,
                      [app.id]: { ...current[app.id], playStoreUrl: event.target.value },
                    }))}
                    disabled={loading || busy}
                    placeholder={`https://play.google.com/store/apps/details?id=${app.packageName}`}
                    className="mt-1 h-10 w-full"
                  />
                </label>
              )}
              <label className="block text-sm font-medium">
                Android APK {saved?.hasApk ? '(uploaded)' : '(optional when Play Store is enabled)'}
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(event) => setApkFiles((current) => ({
                    ...current,
                    [app.id]: event.target.files?.[0] || null,
                  }))}
                  disabled={loading || busy}
                  className="mt-1 block w-full text-sm"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || busy}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save update'}
                </button>
                {saved?.hasApk && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteApk(app.id)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete APK
                  </button>
                )}
                <span className="text-xs text-ink/50">
                  {saved?.version ? `Published version ${saved.version}` : 'No update published'}
                </span>
              </div>
            </form>
          )
        })}
        <div className="ios-card max-w-3xl p-5 opacity-70">
          <h4 className="font-semibold">PICK Merchant</h4>
          <p className="mt-1 text-sm text-ink/55">
            Reserved for a future merchant app. Add its app update settings when the app is connected.
          </p>
        </div>
      </section>}
    </div>
  )
}
