const words = [
  'Documents',
  'Parcels',
  'Gifts',
  'Keys',
  'Electronics',
  'Clothing',
  'Medicine',
  'Same-hour delivery',
]

const stats = [
  { v: '45', u: 'min', l: 'Express city delivery' },
  { v: '42', u: 'riders', l: 'Live on the road today' },
  { v: '98.8', u: '%', l: 'On-time delivery' },
  { v: '5', u: 'cities', l: 'Active coverage zones' },
]

export function StatsMarquee() {
  return (
    <div className="bg-white pb-8 md:pb-16">
      <div className="overflow-hidden py-6" aria-hidden>
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...words, ...words, ...words, ...words].map((w, i) => (
            <span key={i} className="flex items-center gap-10 text-2xl font-semibold tracking-tight text-ink/20">
              {w}
              <span className="size-1.5 rounded-full bg-ink/15" />
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 px-5 md:grid-cols-4 md:gap-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-[1.75rem] bg-[#f5f5f7] p-6 md:p-7">
            <p className="text-4xl font-semibold tracking-[-0.03em] text-ink md:text-5xl">
              {s.v}
              <span className="ml-1 text-base font-medium text-ink/40">{s.u}</span>
            </p>
            <p className="mt-2 text-sm text-ink/55">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
