export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  dark = false,
}: {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
  dark?: boolean
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <span className={`text-sm font-semibold ${dark ? 'text-white/50' : 'text-ink/45'}`}>{eyebrow}</span>
      <h2
        className={`mt-3 text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-balance md:text-[3.25rem] ${
          dark ? 'text-white' : 'text-ink'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-pretty text-base leading-relaxed md:text-lg ${dark ? 'text-white/55' : 'text-ink/55'}`}>
          {description}
        </p>
      )}
    </div>
  )
}
