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
    <div className="border-b mb-7 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav aria-label="Menu ujian" className="flex gap-1 min-w-fit">
        {TABS.map(({ key, href, label, icon: Icon }) => {
          const active = aktif === key
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
