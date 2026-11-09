'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { getTiwloAuthUrl } from '@/lib/tiwlo-auth'

export function AuthRedirect({ mode }: { mode: 'login' | 'signup' }) {
  const authUrl = getTiwloAuthUrl(mode)

  const [openingApp, setOpeningApp] = useState(false)

  const openPICKApp = () => {
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.assign(authUrl)
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
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (!appOpened && !document.hidden) window.location.assign(authUrl)
    }, 1800)

    if (/Android/i.test(navigator.userAgent)) {
      const fallbackUrl = encodeURIComponent(authUrl)
      window.location.href =
        `intent://auth/login#Intent;scheme=pick;package=com.pick.tiwlo;S.browser_fallback_url=${fallbackUrl};end`
    } else {
      window.location.href = 'pick://auth/login'
    }
    setOpeningApp(true)
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" aria-label="Back to PICK home" className="rounded-full p-2 text-ink/60 hover:bg-black/5">
          <ArrowLeft size={20} />
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/land-logo-black.png" alt="PICK" className="h-7 w-auto" />
        <span className="w-9" aria-hidden="true" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="hidden rounded-[2.5rem] bg-ink p-10 text-white lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/land-logo-white.png" alt="PICK" className="h-8 w-auto" />
          <h1 className="mt-14 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            {mode === 'login' ? 'Welcome back to PICK.' : 'Get started with PICK.'}
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-white/65">
            Sign in securely with your Tiwlo account. Your login, verification, and account settings stay in one place.
          </p>
          <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-sm text-white/80">
            <ShieldCheck size={19} className="shrink-0" />
            Secure sign-in for PICK and Tiwlo
          </div>
        </section>

        <section className="ios-card mx-auto w-full max-w-md p-6 sm:p-9">
          <div className="flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/app-icon.png" alt="" className="size-16 rounded-2xl shadow-sm" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
              {mode === 'login' ? 'PICK account' : 'Join PICK'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/60">
              Use the Tiwlo sign-in and account creation flow. Tiwlo administrators can access the PICK dashboard.
            </p>
          </div>

          <div className="mt-7 flex items-start gap-3 rounded-2xl bg-[#f5f5f7] p-4 text-xs leading-5 text-ink/65">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink" />
            <span>Sign-in, email verification, and account security are handled by Tiwlo.</span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {mode === 'login' && (
              <button
                type="button"
                onClick={openPICKApp}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                {openingApp ? 'Opening PICK…' : 'Open PICK app'}
                <ArrowRight size={16} />
              </button>
            )}
            <a
              href={authUrl}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/10 px-5 text-sm font-semibold text-ink transition-colors hover:bg-black/5"
            >
              {mode === 'login' ? 'Continue in browser' : 'Create account with Tiwlo'}
              <ArrowRight size={16} />
            </a>
          </div>

          <p className="mt-6 text-center text-sm text-ink/60">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <Link
              href={mode === 'login' ? '/signup' : '/login'}
              className="font-semibold text-ink underline underline-offset-4"
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
