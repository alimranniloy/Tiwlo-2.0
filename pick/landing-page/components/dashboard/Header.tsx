'use client'

import React from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { DashboardTab } from './Sidebar'

interface HeaderProps {
  title: string
  subtitle: string
  currentTab: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  onLogout: () => void
  user: { name: string; email: string; role: string }
}

const tabs: [DashboardTab, string][] = [
  ['overview', 'Overview'],
  ['orders', 'Orders'],
  ['coverage', 'Coverage'],
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['promotions', 'Promos'],
  ['riders', 'Riders'],
  ['parcel', 'Parcel'],
  ['users', 'Users'],
  ['finance', 'Finance'],
  ['broadcasts', 'Broadcasts'],
  ['settings', 'Settings'],
]

export const Header: React.FC<HeaderProps> = ({ title, subtitle, currentTab, onSelectTab, onLogout, user }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 py-3 md:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink/55">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative hidden xl:block">
            <Search size={15} className="absolute left-3.5 top-3 text-ink/35" />
            <input
              placeholder="Search orders, riders, SKUs..."
              aria-label="Search"
              className="h-10 w-64 rounded-full border-transparent bg-[#f2f2f7] pl-9 text-[13px]"
            />
          </div>
          <span className="hidden max-w-48 truncate text-xs font-medium text-ink/55 sm:block">{user.email}</span>
          <button
            onClick={onLogout}
            className="flex h-10 items-center gap-2 rounded-full bg-ink pl-1.5 pr-3 text-xs font-semibold text-white lg:hidden"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-white text-ink">
              {(user.name || user.email || user.role).charAt(0).toUpperCase()}
            </span>
            Logout
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-5 pb-3 lg:hidden" role="tablist" aria-label="Dashboard sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={currentTab === id}
            onClick={() => onSelectTab(id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              currentTab === id ? 'bg-ink text-white' : 'bg-[#f2f2f7] text-ink/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ChevronDown className="hidden" aria-hidden />
    </header>
  )
}
