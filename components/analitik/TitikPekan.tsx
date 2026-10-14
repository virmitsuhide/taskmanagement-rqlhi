import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PekanHalaqoh } from '@/lib/data/kelengkapan-mingguan'

export interface TitikPekanData extends PekanHalaqoh {
  /** 'YYYY-MM-DD' awal & akhir pekan. */
  dari: string
  sampai: string
  /** Pekan belum selesai (hari ini ada di dalamnya). */
  berjalan: boolean
}

const tgl = (iso: string) => Number(iso.slice(8, 10))

/**
 * Laporan per pekan sebagai deretan kotak kecil: ✓ lengkap, ! sebagian atau
 * ada input terlambat, ✕ kosong, abu-abu = pekan berjalan yang belum terisi.
 * Warna tidak pernah sendirian — tiap kotak punya ikon dan keterangan.
 */
export function TitikPekan({ pekan, className }: { pekan: TitikPekanData[]; className?: string }) {
  if (pekan.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>
  return (
    <ul className={cn('flex items-center gap-1', className)} aria-label="Laporan per pekan">
      {pekan.map(p => {
        const kosongBerjalan = p.berjalan && p.status === 'kosong'
        const ket = `Pekan ${tgl(p.dari)}–${tgl(p.sampai)}: ${
          kosongBerjalan ? 'berjalan, belum ada setoran'
            : p.status === 'lengkap' ? 'lengkap'
            : p.status === 'kosong' ? 'kosong'
            : `${p.terisi}/${p.total} anak terisi${p.terlambat ? `, ${p.terlambat} input terlambat` : ''}`}`
        return (
          <li key={p.dari} title={ket}
            className={cn(
              'flex size-5 items-center justify-center rounded-[5px] text-[11px] font-bold',
              kosongBerjalan ? 'border border-dashed bg-muted text-muted-foreground'
                : p.status === 'lengkap' ? 'bg-primary text-primary-foreground'
                : p.status === 'sebagian' ? 'bg-warning text-white'
                : 'bg-destructive text-white',
            )}>
            <span className="sr-only">{ket}</span>
            {kosongBerjalan ? null
              : p.status === 'lengkap' ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              : p.status === 'sebagian' ? <span aria-hidden>!</span>
              : <X className="h-3 w-3" strokeWidth={3} aria-hidden />}
          </li>
        )
      })}
    </ul>
  )
}
