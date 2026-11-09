'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Sidebar, type DashboardTab } from './Sidebar'
import { Header } from './Header'
import { OverviewView } from './OverviewView'
import { ProductsView } from './ProductsView'
import { CategoriesView } from './CategoriesView'
import { OrdersView } from './OrdersView'
import { RidersView } from './RidersView'
import { UsersView } from './UsersView'
import { ParcelView } from './ParcelView'
import { PromotionsView } from './PromotionsView'
import { FinanceView } from './FinanceView'
import { BroadcastsView } from './BroadcastsView'
import { SettingsView } from './SettingsView'
import { pickAdminRequest, PickAdminApiError } from '@/lib/pick-admin-api'
import { startTiwloAuth } from '@/lib/tiwlo-auth'
import Link from 'next/link'

const AreaCoverageView = dynamic(() => import('./AreaCoverageView').then((m) => m.AreaCoverageView), {
  ssr: false,
  loading: () => <div className="p-8 text-sm text-ink/50">Loading coverage…</div>,
})

const info: Record<DashboardTab, { title: string; subtitle: string }> = {
  overview: { title: 'Operations Dashboard', subtitle: 'Order, catalog, and payment data saved by PICK.' },
  coverage: { title: 'Area Coverage & Geo-Fencing', subtitle: 'Customer delivery areas currently saved in PICK profiles.' },
  products: { title: 'পণ্য ও স্টক (Products & Inventory)', subtitle: 'Manage the catalog and inventory used in PICK checkout.' },
  categories: { title: 'Categories', subtitle: 'Manage categories available in the PICK app.' },
  orders: { title: 'Orders Pipeline', subtitle: 'Review and update grocery orders created in PICK.' },
  riders: { title: 'Delivery Riders & Fleet Hubs', subtitle: 'Rider dispatch is not connected to PICK yet.' },
  users: { title: 'Registered App Customers', subtitle: 'Tiwlo accounts that have used PICK.' },
  parcel: { title: 'Parcel Courier', subtitle: 'PICK parcel orders and configured vehicle rates.' },
  promotions: { title: 'Promotions & Coupons', subtitle: 'Promotion checkout is not connected to PICK yet.' },
  finance: { title: 'Payments & Order Ledger', subtitle: 'Payment states and amounts recorded for PICK orders.' },
  broadcasts: { title: 'Push Broadcasts', subtitle: 'Push notification delivery is not configured for PICK yet.' },
  settings: { title: 'PICK Checkout Settings', subtitle: 'Settings used by the PICK mobile checkout API.' },
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
}

export function DashboardShell() {
  const [tab, setTab] = useState<DashboardTab>('overview')
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authError, setAuthError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    pickAdminRequest<{ user: AdminUser }>('/session')
      .then(({ user: adminUser }) => {
        if (active) setUser(adminUser)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof PickAdminApiError && error.status === 401) {
          startTiwloAuth('login')
          return
        }
        if (error instanceof PickAdminApiError && error.status === 403 && active) {
          setAccessDenied(true)
        }
        setAuthError(
          error instanceof PickAdminApiError && error.status === 403
            ? 'A Tiwlo admin or super admin account is required to access this dashboard.'
            : error instanceof Error ? error.message : 'Could not verify the Tiwlo administrator session.',
        )
      })
    return () => {
      active = false
    }
  }, [])

  const logout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Tiwlo could not end this session. Please try again.')
      window.location.assign('/')
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Could not sign out.')
      setLoggingOut(false)
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="ios-card max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold text-ink">PICK Admin</h1>
          <p className="mt-3 text-sm text-ink/60">{authError || 'Checking your Tiwlo administrator session…'}</p>
          {authError && (
            accessDenied ? (
              <Link
                href="/"
                className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
              >
                Return to PICK
              </Link>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
              >
                Try again
              </button>
            )
          )}
        </div>
      </main>
    )
  }

  const heading = info[tab]

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar currentTab={tab} onSelectTab={setTab} onLogout={logout} user={user} />
      <div className="min-w-0 flex-1">
        <Header title={heading.title} subtitle={heading.subtitle} currentTab={tab} onSelectTab={setTab} onLogout={logout} user={user} />
        {logoutError && <p role="alert" className="px-6 pt-3 text-sm text-red-700">{logoutError}</p>}
        {loggingOut && <p role="status" className="px-6 pt-3 text-sm text-ink/60">Signing out of Tiwlo…</p>}
        <main>
          {tab === 'overview' && <OverviewView onNavigateTab={setTab} />}
          {tab === 'coverage' && <AreaCoverageView />}
          {tab === 'products' && <ProductsView />}
          {tab === 'categories' && <CategoriesView />}
          {tab === 'orders' && <OrdersView />}
          {tab === 'riders' && <RidersView />}
          {tab === 'users' && <UsersView />}
          {tab === 'parcel' && <ParcelView />}
          {tab === 'promotions' && <PromotionsView />}
          {tab === 'finance' && <FinanceView />}
          {tab === 'broadcasts' && <BroadcastsView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
