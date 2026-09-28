import Link from 'next/link'
import { hrefRekap } from '@/components/setoran/FilterSesiBulan'
import { cn } from '@/lib/utils'

/**
 * Progres per Sesi dan Catatan Adab dalam satu menu. Keduanya dibaca dari
 * setoran yang sama, per sesi per bulan — sesi & bulan yang terpilih ikut
 * terbawa saat berpindah tab.
 */
export function TabProgresSesi({ aktif, halaqoh, periode }: {
  aktif: 'tahsin' | 'tahfidz' | 'adab'
  /** undefined / 'semua' = semua sesi (hanya bermakna di tab Adab). */
  halaqoh?: string
  periode: string
}) {
  const sesi = halaqoh && halaqoh !== 'semua' ? halaqoh : undefined
  const tab = [
    { kunci: 'tahsin', label: 'Tahsin', href: hrefRekap('/guru/progres', { halaqoh: sesi, periode, jenis: 'tahsin' }) },
    { kunci: 'tahfidz', label: 'Tahfidz', href: hrefRekap('/guru/progres', { halaqoh: sesi, periode, jenis: 'tahfidz' }) },
    { kunci: 'adab', label: 'Catatan Adab', href: hrefRekap('/guru/adab', { halaqoh: sesi, periode }) },
  ] as const
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tampilan progres sesi">
      {tab.map(t => (
        <Link
          key={t.kunci}
          href={t.href}
          role="tab"
          aria-selected={aktif === t.kunci}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition-colors',
            aktif === t.kunci ? 'border-primary bg-primary-wash font-semibold text-primary' : 'bg-card hover:bg-accent',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
