import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Deretan Jum'at yang masih bisa dicatat — pilih satu untuk dibuka. */
export function PilihJumat({ daftar, terpilih, hariIni, basePath = '/guru/tahsin-rekomendasi' }: {
  /** Urut naik; yang terakhir paling baru. */
  daftar: string[]
  terpilih: string
  hariIni: string
  basePath?: string
}) {
  return (
    <nav aria-label="Pilih Jum'at" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {daftar.map(t => {
        const aktif = t === terpilih
        return (
          <Link
            key={t}
            href={`${basePath}?tanggal=${t}`}
            aria-current={aktif ? 'page' : undefined}
            className={cn(
              'inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
              aktif ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            {new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            {t === hariIni && ' · hari ini'}
          </Link>
        )
      })}
    </nav>
  )
}
