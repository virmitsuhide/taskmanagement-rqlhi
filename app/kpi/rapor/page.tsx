import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewKpi } from '@/lib/auth/permissions'
import { getRaporSemester, KPI_UNITS, MONTH_NAMES, SEMESTER_MONTHS } from '@/lib/data/kpi'
import { levelDari } from '@/lib/kpi/hitung'
import { KPI_LEVELS } from '@/lib/kpi/parameter'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; year?: string; semester?: string }>
}

const LEVEL_TONE: Record<number, string> = {
  5: 'bg-success-wash text-success',
  4: 'bg-primary-wash text-primary',
  3: 'bg-warning-wash text-warning',
  2: 'bg-destructive-wash text-destructive',
  1: 'bg-destructive-wash text-destructive',
}

export default async function RaporSemesterPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const semester = p.semester === 'genap' ? 'genap' : 'ganjil'
  const months = SEMESTER_MONTHS[semester]

  const rows = await getRaporSemester(unit, year, semester)
  const terisi = rows.filter(r => r.rataRata !== null)

  const href = (o: { unit?: string; year?: number; semester?: string }) =>
    `/kpi/rapor?unit=${o.unit ?? unit}&year=${o.year ?? year}&semester=${o.semester ?? semester}`

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Rapor Semester Guru" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <Link
          href={`/kpi?unit=${unit}&year=${year}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke KPI bulanan
        </Link>

        <h1 className="text-2xl font-bold leading-tight">Rapor Semester Guru Qur&apos;an</h1>
        <p className="text-sm text-muted-foreground mt-0.5 mb-5">
          Semester {semester === 'ganjil' ? 'Ganjil' : 'Genap'} {year} · {KPI_UNITS.find(u => u.key === unit)?.label}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
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
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['ganjil', 'genap'] as const).map(s => (
              <Link
                key={s}
                href={href({ semester: s })}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
                  semester === s ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {[year - 1, year, year + 1].map(y => (
              <Link
                key={y}
                href={href({ year: y })}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium tabular-nums transition-colors',
                  year === y ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Rata-rata dihitung hanya dari bulan yang sudah dinilai. Bulan yang belum diisi tidak
          dihitung sebagai nol — guru yang baru dinilai dua bulan bukan berarti kinerjanya sepertiga.
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada guru aktif di unit ini.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium w-8">#</th>
                    <th className="px-2 py-2 text-left font-medium min-w-[220px]">Nama Guru</th>
                    {months.map(m => (
                      <th key={m} className="px-2 py-2 text-center font-medium">{MONTH_NAMES[m - 1].slice(0, 3)}</th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium">Bulan Terisi</th>
                    <th className="px-2 py-2 text-center font-medium">Rata-rata</th>
                    <th className="px-2 py-2 text-center font-medium">Predikat</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const byMonth = new Map(r.perBulan.map(x => [x.month, x.rapot]))
                    const lv = r.rataRata !== null ? levelDari(r.rataRata) : null
                    return (
                      <tr key={r.teacherId} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-2 py-2 font-medium">{r.fullName}</td>
                        {months.map(m => {
                          const v = byMonth.get(m)
                          return (
                            <td key={m} className={cn('px-2 py-2 text-center tabular-nums', v === undefined && 'text-muted-foreground/40')}>
                              {v === undefined ? '·' : v.toFixed(1)}
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                          {r.perBulan.length}/{months.length}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums font-bold">
                          {r.rataRata !== null ? r.rataRata.toFixed(1) : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {lv ? (
                            <span className={cn('inline-block rounded px-1.5 py-0.5 font-medium whitespace-nowrap', LEVEL_TONE[lv.level])}>
                              {lv.level} · {lv.predikat}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-muted-foreground tabular-nums">
              <b className="text-foreground">{terisi.length}</b> dari <b className="text-foreground">{rows.length}</b> guru sudah punya nilai di semester ini.
            </p>

            <section className="mt-6">
              <h2 className="text-sm font-semibold mb-2">Skala Level & Tindak Lanjut</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Level</th>
                      <th className="px-3 py-2 text-left font-medium">Rentang</th>
                      <th className="px-3 py-2 text-left font-medium">Predikat</th>
                      <th className="px-3 py-2 text-left font-medium">Tindak Lanjut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KPI_LEVELS.map(l => (
                      <tr key={l.level} className="border-t">
                        <td className="px-3 py-2">
                          <span className={cn('inline-block rounded px-1.5 py-0.5 font-medium', LEVEL_TONE[l.level])}>{l.level}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.min} – {l.max}</td>
                        <td className="px-3 py-2 font-medium">{l.predikat}</td>
                        <td className="px-3 py-2 text-muted-foreground">{l.tindakLanjut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
