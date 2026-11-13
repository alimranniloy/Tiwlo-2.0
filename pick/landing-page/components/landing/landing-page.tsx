'use client'

import { useEffect, useState } from 'react'
import { Navbar } from './navbar'
import { Hero } from './hero'
import { StatsMarquee } from './stats-marquee'
import { HowItWorks } from './how-it-works'
import { Coverage } from './coverage'
import { Courier } from './courier'
import { DownloadApp } from './download-app'
import { Footer } from './footer'
import { fetchTiwloSession, type TiwloSessionUser } from '@/lib/tiwlo-auth'

export function LandingPage() {
  const [sessionUser, setSessionUser] = useState<TiwloSessionUser | null>(null)

  useEffect(() => {
    let active = true
    fetchTiwloSession().then((user) => {
      if (active) setSessionUser(user)
    })
    return () => {
      active = false
    }
  }, [])

  const openLoginOrDashboard = () => {
    window.location.assign(sessionUser ? '/dashboard' : '/login')
  }

  return (
    <main>
      <Navbar onOpenLogin={openLoginOrDashboard} sessionUser={sessionUser} />
      <Hero />
      <StatsMarquee />
      <HowItWorks />
      <Coverage onOpenLogin={openLoginOrDashboard} sessionUser={sessionUser} />
      <Courier />
      <DownloadApp />
      <Footer />
    </main>
  )
}
