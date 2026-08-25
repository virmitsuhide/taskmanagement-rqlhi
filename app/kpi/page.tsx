import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewKpi, canInputKpi, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getKpiRows, nilaiDari, KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { KPI_INDIKATOR } from '@/lib/kpi/hitung'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; year?: string; month?: string }>
}

/**
 * Singkatan kolom indikator. Nama penuhnya tetap terbaca lewat atribut title,
 * karena sebelas nama panjang berjajar membuat tabelnya jauh lebih lebar
 * daripada layar mana pun.
 */
const SINGKATAN = [
  'Hadir', 'Database', 'Hafalan', 'Tuhfatul', 'Bacaan', 'Seragam',
  'Lapor Ortu', 'Halaqoh', 'Buku Pgg', 'Perizinan', 'Pengganti',
]

const LEVEL_TONE: Record<number, string> = {
  5: 'bg-success-wash text-success',
  4: 'bg-primary-wash text-primary',
  3: 'bg-warning-wash text-warning',
  2: 'bg-destructive-wash text-destructive',
  1: 'bg-destructive-wash text-destructive',
}

export default async function KpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1

  const rows = await getKpiRows(unit, year, month)
  const mayInput = canInputKpi(session.role)

  // Rata-rata hanya dari guru yang sudah dinilai. Memasukkan yang belum diisi
  // sebagai nol akan menyeret angka unit ke bawah hanya karena SDM belum
  // selesai mengisi, dan itu terbaca seolah kinerjanya yang turun.
  const dinilai = rows.filter(r => r.entry)
  const rataRata = dinilai.length
    ? dinilai.reduce((s, r) => s + nilaiDari(r.entry!).rapot, 0) / dinilai.length
    : null

  const href = (o: { unit?: string; year?: number; month?: number }) => {
    const q = new URLSearchParams({
      unit: o.unit ?? unit,
      year: String(o.year ?? year),
      month: String(o.month ?? month),
    })
    return `/kpi?${q}`
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="KPI Bulanan Guru" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">KPI Bulanan Guru</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {MONTH_NAMES[month - 1]} {year} · {KPI_UNITS.find(u => u.key === unit)?.label}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/kpi/rapor?unit=${unit}&year=${year}`}>
              <FileText className="h-4 w-4 mr-1" />Rapor Semester
            </Link>
          </Button>
        </div>

        <div className="flex gap-1 rounded-lg bg-muted p-1 mb-3 w-fit overflow-x-auto">
          {KPI_UNITS.map(u => (
            <Link
              key={u.key}
              href={href({ unit: u.key })}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {u.label}
            </Link>
          ))}
        </div>

        <div className="flex gap-1 mb-4 overflow-x-auto border-b pb-px">
          {MONTH_NAMES.map((m, i) => (
            <Link
              key={m}
              href={href({ month: i + 1 })}
              className={cn(
                'px-2.5 py-1.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors',
                month === i + 1
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {m.slice(0, 3)}
            </Link>
          ))}
          <div className="flex-1" />
          {[year - 1, year, year + 1].map(y => (
            <Link
              key={y}
              href={href({ year: y })}
              className={cn(
                'px-2.5 py-1.5 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors tabular-nums',
                year === y
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {y}
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-3 tabular-nums">
          <b className="text-foreground">{dinilai.length}</b> dari <b className="text-foreground">{rows.length}</b> guru sudah dinilai
          {rataRata !== null && (
            <> · rata-rata rapot <b className="text-foreground">{rataRata.toFixed(1)}</b></>
          )}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada guru aktif di unit ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-8">#</th>
                  <th className="px-2 py-2 text-left font-medium min-w-[200px]">Nama Guru</th>
                  {SINGKATAN.map((s, i) => (
                    <th key={s} className="px-2 py-2 text-center font-medium whitespace-nowrap" title={KPI_INDIKATOR[i]}>
                      {s}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium">Total</th>
                  <th className="px-2 py-2 text-center font-medium">Rapot</th>
                  <th className="px-2 py-2 text-center font-medium">Predikat</th>
                  {mayInput && <th className="px-2 py-2 w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const h = r.entry ? nilaiDari(r.entry) : null
                  return (
                    <tr key={r.teacherId} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2 font-medium">
                        {r.fullName}
                        {/*
                          Guru ini dinilai di unit ini pada bulan tersebut, tapi
                          kini sudah pindah. Barisnya tetap ada karena
                          penilaiannya memang terjadi di sini — penandanya
                          mencegah pembaca mengira daftarnya keliru.
                        */}
                        {r.pindahKe && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground whitespace-nowrap">
                            kini di {JENJANG_LABELS[r.pindahKe]}
                          </span>
                        )}
                      </td>
                      {h ? (
                        h.nilai.map((n, j) => (
                          <td key={j} className="px-2 py-2 text-center tabular-nums">{Math.round(n * 10) / 10}</td>
                        ))
                      ) : (
                        <td colSpan={11} className="px-2 py-2 text-center text-muted-foreground italic">
                          Belum dinilai
                        </td>
                      )}
                      <td className="px-2 py-2 text-center tabular-nums font-medium">
                        {h ? Math.round(h.total * 10) / 10 : '—'}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums font-bold">
                        {h ? h.rapot.toFixed(1) : '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {h ? (
                          <span className={cn('inline-block rounded px-1.5 py-0.5 font-medium whitespace-nowrap', LEVEL_TONE[h.level])}>
                            {h.level} · {h.predikat}
                          </span>
                        ) : '—'}
                      </td>
                      {mayInput && (
                        <td className="px-2 py-2 text-center">
                          <Link
                            href={`/kpi/isi?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                            aria-label={`Isi KPI ${r.fullName}`}
                            className="inline-flex p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
