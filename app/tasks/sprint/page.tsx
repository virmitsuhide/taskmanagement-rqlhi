import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, GanttChartSquare, LayoutGrid, ListChecks, Sparkles } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { ROLE_LABELS, canEditSprintJabatan, getSprintJabatan, isProductOwner } from '@/lib/auth/permissions'
import { getRingkasanSprint, getSprintJabatan as getDataSprintJabatan, type RingkasJabatan } from '@/lib/data/sprint'
import { akhirPeriode, bolehDitutup, geserPeriode, labelPeriode, parsePeriode, periodeDari, type FaseSprint } from '@/lib/tasks/sprint'
import { daysBetween, today } from '@/lib/tasks/gantt'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { DaftarKomitmen, DaftarSaran, FormReview, KartuGoal, TombolTutupSprint } from '@/components/tasks/sprint/SprintPanels'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string; jabatan?: string }>
}

const FASE: Record<FaseSprint, { label: string; warna: string; wash: string }> = {
  perencanaan:        { label: 'Perencanaan',        warna: 'var(--info)',             wash: 'var(--info-wash)' },
  berjalan:           { label: 'Berjalan',           warna: 'var(--success)',          wash: 'var(--success-wash)' },
  menunggu_penutupan: { label: 'Menunggu penutupan', warna: 'var(--warning)',          wash: 'var(--warning-wash)' },
  ditutup:            { label: 'Ditutup',            warna: 'var(--muted-foreground)', wash: 'var(--muted)' },
}

/**
 * Sprint bulanan — janji sebulan yang diambil dari Gantt.
 *
 * Satu halaman untuk ketiga momen Scrum: perencanaan (goal & komitmen),
 * pemantauan (komitmen vs selesai, dependensi yang bentrok), dan review
 * (hasil goal & retrospektif). Periode & jabatan di query string supaya
 * tautannya bisa dibagikan di rapat apa adanya.
 */
export default async function SprintPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  const jabatanBoleh = getSprintJabatan(session.role)
  if (jabatanBoleh.length === 0) redirect('/rapat')

  const params = await searchParams
  const hariIni = today()
  const periodeIni = periodeDari(hariIni)
  const periode = parsePeriode(params.periode) ?? periodeIni
  const jabatan = jabatanBoleh.find(j => j === params.jabatan) ?? session.role
  const pemantau = jabatanBoleh.length > 1
  const po = isProductOwner(session.role)

  const [data, ringkasan] = await Promise.all([
    getDataSprintJabatan(periode, jabatan, session),
    pemantau ? getRingkasanSprint(periode, jabatanBoleh) : Promise.resolve(null),
  ])
  const { sprint } = data
  const terkunci = sprint.fase === 'ditutup'
  const bisaUbah = canEditSprintJabatan(session.role, jabatan)
  const fase = FASE[sprint.fase]
  const sisaHari = sprint.fase === 'berjalan' ? daysBetween(hariIni, akhirPeriode(periode)) : null
  const rataSelesai = data.riwayat.length > 0 ? data.riwayat.reduce((t, r) => t + r.selesaiPoin, 0) / data.riwayat.length : null
  const bolehSusun = periode >= geserPeriode(periodeIni, -1) && periode <= geserPeriode(periodeIni, 1)
  const href = (p: string, j: UserRole = jabatan) =>
    `/tasks/sprint?periode=${p.slice(0, 7)}${j !== session.role ? `&jabatan=${j}` : ''}`

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName} role={session.role} title="Sprint Bulanan" showBack ownH1
        breadcrumbs={[{ label: 'Tugas', href: '/tasks' }, { label: 'Sprint Bulanan' }]}
      />
      <div className="flex-1 bg-muted/50 p-4 dark:bg-background md:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Sprint Bulanan · Product Owner: Kepala RQ</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={href(geserPeriode(periode, -1))} aria-label="Bulan sebelumnya" className="rounded-md p-1 hover:bg-muted"><ChevronLeft className="h-5 w-5" /></Link>
                <h1 className="text-2xl font-bold leading-tight">Sprint {labelPeriode(periode)}</h1>
                <Link href={href(geserPeriode(periode, 1))} aria-label="Bulan berikutnya" className="rounded-md p-1 hover:bg-muted"><ChevronRight className="h-5 w-5" /></Link>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: fase.wash, color: fase.warna }}>{fase.label}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {sprint.fase === 'berjalan' && `Sisa ${sisaHari} hari. `}
                {sprint.fase === 'perencanaan' && 'Susun Sprint Goal & tugas yang disanggupi sebelum bulannya mulai. '}
                {sprint.fase === 'menunggu_penutupan' && 'Bulannya sudah lewat — isi review, lalu Kepala RQ menutup sprint. '}
                {terkunci && 'Sudah dipotret; angka di halaman ini tidak berubah lagi. '}
                {periode !== periodeIni && <Link href={href(periodeIni)} className="text-primary hover:underline">Ke sprint bulan ini</Link>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link href="/tasks/board"><LayoutGrid className="mr-1 h-4 w-4" />Papan</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/tasks/gantt"><GanttChartSquare className="mr-1 h-4 w-4" />Gantt</Link></Button>
            </div>
          </div>

          {!data.tabelAda && (
            <div className="flex gap-2 rounded-xl border p-4 text-sm" style={{ background: 'var(--warning-wash)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />
              <p>Fitur sprint belum aktif — jalankan <code>drizzle/0072_sprint_bulanan_PASTE_TO_SUPABASE.sql</code> di Supabase SQL Editor.</p>
            </div>
          )}

          {ringkasan && (
            <section className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Ringkasan Semua Jabatan</h2>
                  <p className="text-xs text-muted-foreground">Poin selesai dari poin yang disanggupi. Selesai = sudah diverifikasi pemberi tugas.</p>
                </div>
                {po && data.tabelAda && bolehDitutup(periode, hariIni, sprint.ditutupAt) && sprint.id && (
                  <TombolTutupSprint periode={periode} label={labelPeriode(periode)} />
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Jabatan</th>
                      <th className="px-2 py-2 font-medium">Sprint Goal</th>
                      <th className="px-2 py-2 font-medium w-[26%]">Komitmen</th>
                      <th className="px-2 py-2 text-right font-medium">Terbawa</th>
                      <th className="px-2 py-2 text-right font-medium">Bentrok</th>
                      <th className="py-2 pl-2 font-medium">Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ringkasan.baris.map(b => <BarisRingkasan key={b.jabatan} b={b} aktif={b.jabatan === jabatan} href={href(periode, b.jabatan)} />)}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <KartuGoal
            key={`goal-${periode}-${jabatan}-${data.goal?.goal ?? ''}-${data.goal?.disahkanAt ?? ''}`}
            periode={periode} jabatan={jabatan} labelJabatan={ROLE_LABELS[jabatan]} goal={data.goal}
            bisaUbah={bisaUbah && data.tabelAda && bolehSusun} productOwner={po && data.tabelAda && bolehSusun} terkunci={terkunci}
          />

          <section className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" /> Tugas yang Disanggupi</h2>
              {data.ringkas.jumlah > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {data.ringkas.selesai}/{data.ringkas.jumlah} tugas · {data.ringkas.selesaiPoin}/{data.ringkas.komitmenPoin} poin
                  {data.ringkas.tengahSprint > 0 && ` · ${data.ringkas.tengahSprint} masuk tengah sprint`}
                </span>
              )}
            </div>
            {data.ringkas.persen !== null && (
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${data.ringkas.persen}%`, background: 'var(--primary)' }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold tabular-nums">{data.ringkas.persen}%</span>
              </div>
            )}
            <DaftarKomitmen items={data.items} dependensi={data.dependensi} bisaUbah={bisaUbah && bolehSusun && data.tabelAda} terkunci={terkunci} />
          </section>

          {bisaUbah && !terkunci && data.tabelAda && bolehSusun && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" /> Saran dari Gantt</h2>
              <DaftarSaran periode={periode} saran={data.saran} dependensi={data.dependensi} komitmenPoin={data.ringkas.komitmenPoin} rataSelesai={rataSelesai} />
            </section>
          )}

          {sprint.fase !== 'perencanaan' && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Review &amp; Retrospektif · {ROLE_LABELS[jabatan]}</h2>
              <FormReview
                key={`review-${periode}-${jabatan}`}
                periode={periode} jabatan={jabatan} goal={data.goal}
                bisaUbah={bisaUbah && data.tabelAda && bolehSusun} terkunci={terkunci}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

const HASIL: Record<NonNullable<RingkasJabatan['hasil']>, { label: string; warna: string }> = {
  tercapai: { label: 'Tercapai', warna: 'var(--success)' },
  sebagian: { label: 'Sebagian', warna: 'var(--warning)' },
  tidak: { label: 'Tidak', warna: 'var(--destructive)' },
}

function BarisRingkasan({ b, aktif, href }: { b: RingkasJabatan; aktif: boolean; href: string }) {
  return (
    <tr className={cn('border-b last:border-0', aktif && 'bg-primary/5')}>
      <td className="py-2 pr-2 whitespace-nowrap">
        <Link href={href} scroll={false} className="font-medium hover:underline">{ROLE_LABELS[b.jabatan]}</Link>
      </td>
      <td className="px-2 py-2">
        {b.goal ? (
          <span className="line-clamp-2 text-xs" title={b.goal}>
            {b.disahkan ? '✓ ' : '⏳ '}{b.goal}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">belum ditulis</span>
        )}
      </td>
      <td className="px-2 py-2">
        {b.ringkas.persen === null ? (
          <span className="text-xs text-muted-foreground">belum menyanggupi</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${b.ringkas.persen}%`, background: 'var(--primary)' }} />
            </div>
            <span className="w-16 text-right text-[11px] tabular-nums text-muted-foreground">{b.ringkas.selesaiPoin}/{b.ringkas.komitmenPoin} poin</span>
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-xs">{b.terbawa > 0 ? <span style={{ color: 'var(--warning)' }}>{b.terbawa}</span> : '—'}</td>
      <td className="px-2 py-2 text-right tabular-nums text-xs">{b.bentrok > 0 ? <span style={{ color: 'var(--destructive)' }}>{b.bentrok}</span> : '—'}</td>
      <td className="py-2 pl-2 text-xs">
        {b.hasil ? <span style={{ color: HASIL[b.hasil].warna }}>{HASIL[b.hasil].label}</span> : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  )
}
