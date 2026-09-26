import Link from 'next/link'
import { BarChart2, List } from 'lucide-react'

const TABS = [
  { key: 'antrian', href: '/ujian',       label: 'Antrian Ujian', icon: List      },
  { key: 'rekap',   href: '/ujian/rekap', label: 'Rekap Hasil',   icon: BarChart2 },
] as const

/**
 * Dua tab halaman publik modul ujian: antrian berjalan dan rekap bulanan.
 *
 * Gaya garis bawahnya menyalin tab di /tentang — bukan tombol berlatar, supaya
 * halaman publik RQ punya satu bahasa navigasi yang sama.
 */
export function UjianTabPublik({ aktif }: { aktif: 'antrian' | 'rekap' }) {
  return (
    <nav aria-label="Menu ujian" className="mb-6 flex flex-wrap gap-2">
      {TABS.map(({ key, href, label, icon: Icon }) => {
        const active = aktif === key
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
