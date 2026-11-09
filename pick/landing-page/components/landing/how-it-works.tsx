import { MapPinned, PackageCheck, Route } from 'lucide-react'
import { SectionHeading } from './section-heading'

const steps = [
  {
    step: '01',
    time: 'Under 1 min',
    icon: MapPinned,
    title: 'Book your pickup',
    desc: 'Enter pickup and drop-off, choose parcel size and speed. The fare is shown up front, no surprises.',
  },
  {
    step: '02',
    time: 'Rider in ~3 min',
    icon: Route,
    title: 'Rider collects & moves',
    desc: 'The nearest rider is assigned instantly. Follow every kilometre on a live map from your phone.',
  },
  {
    step: '03',
    time: '25–45 min',
    icon: PackageCheck,
    title: 'Verified handover',
    desc: 'The receiver shares a one-time code with the rider. You get a confirmation the moment it is delivered.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f5f5f7] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <SectionHeading eyebrow="How it works" title="Three taps from your door to theirs." />
          <div className="hidden h-44 w-80 overflow-hidden rounded-[2rem] lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/hub.png" alt="PICK sorting hub with neatly stacked parcels" className="size-full object-cover" />
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <article
              key={s.step}
              className="ios-card group relative p-8 transition-transform duration-500 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-14 items-center justify-center rounded-[1.25rem] bg-ink text-white">
                  <s.icon size={24} strokeWidth={1.75} />
                </span>
                <span className="text-6xl font-semibold leading-none tracking-tighter text-ink/[0.07]">{s.step}</span>
              </div>
              <span className="mt-7 inline-block rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-ink/70">
                {s.time}
              </span>
              <h3 className="mt-3 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/55">{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
