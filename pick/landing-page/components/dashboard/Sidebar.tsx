'use client'

import React from 'react'
import {
  Bell,
  Bike,
  ClipboardList,
  Download,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  Sliders,
  Tag,
  Users,
  Wallet,
} from 'lucide-react'

export type DashboardTab =
  | 'overview'
  | 'coverage'
  | 'products'
  | 'categories'
  | 'orders'
  | 'riders'
  | 'users'
  | 'parcel'
  | 'promotions'
  | 'finance'
  | 'broadcasts'
  | 'settings'
  | 'app_updates'

interface SidebarProps {
  currentTab: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  onLogout: () => void
  user: { name: string; email: string; role: string }
}

const groups: {
  title: string
  items: { id: DashboardTab; en: string; bn: string; icon: React.ReactNode; badge?: string }[]
}[] = [
  {
    title: 'Command',
    items: [
      { id: 'overview', en: 'Overview', bn: 'ওভারভিউ', icon: <LayoutDashboard size={17} /> },
      { id: 'orders', en: 'Orders Pipeline', bn: 'অর্ডার প্রসেসিং', icon: <ClipboardList size={17} /> },
      { id: 'coverage', en: 'Area Coverage & Map', bn: 'এরিয়া কভারেজ ও ম্যাপ', icon: <MapPin size={17} /> },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { id: 'products', en: 'Products & Stock', bn: 'পণ্য ও স্টক', icon: <ShoppingBag size={17} /> },
      { id: 'categories', en: 'Categories', bn: 'ক্যাটাগরি', icon: <Layers size={17} /> },
      { id: 'promotions', en: 'Promos & Coupons', bn: 'কুপন ও ডিসকাউন্ট', icon: <Tag size={17} /> },
    ],
  },
  {
    title: 'Logistics',
    items: [
      { id: 'riders', en: 'Delivery Riders', bn: 'ডেলিভারি রাইডার ফ্লিট', icon: <Bike size={17} /> },
      { id: 'parcel', en: 'Parcel Courier', bn: 'পার্সেল কুরিয়ার', icon: <Package size={17} /> },
      { id: 'users', en: 'Registered Users', bn: 'কাস্টমার ডিরেক্টরি', icon: <Users size={17} /> },
    ],
  },
  {
    title: 'Business',
    items: [
      { id: 'finance', en: 'Finances & Ledger', bn: 'ওয়ালেট ও পেমেন্ট', icon: <Wallet size={17} /> },
      { id: 'broadcasts', en: 'Push Broadcasts', bn: 'পুশ নোটিফিকেশন', icon: <Bell size={17} /> },
      { id: 'settings', en: 'Platform Controls', bn: 'প্ল্যাটফর্ম সেটিংস', icon: <Sliders size={17} /> },
      { id: 'app_updates', en: 'App Updates', bn: 'অ্যাপ আপডেট', icon: <Download size={17} /> },
    ],
  },
]

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onLogout, user }) => {
  return (
    <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col overflow-hidden border-r border-black/5 bg-white text-ink lg:flex">
      <div className="relative flex h-[72px] items-center gap-3 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/land-logo-black.png" alt="PICK" className="h-6 w-auto" />
        <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Admin
        </span>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        {groups.map((g) => (
          <div key={g.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-ink/35">{g.title}</p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = item.id === currentTab
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onSelectTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all ${
                        active
                          ? 'bg-ink text-white'
                          : 'text-ink/70 hover:bg-black/[0.04] hover:text-ink'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-ink/45 group-hover:text-ink'}>{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight">{item.en}</span>
                        <span className={`block text-[10px] font-medium ${active ? 'text-white/55' : 'text-ink/35'}`}>
                          {item.bn}
                        </span>
                      </span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-black/5 text-ink/55'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-[#f5f5f7] p-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{user.name || user.role}</p>
            <p className="truncate text-[11px] text-ink/45">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="flex size-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-black/5 hover:text-ink"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
