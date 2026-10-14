import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, Settings2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewHalaqoh, canViewUnitAnalytics, getAnalyticsJenjang, getAnalyticsProgramScope,
} from '@/lib/auth/permissions'
import { UNIT_LABELS, cocokProgram, programLabel } from '@/lib/rq/programs'
import { formatPeriod, monthName, shiftPeriod } from '@/lib/finance/period'
import { tanggalWIB } from '@/lib/rq/ujian'
import { sesiJam } from '@/lib/rq/sesi'
import { getAnalitikHalaqoh, type MetrikHalaqoh } from '@/lib/data/analitik-halaqoh'
import { getKelengkapanMingguan } from '@/lib/data/kelengkapan-mingguan'
import { getTargetTahfidz, type SiswaTarget } from '@/lib/data/target-tahfidz'
import { getDetailHalaqoh, persenHadir, TAHAP_URUT, type Kehadiran, type SiswaDetail } from '@/lib/data/analitik-halaqoh-detail'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KpiCard, Panel, hrefDengan } from '@/components/dashboard/kit'
import { LABEL_METRIK, Selisih, metrikAliran, teksMetrik } from '@/components/analitik/KartuHalaqoh'
import { AvatarGuru } from '@/components/analitik/AvatarGuru'
import { TitikPekan, type TitikPekanData } from '@/components/analitik/TitikPekan'
import { ChipFilter, Lencana } from '@/components/analitik/ChipFilter'
import { GrafikTrenHalaqoh } from '@/components/analitik/GrafikTrenHalaqoh'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

const PATH_LIST = '/dashboard/analitik/halaqoh'
const BATAS_MUNDUR = 12
const AMBANG_HADIR = 85
const AMBANG_DRILL_HARI = 14
const AMBANG_TAK_SETOR = 7
type Rentang = '3' | '6' | 'semester'
type Saring = 'bawah' | 'drill' | 'uji'
const GRAFIK: MetrikHalaqoh[] = ['tahsin', 'tahfidz', 'hafalan']
const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Ahad']

const JUDUL_GRAFIK: Record<MetrikHalaqoh, string> = {
  tahsin: 'Laju tahsin · halaman lulus per anak',
  tahfidz: 'Laju tahfidz · halaman ziyadah per anak',
  jilid: 'Rata-rata jilid',
  hafalan: 'Rata-rata hafalan · juz per anak',
}
const LABEL_PREDIKAT: Record<string, string> = {
  mumtaz: 'Mumtaz', jayyid_jiddan: 'Jayyid Jiddan', jayyid: 'Jayyid', maqbul: 'Maqbul', mengulang: 'Mengulang',
}
const LABEL_TIPE: Record<string, string> = { '1_juz': "Tasmi' 1 juz", '3_juz': "Tasmi' 3 juz", '5_juz': "Tasmi' 5 juz" }

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bulan?: string; rentang?: string; grafik?: string; saring?: string }>
}

/** 'Senin–Kamis 07.30–08.30' — hari berturut digabung, jam sama dikelompokkan. */
function teksJadwal(jadwal: { hari: number; mulai: string; selesai: string }[]): string | null {
  if (jadwal.length === 0) return null
  const perJam = new Map<string, number[]>()
  for (const j of jadwal) {
    const k = `${j.mulai.replace(':', '.')}–${j.selesai.replace(':', '.')}`
    perJam.set(k, [...(perJam.get(k) ?? []), j.hari])
  }
  return [...perJam.entries()].map(([jam, hari]) => {
    const h = [...new Set(hari)].sort((a, b) => a - b)
    const runtut = h.length >= 3 && h.every((d, i) => i === 0 || d === h[i - 1] + 1)
    return `${runtut ? `${HARI[h[0]]}–${HARI[h.at(-1)!]}` : h.map(d => HARI[d]).join(', ')} ${jam}`
  }).join(' · ')
}

function teksHariLalu(tgl: string | null, hariIni: string): { teks: string; hari: number | null } {
  if (!tgl) return { teks: 'Belum ada', hari: null }
  const n = Math.round((Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${tgl}T00:00:00Z`)) / 86_400_000)
  return { teks: n <= 0 ? 'Hari ini' : n === 1 ? 'Kemarin' : `${n} hari lalu`, hari: n }
}

const angka = (v: number, d = 1) => v.toLocaleString('id-ID', { maximumFractionDigits: d })

/**
 * Detail satu halaqoh — untuk pengurus/koordinator yang membuka kartu di
 * Analitik Halaqoh. Gerbang izin sama dengan halaman daftarnya, ditambah
 * cek bahwa halaqoh ini berada di unit & program yang boleh dilihat.
 */
export default async function AnalitikHalaqohDetailPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const { id } = await params
  const sp = await searchParams
  const penuh = canViewAnalytics(session.role)
  const unitBoleh = getAnalyticsJenjang(session.role)
  const scope = getAnalyticsProgramScope(session.role)

  const hariIni = tanggalWIB(new Date())
  const bulanKini = hariIni.slice(0, 7)
  const bulanAwal = shiftPeriod(bulanKini, -(BATAS_MUNDUR - 1))
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') && sp.bulan! <= bulanKini && sp.bulan! >= bulanAwal ? sp.bulan! : bulanKini
  const rentang: Rentang = sp.rentang === '3' || sp.rentang === 'semester' ? sp.rentang : '6'
  const grafik: MetrikHalaqoh = GRAFIK.includes(sp.grafik as MetrikHalaqoh) ? (sp.grafik as MetrikHalaqoh) : 'tahsin'
  const saring: Saring | undefined = (['bawah', 'drill', 'uji'] as const).find(s => s === sp.saring)

  // Semester: Juli–Desember (ganjil) atau Januari–Juni (genap) dari bulan terpilih.
  const [th, bl] = bulan.split('-').map(Number)
  const awalSemesterBulan = `${th}-${bl >= 7 ? '07' : '01'}`
  const jumlahBulan = rentang === '3' ? 3 : rentang === '6' ? 6
    : Math.min(6, (th - Number(awalSemesterBulan.slice(0, 4))) * 12 + bl - Number(awalSemesterBulan.slice(5)) + 1)
  const bulanMulai = shiftPeriod(bulan, -(jumlahBulan - 1))

  const det = await getDetailHalaqoh(id, { dari: `${bulanMulai}-01`, bulan, awalSemester: `${awalSemesterBulan}-01`, program: scope })
  if (!det) notFound()
  // Cakupan: unit harus termasuk yang boleh dilihat; koor QULS hanya halaqoh berisi anak dalam programnya.
  if (!penuh && !unitBoleh.includes(det.jenjang)) notFound()
  if (scope && !cocokProgram(scope, det.program) && det.siswa.length === 0) notFound()

  const jenjang: Jenjang = det.jenjang
  const [analitik, target, mingguan] = await Promise.all([
    getAnalitikHalaqoh({ jenjang: [jenjang], bulan, program: scope }),
    getTargetTahfidz([jenjang]).catch(e => { console.error('[analitik-halaqoh] target tahfidz:', e); return null }),
    getKelengkapanMingguan(bulan, [id]),
  ])

  const kartu = analitik.kartu.find(k => k.id === id) ?? null
  const sejawat = analitik.kartu.filter(k => k.program === det.program)
  const iKini = analitik.bulan.length - 1
  const kini = kartu?.titik[iKini] ?? null
  const lalu = kartu?.titik[iKini - 1] ?? null
  const rataSejawat = (m: MetrikHalaqoh, i: number): number | null => {
    const vs = sejawat.map(k => k.titik[i]?.[m]).filter((v): v is number => v !== null && v !== undefined)
    return vs.length ? Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100 : null
  }
  const labelSejawat = `Rata-rata ${det.program ? programLabel(jenjang, det.program) : 'reguler'} ${UNIT_LABELS[jenjang].replace(/ LHI$/, '')}`
  const titikGrafik = analitik.bulan
    .map((b, i) => ({ bulan: b, nilai: kartu?.titik[i]?.[grafik] ?? null, rata: rataSejawat(grafik, i) }))
    .slice(-jumlahBulan)

  const targetPer = new Map<string, SiswaTarget>((target?.siswa ?? []).map(s => [s.id, s]))
  const pekan: TitikPekanData[] = (mingguan.perHalaqoh[id] ?? []).map((p, i) => ({
    ...p, dari: mingguan.pekan[i].dari, sampai: mingguan.pekan[i].sampai, berjalan: mingguan.pekan[i].sampai >= hariIni,
  }))

  const params_ = {
    bulan: bulan === bulanKini ? undefined : bulan, rentang: rentang === '6' ? undefined : rentang,
    grafik: grafik === 'tahsin' ? undefined : grafik, saring,
  }
  const href = (ganti: Record<string, string | undefined>) => hrefDengan(`${PATH_LIST}/${id}`, params_, ganti)

  // ── Angka utama ──
  const n = det.siswa.length
  const hadirSemua = det.siswa.reduce<Kehadiran>((a, s) => ({
    hadir: a.hadir + s.hadir.hadir, izin: a.izin + s.hadir.izin, sakit: a.sakit + s.hadir.sakit, alfa: a.alfa + s.hadir.alfa, total: a.total + s.hadir.total,
  }), { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 })
  const hadirPct = persenHadir(hadirSemua)
  const jumlahPekan = Math.max(1, mingguan.pekan.length)
  const setorPerAnakPekan = n > 0 ? det.setoranBulan / n / jumlahPekan : null
  const statusSiswa = det.siswa.map(s => targetPer.get(s.id))
  const terukur = statusSiswa.filter(t => t && (t.status === 'di_bawah' || t.status === 'sesuai' || t.status === 'di_atas'))
  const sesuai = terukur.filter(t => t!.status !== 'di_bawah').length
  const dibawah = terukur.length - sesuai

  // ── Metode & jadwal ──
  const metode = new Map<string, number>()
  for (const s of det.siswa) if (s.metode) metode.set(s.metode, (metode.get(s.metode) ?? 0) + 1)
  const teksMetode = [...metode.entries()].sort((a, b) => b[1] - a[1]).map(([m, c]) => `${m} ${c}`).join(' · ')
  const jadwal = teksJadwal(det.jadwal) ?? det.catatanJadwal ?? (det.sesi ? sesiJam(det.sesi) : null)

  // ── Sebaran tahap ──
  const tahapHitung = new Map<string, number>()
  for (const s of det.siswa) tahapHitung.set(s.tahap ?? 'Belum tercatat', (tahapHitung.get(s.tahap ?? 'Belum tercatat') ?? 0) + 1)
  const sebaran = [...TAHAP_URUT, 'Belum tercatat'].filter(t => tahapHitung.has(t)).map(t => ({ label: t, n: tahapHitung.get(t)! }))
  const warnaTahap = (label: string, i: number) => label === 'Belum tercatat'
    ? 'var(--muted)'
    : `color-mix(in oklab, var(--primary) ${Math.round(25 + (75 * (i + 1)) / Math.max(1, sebaran.filter(x => x.label !== 'Belum tercatat').length))}%, var(--card))`

  // ── Per siswa: siapa yang paling perlu dibantu ──
  type Baris = SiswaDetail & {
    t: SiswaTarget | undefined; ph: number | null; lalu: ReturnType<typeof teksHariLalu>; drill: boolean; uji: boolean; skor: number
  }
  const baris: Baris[] = det.siswa.map(s => {
    const t = targetPer.get(s.id)
    const ph = persenHadir(s.hadir)
    const l = teksHariLalu(s.terakhirSetor, hariIni)
    const drill = s.drillTahsinHari !== null || s.drillJuzHari !== null
    const uji = !!t?.perluDiujikan
    const skor = (t?.status === 'di_bawah' ? 4 : 0) + (ph !== null && ph < AMBANG_HADIR ? 3 : 0) + (drill ? 2 : 0)
      + (s.tahsinBulan + s.tahfidzBulan === 0 ? 1 : 0) + (l.hari === null || l.hari > AMBANG_TAK_SETOR ? 1 : 0)
    return { ...s, t, ph, lalu: l, drill, uji, skor }
  }).sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama, 'id'))
  const hitung = {
    bawah: baris.filter(b => b.t?.status === 'di_bawah').length,
    drill: baris.filter(b => b.drill).length,
    uji: baris.filter(b => b.uji).length,
  }
  const barisTampil = baris.filter(b => !saring || (saring === 'bawah' ? b.t?.status === 'di_bawah' : saring === 'drill' ? b.drill : b.uji))
  const maksTahsin = Math.max(1, ...baris.map(b => b.tahsinBulan))

  // ── Yang perlu diperhatikan (aturan tetap) ──
  const nama = (bs: Baris[]) => {
    const ns = bs.map(b => b.nama.split(' ')[0])
    return ns.length <= 3 ? ns.join(ns.length === 2 ? ' & ' : ', ') : `${ns.slice(0, 3).join(', ')} +${ns.length - 3}`
  }
  const catatan: { nada: 'destructive' | 'warning' | 'primary'; tebal: string; teks: string }[] = []
  const drillLama = baris.filter(b => Math.max(b.drillTahsinHari ?? 0, b.drillJuzHari ?? 0) >= AMBANG_DRILL_HARI)
  const hadirRendah = baris.filter(b => b.ph !== null && b.ph < AMBANG_HADIR)
  const keduanya = drillLama.filter(b => hadirRendah.includes(b))
  if (keduanya.length) catatan.push({ nada: 'destructive', tebal: nama(keduanya), teks: `drill ≥ 2 pekan dan hadir di bawah ${AMBANG_HADIR}%.` })
  const drillSaja = drillLama.filter(b => !keduanya.includes(b))
  if (drillSaja.length) catatan.push({ nada: 'warning', tebal: nama(drillSaja), teks: `sedang drill ≥ ${AMBANG_DRILL_HARI} hari — pertimbangkan ujian ulang atau pendampingan.` })
  const hadirSaja = hadirRendah.filter(b => !keduanya.includes(b))
  if (hadirSaja.length) catatan.push({ nada: 'destructive', tebal: nama(hadirSaja), teks: `hadir di bawah ${AMBANG_HADIR}% di ${monthName(bulan)}.` })
  if (hitung.bawah) catatan.push({ nada: 'destructive', tebal: `${hitung.bawah} anak`, teks: 'di bawah target tahfidz semester ini.' })
  if (kartu) {
    const e = analitik.berjalan ? iKini - 1 : iKini
    for (const m of ['tahsin', 'tahfidz'] as const) {
      const a = kartu.titik[e - 1]?.[m], b = kartu.titik[e]?.[m]
      if (a != null && b != null && b < a) {
        catatan.push({ nada: 'warning', tebal: `${m === 'tahsin' ? 'Tahsin' : 'Tahfidz'} turun`, teks: `${angka(a - b)} hlm/anak di ${monthName(analitik.bulan[e])} dibanding ${monthName(analitik.bulan[e - 1])}.` })
      }
    }
  }
  const lamaTakSetor = baris.filter(b => b.lalu.hari === null || b.lalu.hari > AMBANG_DRILL_HARI)
  if (lamaTakSetor.length) catatan.push({ nada: 'warning', tebal: nama(lamaTakSetor), teks: `tidak ada setoran tercatat lebih dari ${AMBANG_DRILL_HARI} hari.` })
  const bolong = pekan.map((p, i) => ({ p, i })).filter(({ p }) => !p.berjalan && p.status === 'kosong')
  if (bolong.length) catatan.push({ nada: 'warning', tebal: `Pekan ke-${bolong.map(x => x.i + 1).join(', ')}`, teks: 'tanpa setoran tercatat.' })
  const siapUji = baris.filter(b => b.uji)
  if (siapUji.length) catatan.push({ nada: 'primary', tebal: nama(siapUji), teks: 'siap diajukan ujian (menurut target tahfidz).' })

  const labelBulan = formatPeriod(bulan)
  const eyebrow = ['Halaqoh', UNIT_LABELS[jenjang].replace(/ LHI$/, ''), det.sesi ? `Sesi ${det.sesi}` : null, det.program ? programLabel(jenjang, det.program) : null]
    .filter(Boolean).join(' · ')
  const bolehLihatHalaqoh = canViewHalaqoh(session.role, jenjang, det.program)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} ownH1
        breadcrumbs={[{ label: 'Analitik Halaqoh', href: hrefDengan(PATH_LIST, { unit: jenjang, bulan: params_.bulan }, {}) }, { label: det.nama }]} />
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <Link href={hrefDengan(PATH_LIST, { unit: jenjang, bulan: params_.bulan }, {})}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Analitik halaqoh
        </Link>

        {/* ── Kepala ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <AvatarGuru gender={det.wali?.gender === 'L' || det.wali?.gender === 'P' ? det.wali.gender : det.wali?.sapaan === 'usth' ? 'P' : det.wali?.sapaan === 'ust' ? 'L' : null}
              label={det.wali?.nama} className="size-14" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">{eyebrow}</p>
              <h1 className="mt-1 font-heading text-3xl font-medium leading-tight tracking-[-0.01em] md:text-4xl">
                {det.nama}{det.wali && <> · <em className="text-primary">{det.wali.nama}</em></>}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {[`${n} siswa`, teksMetode && `metode ${teksMetode}`, jadwal, det.tempat || null].filter(Boolean).join(' · ')}
              </p>
              {det.pengampu.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Pengampu: {det.pengampu.join(', ')}</p>}
              {!det.isActive && <p className="mt-1"><Lencana nada="muted">Halaqoh nonaktif</Lencana></p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
            <div role="group" aria-label="Rentang" className="inline-flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
              {([['3', '3 bulan'], ['6', '6 bulan'], ['semester', 'Semester']] as const).map(([v, l]) => (
                <Link key={v} href={href({ rentang: v === '6' ? undefined : v })} scroll={false} aria-current={rentang === v ? 'true' : undefined}
                  className={cn('rounded-[7px] px-3 py-1.5 text-[13px] font-semibold', rentang === v ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {l}
                </Link>
              ))}
            </div>
            {bolehLihatHalaqoh && (
              <>
                <Link href={`/halaqoh/${id}/progres${bulan === bulanKini ? '' : `?periode=${bulan}`}`}
                  className="inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-[13px] font-bold hover:border-primary/40">
                  <CalendarDays className="h-4 w-4" /> Progres harian
                </Link>
                <Link href={`/halaqoh/${id}`} className="inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-[13px] font-bold hover:border-primary/40">
                  <Settings2 className="h-4 w-4" /> Halaqoh
                </Link>
              </>
            )}
          </div>
        </div>

        {n === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Belum ada siswa aktif di halaqoh ini{scope ? ' dalam cakupan program Anda' : ''}.
          </p>
        ) : (
          <>
            {/* ── Lima angka ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="Kehadiran" value={hadirPct === null ? '—' : `${hadirPct}%`}
                tone={hadirPct !== null && hadirPct < AMBANG_HADIR ? 'destructive' : undefined}
                sub={hadirPct === null ? `Belum ada presensi ${monthName(bulan)}` : `${monthName(bulan).slice(0, 3)} · ${hadirSemua.izin} izin, ${hadirSemua.sakit} sakit, ${hadirSemua.alfa} alfa`} />
              <KpiCard label="Setor / anak / pekan" value={setorPerAnakPekan === null ? '—' : angka(setorPerAnakPekan)}
                sub={`dari ${mingguan.pekan.length} pekan ${monthName(bulan)} · jalur sekolah`} />
              <KpiCard label="Tahsin" value={kini?.tahsin == null ? '—' : angka(kini.tahsin)}
                sub={<>hlm lulus / anak · <Selisih m="tahsin" kini={kini?.tahsin ?? null} lalu={lalu?.tahsin ?? null} berjalan={analitik.berjalan} /></>} />
              <KpiCard label="Tahfidz" value={kini?.tahfidz == null ? '—' : angka(kini.tahfidz)}
                sub={<>hlm ziyadah / anak · <Selisih m="tahfidz" kini={kini?.tahfidz ?? null} lalu={lalu?.tahfidz ?? null} berjalan={analitik.berjalan} /></>} />
              <KpiCard label="Sesuai target tahfidz" value={terukur.length ? `${sesuai}/${terukur.length}` : '—'}
                tone={dibawah > 0 ? 'warning' : undefined}
                sub={terukur.length ? `${dibawah} di bawah target · per hari ini` : 'Belum ada anak yang terukur'} />
            </div>

            {/* ── Grafik & sebaran ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <section className="min-w-0 rounded-2xl border bg-card p-5 md:p-6">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-heading text-lg font-medium leading-tight md:text-xl">{JUDUL_GRAFIK[grafik]}</h2>
                  <div role="group" aria-label="Metrik grafik" className="inline-flex gap-0.5 rounded-[10px] bg-muted p-[3px]">
                    {GRAFIK.map(m => (
                      <Link key={m} href={href({ grafik: m === 'tahsin' ? undefined : m })} scroll={false} aria-current={grafik === m ? 'true' : undefined}
                        className={cn('rounded-[7px] px-3 py-1.5 text-[13px] font-semibold', grafik === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                        {m === 'tahsin' ? 'Tahsin' : m === 'tahfidz' ? 'Tahfidz' : 'Hafalan'}
                      </Link>
                    ))}
                  </div>
                </div>
                {kartu ? (
                  <GrafikTrenHalaqoh titik={titikGrafik} labelSeri={det.nama} labelRata={labelSejawat}
                    format={v => teksMetrik(grafik, v)} berjalan={analitik.berjalan && metrikAliran(grafik)} judul={`${LABEL_METRIK[grafik]} ${det.nama}`} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data tren untuk halaqoh ini.</p>
                )}
              </section>

              <Panel title="Sebaran tahap" sub="Posisi tahsin anak hari ini">
                <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {sebaran.map((s, i) => (
                    <div key={s.label} style={{ width: `${(s.n / n) * 100}%`, background: warnaTahap(s.label, i) }} title={`${s.label}: ${s.n}`} />
                  ))}
                </div>
                <ul className="mt-3 divide-y">
                  {sebaran.map((s, i) => (
                    <li key={s.label} className="flex items-center gap-2.5 py-2 text-sm">
                      <span className="size-3 shrink-0 rounded-[3px] border" style={{ background: warnaTahap(s.label, i) }} aria-hidden />
                      <span className="flex-1">{s.label}</span>
                      <b className="tabular-nums">{s.n} anak</b>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">Laporan per pekan · {monthName(bulan).slice(0, 3)}</span>
                  <TitikPekan pekan={pekan} />
                </div>
              </Panel>
            </div>

            {/* ── Per siswa ── */}
            <section className="min-w-0 rounded-2xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3 md:px-6">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 className="font-heading text-lg font-medium md:text-xl">Per siswa</h2>
                  <span className="text-xs text-muted-foreground">yang paling perlu dibantu di atas · {labelBulan}</span>
                </div>
                <div className="-mx-1 max-w-full overflow-x-auto px-1">
                  <ChipFilter label="Saring siswa" chips={[
                    { label: 'Semua', count: n, href: href({ saring: undefined }), active: !saring },
                    { label: 'Di bawah target', count: hitung.bawah, href: href({ saring: 'bawah' }), active: saring === 'bawah' },
                    { label: 'Drill', count: hitung.drill, href: href({ saring: 'drill' }), active: saring === 'drill' },
                    { label: 'Siap diuji', count: hitung.uji, href: href({ saring: 'uji' }), active: saring === 'uji' },
                  ]} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead>
                    <tr className="border-y text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-5 py-2.5 md:px-6">Siswa</th>
                      <th className="px-2 py-2.5">Posisi kini</th>
                      <th className="px-2 py-2.5">Laju bulan ini</th>
                      <th className="px-2 py-2.5">Target tahfidz</th>
                      <th className="px-2 py-2.5 text-right">Hadir</th>
                      <th className="px-2 py-2.5">Terakhir setor</th>
                      <th className="px-5 py-2.5 md:px-6">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {barisTampil.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-6 text-center text-sm text-muted-foreground">Tidak ada siswa untuk saringan ini.</td></tr>
                    )}
                    {barisTampil.map(b => {
                      const lulus = b.tahap === 'Lulus'
                      return (
                        <tr key={b.id} className="align-middle">
                          <td className="px-5 py-3 md:px-6">
                            <span className="block font-bold">{b.nama}</span>
                            <span className="block text-xs text-muted-foreground">{b.kelas ? `Kelas ${b.kelas}` : '—'}</span>
                          </td>
                          <td className="px-2 py-3 font-semibold">{b.posisi ?? <span className="font-normal text-muted-foreground">Belum tercatat</span>}</td>
                          <td className="px-2 py-3">
                            {!lulus && (
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
                                  <span className={cn('block h-full rounded-full', b.tahsinBulan === 0 ? 'bg-accent-warm' : 'bg-primary')}
                                    style={{ width: `${(b.tahsinBulan / maksTahsin) * 100}%` }} />
                                </span>
                                <b className="tabular-nums">{b.tahsinBulan} hlm</b>
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground tabular-nums">{lulus ? 'Ziyadah ' : 'tahfidz '}{angka(b.tahfidzBulan)} hlm</span>
                          </td>
                          <td className="px-2 py-3">
                            {!b.t ? <span className="text-muted-foreground">—</span>
                              : b.t.status === 'di_bawah' ? <Lencana nada="destructive">Di bawah target</Lencana>
                              : b.t.status === 'sesuai' ? <Lencana nada="info">Sesuai</Lencana>
                              : b.t.status === 'di_atas' ? <Lencana nada="success">Di atas target</Lencana>
                              : <Lencana nada="muted">{b.t.status === 'belum_terukur' ? 'Belum terukur' : 'Tanpa target'}</Lencana>}
                          </td>
                          <td className={cn('px-2 py-3 text-right font-semibold tabular-nums', b.ph !== null && b.ph < AMBANG_HADIR && 'text-destructive')}>
                            {b.ph === null ? '—' : `${b.ph}%`}
                          </td>
                          <td className={cn('px-2 py-3 font-semibold', (b.lalu.hari === null || b.lalu.hari > AMBANG_TAK_SETOR) && 'text-destructive')}>
                            {b.lalu.hari === null ? <span>&gt; {jumlahBulan} bulan</span> : b.lalu.teks}
                          </td>
                          <td className="px-5 py-3 md:px-6">
                            <span className="flex flex-wrap gap-1">
                              {b.drillTahsinHari !== null && <Lencana nada="warning">drill jilid {b.drillTahsinHari} hari</Lencana>}
                              {b.drillJuzHari !== null && <Lencana nada="warning">drill juz {b.drillJuzHari} hari</Lencana>}
                              {b.uji && <Lencana nada="info">siap diuji</Lencana>}
                              {!b.drill && !b.uji && <span className="text-muted-foreground">—</span>}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Catatan & ujian ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Panel title="Yang perlu diperhatikan" sub="Disusun dari aturan tetap, bukan penilaian.">
                {catatan.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada catatan khusus untuk {monthName(bulan)}.</p>
                ) : (
                  <ul className="divide-y">
                    {catatan.map((c, i) => (
                      <li key={i} className="flex gap-3 py-3 text-sm leading-relaxed first:pt-0">
                        <span className={cn('mt-2 size-2 shrink-0 rounded-full',
                          c.nada === 'destructive' ? 'bg-destructive' : c.nada === 'warning' ? 'bg-accent-warm' : 'bg-primary')} aria-hidden />
                        <span><b>{c.tebal}</b> {c.teks}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Ujian tahfidz semester ini" sub={`Sejak ${formatPeriod(awalSemesterBulan)} · ujian tahsin belum bisa dipetakan per halaqoh`}>
                {det.ujian.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada ujian tahfidz anak halaqoh ini di semester ini.</p>
                ) : (
                  <ul className="divide-y">
                    {det.ujian.slice(0, 10).map((u, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0">
                        <span className="min-w-0">
                          <span className="block truncate">{LABEL_TIPE[u.tipe] ?? 'Ujian'} · juz {u.juz}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.nama}</span>
                        </span>
                        {u.status === 'selesai' && u.predikat
                          ? <Lencana nada={u.predikat === 'mengulang' ? 'warning' : 'success'}>{LABEL_PREDIKAT[u.predikat] ?? u.predikat}</Lencana>
                          : <Lencana nada="muted">{u.status === 'dijadwalkan' ? 'Dijadwalkan' : u.status === 'selesai' ? 'Selesai' : 'Diajukan'}</Lencana>}
                      </li>
                    ))}
                    {det.ujian.length > 10 && <li className="pt-2.5 text-xs text-muted-foreground">dan {det.ujian.length - 10} ujian lain.</li>}
                  </ul>
                )}
              </Panel>
            </div>

            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Laju = halaman tahsin lulus (unik, bukan drill) dan halaman ziyadah, hanya setoran halaqoh sekolah. Pembanding grafik = rata-rata
              halaqoh {det.program ? programLabel(jenjang, det.program) : 'reguler'} di {UNIT_LABELS[jenjang]}. Target = target tahfidz per hari ini.
              Kehadiran dari presensi harian {labelBulan}. “Terakhir setor” mencari setoran apa pun dalam {jumlahBulan} bulan terakhir.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
