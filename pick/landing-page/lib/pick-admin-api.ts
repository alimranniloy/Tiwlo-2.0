'use client'

import * as React from 'react'

export class PickAdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'PickAdminApiError'
  }
}

export async function pickAdminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  let response: Response
  try {
    response = await fetch(`/api/pick/admin${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new PickAdminApiError('The request timed out. Check your connection and try again.', 408)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
  const result: unknown = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    const message = typeof result === 'object' && result !== null &&
      'error' in result && typeof result.error === 'string'
      ? result.error
      : `PICK admin request failed (${response.status}).`
    throw new PickAdminApiError(message, response.status)
  }
  return result as T
}

export interface AdminCategory {
  id: string
  nameEn: string
  nameBn: string
  groupEn: string
  groupBn: string
  sortOrder: number
  active: boolean
  itemCount: number
}

export interface AdminProduct {
  id: string
  sku: string | null
  categoryId: string | null
  category: string | null
  categoryEn: string | null
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  price: number
  oldPrice: number | null
  unit: string
  unitEn: string
  units: string[]
  unitsEn: string[]
  unitPrices: number[]
  image: string
  origin: string
  deliveryTime: string
  reviews: string
  badge: string | null
  rating: number
  stockCount: number
  inStock: boolean
  active: boolean
}

export interface AdminOrderItem {
  name: string
  nameBn: string
  quantity: number
  unit: string
  unitBn: string
  unitPrice: number
  lineTotal: number
}

export interface AdminOrder {
  id: string
  orderType: 'grocery' | 'parcel'
  status: string
  deliveryAddress: string
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: string
  paymentStatus: string
  paymentProvider: string | null
  transactionId: string | null
  createdAt: string
  customerName: string
  customerEmail: string
  customerPhone: string
  deliveryArea: string
  parcelDetails: {
    sender?: { name?: string; phone?: string; address?: string }
    recipient?: { name?: string; phone?: string; address?: string }
    package?: { categoryName?: string; weight?: number }
    vehicle?: { nameEn?: string }
  } | null
  items: AdminOrderItem[]
}

export interface AdminUser {
  id: string
  name: string
  email: string
  phone: string
  address: string
  area: string
  totalOrders: number
  orderValue: number
  joinedAt: string
}

export function usePickAdminData<T>(path: string) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const reload = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await pickAdminRequest<T>(path)
      setData(result)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load PICK data.')
    } finally {
      setLoading(false)
    }
  }, [path])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    pickAdminRequest<T>(path)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load PICK data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path])

  return { data, loading, error, reload }
}
