import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Newsreader, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

// Huruf "Teduh": Plus Jakarta Sans untuk teks & data, Newsreader untuk judul
// (dipakai lewat token --font-heading / kelas font-heading).
const fontSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const fontDisplay = Newsreader({ subsets: ['latin'], variable: '--font-display', display: 'swap', style: ['normal', 'italic'] })
const fontMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: 'RQ LHI — Sistem Manajemen',
  description: 'Sistem operasional internal Rumah Qur\'an LHI',
  openGraph: {
    siteName: 'Rumah Qur\'an LHI',
    locale: 'id_ID',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn('antialiased', fontMono.variable, 'font-sans', fontSans.variable, fontDisplay.variable)}
    >
      <body>
        <ThemeProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
