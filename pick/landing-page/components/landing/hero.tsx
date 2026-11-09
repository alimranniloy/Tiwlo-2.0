import { Bike, MapPin, ShieldCheck, Zap } from 'lucide-react'
import { HeroBooking } from './hero-booking'

const points = [
  { icon: Zap, text: 'Express in under 45 min' },
  { icon: MapPin, text: 'Live GPS tracking' },
  { icon: ShieldCheck, text: 'Verified handover code' },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-32 md:pb-28 md:pt-40">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1fr_1.05fr]">
        <div className="animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] py-1.5 pl-2.5 pr-4 text-xs font-medium text-ink/70">
            <span className="relative flex size-4 items-center justify-center">
              <span className="absolute size-2.5 animate-pulse-ring rounded-full bg-ink/40" />
              <span className="size-2 rounded-full bg-ink" />
            </span>
            42 riders live across 5 cities
          </div>

          <h1 className="mt-7 text-5xl font-semibold leading-[1.04] tracking-[-0.035em] text-ink text-balance md:text-7xl">
            Send anything.
            <br />
            <span className="text-ink/35">Delivered in minutes.</span>
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-ink/60">
            Book a rider in seconds. We pick up from your door, track every kilometre live, and hand over with a verified
            code.
          </p>

          <ul className="mt-9 flex flex-col gap-3.5">
            {points.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-[15px] font-medium text-ink/75">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f5f7] text-ink">
                  <p.icon size={16} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-rise [animation-delay:150ms] lg:h-[680px]">
          <div className="relative hidden h-full overflow-hidden rounded-[2.75rem] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)] lg:ml-auto lg:block lg:w-[72%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-courier.png"
              alt="PICK courier handing a parcel to a customer at their doorstep"
              className="size-full object-cover"
            />
            <div className="glass absolute right-4 top-4 flex items-center gap-3 rounded-[1.25rem] p-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-white">
                <Bike size={18} />
              </span>
              <div>
                <p className="text-[10px] font-medium text-ink/50">Rider assigned</p>
                <p className="text-sm font-semibold leading-none text-ink">in 3 min</p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:absolute lg:left-0 lg:top-1/2 lg:max-w-[390px] lg:-translate-y-1/2">
            <HeroBooking />
          </div>
        </div>
      </div>
    </section>
  )
}
