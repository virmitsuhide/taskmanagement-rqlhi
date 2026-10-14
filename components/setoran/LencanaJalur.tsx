import { cn } from '@/lib/utils'
import { angkaHalaman } from '@/lib/rq/murojaah'
import {
  KETERANGAN_JALUR, LABEL_JALUR, URUTAN_JALUR,
  type CapaianJalur, type JalurTambahan,
} from '@/lib/rq/jalur'

/**
 * Lencana jalur tambahan (Ekstra, TR, Riyadhoh, Boarding) — tanda anak punya
 * waktu mengaji di luar halaqoh sekolah. Sudut kotak, bukan pil, supaya tidak
 * tertukar dengan lencana level asrama di sebelahnya.
 */
export function LencanaJalur({ jalur, kecuali, className }: {
  jalur: readonly JalurTambahan[]
  /** Jalur yang sudah diwakili lencana lain, mis. boarding oleh lencana level. */
  kecuali?: readonly JalurTambahan[]
  className?: string
}) {
  const tampil = jalur.filter(j => !kecuali?.includes(j))
  if (tampil.length === 0) return null
  return (
    <>
      {tampil.map(j => (
        <span
          key={j}
          title={KETERANGAN_JALUR[j]}
          className={cn(
            'inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-px text-[10px] font-semibold leading-tight text-foreground',
            className,
          )}
        >
          {LABEL_JALUR[j]}
        </span>
      ))}
    </>
  )
}

/**
 * "Sekolah 12 · Ekstra 5 · TR 3 hlm". Hanya ditampilkan bila anak ikut jalur
 * tambahan atau punya capaian di luar sekolah — anak yang hanya di sekolah
 * cukup dibaca dari tabelnya.
 */
export function RincianCapaianJalur({ capaian, jalur }: { capaian: CapaianJalur; jalur: readonly JalurTambahan[] }) {
  const tampil = URUTAN_JALUR.filter(j =>
    j === 'sekolah' || (capaian[j] ?? 0) > 0 || (jalur as readonly string[]).includes(j))
  if (tampil.length < 2) return null
  return (
    <span className="block text-[11px] text-muted-foreground">
      {tampil.map((j, i) => (
        <span key={j}>
          {i > 0 && ' · '}
          {LABEL_JALUR[j]} <b className="font-semibold text-foreground tabular-nums">{angkaHalaman(capaian[j] ?? 0)}</b>
        </span>
      ))} hlm
    </span>
  )
}
