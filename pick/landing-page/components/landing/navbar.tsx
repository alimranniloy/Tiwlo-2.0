'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'

const links = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'courier', label: 'Services' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'download', label: 'Get the app' },
]

export function Navbar({ onOpenLogin }: { onOpenLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b px-4 pt-4 transition-all duration-300 ${
        scrolled || open
          ? 'border-black/10 bg-white/95 pb-3 shadow-sm backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div
        className={`mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-5 pr-2 transition-all duration-300 ${
          scrolled || open ? 'glass' : 'border border-transparent bg-transparent'
        }`}
      >
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="PICK home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/land-logo-black.png" alt="PICK" className="h-6 w-auto" />
        </button>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium text-ink/65 transition-colors hover:bg-black/5 hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenLogin}
            className="hidden h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-semibold text-white transition-all hover:bg-black active:scale-[0.97] sm:inline-flex"
          >
            Login
            <ArrowRight size={14} />
          </button>
          <button
            className="inline-flex size-10 items-center justify-center rounded-full text-ink md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass mx-auto mt-2 max-w-5xl rounded-3xl p-2 md:hidden">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink/80 hover:bg-black/5"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false)
              onOpenLogin()
            }}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-semibold text-white"
          >
            Login <ArrowRight size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
