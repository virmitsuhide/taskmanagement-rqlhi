import Link from 'next/link'
import { hrefRekap } from '@/components/setoran/FilterSesiBulan'
import type { TabTambahanGuru } from '@/lib/data/tab-progres-guru'
import { cn } from '@/lib/utils'

export type TabProgres = 'tahsin' | 'tahfidz' | 'adab' | 'ekstra' | 'tr' | 'riyadhoh' | 'gukar'

/**
 * Progres per Sesi dan Catatan Adab dalam satu menu. Keduanya dibaca dari
 * setoran yang sama, per sesi per bulan — sesi & bulan yang terpilih ikut
 * terbawa saat berpindah tab.
 *
 * Tab jalur tambahan (Ekstra, TR, Riyadhoh, Gukar) hanya muncul bagi guru
 * yang mengampu jalur itu.
 */
export function TabProgresSesi({ aktif, halaqoh, periode, ekstra = false, tambahan }: {
  aktif: TabProgres
  /** Guru mengampu halaqoh ekstra — tab Ekstra ditampilkan. */
  ekstra?: boolean
  /** Tab TR / Riyadhoh / Gukar yang berhak dilihat guru ini. */
  tambahan?: TabTambahanGuru
  /** undefined / 'semua' = semua sesi (hanya bermakna di tab Adab). */
  halaqoh?: string
  periode: string
}) {
  // Kunci sesi sekolah tidak berlaku di tab jalur tambahan (dan sebaliknya).
  const sesi = halaqoh && halaqoh !== 'semua' && !halaqoh.startsWith('ekstra-') ? halaqoh : undefined
  const tabJalur = (kunci: 'ekstra' | 'tr' | 'riyadhoh' | 'gukar', label: string) =>
    ({ kunci, label, href: hrefRekap('/guru/progres', { periode, tab: kunci }) })
  const tab = [
    { kunci: 'tahsin', label: 'Tahsin', href: hrefRekap('/guru/progres', { halaqoh: sesi, periode, jenis: 'tahsin' }) },
    { kunci: 'tahfidz', label: 'Tahfidz', href: hrefRekap('/guru/progres', { halaqoh: sesi, periode, jenis: 'tahfidz' }) },
    { kunci: 'adab', label: 'Catatan Adab', href: hrefRekap('/guru/adab', { halaqoh: sesi, periode }) },
    ...(ekstra ? [tabJalur('ekstra', 'Ekstra')] : []),
    ...(tambahan?.tr ? [tabJalur('tr', 'TR')] : []),
    ...(tambahan?.riyadhoh ? [tabJalur('riyadhoh', 'Riyadhoh')] : []),
    ...(tambahan?.gukar ? [tabJalur('gukar', 'Gukar')] : []),
  ]
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tampilan progres sesi">
      {tab.map(t => (
        <Link
          key={t.kunci}
          href={t.href}
          role="tab"
          aria-selected={aktif === t.kunci}
          title={t.kunci === 'tr' ? 'Tahsin Rekomendasi' : t.kunci === 'gukar' ? 'Mentoring guru & karyawan' : undefined}
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
