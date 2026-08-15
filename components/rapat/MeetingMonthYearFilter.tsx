'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

interface Props {
  years: number[]
}

export function MeetingMonthYearFilter({ years }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const month = searchParams.get('month') ?? ''
  const year = searchParams.get('year') ?? ''

  function update(key: 'month' | 'year', value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page') // reset ke halaman 1 saat filter berubah
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={e => update('month', e.target.value)}
        className="text-sm border rounded-md px-2 py-1.5 bg-background"
        aria-label="Filter bulan"
      >
        <option value="">Semua bulan</option>
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={year}
        onChange={e => update('year', e.target.value)}
        className="text-sm border rounded-md px-2 py-1.5 bg-background"
        aria-label="Filter tahun"
      >
        <option value="">Semua tahun</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
