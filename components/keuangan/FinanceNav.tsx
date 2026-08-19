'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/keuangan', label: 'Ringkasan' },
  { href: '/keuangan/transaksi', label: 'Transaksi' },
  { href: '/keuangan/anggaran', label: 'Anggaran' },
  { href: '/keuangan/titipan', label: 'Dana Titipan' },
  { href: '/keuangan/laporan', label: 'Laporan BPH' },
]

/** Tab modul keuangan. Periode ikut dibawa antar tab lewat query string. */
export function FinanceNav({ period }: { period: string }) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto border-b print:hidden">
      {TABS.map(tab => {
        // '/keuangan' cocok persis saja, kalau tidak semua sub-halaman ikut aktif.
        const active = tab.href === '/keuangan' ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={`${tab.href}?periode=${period}`}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
