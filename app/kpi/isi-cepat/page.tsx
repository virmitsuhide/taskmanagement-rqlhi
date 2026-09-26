import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canInputKpi, canViewKpi } from '@/lib/auth/permissions'
import { getKpiRows, KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { getSetoranGuruUnit } from '@/lib/data/setoran-guru'
import { terkunci } from '@/lib/kpi/alur'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TabelIsiCepat, type BarisTabelKpi } from '@/components/kpi/TabelIsiCepat'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

const PATH = '/kpi/isi-cepat'

/**
 * Isi cepat KPI — alternatif formulir per guru: nilai akhir tiap indikator
 * untuk seluruh guru satu unit di satu tabel. Hafalan Al-Qur'an & Tuhfatul
 * Athfal tetap dari Setoran Guru (kolom baca saja).
 */
export default async function IsiCepatKpiPage({ searchParams }: {
  searchParams: Promise<{ unit?: string; year?: string; month?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) >= 1 && Number(p.month) <= 12 ? Number(p.month) : now.getMonth() + 1
  const href = (ubah: { unit?: string; month?: number }) => `${PATH}?unit=${ubah.unit ?? unit}&year=${year}&month=${ubah.month ?? month}`

  const [rows, setoran] = await Promise.all([getKpiRows(unit, year, month), getSetoranGuruUnit(unit, year, month)])
  const isianSetoran = new Map(setoran.guru.map(g => [g.id, g.isian]))
  const baris: BarisTabelKpi[] = rows.map(r => {
    const s = isianSetoran.get(r.teacherId)
    return {
      teacherId: r.teacherId,
      nama: r.fullName,
      unit: r.entry?.unit ?? r.unit,
      terkunci: !!r.entry && terkunci(r.entry.status),
      entry: r.entry,
      setoran: { hafalan_juz: s?.hafalan_juz, hafalan_pages: s?.hafalan_pages, tuhfatul_bait: s?.tuhfatul_bait },
    }
  })

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Isi Cepat KPI" showBack ownH1 />
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <Link href={`/kpi?unit=${unit}&year=${year}&month=${month}`} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />Buat KPI
        </Link>
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Kinerja guru · isi per indikator</p>
          <h1 className="mt-2 text-3xl leading-tight md:text-4xl">Isi Cepat KPI</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            Ketik nilai akhir 0–100 tiap indikator untuk semua guru {KPI_UNITS.find(u => u.key === unit)?.label} di {MONTH_NAMES[month - 1]} {year},
            tanpa membuka formulir per guru. Sel yang dikosongkan dihitung dari rinciannya seperti biasa. Hafalan Al-Qur&apos;an &amp; Tuhfatul
            Athfal diambil dari <Link href={`/kpi/setoran-guru?unit=${unit}&year=${year}&month=${month}`} className="font-medium text-primary hover:underline">Setoran Guru</Link>.
          </p>
        </div>

        <div role="group" aria-label="Unit" className="mb-4 flex w-fit gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px]">
          {KPI_UNITS.map(u => (
            <Link key={u.key} href={href({ unit: u.key })} aria-current={unit === u.key ? 'page' : undefined}
              className={cn('whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {u.label}
            </Link>
          ))}
        </div>
        <div className="mb-5 flex gap-1 overflow-x-auto border-b pb-px">
          {MONTH_NAMES.map((m, i) => (
            <Link key={m} href={href({ month: i + 1 })}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
                month === i + 1 ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {m}
            </Link>
          ))}
        </div>

        {baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada guru aktif di unit ini.</p>
        ) : (
          <TabelIsiCepat key={`${unit}-${year}-${month}`} baris={baris} year={year} month={month} bolehIsi={canInputKpi(session.role)} unitParam={unit} />
        )}
      </div>
    </div>
  )
}
