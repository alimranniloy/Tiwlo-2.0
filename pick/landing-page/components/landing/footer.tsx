export function Footer() {
  return (
    <footer className="bg-[#f5f5f7] text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-12 text-sm text-ink/50">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/land-logo-black.png" alt="PICK" className="h-6 w-auto" />
          <span>© {new Date().getFullYear()} PICK Bangladesh Ltd. All rights reserved.</span>
        </div>
        <div className="flex flex-wrap gap-6">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Support: 09612-PICK-BD</span>
        </div>
      </div>
    </footer>
  )
}
