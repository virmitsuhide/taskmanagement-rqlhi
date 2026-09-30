import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Dua tampilan Daftar Hadir dalam satu menu: harian (mengisi) dan rekap
 * sebulan (membaca). Dulu dua menu terpisah di sidebar guru.
 */
export function TabDaftarHadir({ aktif }: { aktif: 'harian' | 'rekap' }) {
  const tab = [
    { kunci: 'harian', label: 'Harian', href: '/guru/absensi' },
    { kunci: 'rekap', label: 'Rekap bulanan', href: '/guru/absensi/rekap' },
  ] as const
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Tampilan daftar hadir">
      {tab.map(t => (
        <Link
          key={t.kunci}
          href={t.href}
          role="tab"
          aria-selected={aktif === t.kunci}
          className={cn(
            'inline-flex h-[34px] items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
            aktif === t.kunci ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
