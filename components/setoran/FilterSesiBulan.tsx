import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
import type { HalaqohSesi } from '@/lib/data/setoran-sesi'

/**
 * Pemilih sesi + bulan untuk rekap guru. Semuanya tautan biasa: halaman tetap
 * server component, dan "Sesi 2, Agustus" bisa disimpan atau dibagikan
 * sebagai URL.
 */

export type ParamRekap = Record<string, string | undefined>

function href(basePath: string, params: ParamRekap): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${basePath}?${s}` : basePath
}

const CHIP = 'rounded-lg border px-3 py-1.5 text-sm transition-colors'
const CHIP_AKTIF = 'border-primary bg-primary-wash font-semibold text-primary'
const CHIP_PASIF = 'bg-card hover:bg-accent'

export function FilterSesiBulan({
  basePath, daftar, halaqoh, periode, params, semua = false,
}: {
  basePath: string
  daftar: HalaqohSesi[]
  /** id halaqoh terpilih, atau 'semua'. */
  halaqoh: string
  periode: string
  /** Parameter lain yang ikut dipertahankan (mis. jenis). */
  params?: ParamRekap
  /** Tampilkan pilihan "Semua sesi". */
  semua?: boolean
}) {
  const dasar = { ...params, halaqoh, periode }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      {(daftar.length > 1 || semua) ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih sesi">
          {semua && (
            <Link
              href={href(basePath, { ...dasar, halaqoh: 'semua' })}
              aria-current={halaqoh === 'semua' ? 'page' : undefined}
              className={`${CHIP} ${halaqoh === 'semua' ? CHIP_AKTIF : CHIP_PASIF}`}
            >
              Semua sesi
            </Link>
          )}
          {daftar.map(h => (
            <Link
              key={h.id}
              href={href(basePath, { ...dasar, halaqoh: h.id })}
              aria-current={h.id === halaqoh ? 'page' : undefined}
              className={`${CHIP} ${h.id === halaqoh ? CHIP_AKTIF : CHIP_PASIF}`}
            >
              {h.sesi ? `Sesi ${h.sesi}` : h.name}
            </Link>
          ))}
        </div>
      ) : <span />}

      <div className="flex items-center gap-1">
        <Link
          href={href(basePath, { ...dasar, periode: shiftPeriod(periode, -1) })}
          aria-label="Bulan sebelumnya"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="min-w-32 text-center text-sm font-medium">{formatPeriod(periode)}</span>
        <Link
          href={href(basePath, { ...dasar, periode: shiftPeriod(periode, 1) })}
          aria-label="Bulan berikutnya"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

export { href as hrefRekap }
