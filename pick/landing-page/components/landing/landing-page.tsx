'use client'

import { useState } from 'react'
import { Navbar } from './navbar'
import { Hero } from './hero'
import { StatsMarquee } from './stats-marquee'
import { HowItWorks } from './how-it-works'
import { Coverage } from './coverage'
import { Courier } from './courier'
import { DownloadApp } from './download-app'
import { Footer } from './footer'
import { LoginModal } from './login-modal'

export function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const open = () => setLoginOpen(true)

  return (
    <main>
      <Navbar onOpenLogin={open} />
      <Hero />
      <StatsMarquee />
      <HowItWorks />
      <Coverage onOpenLogin={open} />
      <Courier />
      <DownloadApp />
      <Footer />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </main>
  )
}
