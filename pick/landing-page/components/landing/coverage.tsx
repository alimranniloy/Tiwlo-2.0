import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react'
import { SectionHeading } from './section-heading'

export function Coverage({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <section id="coverage" className="bg-black py-24 text-white md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            dark
            eyebrow="Coverage"
            title="Check service availability for your address."
            description="PICK confirms delivery availability from the address saved in your account. No unconfigured service zones are advertised."
          />
          <button
            onClick={onOpenLogin}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-ink transition-all hover:bg-white/90 active:scale-[0.97]"
          >
            <ShieldCheck size={16} />
            Open PICK Admin
            <ArrowRight size={14} />
          </button>
        </div>

        <article className="mt-14 flex items-start gap-4 rounded-[2rem] bg-[#1c1c1e] p-7">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10">
            <MapPin size={20} />
          </span>
          <div>
            <h3 className="text-lg font-semibold">Coverage is confirmed at checkout</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              PICK currently does not have configured geofence boundaries. The app uses your saved delivery address and only displays rates configured by the PICK service.
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}
