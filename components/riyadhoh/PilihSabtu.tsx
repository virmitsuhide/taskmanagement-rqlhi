import Link from 'next/link'
import { LABEL_KELOMPOK, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'
import { cn } from '@/lib/utils'

/** Deretan Sabtu terjadwal kelompok pengampu — pilih satu untuk dibuka. */
export function PilihSabtu({ daftar, terpilih, hariIni, basePath = '/guru/riyadhoh' }: {
  daftar: { tanggal: string; kelompok: KelompokRiyadhoh }[]
  terpilih: string
  hariIni: string
  basePath?: string
}) {
  // Label putra/putri hanya perlu bila pengampu memegang kedua kelompok.
  const duaKelompok = new Set(daftar.map(d => d.kelompok)).size > 1
  return (
    <nav aria-label="Pilih Sabtu" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {daftar.map(d => {
        const tgl = new Date(`${d.tanggal}T00:00:00`)
        const aktif = d.tanggal === terpilih
        const tambahan = [d.tanggal === hariIni ? 'hari ini' : null, duaKelompok ? LABEL_KELOMPOK[d.kelompok].toLowerCase() : null]
          .filter(Boolean).join(' · ')
        return (
          <Link
            key={d.tanggal}
            href={`${basePath}?tanggal=${d.tanggal}`}
            aria-current={aktif ? 'page' : undefined}
            className={cn(
              'inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
              aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
              d.tanggal > hariIni && !aktif && 'opacity-70',
            )}
          >
            {tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            {tambahan && ` · ${tambahan}`}
          </Link>
        )
      })}
    </nav>
  )
}
