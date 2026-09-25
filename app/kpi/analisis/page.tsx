import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ClipboardCheck, Gauge, LineChart, Scale, TrendingUp } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewKpi, canViewKpiBanding } from '@/lib/auth/permissions'
import { getKpiRows, getKpiTren, nilaiDari, KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { KPI_INDIKATOR } from '@/lib/kpi/hitung'
import { KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/kpi/alur'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Panel } from '@/components/dashboard/kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

/**
 * Analisis KPI Guru — bacaan, bukan isian.
 *
 * Halaman "Buat KPI" (/kpi) adalah tempat SDM mengisi dan mengelola rapor.
 * Halaman ini membaca data yang sama (getKpiRows + nilaiDari, tanpa kueri
 * baru) dan menjawab dua pertanyaan: siapa yang perlu didampingi, dan rapor
 * mana yang sudah bergerak di alur penerbitan. Tidak ada tombol yang
 * mengubah data di sini.
 */

interface PageProps {
  searchParams: Promise<{ unit?: string; year?: string; month?: string }>
}

const SINGKATAN = [
  'Hadir', 'Database', 'Hafalan', 'Tuhfatul', 'Bacaan', 'Seragam',
  'Lapor Ortu', 'Halaqoh', 'Buku Pgg', 'Perizinan', 'Pengganti',
]

/** Warna sel, mengikuti ambang tangga predikat (91 / 81 / 71 / 61). */
function nadaSel(n: number): string {
  if (n >= 91) return 'bg-primary text-primary-foreground'
  if (n >= 81) return 'bg-chart-2/35 text-foreground'
  if (n >= 71) return 'bg-primary-wash text-foreground'
  if (n >= 61) return 'bg-warning-wash text-warning'
  return 'bg-destructive-wash text-destructive'
}

const LEGENDA: { kelas: string; label: string }[] = [
  { kelas: 'bg-primary', label: '91–100' },
  { kelas: 'bg-chart-2/35', label: '81–90' },
  { kelas: 'bg-primary-wash', label: '71–80' },
  { kelas: 'bg-warning-wash', label: '61–70' },
  { kelas: 'bg-destructive-wash', label: '≤ 60' },
]

export default async function AnalisisKpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1

  const [rows, tren] = await Promise.all([getKpiRows(unit, year, month), getKpiTren(unit, year, month)])
  const dinilai = rows.filter(r => r.entry).map(r => ({ ...r, h: nilaiDari(r.entry!) }))

  // ── Alur rapor ──
  const hitung = (s: string[]) => dinilai.filter(r => s.includes(r.entry!.status ?? 'draft')).length
  const alur = [
    { label: 'Belum dinilai', n: rows.length - dinilai.length, nada: 'text-muted-foreground' },
    { label: 'Draf', n: hitung(['draft']), nada: 'text-foreground' },
    { label: 'Menunggu koordinator', n: hitung(['diajukan', 'dikembalikan']), nada: 'text-warning' },
    { label: 'Diterbitkan', n: hitung(['terbit', 'selesai']), nada: 'text-primary' },
    { label: 'Banding', n: hitung(['banding']), nada: 'text-warning' },
  ]

  // ── Indikator terlemah: rata-rata tiap indikator dari guru yang sudah dinilai ──
  const rataIndikator = KPI_INDIKATOR.map((nama, i) => ({
    nama,
    rata: dinilai.length ? dinilai.reduce((s, r) => s + r.h.nilai[i], 0) / dinilai.length : 0,
  }))
  const terlemah = [...rataIndikator].sort((a, b) => a.rata - b.rata).slice(0, 5)

  // ── Sebaran predikat ──
  const perLevel = new Map<number, { predikat: string; n: number }>()
  for (const r of dinilai) {
    const x = perLevel.get(r.h.level) ?? { predikat: r.h.predikat, n: 0 }
    x.n++
    perLevel.set(r.h.level, x)
  }
  const sebaran = [...perLevel.entries()].sort((a, b) => b[0] - a[0])

  const rataRata = dinilai.length ? dinilai.reduce((s, r) => s + r.h.rapot, 0) / dinilai.length : null

  // ── Tren: bulan pertama & terakhir yang punya data, untuk melihat indikator yang bergerak ──
  const trenBerisi = tren.filter(t => t.n > 0)
  const awalTren = trenBerisi[0]
  const akhirTren = trenBerisi[trenBerisi.length - 1]
  const gerakIndikator = awalTren && akhirTren && awalTren !== akhirTren
    ? KPI_INDIKATOR.map((nama, i) => ({ nama, selisih: akhirTren.indikator[i] - awalTren.indikator[i] }))
        .filter(g => Math.abs(g.selisih) >= 1)
        .sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih))
        .slice(0, 4)
    : []
  const banding = dinilai.filter(r => r.entry!.status === 'banding')
  const urut = [...dinilai].sort((a, b) => a.h.rapot - b.h.rapot)

  const href = (o: { unit?: string; month?: number; year?: number }) => {
    const q = new URLSearchParams({ unit: o.unit ?? unit, year: String(o.year ?? year), month: String(o.month ?? month) })
    return `/kpi/analisis?${q}`
  }
  const periode = `${MONTH_NAMES[month - 1]} ${year}`
  const namaUnit = KPI_UNITS.find(u => u.key === unit)?.label

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analisis KPI Guru" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Analisis KPI guru · {periode}</p>
            <h1 className="mt-2 text-3xl leading-tight md:text-4xl">
              Siapa yang perlu didampingi, dan rapor mana yang siap diterbitkan?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {namaUnit} · {dinilai.length} dari {rows.length} guru dinilai
              {rataRata !== null && <> · rata-rata rapot <b className="text-foreground">{rataRata.toFixed(1)}</b></>}
            </p>
          </div>
          <Button asChild>
            <Link href={`/kpi?unit=${unit}&year=${year}&month=${month}`}>
              <ClipboardCheck className="h-4 w-4" />Buat KPI
            </Link>
          </Button>
        </div>

        {/* Saringan: unit & bulan — sama dengan halaman Buat KPI. */}
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Unit" className="flex w-fit gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px]">
            {KPI_UNITS.map(u => (
              <Link key={u.key} href={href({ unit: u.key })}
                className={cn('whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {u.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {MONTH_NAMES.map((m, i) => (
              <Link key={m} href={href({ month: i + 1 })}
                className={cn('whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                  month === i + 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                {m.slice(0, 3)}
              </Link>
            ))}
          </div>
        </div>

        {/* Alur rapor — lima tahap berurutan. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {alur.map((a, i) => (
            <div key={a.label} className="rounded-2xl border bg-card p-4">
              <p className="text-[13px] font-medium text-muted-foreground">{i + 1} · {a.label}</p>
              <p className={cn('mt-2 font-heading text-4xl font-medium leading-none tabular-nums', a.n > 0 ? a.nada : 'text-muted-foreground')}>{a.n}</p>
            </div>
          ))}
        </div>

        {/* Tren 6 bulan — rata-rata rapot unit ini, bulan terpilih paling kanan. */}
        <Panel
          title="Tren 6 bulan"
          icon={<TrendingUp className="h-4 w-4" />}
          sub={`${namaUnit} · rata-rata rapot guru yang dinilai tiap bulan`}
        >
          {trenBerisi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada rapor KPI pada enam bulan terakhir.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="grid h-44 grid-cols-6 items-end gap-2 sm:gap-4">
                  {tren.map(t => {
                    const aktif = t.year === year && t.month === month
                    return (
                      <Link
                        key={`${t.year}-${t.month}`}
                        href={href({ year: t.year, month: t.month })}
                        className="group flex h-full flex-col items-center justify-end gap-1"
                        title={t.n ? `${MONTH_NAMES[t.month - 1]} ${t.year}: rata-rata ${t.rata!.toFixed(1)} dari ${t.n} guru` : `${MONTH_NAMES[t.month - 1]} ${t.year}: belum ada rapor`}
                      >
                        <span className="text-xs font-bold tabular-nums">{t.rata !== null ? t.rata.toFixed(1) : '—'}</span>
                        {t.rata !== null ? (
                          // Skala 50–100: rapot di bawah 50 jarang, dan skala dari nol
                          // membuat semua batang nyaris sama tinggi.
                          <span
                            className="w-full max-w-12 rounded-t-md transition-opacity group-hover:opacity-80"
                            style={{
                              height: `${Math.max(4, ((Math.max(50, t.rata) - 50) / 50) * 100)}%`,
                              background: aktif ? 'var(--primary)' : 'var(--chart-2)',
                            }}
                          />
                        ) : (
                          <span className="h-1 w-full max-w-12 rounded-full bg-muted" />
                        )}
                      </Link>
                    )
                  })}
                </div>
                <div className="mt-2 grid grid-cols-6 gap-2 border-t pt-2 sm:gap-4">
                  {tren.map(t => (
                    <div key={`${t.year}-${t.month}`} className="text-center">
                      <p className={cn('text-[13px] font-semibold', t.year === year && t.month === month ? 'text-primary' : '')}>
                        {MONTH_NAMES[t.month - 1].slice(0, 3)}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{t.n} guru</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Skala batang mulai dari 50. Ketuk bulan untuk membukanya.</p>
              </div>

              <div className="lg:col-span-4">
                <p className="mb-3 text-[13px] font-semibold">
                  Indikator yang paling bergerak
                  {awalTren && akhirTren && awalTren !== akhirTren && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {MONTH_NAMES[awalTren.month - 1].slice(0, 3)} → {MONTH_NAMES[akhirTren.month - 1].slice(0, 3)} {akhirTren.year}
                    </span>
                  )}
                </p>
                {trenBerisi.length < 2 ? (
                  <p className="text-sm text-muted-foreground">Butuh rapor dari minimal dua bulan untuk dibandingkan.</p>
                ) : gerakIndikator.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Semua indikator stabil (bergeser kurang dari 1 poin).</p>
                ) : (
                  <ul className="space-y-2">
                    {gerakIndikator.map(g => (
                      <li key={g.nama} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate">{g.nama}</span>
                        <span className={cn('shrink-0 font-bold tabular-nums', g.selisih > 0 ? 'text-success' : 'text-destructive')}>
                          {g.selisih > 0 ? '▲' : '▼'} {Math.abs(g.selisih).toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Panel
            className="lg:col-span-8"
            title="Rapor per guru"
            icon={<Gauge className="h-4 w-4" />}
            sub="11 indikator · nilai terendah di atas"
            action={{ href: `/kpi?unit=${unit}&year=${year}&month=${month}`, label: 'Buat / sunting KPI' }}
          >
            {urut.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
                Belum ada guru yang dinilai pada {periode}.
              </p>
            ) : (
              <>
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="px-1 py-2 text-left font-semibold">Guru</th>
                        {SINGKATAN.map((s, i) => (
                          <th key={s} className="px-1 py-2 text-center font-semibold" title={KPI_INDIKATOR[i]}>{s}</th>
                        ))}
                        <th className="px-1 py-2 text-center font-semibold">Rapot</th>
                        <th className="px-1 py-2 text-left font-semibold">Predikat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urut.map(r => (
                        <tr key={r.teacherId} className="border-t">
                          <td className="px-1 py-2">
                            <span className="block text-[13px] font-semibold">{r.fullName}</span>
                            {r.entry!.status && r.entry!.status !== 'draft' && (
                              <span className={cn('mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold', STATUS_TONE[r.entry!.status])}>
                                {STATUS_LABELS[r.entry!.status]}
                              </span>
                            )}
                          </td>
                          {r.h.nilai.map((n, j) => (
                            <td key={j} className="px-0.5 py-1.5 text-center">
                              <span className={cn('inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1 font-semibold tabular-nums', nadaSel(n))}>
                                {Math.round(n)}
                              </span>
                            </td>
                          ))}
                          <td className="px-1 py-2 text-center font-heading text-lg font-medium tabular-nums">{r.h.rapot.toFixed(1)}</td>
                          <td className="px-1 py-2">
                            <span className={cn('inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 font-semibold', KPI_LEVEL_TONE[r.h.level])}>
                              {r.h.predikat}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  {LEGENDA.map(l => (
                    <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn('h-3.5 w-3.5 rounded', l.kelas)} />{l.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <div className="min-w-0 space-y-6 lg:col-span-4">
            <Panel title="Indikator terlemah" icon={<LineChart className="h-4 w-4" />} sub={`Rata-rata ${dinilai.length} rapor terisi`}>
              {dinilai.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data.</p>
              ) : (
                <ul className="space-y-3">
                  {terlemah.map(t => (
                    <li key={t.nama} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-semibold">{t.nama}</span>
                        <span className={cn('font-bold tabular-nums', t.rata < 81 ? 'text-warning' : 'text-foreground')}>{t.rata.toFixed(0)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.rata)}%`, background: t.rata < 81 ? 'var(--accent-warm)' : 'var(--primary)' }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Sebaran predikat" icon={<Gauge className="h-4 w-4" />}>
              {sebaran.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data.</p>
              ) : (
                <ul className="space-y-2">
                  {sebaran.map(([level, x]) => (
                    <li key={level} className="flex items-center gap-3 text-[13px]">
                      <span className={cn('w-28 shrink-0 rounded-md px-2 py-1 font-semibold', KPI_LEVEL_TONE[level])}>{level} · {x.predikat}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${(x.n / dinilai.length) * 100}%` }} />
                      </span>
                      <b className="w-6 text-right tabular-nums">{x.n}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {canViewKpiBanding(session.role) && (
              <Panel title="Banding masuk" icon={<Scale className="h-4 w-4" />} action={{ href: '/kpi/banding', label: 'Putuskan' }}>
                {banding.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada banding pada {periode}.</p>
                ) : (
                  <ul className="-mx-2 divide-y">
                    {banding.map(r => (
                      <li key={r.teacherId}>
                        <Link href="/kpi/banding" className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{r.fullName}</span>
                            <span className="block text-xs text-muted-foreground">Rapot {r.h.rapot.toFixed(1)} · {r.h.predikat}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
