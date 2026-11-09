import { Bike, Clock, MapPin, Package } from 'lucide-react'
import { SectionHeading } from './section-heading'

const items = [
  {
    icon: Package,
    title: 'Documents & Small Packets',
    desc: 'Up to 1 kg urgent document courier between offices, schools, and legal hubs. Starting at ৳60.',
  },
  {
    icon: Bike,
    title: 'Standard Parcel (Up to 5 kg)',
    desc: 'Clothes, boxed goods, electronics, gifts with instant doorstep pickup and verification code.',
  },
  {
    icon: Clock,
    title: 'Same-Hour Point-to-Point',
    desc: 'Dedicated motorcycle rider assigned within 3 minutes of request with live GPS tracking on map.',
  },
]

export function Courier() {
  return (
    <section id="courier" className="bg-[#f5f5f7] py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <div className="relative">
          <div className="relative overflow-hidden rounded-[2.75rem] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/rider.png"
              alt="PICK delivery rider on a scooter in a Dhaka street at golden hour"
              className="aspect-[4/5] w-full object-cover"
            />
          </div>

          <div className="glass absolute -right-3 top-8 flex items-center gap-3 rounded-[1.5rem] p-3.5 md:-right-8">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-ink text-white">
              <MapPin size={18} />
            </span>
            <div>
              <p className="text-[11px] font-medium text-ink/50">Rider assigned</p>
              <p className="text-sm font-semibold text-ink">in under 3 min</p>
            </div>
          </div>
          <div className="glass-dark absolute -left-3 bottom-10 rounded-[1.5rem] p-4 text-white md:-left-8">
            <p className="text-[11px] text-white/55">Express city parcel</p>
            <p className="text-3xl font-semibold tracking-tight">
              &lt; 45 <span className="text-base font-medium text-white/70">min</span>
            </p>
          </div>
        </div>

        <div>
          <SectionHeading
            eyebrow="Services"
            title="One rider. Every kind of delivery."
            description="Documents, gifts, keys or merchandise across Dhaka & Chittagong, picked up and delivered in under 45 minutes."
          />
          <div className="mt-10 flex flex-col gap-3">
            {items.map((it) => (
              <article
                key={it.title}
                className="ios-card group flex gap-5 rounded-[1.75rem] p-5 transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
                  <it.icon size={22} strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{it.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink/55">{it.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
