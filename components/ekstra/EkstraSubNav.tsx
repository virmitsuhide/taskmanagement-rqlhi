'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileText, GraduationCap, Inbox, Settings2, UserRound, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const MENU = [
  { href: '/ekstra', label: 'Booking', icon: Inbox },
  { href: '/ekstra/halaqoh', label: 'Halaqoh ekstra', icon: UsersRound },
  { href: '/ekstra/siswa', label: 'Siswa ekstra', icon: UserRound },
  { href: '/ekstra/guru', label: 'Guru ekstra', icon: GraduationCap },
  { href: '/ekstra/atur', label: 'Jenis ekstra', icon: Settings2 },
  { href: '/ekstra/laporan', label: 'Laporan', icon: FileText },
  { href: '/ekstra/analitik', label: 'Analitik', icon: BarChart3 },
]

export function EkstraSubNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Menu ekstra" className="flex flex-wrap gap-2">
      {MENU.map(({ href, label, icon: Icon }) => {
        // /ekstra hanya cocok persis; menu lain ikut menyala di halaman turunannya (detail halaqoh).
        const aktif = href === '/ekstra' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} aria-current={aktif ? 'page' : undefined}
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
              aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        )
      })}
    </nav>
  )
}

export function MigrasiEkstra() {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
      Tabel ekstra belum ada di basis data. Jalankan{' '}
      <code className="rounded bg-muted px-1 py-0.5 text-xs">drizzle/0091_ekstra_PASTE_TO_SUPABASE.sql</code>{' '}
      di Supabase SQL Editor lebih dulu.
    </div>
  )
}
