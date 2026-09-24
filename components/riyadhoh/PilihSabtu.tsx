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
  return (
    <nav aria-label="Pilih Sabtu" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {daftar.map(d => {
        const tgl = new Date(`${d.tanggal}T00:00:00`)
        const aktif = d.tanggal === terpilih
        return (
          <Link
            key={d.tanggal}
            href={`${basePath}?tanggal=${d.tanggal}`}
            aria-current={aktif ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1.5 text-center text-xs transition-colors',
              aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
              d.tanggal > hariIni && !aktif && 'opacity-60',
            )}
          >
            <span className="block font-semibold">{tgl.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
            <span className="block">{d.tanggal === hariIni ? 'Hari ini' : LABEL_KELOMPOK[d.kelompok]}</span>
          </Link>
        )
      })}
    </nav>
  )
}
