import { Check } from 'lucide-react';

const highlights = [
  'Online store and retail tools',
  'Cloud workspace and account services',
  'One account for your Tiwlo workspace',
];

export default function AuthBrandPanel({ title, description, children }) {
  return (
    <aside className="auth-v3-brand-panel relative hidden flex-col justify-between overflow-hidden bg-[#121212] p-8 text-white lg:flex lg:p-12">
      <img
        src="/tiwlo-dark-bg-logo.png"
        alt="Tiwlo"
        className="relative z-10 h-9 w-fit max-w-[180px] object-contain"
      />
      <div className="relative z-10 my-10 max-w-md">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#1ed760]">
          One Tiwlo Account
        </p>
        <h2 className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight xl:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">
          {description}
        </p>
        <ul className="mt-8 flex flex-col gap-4">
          {highlights.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-white/80">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-[#121212]">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      {children || (
        <p className="relative z-10 text-xs text-white/50">
          Your Tiwlo workspace, all in one place.
        </p>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -right-56 size-[520px] rounded-full border-[56px] border-[#1ed760]/80"
      />
    </aside>
  );
}
