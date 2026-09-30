import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Riyadhoh Sabtu adalah satu alur tiga langkah — kehadiran, setoran,
 * laporan — yang tersebar di beberapa rute. Berkas ini memberi kerangka yang
 * sama di semua rute itu: kartu langkah di halaman utama, dan penanda langkah
 * ringkas di halaman setoran & laporan.
 */

export type KeadaanLangkah = 'selesai' | 'kini' | 'nanti'

export function KartuLangkah({ no, judul, sub, keadaan, href, aksi }: {
  no: number
  judul: string
  sub: React.ReactNode
  keadaan: KeadaanLangkah
  /** Seluruh kartu menjadi tautan. */
  href?: string
  /** Tautan kecil di kanan, dipakai bila langkahnya punya lebih dari satu tujuan. */
  aksi?: React.ReactNode
}) {
  const isi = (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          keadaan === 'selesai' && 'bg-primary text-primary-foreground',
          keadaan === 'kini' && 'bg-accent-warm text-white',
          keadaan === 'nanti' && 'bg-muted text-muted-foreground',
        )}
      >
        {keadaan === 'selesai' ? <Check className="size-4" /> : no}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-tight">{judul}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      {aksi ?? (href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />)}
    </>
  )
  const kelas = cn(
    'flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 transition-colors',
    keadaan === 'kini' && 'border-accent-warm',
    href && 'hover:bg-accent',
  )
  return href ? <Link href={href} className={kelas}>{isi}</Link> : <div className={kelas}>{isi}</div>
}

/** Penanda langkah ringkas untuk halaman setoran & laporan. */
export function LangkahRingkas({ tanggal, aktif }: { tanggal: string; aktif: 1 | 2 | 3 }) {
  const langkah = [
    { no: 1, label: 'Kehadiran', href: `/guru/riyadhoh?tanggal=${tanggal}` },
    { no: 2, label: 'Setoran', href: `/guru/riyadhoh/tahsin?tanggal=${tanggal}` },
    { no: 3, label: 'Laporan', href: `/guru/riyadhoh/laporan?tanggal=${tanggal}` },
  ] as const
  return (
    <nav aria-label="Langkah Riyadhoh" className="grid grid-cols-3 gap-1.5">
      {langkah.map(l => (
        <Link
          key={l.no}
          href={l.href}
          aria-current={l.no === aktif ? 'step' : undefined}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors',
            l.no === aktif ? 'border-accent-warm bg-accent-warm-wash text-accent-warm' : 'bg-card text-muted-foreground hover:bg-accent',
          )}
        >
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full text-[11px]',
              l.no === aktif ? 'bg-accent-warm text-white' : l.no < aktif ? 'bg-primary text-primary-foreground' : 'bg-muted',
            )}
          >
            {l.no < aktif ? <Check className="size-3" /> : l.no}
          </span>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
