import { Check, Download } from 'lucide-react'
import { SectionHeading } from './section-heading'

const features = [
  ['Instant Booking:', 'Pick size and speed, see the fare before you confirm'],
  ['Bilingual UI:', 'Toggle between English and বাংলা with 1 tap'],
  ['Live Parcel Tracking:', 'Watch your rider move on the map in real time'],
  ['bKash, Nagad & Cash:', 'Safe and verified payment'],
]

export function DownloadApp() {
  return (
    <section id="download" className="bg-white px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.75rem] bg-ink px-6 py-16 text-white md:px-14 md:py-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeading dark eyebrow="Mobile Experience" title="Download the PICK Android app." />
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/55">
              Book pickups, track your rider live on GPS, share handover codes and manage every parcel from one place,
              in English or বাংলা.
            </p>

            <ul className="mt-8 flex flex-col gap-3.5">
              {features.map(([b, t]) => (
                <li key={b} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">{b}</strong> {t}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap items-center gap-5">
              <a
                href="/PICK.apk"
                download="PICK.apk"
                className="inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Download size={18} />
                Download APK (v1.0.0)
              </a>
              <div className="text-xs text-white/45">
                <div>Android 8.0+ Ready</div>
                <div>Direct Standalone Install</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="animate-float-slow">
              <div className="relative w-[290px] overflow-hidden rounded-[3rem] border-[8px] border-[#2c2c2e] bg-white text-ink shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
                <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
                <div className="px-4 pb-4 pt-10">
                  <p className="text-[10px] font-semibold tracking-wider text-ink/40">PICKUP FROM</p>
                  <p className="mb-3 text-sm font-semibold">Dhanmondi, Dhaka ▾</p>
                  <div className="mb-4 flex h-9 items-center rounded-xl bg-[#f2f2f7] px-3 text-[11px] text-ink/45">
                    Where to deliver?
                  </div>

                  {[
                    ['Document', 'Up to 1 kg', '৳60'],
                    ['Small parcel', 'Up to 2 kg', '৳90'],
                  ].map(([n, w, p]) => (
                    <div key={n} className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl bg-[#f2f2f7] p-3">
                      <div>
                        <p className="text-xs font-semibold">{n}</p>
                        <p className="mt-0.5 text-[10px] text-ink/50">{w} · 25–45 min</p>
                      </div>
                      <p className="text-sm font-semibold">{p}</p>
                    </div>
                  ))}

                  <div className="mt-3 rounded-2xl bg-ink p-3 text-white">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/60">Rider on the way</span>
                      <span className="font-semibold">12 min</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full w-3/5 rounded-full bg-white" />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-around pt-2.5 text-[10px] font-semibold text-ink/35">
                    <span className="text-ink">Home</span>
                    <span>Parcel</span>
                    <span>Orders</span>
                    <span>Profile</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
