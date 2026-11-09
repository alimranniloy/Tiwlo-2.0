'use client'

import { useId, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, FileText, Package, PackageOpen, Zap, Clock, Box } from 'lucide-react'

type Size = 'document' | 'small' | 'medium' | 'large'
type Speed = 'express' | 'standard'
type Payment = 'cod' | 'bkash' | 'nagad'
type Step = 'details' | 'confirm' | 'done'

const sizes: { id: Size; label: string; hint: string; price: number; icon: typeof Package }[] = [
  { id: 'document', label: 'Document', hint: 'Up to 1 kg', price: 60, icon: FileText },
  { id: 'small', label: 'Small', hint: 'Up to 2 kg', price: 90, icon: Package },
  { id: 'medium', label: 'Medium', hint: 'Up to 5 kg', price: 140, icon: PackageOpen },
  { id: 'large', label: 'Large', hint: 'Up to 10 kg', price: 220, icon: Box },
]

const speeds: { id: Speed; label: string; eta: string; icon: typeof Zap; multiplier: number }[] = [
  { id: 'express', label: 'Express', eta: '25–45 min', icon: Zap, multiplier: 1.5 },
  { id: 'standard', label: 'Standard', eta: '1–2 hours', icon: Clock, multiplier: 1 },
]

const payments: { id: Payment; label: string }[] = [
  { id: 'cod', label: 'Cash' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
]

const phonePattern = /^01[3-9]\d{8}$/

export function HeroBooking() {
  const uid = useId()
  const [step, setStep] = useState<Step>('details')
  const [pickup, setPickup] = useState('')
  const [drop, setDrop] = useState('')
  const [size, setSize] = useState<Size>('small')
  const [speed, setSpeed] = useState<Speed>('express')
  const [senderPhone, setSenderPhone] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [payment, setPayment] = useState<Payment>('cod')
  const [trackingId, setTrackingId] = useState('')
  const [copied, setCopied] = useState(false)

  const price = useMemo(() => {
    const base = sizes.find((s) => s.id === size)!.price
    const mult = speeds.find((s) => s.id === speed)!.multiplier
    return Math.round(base * mult)
  }, [size, speed])

  const eta = speeds.find((s) => s.id === speed)!.eta
  const detailsValid = pickup.trim().length >= 3 && drop.trim().length >= 3
  const phonesValid = phonePattern.test(senderPhone) && phonePattern.test(receiverPhone)

  const confirm = () => {
    if (!phonesValid) return
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    setTrackingId(`PICK-${code}`)
    setStep('done')
  }

  const reset = () => {
    setStep('details')
    setPickup('')
    setDrop('')
    setSenderPhone('')
    setReceiverPhone('')
    setCopied(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div id="book" className="w-full rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.04)] sm:p-6">
      {step !== 'done' && (
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'confirm' && (
              <button
                onClick={() => setStep('details')}
                aria-label="Back to parcel details"
                className="flex size-8 items-center justify-center rounded-full bg-[#f5f5f7] text-ink transition-colors hover:bg-[#ebebf0]"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {step === 'details' ? 'Send a parcel' : 'Contact & payment'}
            </h2>
          </div>
          <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-ink/60">
            Step {step === 'details' ? 1 : 2} of 2
          </span>
        </div>
      )}

      {step === 'details' && (
        <div className="animate-rise space-y-4">
          <div className="overflow-hidden rounded-2xl bg-[#f5f5f7]">
            <label htmlFor={`${uid}-pickup`} className="flex items-center gap-3 px-4 py-3">
              <span className="size-2.5 shrink-0 rounded-full bg-ink" />
              <span className="flex-1">
                <span className="block text-[11px] font-semibold text-ink/45">Pickup from</span>
                <input
                  id={`${uid}-pickup`}
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="House, road, area"
                  autoComplete="street-address"
                  className="!h-7 w-full !rounded-none !border-0 !bg-transparent !p-0 text-[15px] font-medium text-ink placeholder:text-ink/30 focus:!shadow-none"
                />
              </span>
            </label>
            <div className="mx-4 h-px bg-black/[0.06]" />
            <label htmlFor={`${uid}-drop`} className="flex items-center gap-3 px-4 py-3">
              <span className="size-2.5 shrink-0 rounded-[3px] border-2 border-ink" />
              <span className="flex-1">
                <span className="block text-[11px] font-semibold text-ink/45">Deliver to</span>
                <input
                  id={`${uid}-drop`}
                  value={drop}
                  onChange={(e) => setDrop(e.target.value)}
                  placeholder="House, road, area"
                  autoComplete="off"
                  className="!h-7 w-full !rounded-none !border-0 !bg-transparent !p-0 text-[15px] font-medium text-ink placeholder:text-ink/30 focus:!shadow-none"
                />
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-ink/45">Parcel size</legend>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map((s) => {
                const active = s.id === size
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSize(s.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-3 transition-all active:scale-[0.96] ${
                      active ? 'bg-ink text-white' : 'bg-[#f5f5f7] text-ink hover:bg-[#ebebf0]'
                    }`}
                  >
                    <s.icon size={20} strokeWidth={1.75} />
                    <span className="text-xs font-semibold">{s.label}</span>
                    <span className={`text-[10px] ${active ? 'text-white/60' : 'text-ink/40'}`}>{s.hint}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-ink/45">Delivery speed</legend>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f5f5f7] p-1">
              {speeds.map((s) => {
                const active = s.id === speed
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpeed(s.id)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                      active ? 'bg-white text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
                    }`}
                  >
                    <s.icon size={15} />
                    <span className="text-left leading-tight">
                      {s.label}
                      <span className="block text-[10px] font-medium text-ink/40">{s.eta}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold text-ink/45">Estimated fare</p>
              <p className="text-2xl font-semibold leading-tight tracking-tight text-ink">৳{price}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-ink/45">Arrives in</p>
              <p className="text-sm font-semibold text-ink">{eta}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!detailsValid}
            onClick={() => setStep('confirm')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition-all hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/20"
          >
            Continue
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="animate-rise space-y-4">
          <div className="rounded-2xl bg-[#f5f5f7] p-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1.5 flex flex-col items-center gap-1">
                <span className="size-2 rounded-full bg-ink" />
                <span className="h-5 w-px bg-ink/20" />
                <span className="size-2 rounded-[2px] border-[1.5px] border-ink" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="truncate font-medium text-ink">{pickup}</p>
                <p className="truncate font-medium text-ink">{drop}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">৳{price}</p>
                <p className="text-[11px] text-ink/45">{eta}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor={`${uid}-sp`} className="mb-1.5 block text-[11px] font-semibold text-ink/45">
                Your phone
              </label>
              <input
                id={`${uid}-sp`}
                type="tel"
                inputMode="numeric"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="01XXXXXXXXX"
                className="!h-12 w-full !rounded-2xl !border-transparent !bg-[#f5f5f7] !px-4 text-[15px] font-medium"
              />
            </div>
            <div>
              <label htmlFor={`${uid}-rp`} className="mb-1.5 block text-[11px] font-semibold text-ink/45">
                Receiver phone
              </label>
              <input
                id={`${uid}-rp`}
                type="tel"
                inputMode="numeric"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="01XXXXXXXXX"
                className="!h-12 w-full !rounded-2xl !border-transparent !bg-[#f5f5f7] !px-4 text-[15px] font-medium"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-[11px] font-semibold text-ink/45">Pay with</legend>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f5f5f7] p-1">
              {payments.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPayment(p.id)}
                  aria-pressed={payment === p.id}
                  className={`rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    payment === p.id ? 'bg-white text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            disabled={!phonesValid}
            onClick={confirm}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition-all hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/20"
          >
            Book pickup · ৳{price}
          </button>
          <p className="text-center text-[11px] text-ink/40">Enter valid 11-digit Bangladeshi numbers to continue.</p>
        </div>
      )}

      {step === 'done' && (
        <div className="animate-rise py-2 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-ink text-white">
            <Check size={30} strokeWidth={2.5} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Pickup requested</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-ink/55">
            A rider is being assigned and will reach you in about 3 minutes.
          </p>

          <div className="mt-6 rounded-2xl bg-[#f5f5f7] p-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-ink/45">Tracking ID</p>
                <p className="font-mono text-lg font-semibold tracking-wider text-ink">{trackingId}</p>
              </div>
              <button
                onClick={copy}
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-semibold text-ink shadow-sm transition-transform active:scale-95"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-4 text-xs">
              <div>
                <p className="text-ink/45">Fare</p>
                <p className="mt-0.5 font-semibold text-ink">৳{price}</p>
              </div>
              <div>
                <p className="text-ink/45">Arrival</p>
                <p className="mt-0.5 font-semibold text-ink">{eta}</p>
              </div>
              <div>
                <p className="text-ink/45">Payment</p>
                <p className="mt-0.5 font-semibold text-ink">{payments.find((p) => p.id === payment)!.label}</p>
              </div>
            </div>
          </div>

          <button
            onClick={reset}
            className="mt-5 h-12 w-full rounded-full bg-[#f5f5f7] text-sm font-semibold text-ink transition-all hover:bg-[#ebebf0] active:scale-[0.98]"
          >
            Send another parcel
          </button>
        </div>
      )}
    </div>
  )
}
