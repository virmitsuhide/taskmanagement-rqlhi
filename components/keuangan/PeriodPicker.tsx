'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'

/**
 * Pemilih bulan yang menempel di URL (`?periode=2026-04`).
 *
 * Periode disimpan di query string, bukan di state komponen, karena tiap
 * halaman modul ini adalah server component yang mengambil datanya sendiri —
 * dan karena bendahara sering membagikan tautan "laporan April" apa adanya.
 */
export function PeriodPicker({ period }: { period: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periode', next)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 print:hidden">
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => go(shiftPeriod(period, -1))}
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium tabular-nums">
        {formatPeriod(period)}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => go(shiftPeriod(period, 1))}
        aria-label="Bulan berikutnya"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
