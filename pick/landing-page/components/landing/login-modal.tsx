'use client'

import { ArrowRight, ShieldCheck, X } from 'lucide-react'
import { startTiwloAuth } from '@/lib/tiwlo-auth'

export function LoginModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div
        className="relative w-full max-w-md animate-rise overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-full bg-[#f5f5f7] text-ink/60 transition-colors hover:bg-[#ebebf0]"
        >
          <X size={15} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/app-icon.png" alt="" className="size-16 rounded-[1.25rem] shadow-lg" />
          <h3 id="login-title" className="mt-5 text-2xl font-semibold tracking-tight text-ink">
            Welcome back
          </h3>
          <p className="mt-1 text-sm text-ink/50">PICK Operations & Fleet Control</p>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f5f5f7] p-3.5 text-xs text-ink/60">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink" />
          <div>
            <strong className="text-ink">Sign in with your Tiwlo account</strong>
            <div className="mt-0.5">Only Tiwlo administrator accounts can open this dashboard.</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => startTiwloAuth('login')}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition-all hover:bg-black active:scale-[0.98]"
          >
            Continue to Tiwlo Login <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => startTiwloAuth('signup')}
            className="flex h-12 items-center justify-center rounded-full bg-[#f5f5f7] text-sm font-semibold text-ink transition-colors hover:bg-[#ebebf0]"
          >
            Create a Tiwlo Account
          </button>
        </div>
      </div>
    </div>
  )
}
