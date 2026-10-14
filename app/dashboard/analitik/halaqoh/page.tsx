import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutGrid, Table2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, getAnalyticsProgramScope,
} from '@/lib/auth/permissions'
import { UNIT_LABELS, UNIT_ORDER, programLabel } from '@/lib/rq/programs'
import { formatPeriod, monthName, shiftPeriod } from '@/lib/finance/period'
import { tanggalWIB } from '@/lib/rq/ujian'
import { getAnalitikHalaqoh, JENDELA_BULAN, type KartuHalaqoh as DataKartu, type MetrikHalaqoh } from '@/lib/data/analitik-halaqoh'
import { getKelengkapanMingguan } from '@/lib/data/kelengkapan-mingguan'
import { getTargetTahfidz } from '@/lib/data/target-tahfidz'
import { getTambahanRingkas, persenHadir, type Kehadiran } from '@/lib/data/analitik-halaqoh-detail'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KpiCard, MonthStepper, Panel, Slicer, hrefDengan } from '@/components/dashboard/kit'
import { KartuHalaqoh, LABEL_METRIK, Selisih, metrikAliran, peringkat, teksMetrik } from '@/components/analitik/KartuHalaqoh'
import { AvatarGuru } from '@/components/analitik/AvatarGuru'
import { TitikPekan, type TitikPekanData } from '@/components/analitik/TitikPekan'
import { ChipFilter, Lencana } from '@/components/analitik/ChipFilter'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

const PATH = '/dashboard/analitik/halaqoh'
const METRIK: MetrikHalaqoh[] = ['tahsin', 'tahfidz', 'jilid', 'hafalan']
/** Sejauh mana bulan bisa dimundurkan. */
const BATAS_MUNDUR = 12
/** Kunci URL untuk halaqoh tanpa program (program NULL). */
const TANPA = 'tanpa'
const AMBANG_HADIR = 85
const AMBANG_DRILL_HARI = 14
const TAMPIL_PERINGKAT = 5

const LABEL_LAJU: Record<MetrikHalaqoh, string> = {
  tahsin: 'laju tahsin', tahfidz: 'laju tahfidz', jilid: 'rata-rata jilid', hafalan: 'rata-rata hafalan',
}
const SATUAN_TILE: Record<MetrikHalaqoh, string> = {
  tahsin: 'hlm lulus / anak', tahfidz: 'hlm ziyadah / anak', jilid: 'posisi rata-rata akhir bulan', hafalan: 'juz rata-rata per anak',
}

interface PageProps {
  searchParams: Promise<{ bulan?: string; unit?: string; urut?: string; program?: string; sesi?: string; tampil?: string }>
}

interface Penanda {
  jenis: 'laju' | 'hadir' | 'laporan' | 'drill' | 'uji'
  label: string
  teks: string
  nada: 'destructive' | 'warning' | 'info'
}

/**
 * Analitik per halaqoh: ringkasan satu unit — kalimat utama, empat angka,
 * peringkat laju dengan garis rata-rata unit, panel "Perlu perhatian"
 * berbasis aturan, lalu satu kartu per halaqoh (atau tabel) yang menuju
 * halaman detail halaqoh.
 *
 * Selalu SATU unit: memeringkat halaqoh TPAIT bersama halaqoh SMP
 * membandingkan kurikulum, bukan kinerja. Akses & penguncian unit sama
 * dengan Analitik BTHCQ (koordinator hanya unitnya sendiri).
 */
export default async function AnalitikHalaqohPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const penuh = canViewAnalytics(session.role)
  const unitBoleh = penuh ? UNIT_ORDER : UNIT_ORDER.filter(j => getAnalyticsJenjang(session.role).includes(j))
  const jenjang: Jenjang | undefined = unitBoleh.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : unitBoleh[0]
  if (!jenjang) redirect('/dashboard')
  const program = getAnalyticsProgramScope(session.role)

  const hariIni = tanggalWIB(new Date())
  const bulanKini = hariIni.slice(0, 7)
  const bulanAwal = shiftPeriod(bulanKini, -(BATAS_MUNDUR - 1))
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') && sp.bulan! <= bulanKini && sp.bulan! >= bulanAwal ? sp.bulan! : bulanKini
  const metrik: MetrikHalaqoh = METRIK.includes(sp.urut as MetrikHalaqoh) ? (sp.urut as MetrikHalaqoh) : 'tahsin'
  const tabel = sp.tampil === 'tabel'

  const [data, target] = await Promise.all([
    getAnalitikHalaqoh({ jenjang: [jenjang], bulan, program }),
    getTargetTahfidz([jenjang]).catch(e => { console.error('[analitik-halaqoh] target tahfidz:', e); return null }),
  ])

  // ── Filter program & sesi (dari halaqoh yang ada di unit ini) ──
  const kodeProgram = (k: DataKartu) => k.program ?? TANPA
  const adaKodeReguler = data.kartu.some(k => k.program === 'reguler')
  const labelProgram = (kode: string) => kode === TANPA ? (adaKodeReguler ? 'Tanpa program' : 'Reguler') : programLabel(jenjang, kode)
  const daftarProgram = [...new Set(data.kartu.map(kodeProgram))].sort((a, b) => labelProgram(a).localeCompare(labelProgram(b), 'id'))
  const daftarSesi = [...new Set(data.kartu.map(k => k.sesi).filter((s): s is number => s !== null))].sort((a, b) => a - b)
  const progPilih = daftarProgram.includes(sp.program ?? '') ? sp.program! : undefined
  const sesiPilih = daftarSesi.includes(Number(sp.sesi)) ? Number(sp.sesi) : undefined

  const kartu = data.kartu
    .filter(k => !progPilih || kodeProgram(k) === progPilih)
    .filter(k => sesiPilih === undefined || k.sesi === sesiPilih)
  const ids = kartu.map(k => k.id)

  const [mingguan, tambahan] = await Promise.all([
    getKelengkapanMingguan(bulan, ids),
    getTambahanRingkas(ids, bulan),
  ])

  const params = {
    unit: jenjang, bulan: bulan === bulanKini ? undefined : bulan, urut: metrik === 'tahsin' ? undefined : metrik,
    program: progPilih, sesi: sesiPilih === undefined ? undefined : String(sesiPilih), tampil: tabel ? 'tabel' : undefined,
  }
  const href = (ganti: Record<string, string | undefined>) => hrefDengan(PATH, params, ganti)
  const bulanHref = (b: string) => (b < bulanAwal || b > bulanKini ? null : href({ bulan: b === bulanKini ? undefined : b }))
  const detailHref = (id: string) => hrefDengan(`${PATH}/${id}`, { bulan: params.bulan }, {})

  const iKini = data.bulan.length - 1
  const rank = peringkat(kartu, metrik, iKini)
  const rankLalu = peringkat(kartu, metrik, iKini - 1)
  const urut = [...kartu].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.nama.localeCompare(b.nama, 'id'))

  // Rata-rata UNIT (semua halaqoh unit ini dalam cakupan, sebelum filter program/sesi).
  const rataDi = (daftar: DataKartu[], m: MetrikHalaqoh, i: number): number | null => {
    const vs = daftar.map(k => k.titik[i]?.[m]).filter((v): v is number => v !== null && v !== undefined)
    return vs.length ? Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100 : null
  }
  const rataUnit = data.bulan.map((_, i) => rataDi(data.kartu, metrik, i))
  const rataTampil = rataDi(kartu, metrik, iKini)
  const rataTampilLalu = rataDi(kartu, metrik, iKini - 1)

  // ── Target tahfidz dikelompokkan ulang per halaqoh (lewat id siswa) ──
  const targetPer = new Map<string, { sesuai: number; terukur: number; dibawah: number; perluDiujikan: number }>()
  for (const s of target?.siswa ?? []) {
    const h = tambahan.anggota[s.id]
    if (!h) continue
    const t = targetPer.get(h) ?? { sesuai: 0, terukur: 0, dibawah: 0, perluDiujikan: 0 }
    if (s.status === 'sesuai' || s.status === 'di_atas') { t.sesuai++; t.terukur++ }
    if (s.status === 'di_bawah') { t.dibawah++; t.terukur++ }
    if (s.perluDiujikan) t.perluDiujikan++
    targetPer.set(h, t)
  }

  // ── Laporan per pekan ──
  const pekanPer = (id: string): TitikPekanData[] => (mingguan.perHalaqoh[id] ?? []).map((p, i) => ({
    ...p, dari: mingguan.pekan[i].dari, sampai: mingguan.pekan[i].sampai, berjalan: mingguan.pekan[i].sampai >= hariIni,
  }))

  // ── Penanda "perlu perhatian" — aturan tetap, bukan penilaian ──
  const iAkhirPenuh = data.berjalan ? iKini - 1 : iKini
  const penandaPer = new Map<string, Penanda[]>()
  for (const k of kartu) {
    const p: Penanda[] = []
    for (const m of ['tahsin', 'tahfidz'] as const) {
      const e = iAkhirPenuh
      if (e < 2) continue
      const [a, b, c] = [k.titik[e - 2]?.[m], k.titik[e - 1]?.[m], k.titik[e]?.[m]]
      if (a != null && b != null && c != null && a > b && b > c) {
        p.push({ jenis: 'laju', label: 'Laju turun', nada: 'destructive',
          teks: `${m === 'tahsin' ? 'Tahsin' : 'Tahfidz'} turun 2 bulan beruntun (${[a, b, c].map(v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 })).join(' → ')} hlm/anak).` })
        break
      }
    }
    const kh = tambahan.hadir[k.id]
    const ph = persenHadir(kh)
    if (ph !== null && ph < AMBANG_HADIR) {
      p.push({ jenis: 'hadir', label: 'Hadir rendah', nada: 'destructive',
        teks: `Kehadiran ${ph}% di ${monthName(bulan)}${kh!.alfa ? ` (${kh!.alfa} catatan alfa)` : ''}.` })
    }
    const pekan = pekanPer(k.id)
    const bolong = pekan.map((w, i) => ({ w, i })).filter(({ w }) => !w.berjalan && w.status === 'kosong')
    const telat = pekan.reduce((n, w) => n + w.terlambat, 0)
    if (bolong.length > 0 || telat > 0) {
      const bagian = [
        bolong.length > 0 && `Pekan ke-${bolong.map(x => x.i + 1).join(', ')} tanpa setoran tercatat`,
        telat > 0 && `${telat} setoran dicatat lebih dari 2 hari kemudian`,
      ].filter(Boolean)
      p.push({ jenis: 'laporan', label: bolong.length > 0 ? 'Laporan bolong' : 'Input terlambat', nada: 'warning', teks: `${bagian.join('; ')}.` })
    }
    const kini = k.titik[iKini]
    const dJ = kini.drillJilid, dZ = kini.drillJuz
    const lamaJ = dJ.rataHari !== null && dJ.rataHari >= AMBANG_DRILL_HARI
    const lamaZ = dZ.rataHari !== null && dZ.rataHari >= AMBANG_DRILL_HARI
    if (lamaJ || lamaZ) {
      p.push({ jenis: 'drill', label: 'Drill lama', nada: 'warning',
        teks: [
          lamaJ && `${dJ.anak} anak drill jilid rata-rata ${dJ.rataHari} hari`,
          lamaZ && `${dZ.anak} anak drill juz rata-rata ${dZ.rataHari} hari`,
        ].filter(Boolean).join('; ') + ' — pertimbangkan ujian ulang atau pendampingan.' })
    }
    const t = targetPer.get(k.id)
    if (t && t.perluDiujikan > 0) {
      p.push({ jenis: 'uji', label: 'Siap diuji', nada: 'info', teks: `${t.perluDiujikan} anak perlu diujikan menurut target tahfidz semester ini.` })
    }
    if (p.length) penandaPer.set(k.id, p)
  }
  const perluPerhatian = kartu.filter(k => (penandaPer.get(k.id) ?? []).some(p => p.jenis !== 'uji'))
  const daftarPerhatian = [...penandaPer.entries()]
    .map(([id, p]) => ({ k: kartu.find(x => x.id === id)!, p, bobot: p.filter(x => x.nada === 'destructive').length * 10 + p.filter(x => x.jenis !== 'uji').length }))
    .sort((a, b) => b.bobot - a.bobot || a.k.nama.localeCompare(b.k.nama, 'id'))

  // ── Kehadiran unit (halaqoh yang tampil) ──
  const hadirTotal = kartu.reduce<Kehadiran>((acc, k) => {
    const h = tambahan.hadir[k.id]
    if (h) { acc.hadir += h.hadir; acc.total += h.total; acc.izin += h.izin; acc.sakit += h.sakit; acc.alfa += h.alfa }
    return acc
  }, { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 })
  const hadirUnit = persenHadir(hadirTotal)

  // ── Kalimat utama ──
  const pakaiLalu = data.berjalan && metrikAliran(metrik)
  const [ia, ib] = pakaiLalu ? [iKini - 1, iKini - 2] : [iKini, iKini - 1]
  const bandingan = kartu.filter(k => k.titik[ia]?.[metrik] != null && k.titik[ib]?.[metrik] != null)
  const naikN = bandingan.filter(k => k.titik[ia][metrik]! > k.titik[ib][metrik]!).length
  const cakupanProgram = progPilih ? ` ${labelProgram(progPilih)}` : program && jenjang === 'sd' ? ' QULS' : ''
  const unitPendek = UNIT_LABELS[jenjang].replace(/ LHI$/, '')
  const judulA = `Halaqoh ${unitPendek}${cakupanProgram} ${monthName(bulan)}`
  const judulB = bandingan.length === 0
    ? `${LABEL_LAJU[metrik]} belum punya pembanding bulan lalu.`
    : `${LABEL_LAJU[metrik]} naik di ${naikN} dari ${bandingan.length} halaqoh${pakaiLalu ? ` (${monthName(data.bulan[ia])} vs ${monthName(data.bulan[ib])})` : ''}.`

  const labelBulan = formatPeriod(bulan)
  const totalSiswa = kartu.reduce((n, k) => n + k.siswa, 0)
  const maksBar = Math.max(0, ...kartu.map(k => k.titik[iKini]?.[metrik] ?? 0), rataUnit[iKini] ?? 0)
  const peringkatUrut = urut.filter(k => rank.has(k.id))

  const barisPeringkat = (k: DataKartu) => {
    const v = k.titik[iKini][metrik]!
    const ru = rataUnit[iKini]
    const bawah = ru !== null && v < ru
    return (
      <li key={k.id}>
        <Link href={detailHref(k.id)} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50 sm:grid-cols-[1.5rem_minmax(0,14rem)_1fr_auto]">
          <span className="font-heading text-lg tabular-nums text-muted-foreground">{rank.get(k.id)}</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <AvatarGuru gender={k.guru?.gender ?? null} className="size-8" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{k.nama}</span>
              <span className="block truncate text-xs text-muted-foreground">{k.guru?.nama ?? 'Tanpa wali'}{k.sesi ? ` · sesi ${k.sesi}` : ''}</span>
            </span>
          </span>
          <span className="relative col-span-3 h-2.5 rounded-full bg-muted sm:col-span-1" aria-hidden>
            <span className={cn('absolute inset-y-0 left-0 rounded-full', bawah ? 'bg-accent-warm' : 'bg-primary')}
              style={{ width: `${maksBar > 0 ? (v / maksBar) * 100 : 0}%` }} />
            {ru !== null && maksBar > 0 && (
              <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground" style={{ left: `${(ru / maksBar) * 100}%` }} />
            )}
          </span>
          <span className="col-start-3 row-start-1 text-right text-sm sm:col-start-4">
            <b className="tabular-nums">{teksMetrik(metrik, v)}</b>
            <span className="block text-[11px]"><Selisih m={metrik} kini={v} lalu={k.titik[iKini - 1]?.[metrik] ?? null} berjalan={data.berjalan} /></span>
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik Halaqoh" showBack ownH1 />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* ── Judul & bulan ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Analitik · Halaqoh · {penuh ? 'Manajemen' : 'Koordinator'}</p>
            <h1 className="mt-2 max-w-3xl font-heading text-3xl font-medium leading-tight tracking-[-0.01em] md:text-4xl">
              {judulA} — <em className="text-primary">{judulB}</em>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {UNIT_LABELS[jenjang]} · {labelBulan}{data.berjalan && ' (berjalan)'} · {kartu.length.toLocaleString('id-ID')} halaqoh · tren {JENDELA_BULAN} bulan
            </p>
          </div>
          <MonthStepper label="Bulan" current={labelBulan}
            prevHref={bulanHref(shiftPeriod(bulan, -1))} nextHref={bulanHref(shiftPeriod(bulan, 1))} />
        </div>

        {/* ── Filter ── */}
        <div className="space-y-3">
          <div className="-mx-4 flex items-center gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {unitBoleh.length > 1 && (
              <ChipFilter label="Unit" chips={unitBoleh.map(j => ({
                label: UNIT_LABELS[j].replace(/ LHI$/, ''), href: hrefDengan(PATH, { unit: j, urut: params.urut, bulan: params.bulan, tampil: params.tampil }, {}), active: jenjang === j,
              }))} />
            )}
            {daftarProgram.length > 1 && (
              <>
                <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
                <ChipFilter label="Program" chips={[
                  { label: 'Semua program', href: href({ program: undefined }), active: !progPilih },
                  ...daftarProgram.map(p => ({ label: labelProgram(p), href: href({ program: p }), active: progPilih === p })),
                ]} />
              </>
            )}
            {daftarSesi.length > 1 && (
              <>
                <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
                <ChipFilter label="Sesi" chips={[
                  { label: 'Semua sesi', href: href({ sesi: undefined }), active: sesiPilih === undefined },
                  ...daftarSesi.map(s => ({ label: `Sesi ${s}`, href: href({ sesi: String(s) }), active: sesiPilih === s })),
                ]} />
              </>
            )}
          </div>
          <Slicer label="Metrik" options={METRIK.map(m => ({
            label: LABEL_METRIK[m], href: href({ urut: m === 'tahsin' ? undefined : m }), active: metrik === m,
          }))} />
        </div>

        {kartu.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Belum ada halaqoh aktif berisi siswa di cakupan ini.
          </p>
        ) : (
          <>
            {/* ── Empat angka ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Halaqoh aktif" value={kartu.length} sub={<>{totalSiswa.toLocaleString('id-ID')} siswa · {UNIT_LABELS[jenjang]}</>} />
              <KpiCard label={`${LABEL_LAJU[metrik].replace(/^./, c => c.toUpperCase())} rata-rata`}
                value={rataTampil === null ? '—' : teksMetrik(metrik, rataTampil)}
                sub={<>{SATUAN_TILE[metrik]} · {monthName(bulan).slice(0, 3)}{data.berjalan && metrikAliran(metrik) ? ' (berjalan)' : rataTampilLalu !== null ? ` · bln lalu ${teksMetrik(metrik, rataTampilLalu)}` : ''}</>} />
              <KpiCard label="Kehadiran" value={hadirUnit === null ? '—' : `${hadirUnit}%`}
                tone={hadirUnit !== null && hadirUnit < AMBANG_HADIR ? 'destructive' : undefined}
                sub={hadirUnit === null ? `Belum ada presensi di ${monthName(bulan)}` : <>rata-rata seluruh halaqoh · {hadirTotal.izin} izin, {hadirTotal.sakit} sakit, {hadirTotal.alfa} alfa</>} />
              <KpiCard label="Perlu perhatian" value={perluPerhatian.length}
                tone={perluPerhatian.length > 0 ? 'warning' : undefined}
                sub={`laju turun 2 bulan, hadir < ${AMBANG_HADIR}%, pekan bolong, atau drill ≥ ${AMBANG_DRILL_HARI} hari`} />
            </div>

            {/* ── Peringkat & perlu perhatian ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Panel title={`Peringkat ${LABEL_LAJU[metrik]} · ${monthName(bulan)}`}
                sub={rataUnit[iKini] !== null
                  ? <>garis hitam = rata-rata unit ({teksMetrik(metrik, rataUnit[iKini])}) · oranye = di bawah rata-rata</>
                  : 'Belum ada rata-rata unit bulan ini.'}>
                {peringkatUrut.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada angka {LABEL_METRIK[metrik].toLowerCase()} di bulan ini.</p>
                ) : (
                  <>
                    <ol className="divide-y">{peringkatUrut.slice(0, TAMPIL_PERINGKAT).map(barisPeringkat)}</ol>
                    {peringkatUrut.length > TAMPIL_PERINGKAT && (
                      <details className="group/lain">
                        <summary className="mt-2 cursor-pointer list-none text-[13px] font-semibold text-primary hover:underline">
                          <span className="group-open/lain:hidden">Lihat {peringkatUrut.length - TAMPIL_PERINGKAT} lainnya</span>
                          <span className="hidden group-open/lain:inline">Sembunyikan</span>
                        </summary>
                        <ol className="mt-1 divide-y border-t">{peringkatUrut.slice(TAMPIL_PERINGKAT).map(barisPeringkat)}</ol>
                      </details>
                    )}
                  </>
                )}
              </Panel>

              <Panel title="Perlu perhatian" sub="Aturan tetap: laju turun 2 bulan beruntun, hadir < 85%, pekan tanpa setoran / input terlambat, drill ≥ 14 hari, anak siap diuji.">
                {daftarPerhatian.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada halaqoh yang memenuhi aturan perhatian di {monthName(bulan)}.</p>
                ) : (
                  <ul className="divide-y">
                    {daftarPerhatian.slice(0, 8).map(({ k, p }) => (
                      <li key={k.id} className="py-3 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={detailHref(k.id)} className="min-w-0 truncate text-sm font-bold hover:underline">{k.nama}</Link>
                          <span className="flex flex-wrap justify-end gap-1">{p.map(x => <Lencana key={x.jenis} nada={x.nada}>{x.label}</Lencana>)}</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.map(x => x.teks).join(' ')}</p>
                      </li>
                    ))}
                    {daftarPerhatian.length > 8 && (
                      <li className="pt-3 text-xs text-muted-foreground">dan {daftarPerhatian.length - 8} halaqoh lain — lihat kartu di bawah.</li>
                    )}
                  </ul>
                )}
              </Panel>
            </div>

            {/* ── Semua halaqoh ── */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-medium leading-tight md:text-2xl">Semua halaqoh</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    garis oranye putus-putus = rata-rata unit · ruas putus-putus = bulan berjalan · “Sesuai target” = target tahfidz per hari ini
                  </p>
                </div>
                <div role="group" aria-label="Tampilan" className="inline-flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
                  {[
                    { label: 'Kartu', ikon: <LayoutGrid className="h-3.5 w-3.5" />, aktif: !tabel, h: href({ tampil: undefined }) },
                    { label: 'Tabel', ikon: <Table2 className="h-3.5 w-3.5" />, aktif: tabel, h: href({ tampil: 'tabel' }) },
                  ].map(o => (
                    <Link key={o.label} href={o.h} scroll={false} aria-current={o.aktif ? 'true' : undefined}
                      className={cn('inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold',
                        o.aktif ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                      {o.ikon}{o.label}
                    </Link>
                  ))}
                </div>
              </div>

              {tabel ? (
                <div className="overflow-x-auto rounded-2xl border bg-card">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-4 py-3">#</th>
                        <th className="px-2 py-3">Halaqoh</th>
                        <th className="px-2 py-3 text-right">{LABEL_METRIK[metrik]}</th>
                        <th className="px-2 py-3 text-right">Hadir</th>
                        <th className="px-2 py-3 text-right">Sesuai target</th>
                        <th className="px-2 py-3 text-right">Drill</th>
                        <th className="px-4 py-3">Laporan per pekan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {urut.map(k => {
                        const kini = k.titik[iKini]
                        const ph = persenHadir(tambahan.hadir[k.id])
                        const t = targetPer.get(k.id)
                        return (
                          <tr key={k.id} className="hover:bg-muted/40">
                            <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{rank.get(k.id) ?? '—'}</td>
                            <td className="px-2 py-2.5">
                              <Link href={detailHref(k.id)} className="font-bold hover:underline">{k.nama}</Link>
                              <span className="block text-xs text-muted-foreground">{k.guru?.nama ?? 'Tanpa wali'} · {k.siswa} siswa{k.sesi ? ` · sesi ${k.sesi}` : ''}</span>
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <b className="tabular-nums">{teksMetrik(metrik, kini[metrik])}</b>
                              <span className="block text-[11px]"><Selisih m={metrik} kini={kini[metrik]} lalu={k.titik[iKini - 1]?.[metrik] ?? null} berjalan={data.berjalan} /></span>
                            </td>
                            <td className={cn('px-2 py-2.5 text-right font-semibold tabular-nums', ph !== null && ph < AMBANG_HADIR && 'text-destructive')}>{ph === null ? '—' : `${ph}%`}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{t && t.terukur > 0 ? `${t.sesuai}/${t.terukur}` : '—'}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{kini.drillJilid.anak + kini.drillJuz.anak}</td>
                            <td className="px-4 py-2.5"><TitikPekan pekan={pekanPer(k.id)} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {urut.map(k => {
                    const t = targetPer.get(k.id)
                    return (
                      <KartuHalaqoh key={k.id} k={k} metrik={metrik} rank={rank.get(k.id)} rankLalu={rankLalu.get(k.id)} berjalan={data.berjalan}
                        tambahan={{
                          rataUnit, hadir: persenHadir(tambahan.hadir[k.id]),
                          target: t ? { sesuai: t.sesuai, terukur: t.terukur } : null,
                          pekan: pekanPer(k.id), href: detailHref(k.id),
                        }} />
                    )
                  })}
                </div>
              )}
            </section>

            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <b>Tahsin/Tahfidz per bulan</b> = rata-rata halaman lulus / halaman ziyadah per anak, hanya setoran halaqoh sekolah
              (ekstra, TR, Riyadhoh, dan asrama tidak dihitung). <b>Jilid</b> dan <b>hafalan</b> = posisi rata-rata di akhir bulan.
              Anggota halaqoh dibaca sesuai susunan sekarang. <b>Kehadiran</b> = catatan “hadir” dibagi seluruh catatan presensi bulan itu.
              <b> Sesuai target</b> = anak sesuai/di atas target tahfidz dari yang terukur, posisi hari ini.
              {data.berjalan && ' Bulan berjalan: capaian per bulan belum dibandingkan, garis trennya putus-putus.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
