'use client'

import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { BULAN_ID } from '@/lib/rq/ujian'

interface Props {
  month: number
  year: number
  /** Ditaruh di baris yang sama, mis. penyaring penguji pada halaman riwayat. */
  children?: React.ReactNode
}

const SELECT_CLASS =
  'h-9 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Pemilih bulan & tahun yang menulis ke URL, bukan ke state.
 *
 * Periode ikut di query string supaya halaman rekap bisa ditautkan dan
 * dimuat ulang tanpa kehilangan bulan yang sedang dilihat — dan supaya
 * datanya tetap diambil di server, bukan seluruh tahun dikirim ke peramban.
 */
export function PilihPeriode({ month, year, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function pindah(bulan: number, tahun: number) {
    router.push(`${pathname}?bulan=${bulan}&tahun=${tahun}`)
  }

  const tahunIni = new Date().getFullYear()
  const pilihanTahun = Array.from({ length: 5 }, (_, i) => tahunIni - 2 + i)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" /> Periode
      </span>
      {/* Lebarnya dipatok, tidak flex-1: di layar lebar select yang memanjang
          sampai ujung kartu membuat baris periode terlihat seperti kolom
          isian, padahal isinya cuma nama bulan. */}
      <select
        aria-label="Bulan"
        value={month}
        onChange={e => pindah(Number(e.target.value), year)}
        className={`${SELECT_CLASS} min-w-32 flex-1 sm:w-44 sm:flex-none`}
      >
        {BULAN_ID.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        aria-label="Tahun"
        value={year}
        onChange={e => pindah(month, Number(e.target.value))}
        className={`${SELECT_CLASS} w-28`}
      >
        {pilihanTahun.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      {children}
    </div>
  )
}

export const PERIODE_SELECT_CLASS = SELECT_CLASS
