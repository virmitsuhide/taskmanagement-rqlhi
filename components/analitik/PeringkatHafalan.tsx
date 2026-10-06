import Link from 'next/link'
import { formatCapaian } from '@/lib/rq/halaman'
import type { HafalanBoard, PeringkatHafalan } from '@/lib/data/analytics'
import { cn } from '@/lib/utils'

export type SiswaPeringkat = PeringkatHafalan & { unit: string }

/**
 * Peringkat hafalan dari satu atau beberapa papan unit — dipakai panel
 * "10 Besar Hafalan" di /dashboard/analitik dan halaman peringkat lengkapnya,
 * supaya urutan keduanya tidak pernah berbeda.
 *
 * Satu unit yang menghafal per surat (PAUD) memakai urutan halamannya
 * sendiri. Gabungan beberapa unit tetap menurut ukuran juz — halaman Juz 30
 * anak PAUD tidak setara dengan hafalan anak SMP, jadi mereka tidak dicampur.
 */
export function susunPeringkat(boards: HafalanBoard[]): { perHalaman: boolean; siswa: SiswaPeringkat[] } {
  if (boards.length === 1 && boards[0].ukuran === 'halaman') {
    return { perHalaman: true, siswa: boards[0].peringkat.map(s => ({ ...s, unit: boards[0].label })) }
  }
  const siswa = boards
    .filter(b => b.ukuran === 'juz')
    .flatMap(b => b.peringkat.map(s => ({ ...s, unit: b.label })))
    .sort((x, y) => (y.totalHalaman ?? 0) - (x.totalHalaman ?? 0) || y.juzCount - x.juzCount || y.totalAyat - x.totalAyat)
  return { perHalaman: false, siswa }
}

function nilai(s: PeringkatHafalan, perHalaman: boolean): number {
  return perHalaman ? s.halaman ?? 0 : s.totalHalaman ?? s.juzCount
}

/** "1 juz 3 halaman" — atau halaman Juz 30 untuk unit per surat. */
function teksCapaian(s: PeringkatHafalan, perHalaman: boolean): string {
  if (perHalaman) return `${s.halaman ?? 0} hal`
  return s.capaian ? formatCapaian(s.capaian) : `${s.juzCount} juz`
}

/**
 * Daftar bernomor. `mulai` = peringkat baris pertama (halaman 2 dimulai dari
 * 31, bukan 1); `maks` = nilai peringkat 1 seluruh daftar, supaya panjang bar
 * di halaman 2 tetap sebanding dengan juara di halaman 1.
 */
export function DaftarPeringkat({ siswa, perHalaman, mulai = 1, maks, tampilUnit, kolom = true }: {
  siswa: SiswaPeringkat[]
  perHalaman: boolean
  mulai?: number
  maks: number
  tampilUnit: boolean
  /** Dua kolom di layar lebar. */
  kolom?: boolean
}) {
  return (
    <ol start={mulai} className={cn('divide-y', kolom && 'lg:columns-2 lg:gap-x-8 [&>li]:break-inside-avoid')}>
      {siswa.map((s, i) => {
        const no = mulai + i
        return (
          <li key={s.id}>
            <Link href={`/siswa/${s.id}`} className="flex items-center gap-3 py-1.5 hover:bg-muted/40"
              title={s.totalAyat > 0 ? `${s.totalAyat.toLocaleString('id-ID')} ayat ${perHalaman ? 'Juz 30 terhafal' : 'disetor'}` : undefined}>
              <span className={cn('w-7 shrink-0 text-xs font-bold tabular-nums', no <= 3 ? 'text-primary' : 'text-muted-foreground')}>{no}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {[
                    tampilUnit ? s.unit : null,
                    s.kelas ? `Kelas ${s.kelas}` : null,
                    perHalaman && s.posisi ? `sampai ${s.posisi}` : null,
                  ].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                <span className="block h-full rounded-full" style={{ width: `${(nilai(s, perHalaman) / Math.max(1, maks)) * 100}%`, background: 'var(--primary)' }} />
              </span>
              <span className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums">
                {teksCapaian(s, perHalaman)}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** Nilai peringkat 1 — skala bar. */
export function nilaiTeratas(siswa: SiswaPeringkat[], perHalaman: boolean): number {
  return siswa.length > 0 ? nilai(siswa[0], perHalaman) : 1
}
