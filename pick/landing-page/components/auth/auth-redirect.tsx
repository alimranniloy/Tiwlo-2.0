'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { getTiwloAuthUrl } from '@/lib/tiwlo-auth'

export function AuthRedirect({ mode }: { mode: 'login' | 'signup' }) {
  const authUrl = getTiwloAuthUrl(mode)

  useEffect(() => {
    if (mode !== 'login' || !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.replace(authUrl)
      return
    }

    let appOpened = false
    const handleVisibilityChange = () => {
      if (document.hidden) {
        appOpened = true
        window.clearTimeout(fallbackTimer)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const fallbackTimer = window.setTimeout(() => {
      if (!appOpened && !document.hidden) window.location.replace(authUrl)
    }, 1800)

    if (/Android/i.test(navigator.userAgent)) {
      const fallbackUrl = encodeURIComponent(authUrl)
      window.location.href =
        `intent://auth/login#Intent;scheme=pick;package=com.pick.tiwlo;S.browser_fallback_url=${fallbackUrl};end`
    } else {
      window.location.href = 'pick://auth/login'
    }

    return () => {
      window.clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authUrl, mode])

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="ios-card max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-ink">
          {mode === 'login' ? 'Continue to PICK Login' : 'Create a Tiwlo Account'}
        </h1>
        <p className="mt-3 text-sm text-ink/60">
          Only Tiwlo administrator accounts can access the PICK dashboard.
        </p>
        <Link
          href={authUrl}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white"
        >
          Continue
        </Link>
      </div>
    </main>
  )
}
