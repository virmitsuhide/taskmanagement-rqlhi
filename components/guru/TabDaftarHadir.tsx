import Link from 'next/link'
import { CalendarCheck, CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Dua tampilan Daftar Hadir dalam satu menu: harian (mengisi) dan rekap
 * sebulan (membaca). Dulu dua menu terpisah di sidebar guru.
 */
export function TabDaftarHadir({ aktif }: { aktif: 'harian' | 'rekap' }) {
  const tab = [
    { kunci: 'harian', label: 'Harian', href: '/guru/absensi', ikon: <CalendarCheck className="h-4 w-4" /> },
    { kunci: 'rekap', label: 'Rekap Bulanan', href: '/guru/absensi/rekap', ikon: <CalendarRange className="h-4 w-4" /> },
  ] as const
  return (
    <div className="flex gap-2" role="tablist" aria-label="Tampilan daftar hadir">
      {tab.map(t => (
        <Link
          key={t.kunci}
          href={t.href}
          role="tab"
          aria-selected={aktif === t.kunci}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
            aktif === t.kunci ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
          )}
        >
          {t.ikon}{t.label}
        </Link>
      ))}
    </div>
  )
}
