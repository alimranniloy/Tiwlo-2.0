import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Bengali } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const bengali = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-bengali' })

export const metadata: Metadata = {
  title: 'PICK — Express parcel delivery in under 45 minutes',
  description:
    'PICK delivers farm-fresh produce and express parcels across Bangladesh in 25–35 minutes. Order in the app, track your rider live.',
  icons: { icon: '/logos/app-icon.png', apple: '/logos/app-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${bengali.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
