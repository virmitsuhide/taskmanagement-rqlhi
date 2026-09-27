import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canViewKpi, canInputKpi, canPrintKpiRapor, canResetKpiRapor,
  canAccessKpiPublikasi, canViewKpiBanding, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getKpiRows, nilaiDari, KPI_UNITS, MONTH_NAMES } from '@/lib/data/kpi'
import { getBandingAktifPer } from '@/lib/data/kpi-banding'
import { KPI_INDIKATOR } from '@/lib/kpi/hitung'
import { KPI_LEVEL_TONE } from '@/lib/kpi/parameter'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { AlertCircle, BookMarked, CalendarDays, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Printer, Search, Table2 } from 'lucide-react'
import { AjukanSatu, AlurPanel, type RingkasAlur } from './AlurPanel'
import { ResetRaporButton } from './ResetRaporButton'
import { STATUS_LABELS, STATUS_TONE, keteranganRapor } from '@/lib/kpi/alur'
import { cn } from '@/lib/utils'
import type { Jenjang, KpiRaporStatus } from '@/types'

interface PageProps {
  searchParams: Promise<{ unit?: string; year?: string; month?: string; saring?: string; tampil?: string; q?: string }>
}

/**
 * Singkatan kolom indikator (tampilan tabel rinci). Nama penuhnya tetap
 * terbaca lewat atribut title.
 */
const SINGKATAN = [
  'Hadir', 'Database', 'Hafalan', 'Tuhfatul', 'Bacaan', 'Seragam',
  'Lapor Ortu', 'Halaqoh', 'Buku Pgg', 'Perizinan', 'Pengganti',
]

const SARING = ['semua', 'belum', 'draft', 'diajukan', 'dikembalikan', 'terbit', 'banding', 'selesai'] as const
type Saring = (typeof SARING)[number]
const LABEL_SARING: Record<Saring, string> = {
  semua: 'Semua', belum: 'Belum dinilai', draft: 'Draf', diajukan: 'Menunggu koordinator',
  dikembalikan: 'Dikembalikan', terbit: 'Dipublikasikan', banding: 'Banding', selesai: 'Selesai',
}

/**
 * Buat KPI — SDM mengisi nilai tiap guru lalu mengajukan rapornya ke
 * koordinator unit. Tampilan ringkas: satu baris per guru dengan 11 kotak
 * warna indikator; klik baris untuk rinciannya. Tabel 17 kolom tetap ada
 * sebagai "Tabel rinci".
 */
export default async function KpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const unit = (KPI_UNITS.find(u => u.key === p.unit)?.key ?? 'sd') as Jenjang
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1
  const saring: Saring = SARING.includes(p.saring as Saring) ? (p.saring as Saring) : 'semua'
  const tabel = p.tampil === 'tabel'
  const q = (p.q ?? '').trim().toLowerCase()

  const rows = await getKpiRows(unit, year, month)

  // Tenggat putusan banding, satu kueri untuk seluruh daftar — lihat getBandingAktifPer().
  const banding = await getBandingAktifPer(
    rows.filter(r => r.entry?.status === 'banding').map(r => r.entry!.id),
  )

  const mayInput = canInputKpi(session.role)
  // Mencetak rapor lebih sempit daripada mengisinya: SDM yang menerbitkannya.
  const mayPrint = canPrintKpiRapor(session.role)
  // Menghapus penilaian: Kepala RQ saja, dan hanya pada baris yang sudah berisi.
  const mayReset = canResetKpiRapor(session.role)

  // Bahan panel alur — hanya guru yang sudah punya baris rapor.
  const ringkasAlur: RingkasAlur[] = rows
    .filter(r => r.entry)
    .map(r => ({ kpiId: r.entry!.id, fullName: r.fullName, status: r.entry!.status ?? 'draft' }))

  // Rata-rata hanya dari guru yang sudah dinilai (yang belum diisi bukan nol).
  const dinilai = rows.filter(r => r.entry)
  const rataRata = dinilai.length
    ? dinilai.reduce((s, r) => s + nilaiDari(r.entry!).rapot, 0) / dinilai.length
    : null
  const belum = rows.length - dinilai.length
  const siapAju = dinilai.filter(r => (r.entry!.status ?? 'draft') === 'draft' || r.entry!.status === 'dikembalikan').length

  // Rata-rata tiap indikator bulan ini, terendah dulu — bahan pembinaan.
  const rataIndikator = dinilai.length
    ? KPI_INDIKATOR.map((nama, i) => ({ nama, nilai: dinilai.reduce((s, r) => s + nilaiDari(r.entry!).nilai[i], 0) / dinilai.length }))
      .sort((a, b) => a.nilai - b.nilai)
    : []

  const statusOf = (r: (typeof rows)[number]): Saring => (r.entry ? (r.entry.status ?? 'draft') as Saring : 'belum')
  const hitung = (s: Saring) => (s === 'semua' ? rows.length : rows.filter(r => statusOf(r) === s).length)
  const tampil = rows
    .filter(r => saring === 'semua' || statusOf(r) === saring)
    .filter(r => !q || r.fullName.toLowerCase().includes(q))

  const href = (o: { unit?: string; year?: number; month?: number; saring?: string; tampil?: string | null }) => {
    const u = new URLSearchParams({
      unit: o.unit ?? unit,
      year: String(o.year ?? year),
      month: String(o.month ?? month),
    })
    const s = o.saring ?? saring
    if (s !== 'semua') u.set('saring', s)
    const t = o.tampil === undefined ? (tabel ? 'tabel' : null) : o.tampil
    if (t) u.set('tampil', t)
    return `/kpi?${u}`
  }
  const geser = (n: number) => {
    const d = new Date(Date.UTC(year, month - 1 + n, 1))
    return href({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 })
  }
  const hrefTahap = Object.fromEntries(SARING.map(s => [s, href({ saring: s })]))
  const namaUnit = KPI_UNITS.find(u => u.key === unit)?.label ?? ''

  const judul = rows.length === 0
    ? null
    : belum > 0
      ? <>{belum} guru belum dinilai{siapAju > 0 ? <>, <i>{siapAju} draf siap diajukan.</i></> : '.'}</>
      : siapAju > 0 ? <>Semua guru sudah dinilai — <i>{siapAju} draf siap diajukan.</i></> : <>Semua guru sudah dinilai.</>

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Buat KPI" showBack ownH1 />
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Kinerja guru</p>
            <h1 className="mt-2 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">
              Buat KPI{judul && <> — {judul}</>}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
              {namaUnit} · {MONTH_NAMES[month - 1]} {year} · <b className="text-foreground">{dinilai.length}</b> dari <b className="text-foreground">{rows.length}</b> guru dinilai
              {rataRata !== null && <> · rata-rata rapot <b className="text-foreground">{rataRata.toFixed(1)}</b></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Unit" className="flex gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px]">
              {KPI_UNITS.map(u => (
                <Link key={u.key} href={href({ unit: u.key, saring: 'semua' })} aria-current={unit === u.key ? 'page' : undefined}
                  className={cn('whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
                    unit === u.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {u.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Link href={geser(-1)} aria-label="Bulan sebelumnya" className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Link>
              <span className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-bold tabular-nums">
                <CalendarDays className="h-4 w-4 text-primary" />{MONTH_NAMES[month - 1]} {year}
              </span>
              <Link href={geser(1)} aria-label="Bulan berikutnya" className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card hover:bg-muted"><ChevronRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/kpi/isi-cepat?unit=${unit}&year=${year}&month=${month}`}><Table2 className="mr-1 h-4 w-4" />Isi cepat per indikator</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/kpi/setoran-guru?unit=${unit}&year=${year}&month=${month}`}><BookMarked className="mr-1 h-4 w-4" />Setoran guru</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/kpi/rapor?unit=${unit}&year=${year}`}><FileText className="mr-1 h-4 w-4" />Rapor semester</Link>
          </Button>
        </div>

        <AlurPanel
          rows={ringkasAlur}
          belumDinilai={belum}
          bisaAjukan={mayInput}
          bisaPublikasi={canAccessKpiPublikasi(session.role)}
          bisaBanding={canViewKpiBanding(session.role)}
          unit={unit}
          year={year}
          month={month}
          hrefTahap={hrefTahap}
        />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada guru aktif di unit ini.</p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="space-y-3 px-4 pb-3 pt-4 md:px-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex-1 font-heading text-[22px] leading-tight">Guru {namaUnit}</h2>
                <form action="/kpi" className="flex h-9 w-full items-center gap-2 rounded-xl border bg-background px-3 sm:w-60">
                  <input type="hidden" name="unit" value={unit} />
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  {saring !== 'semua' && <input type="hidden" name="saring" value={saring} />}
                  {tabel && <input type="hidden" name="tampil" value="tabel" />}
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input name="q" defaultValue={p.q ?? ''} placeholder="Cari guru" aria-label="Cari guru" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </form>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SARING.filter(s => s === 'semua' || s === saring || hitung(s) > 0).map(s => (
                  <Link key={s} href={href({ saring: s })} aria-current={saring === s ? 'page' : undefined}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
                      saring === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                    {LABEL_SARING[s]} <span className="tabular-nums opacity-70">{hitung(s)}</span>
                  </Link>
                ))}
                <span className="flex-1" />
                <div role="group" aria-label="Tampilan" className="flex rounded-[10px] bg-muted p-[3px]">
                  {[{ l: 'Ringkas', t: null }, { l: 'Tabel rinci', t: 'tabel' }].map(o => (
                    <Link key={o.l} href={href({ tampil: o.t })} aria-current={(o.t === 'tabel') === tabel ? 'page' : undefined}
                      className={cn('rounded-[7px] px-3 py-1 text-xs font-semibold', (o.t === 'tabel') === tabel ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                      {o.l}
                    </Link>
                  ))}
                </div>
              </div>
              {!tabel && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
                  {[[95, '≥ 91 Sangat baik'], [85, '81–90 Baik'], [75, '71–80 Cukup'], [65, '61–70 Kurang'], [50, '≤ 60 Sangat kurang']].map(([n, t]) => (
                    <span key={t} className="inline-flex items-center gap-1.5"><span className={cn('h-3.5 w-3.5 rounded border', nadaSel(n as number))} />{t}</span>
                  ))}
                  <span>· arahkan kursor ke kotak untuk nama &amp; nilai indikator</span>
                </div>
              )}
            </div>

            {tampil.length === 0 ? (
              <p className="border-t px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada guru yang cocok dengan saringan ini.</p>
            ) : tabel ? (
              <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold w-8">#</th>
                  <th className="px-2 py-2.5 text-left font-semibold min-w-[200px]">Nama Guru</th>
                  {SINGKATAN.map((s, i) => (
                    <th key={s} className="px-2 py-2 text-center font-medium whitespace-nowrap" title={KPI_INDIKATOR[i]}>
                      {s}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium">Total</th>
                  <th className="px-2 py-2 text-center font-medium">Rapot</th>
                  <th className="px-2 py-2 text-center font-medium">Predikat</th>
                  {(mayInput || mayPrint || mayReset) && (
                    <th className="px-2 py-2 text-center font-medium w-16">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {tampil.map((r, i) => {
                  const h = r.entry ? nilaiDari(r.entry) : null
                  return (
                    <tr key={r.teacherId} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2.5 font-semibold">
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
                        {/*
                          Status alur ditempelkan pada nama, bukan diberi kolom
                          sendiri: tabelnya sudah tujuh belas kolom, dan kolom
                          ke-18 akan mendorong indikator ke luar layar. 'draft'
                          sengaja tidak dilencanai — itu keadaan biasa, dan
                          lencana yang muncul di semua baris berhenti dibaca.
                        */}
                        {r.entry && r.entry.status && r.entry.status !== 'draft' && (
                          <>
                            <span className={cn(
                              'ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
                              STATUS_TONE[r.entry.status],
                            )}>
                              {STATUS_LABELS[r.entry.status]}
                            </span>
                            {/*
                              Keterangannya diberi baris sendiri di bawah nama,
                              bukan disambung ke lencana. Kalimatnya sepanjang
                              satu tarikan napas — "dipublikasikan 12 Sep ·
                              belum dibuka guru · sisa 2 hari banding" — dan
                              menyambungnya ke lencana akan melebarkan kolom
                              nama sampai indikatornya terdorong ke luar layar,
                              persoalan yang sama yang membuat statusnya tidak
                              diberi kolom sendiri.
                            */}
                            {/*
                              Banding yang tenggat putusannya lewat diwarnai
                              merah, bukan abu-abu seperti keterangan lain.
                              Inilah satu-satunya keadaan di tabel ini yang
                              berarti seseorang sedang menunggu jawaban yang
                              melampaui janjinya — dan yang terlambat tidak
                              boleh terbaca sama tenangnya dengan yang berjalan
                              normal.
                            */}
                            <span className={cn(
                              'mt-0.5 block text-[10px] font-normal',
                              banding.get(r.entry.id)?.terlambat
                                ? 'font-medium text-destructive'
                                : 'text-muted-foreground',
                            )}>
                              {keteranganRapor({
                                status: r.entry.status,
                                selesaiSebab: r.entry.selesai_sebab ?? null,
                                terbitAt: r.entry.terbit_at ?? null,
                                bandingBatas: r.entry.banding_batas ?? null,
                                dibuka: Boolean(r.entry.guru_dibuka_at),
                                banding: banding.get(r.entry.id) ?? null,
                              })}
                            </span>
                            {/*
                              Alasan pengembalian ditampilkan utuh, bukan
                              dipotong: inilah satu-satunya kalimat yang
                              memberitahu SDM apa yang harus dibetulkan, dan
                              yang terpotong menjadi keberatan yang harus
                              ditebak.
                            */}
                            {r.entry.status === 'dikembalikan' && r.entry.dikembalikan_alasan && (
                              <span className="mt-0.5 block text-[10px] font-normal text-destructive">
                                &ldquo;{r.entry.dikembalikan_alasan}&rdquo;
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      {h ? (
                        h.nilai.map((n, j) => (
                          <td key={j} className="px-1 py-1.5 text-center">
                            {/* Sel berwarna menurut rentang nilai — sama dengan tangga predikat. */}
                            <span className={cn('inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1 font-semibold tabular-nums', nadaSel(n))}>
                              {Math.round(n * 10) / 10}
                            </span>
                          </td>
                        ))
                      ) : (
                        <td colSpan={11} className="px-2 py-2 text-center text-muted-foreground italic">
                          Belum dinilai
                        </td>
                      )}
                      <td className="px-2 py-2 text-center tabular-nums font-medium">
                        {h ? Math.round(h.total * 10) / 10 : '—'}
                      </td>
                      <td className="px-2 py-2 text-center font-heading text-lg font-medium tabular-nums">
                        {h ? h.rapot.toFixed(1) : '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {h ? (
                          <span className={cn('inline-block rounded px-1.5 py-0.5 font-medium whitespace-nowrap', KPI_LEVEL_TONE[h.level])}>
                            {h.level} · {h.predikat}
                          </span>
                        ) : '—'}
                      </td>
                      {(mayInput || mayPrint || mayReset) && (
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center gap-0.5">
                            {mayInput && (
                              <Link
                                href={`/kpi/isi?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                                aria-label={`Isi KPI ${r.fullName}`}
                                title="Isi / sunting nilai"
                                className="inline-flex p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            {/*
                              Hanya muncul kalau gurunya memang sudah dinilai.
                              Tautan cetak pada baris kosong akan mengantar ke
                              halaman yang cuma bisa berkata "belum ada nilai" —
                              lebih baik tombolnya tidak ada sejak awal.
                            */}
                            {mayPrint && h && (
                              <Link
                                href={`/kpi/cetak?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                                aria-label={`Cetak rapor KPI ${r.fullName}`}
                                title="Cetak rapor bulanan (PDF)"
                                className="inline-flex p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            {/*
                              Menghapus penilaian duduk di baris orangnya, bukan
                              di panel atas: yang dihapus adalah pekerjaan satu
                              guru selama sebulan, dan sasaran yang jauh dari
                              mata adalah sasaran yang bisa keliru.
                            */}
                            {mayReset && h && r.entry && (
                              <ResetRaporButton
                                kpiId={r.entry.id}
                                fullName={r.fullName}
                                status={r.entry.status ?? 'draft'}
                                rapot={h.rapot}
                              />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(0,1fr)_236px_190px_104px] gap-4 border-t px-5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground lg:grid">
                  <span>Guru</span><span>11 indikator</span><span>Rapot</span><span />
                </div>
                <ul>
                  {tampil.map(r => {
                    const h = r.entry ? nilaiDari(r.entry) : null
                    const st = r.entry?.status ?? 'draft'
                    const inisial = r.fullName.replace(/^(Ust\.?|Ustzh\.?|Ustadz|Ustadzah)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
                    const nama = (
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-wash text-xs font-bold text-primary">{inisial}</span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold">{r.fullName}</span>
                            {!r.entry
                              ? <span className="rounded bg-accent-warm-wash px-1.5 py-0.5 text-[10px] font-semibold text-accent-warm">Belum dinilai</span>
                              : st !== 'draft' && <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_TONE[st as KpiRaporStatus])}>{STATUS_LABELS[st as KpiRaporStatus]}</span>}
                            {r.pindahKe && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">kini di {JENJANG_LABELS[r.pindahKe]}</span>}
                          </span>
                          {r.entry && st !== 'draft' && (
                            <span className={cn('block truncate text-xs', banding.get(r.entry.id)?.terlambat || st === 'dikembalikan' ? 'text-destructive' : 'text-muted-foreground')}>
                              {st === 'dikembalikan' && r.entry.dikembalikan_alasan
                                ? <>&ldquo;{r.entry.dikembalikan_alasan}&rdquo;</>
                                : keteranganRapor({
                                  status: st as KpiRaporStatus,
                                  selesaiSebab: r.entry.selesai_sebab ?? null,
                                  terbitAt: r.entry.terbit_at ?? null,
                                  bandingBatas: r.entry.banding_batas ?? null,
                                  dibuka: Boolean(r.entry.guru_dibuka_at),
                                  banding: banding.get(r.entry.id) ?? null,
                                })}
                            </span>
                          )}
                          {r.entry && st === 'draft' && <span className="block text-xs text-muted-foreground">Draf — belum diajukan</span>}
                        </span>
                      </span>
                    )
                    if (!h || !r.entry) {
                      return (
                        <li key={r.teacherId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t px-4 py-3 md:px-5 lg:grid-cols-[minmax(0,1fr)_236px_190px_104px]">
                          {nama}
                          <span className="hidden h-7 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground lg:flex">11 indikator belum diisi</span>
                          <span className="hidden text-sm text-muted-foreground lg:block">—</span>
                          <span className="flex justify-end">
                            {mayInput && (
                              <Link href={`/kpi/isi?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}
                                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent-warm px-3.5 text-[13px] font-bold text-white hover:opacity-90">
                                <Plus className="h-3.5 w-3.5" />Isi nilai
                              </Link>
                            )}
                          </span>
                        </li>
                      )
                    }
                    const urut = h.nilai.map((n, i) => ({ n, i })).sort((a, b) => a.n - b.n)
                    const bolehAju = mayInput && (st === 'draft' || st === 'dikembalikan')
                    return (
                      <li key={r.teacherId} className="border-t">
                        <details className="group">
                          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/30 md:px-5 lg:grid-cols-[minmax(0,1fr)_236px_190px_104px] [&::-webkit-details-marker]:hidden">
                            {nama}
                            <span className="order-last col-span-2 flex gap-[3px] lg:order-none lg:col-span-1" role="img" aria-label={`Nilai 11 indikator ${r.fullName}`}>
                              {h.nilai.map((n, j) => (
                                <span key={j} title={`${KPI_INDIKATOR[j]}: ${Math.round(n * 10) / 10}`} className={cn('h-[26px] flex-1 rounded border lg:w-[18px] lg:flex-none', nadaSel(n))} />
                              ))}
                            </span>
                            <span className="flex items-baseline gap-2">
                              <span className="font-heading text-2xl leading-none tabular-nums">{h.rapot.toFixed(1)}</span>
                              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', KPI_LEVEL_TONE[h.level])}>L{h.level} · {h.predikat}</span>
                            </span>
                            <span className="hidden justify-end gap-1 lg:flex">
                              {mayInput && (
                                <Link href={`/kpi/isi?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`} aria-label={`Isi KPI ${r.fullName}`} title="Isi / sunting nilai"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-primary"><Pencil className="h-3.5 w-3.5" /></Link>
                              )}
                              {mayPrint && (
                                <Link href={`/kpi/cetak?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`} aria-label={`Cetak rapor KPI ${r.fullName}`} title="Cetak rapor bulanan (PDF)"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-primary"><Printer className="h-3.5 w-3.5" /></Link>
                              )}
                              <span className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-transform group-open:rotate-90"><ChevronRight className="h-4 w-4" /></span>
                            </span>
                          </summary>
                          <div className="bg-muted/30 px-4 pb-4 pt-1 md:px-5 lg:pl-[68px]">
                            <div className="grid gap-x-8 gap-y-1.5 rounded-xl border bg-card p-3.5 sm:grid-cols-2">
                              {h.nilai.map((n, j) => (
                                <div key={j} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3">
                                  <span className="text-[13px]">{j + 1}. {KPI_INDIKATOR[j]}</span>
                                  <span className={cn('flex h-6 items-center justify-center rounded-md text-[12.5px] font-bold tabular-nums', nadaSel(n))}>{Math.round(n * 10) / 10}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                                Terendah: <b className="text-accent-warm">{KPI_INDIKATOR[urut[0].i]} ({Math.round(urut[0].n * 10) / 10})</b> · {KPI_INDIKATOR[urut[1].i]} ({Math.round(urut[1].n * 10) / 10}) · total {Math.round(h.total * 10) / 10}
                              </p>
                              {mayInput && (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/kpi/isi?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}><Pencil className="mr-1 h-3.5 w-3.5" />Sunting nilai</Link>
                                </Button>
                              )}
                              {mayPrint && (
                                <Button asChild size="sm" variant="outline" className="lg:hidden">
                                  <Link href={`/kpi/cetak?teacher=${r.teacherId}&unit=${unit}&year=${year}&month=${month}`}><Printer className="mr-1 h-3.5 w-3.5" />Cetak</Link>
                                </Button>
                              )}
                              {mayReset && (
                                <ResetRaporButton kpiId={r.entry.id} fullName={r.fullName} status={st} rapot={h.rapot} />
                              )}
                              {bolehAju && <AjukanSatu kpiId={r.entry.id} />}
                            </div>
                          </div>
                        </details>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
        )}

        {rataIndikator.length > 0 && (
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-wash text-primary"><AlertCircle className="h-4 w-4" /></span>
              <div>
                <h2 className="font-heading text-xl leading-tight">Indikator paling rendah</h2>
                <p className="text-xs text-muted-foreground">Rata-rata {dinilai.length} guru yang sudah dinilai · bahan pembinaan bulan ini</p>
              </div>
            </div>
            <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              {rataIndikator.slice(0, 6).map(x => (
                <div key={x.nama}>
                  <div className="flex justify-between gap-2 text-[13px]"><span className="font-semibold">{x.nama}</span><b className="tabular-nums">{Math.round(x.nilai)}</b></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', x.nilai >= 81 ? 'bg-primary' : x.nilai >= 71 ? 'bg-primary/60' : x.nilai >= 61 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${Math.min(100, x.nilai)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/**
 * Warna sel indikator, mengikuti ambang tangga predikat KPI (91 / 81 / 71 / 61).
 * Hanya tampilan: nilainya sendiri tetap tertulis di dalam sel.
 */
function nadaSel(n: number): string {
  if (n >= 91) return 'bg-primary text-primary-foreground'
  if (n >= 81) return 'bg-chart-2/35 text-foreground'
  if (n >= 71) return 'bg-primary-wash text-foreground'
  if (n >= 61) return 'bg-warning-wash text-warning'
  return 'bg-destructive-wash text-destructive'
}
