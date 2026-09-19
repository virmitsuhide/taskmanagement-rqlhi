import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, canViewGukarRecap } from '@/lib/auth/permissions'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import {
  getRqAnalytics, getUnitHafalanBoards, getSetoranTrend, getHafalanUjianPerUnit, getSiswaDrill, getDrillTahfidz,
  type HafalanBoard,
} from '@/lib/data/analytics'
import { DrillTahsinBoard } from '@/components/dashboard/DrillTahsinBoard'
import { DrillTahfidzBoard } from '@/components/dashboard/DrillTahfidzBoard'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { HafalanUjianBoard } from '@/components/dashboard/HafalanUjianBoard'
import { SetoranTrendChart } from '@/components/dashboard/SetoranTrendChart'
import {
  DashTop, Panel, GroupLabel, Slicer, MonthStepper, KpiCard, StackedBar, ActionRow, hrefDengan, persenUbah,
} from '@/components/dashboard/kit'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'
import {
  Users, GraduationCap, BookMarked, BookOpen, ClipboardList, Target, TrendingUp, Trophy, Activity,
  ArrowDown, Check, ArrowUp, HelpCircle, Layers, Repeat,
} from 'lucide-react'

type Fokus = 'semua' | 'tahsin' | 'tahfidz'

interface PageProps {
  searchParams: Promise<{ bulan?: string; unit?: string; fokus?: string }>
}

const PATH = '/dashboard/analitik'

/**
 * Dashboard analitik manajemen — tata letak Z:
 *
 *   judul & cakupan ─────────────────────► filter (bulan · unit · program)
 *                         ╱
 *   ◄──────── 4 KPI ─────╱
 *   tren 12 bulan (lebar) ─────────────► kondisi hari ini & tindak lanjut
 *                         ╱
 *   perbandingan unit ────────────────► 10 besar hafalan
 *
 * lalu rincian dan tautan laporan di bawahnya. Semua filter tinggal di URL.
 */
export default async function AnalitikPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams
  const jenjang = UNIT_ORDER.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : null
  const fokus: Fokus = sp.fokus === 'tahsin' || sp.fokus === 'tahfidz' ? sp.fokus : 'semua'
  const bulanDiminta = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') ? sp.bulan! : null

  const [a, semuaBoards, trend, semuaUjian, semuaDrill, drillTahfidz] = await Promise.all([
    getRqAnalytics({ bulan: bulanDiminta, jenjang }),
    getUnitHafalanBoards(),
    getSetoranTrend(12, jenjang),
    getHafalanUjianPerUnit(),
    getSiswaDrill(),
    getDrillTahfidz(jenjang ? [jenjang] : undefined),
  ])

  // Bulan dibatasi ke jendela tren 12 bulan — di luar itu tidak ada titik
  // pembanding, dan grafik tidak bisa menyorotnya.
  const kunciBulan = trend.points.map(p => p.key)
  const iBulan = kunciBulan.indexOf(a.monthKey)
  if (bulanDiminta && iBulan === -1) redirect(hrefDengan(PATH, { ...sp, bulan: undefined }, {}))
  const titik = trend.points[iBulan]
  const titikLalu = iBulan > 0 ? trend.points[iBulan - 1] : undefined

  const params = { bulan: bulanDiminta ?? undefined, unit: jenjang ?? undefined, fokus: fokus === 'semua' ? undefined : fokus }
  const href = (ganti: Record<string, string | undefined>) => hrefDengan(PATH, params, ganti)
  const bulanHref = (i: number) =>
    i < 0 || i >= kunciBulan.length ? null : href({ bulan: i === kunciBulan.length - 1 ? undefined : kunciBulan[i] })

  const saringUnit = <T extends { jenjang: Jenjang }>(xs: T[]) => (jenjang ? xs.filter(x => x.jenjang === jenjang) : xs)
  const boards = saringUnit(semuaBoards)
  const ujian = saringUnit(semuaUjian)
  const drill = saringUnit(semuaDrill)

  const target = ringkasTarget(boards)
  const drillBelumDiajukan = drill.reduce((n, u) => n + u.belumDiajukan, 0)
  const drillTahsinTotal = drill.reduce((n, u) => n + u.siswa.length, 0)
  const aktif = a.overview.activeStudents
  const cakupan = jenjang ? UNIT_LABELS[jenjang] : "Seluruh RQ"
  const tampilTahsin = fokus !== 'tahfidz'
  const tampilTahfidz = fokus !== 'tahsin'

  // Delta hanya untuk bulan yang sudah tutup: bulan berjalan belum lengkap,
  // dan membandingkannya dengan bulan penuh selalu tampak anjlok.
  const deltaSiswa = (pick: (p: { tahsin: number; tahfidz: number }) => number) =>
    a.isRunningMonth || !titik || !titikLalu || titikLalu.isBeforeData
      ? undefined
      : { pct: persenUbah(pick(titikLalu), pick(titik)), vs: titikLalu.full }
  const tercatat = (n: number | undefined) =>
    !titik || titik.isBeforeData ? '—' : (n ?? 0)
  const catatanBerjalan = a.isRunningMonth ? 'Bulan berjalan · belum final' : undefined

  const naikIni = (tampilTahsin ? a.monthly.jilidPromotions : 0) + (tampilTahfidz ? a.monthly.juzPromotions : 0)
  const naikLalu = (tampilTahsin ? a.prevMonthly.jilidPromotions : 0) + (tampilTahfidz ? a.prevMonthly.juzPromotions : 0)

  const top = papanTeratas(boards)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik RQ" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">

        {/* ── Z · garis atas: judul ► filter ── */}
        <DashTop
          eyebrow="Dashboard Manajemen"
          title="Analitik Rumah Qur'an"
          context={<>{cakupan} · {a.monthLabel}{a.isRunningMonth && ' (berjalan)'}</>}
          filters={
            <>
              <MonthStepper label="Bulan" current={a.monthLabel} prevHref={bulanHref(iBulan - 1)} nextHref={bulanHref(iBulan + 1)} />
              <Slicer
                label="Unit"
                options={[
                  { label: 'Semua', href: href({ unit: undefined }), active: !jenjang },
                  ...UNIT_ORDER.map(j => ({
                    label: UNIT_LABELS[j], href: href({ unit: j }), active: jenjang === j,
                  })),
                ]}
              />
              <Slicer
                label="Program"
                options={(['semua', 'tahsin', 'tahfidz'] as Fokus[]).map(f => ({
                  label: f === 'semua' ? 'Semua' : f === 'tahsin' ? 'Tahsin' : 'Tahfidz',
                  href: href({ fokus: f === 'semua' ? undefined : f }),
                  active: fokus === f,
                }))}
              />
            </>
          }
        />

        {/* ── Z · diagonal: KPI ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-3.5 w-3.5" />}
            label="Siswa aktif"
            value={aktif}
            sub={`${a.overview.activeHalaqoh.toLocaleString('id-ID')} halaqoh · ${a.overview.activeTeachers.toLocaleString('id-ID')} guru`}
          />
          {tampilTahsin && (
            <KpiCard
              icon={<BookOpen className="h-3.5 w-3.5" />}
              label="Tercatat tahsin"
              value={tercatat(titik?.tahsin)}
              unit={aktif > 0 && titik && !titik.isBeforeData ? `/ ${aktif.toLocaleString('id-ID')}` : undefined}
              ratio={aktif > 0 && titik && !titik.isBeforeData ? titik.tahsin / aktif : undefined}
              delta={deltaSiswa(p => p.tahsin)}
              sub={catatanBerjalan ?? (!titik || titik.isBeforeData ? 'Belum ada data bulan ini' : undefined)}
            />
          )}
          {tampilTahfidz && (
            <KpiCard
              icon={<BookMarked className="h-3.5 w-3.5" />}
              label="Tercatat tahfidz"
              value={tercatat(titik?.tahfidz)}
              unit={aktif > 0 && titik && !titik.isBeforeData ? `/ ${aktif.toLocaleString('id-ID')}` : undefined}
              ratio={aktif > 0 && titik && !titik.isBeforeData ? titik.tahfidz / aktif : undefined}
              delta={deltaSiswa(p => p.tahfidz)}
              sub={catatanBerjalan ?? (!titik || titik.isBeforeData ? 'Belum ada data bulan ini' : undefined)}
            />
          )}
          {/* Program tunggal: slot yang kosong diisi KPI kondisi program itu. */}
          {fokus === 'tahsin' && (
            <KpiCard
              icon={<Repeat className="h-3.5 w-3.5" />}
              label="Sedang drill tahsin"
              value={drillTahsinTotal}
              sub={drillBelumDiajukan > 0 ? `${drillBelumDiajukan} belum diajukan ujian` : 'Semua sudah diajukan ujian'}
            />
          )}
          {fokus === 'tahfidz' && (
            <KpiCard
              icon={<Target className="h-3.5 w-3.5" />}
              label="Sesuai / di atas target"
              value={target.terukur > 0 ? `${Math.round(((target.on + target.above) / target.terukur) * 100)}%` : '—'}
              ratio={target.terukur > 0 ? (target.on + target.above) / target.terukur : undefined}
              sub={target.terukur > 0 ? `dari ${target.terukur.toLocaleString('id-ID')} siswa terukur · hari ini` : 'Belum ada siswa terukur'}
            />
          )}
          <KpiCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={fokus === 'tahsin' ? 'Kenaikan jilid' : fokus === 'tahfidz' ? 'Kenaikan juz' : 'Kenaikan jilid · juz'}
            value={fokus === 'semua'
              ? `${a.monthly.jilidPromotions.toLocaleString('id-ID')} · ${a.monthly.juzPromotions.toLocaleString('id-ID')}`
              : naikIni}
            delta={a.isRunningMonth ? undefined : { pct: persenUbah(naikLalu, naikIni), vs: a.prevMonthLabel }}
            sub={catatanBerjalan ?? `${a.juzTerujiTotal.toLocaleString('id-ID')} juz teruji (lulus ujian)`}
          />
        </div>

        {/* ── Z · garis tengah: tren (utama) ► kondisi hari ini ── */}
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SetoranTrendChart trend={trend} highlightKey={a.monthKey} fokus={fokus} />
          </div>

          <Panel
            className="lg:col-span-4"
            title="Kondisi Hari Ini"
            icon={<Activity className="h-4 w-4" />}
            sub="Posisi siswa sekarang — tidak mengikuti filter bulan."
          >
            <div className="space-y-5">
              {tampilTahfidz && (
                <div>
                  <p className="mb-2 flex items-center justify-between text-xs font-semibold">
                    <span>Posisi vs target tahfidz</span>
                    <Link href="/dashboard/analitik/target-tahfidz" className="font-normal text-primary hover:underline">Rincian →</Link>
                  </p>
                  {target.berlaku ? (
                    <StackedBar segments={[
                      { label: 'Di bawah target', value: target.below, color: 'var(--destructive)', icon: <ArrowDown className="h-3.5 w-3.5" /> },
                      { label: 'Sesuai target', value: target.on, color: 'var(--success)', icon: <Check className="h-3.5 w-3.5" /> },
                      { label: 'Di atas target', value: target.above, color: 'var(--info)', icon: <ArrowUp className="h-3.5 w-3.5" /> },
                      { label: 'Belum terukur', value: target.belumTerukur, color: 'var(--muted-foreground)', icon: <HelpCircle className="h-3.5 w-3.5" /> },
                    ]} />
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                      {aktif === 0 ? `Belum ada siswa aktif di ${cakupan}.` : `${cakupan} belum punya rencana target tahfidz.`}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold">Perlu tindak lanjut</p>
                <div className="-mx-2">
                  {tampilTahsin && (
                    <ActionRow count={drillBelumDiajukan} tone="destructive" href="#drill-tahsin"
                      label="siswa drill tahsin belum diajukan ujian" />
                  )}
                  {tampilTahfidz && (
                    <>
                      <ActionRow count={drillTahfidz.sedang.length} href="#drill-tahfidz"
                        label="juz tuntas ziyadah, menunggu diajukan ujian" />
                      <ActionRow count={target.below} href="/dashboard/analitik/target-tahfidz"
                        label="siswa tertinggal dari target tahfidz" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* ── Z · garis bawah: perbandingan unit ► papan hafalan ── */}
        <div className="grid items-start gap-5 lg:grid-cols-12">
          <Panel
            className="lg:col-span-7"
            title="Perbandingan Unit"
            icon={<Layers className="h-4 w-4" />}
            sub="Klik nama unit untuk menyaring seluruh dashboard."
          >
            <PerbandinganUnit
              boards={semuaBoards}
              ujian={semuaUjian}
              drill={semuaDrill}
              aktifUnit={jenjang}
              hrefUnit={j => href({ unit: j })}
              fokus={fokus}
            />
          </Panel>

          <Panel
            className="lg:col-span-5"
            title="10 Besar Hafalan"
            icon={<Trophy className="h-4 w-4" />}
            sub={`${cakupan} · juz dari setoran atau ujian, yang terjauh`}
          >
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data hafalan di {cakupan}.</p>
            ) : (
              <ol className="divide-y">
                {top.map((s, i) => (
                  <li key={s.id}>
                    <Link href={`/siswa/${s.id}`} className="flex items-center gap-3 py-1.5 hover:bg-muted/40"
                      title={s.totalAyat > 0 ? `${s.totalAyat.toLocaleString('id-ID')} ayat disetor` : undefined}>
                      <span className={cn('w-5 shrink-0 text-xs font-bold tabular-nums', i < 3 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[!jenjang ? s.unit : null, s.kelas ? `Kelas ${s.kelas}` : null].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block">
                        <span className="block h-full rounded-full" style={{ width: `${(s.juzCount / Math.max(1, top[0].juzCount)) * 100}%`, background: 'var(--primary)' }} />
                      </span>
                      <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{s.juzCount} juz</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* ── Rincian ── */}
        <GroupLabel note={`${cakupan} · kondisi hari ini`}>Rincian</GroupLabel>
        {tampilTahfidz && <HafalanUjianBoard units={ujian} />}
        {tampilTahsin && <div id="drill-tahsin" className="scroll-mt-4"><DrillTahsinBoard units={drill} /></div>}
        {tampilTahfidz && <div id="drill-tahfidz" className="scroll-mt-4"><DrillTahfidzBoard data={drillTahfidz} showUnit={!jenjang} /></div>}

        {/* ── Laporan lanjutan ── */}
        <GroupLabel>Laporan Lanjutan</GroupLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <TautanLaporan href="/dashboard/analitik/unit" icon={<GraduationCap className="h-4 w-4" />}
            judul="Analitik per Unit & Program" ket="Capaian tahsin & tahfidz, ujian juz'iyah & tasmi' tiap unit/program" />
          <TautanLaporan href="/dashboard/analitik/target-tahfidz" icon={<Target className="h-4 w-4" />}
            judul="Target Tahfidz Bulanan" ket="Target per program & kelas, kalender pekan efektif, siswa yang tertinggal" />
          <TautanLaporan href="/dashboard/analitik/kelengkapan" icon={<ClipboardList className="h-4 w-4" />}
            judul="Kelengkapan Pengisian Capaian" ket="Halaqoh mana yang gurunya belum mengisi capaian bulan ini" />
          {/* Pembinaan gukar dipisah dari analitik siswa: pesertanya pegawai,
              satuannya bulanan, dan pemiliknya SDM. */}
          {canViewGukarRecap(session.role) && (
            <TautanLaporan href="/dashboard/analitik/gukar" icon={<BookMarked className="h-4 w-4" />}
              judul="Halaqoh Qur'an Guru & Karyawan" ket="Capaian tahsin & tahfidz dan kehadiran pembinaan pegawai" />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bantu ───────────────────────────────────────────────────────────────────

function ringkasTarget(boards: HafalanBoard[]) {
  const berlaku = boards.filter(b => b.target.berlaku)
  const jumlah = (f: (b: HafalanBoard) => number) => berlaku.reduce((n, b) => n + f(b), 0)
  const below = jumlah(b => b.target.below)
  const on = jumlah(b => b.target.on)
  const above = jumlah(b => b.target.above)
  return {
    berlaku: berlaku.length > 0,
    below, on, above,
    belumTerukur: jumlah(b => b.target.belumTerukur),
    terukur: below + on + above,
  }
}

function papanTeratas(boards: HafalanBoard[]) {
  return boards
    .flatMap(b => b.top10.map(s => ({ ...s, unit: b.label })))
    .filter(s => s.juzCount > 0)
    .sort((x, y) => y.juzCount - x.juzCount || y.totalAyat - x.totalAyat)
    .slice(0, 10)
}

/**
 * Tabel antar-unit. Satu baris per unit dalam urutan jenjang (ordinal — tidak
 * diurut ulang menurut nilai). Unit tanpa rencana target ditulis "—", bukan
 * "0%": tidak berlaku berbeda dari nol.
 */
function PerbandinganUnit({ boards, ujian, drill, aktifUnit, hrefUnit, fokus }: {
  boards: HafalanBoard[]
  ujian: Awaited<ReturnType<typeof getHafalanUjianPerUnit>>
  drill: Awaited<ReturnType<typeof getSiswaDrill>>
  aktifUnit: Jenjang | null
  hrefUnit: (j: Jenjang) => string
  fokus: Fokus
}) {
  const maksSiswa = Math.max(1, ...boards.map(b => b.studentCount))
  if (boards.every(b => b.studentCount === 0)) {
    return <p className="text-sm text-muted-foreground">Belum ada data siswa.</p>
  }
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Unit</th>
            <th className="pb-2 pr-3 font-medium">Siswa</th>
            {fokus !== 'tahsin' && <th className="pb-2 pr-3 text-right font-medium">Di bawah target</th>}
            {fokus !== 'tahsin' && <th className="pb-2 pr-3 text-right font-medium">Juz teruji</th>}
            {fokus !== 'tahfidz' && <th className="pb-2 text-right font-medium">Drill tahsin</th>}
          </tr>
        </thead>
        <tbody>
          {boards.map(b => {
            const u = ujian.find(x => x.jenjang === b.jenjang)
            const d = drill.find(x => x.jenjang === b.jenjang)
            const terukur = b.target.below + b.target.on + b.target.above
            const aktif = aktifUnit === b.jenjang
            return (
              <tr key={b.jenjang} className={cn('border-b last:border-0', aktif && 'bg-primary-wash')}>
                <td className="py-2.5 pr-3">
                  <Link href={hrefUnit(b.jenjang)} scroll={false} className={cn('hover:underline', aktif ? 'font-semibold text-primary' : 'font-medium')}>
                    {b.label}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 shrink-0 tabular-nums">{b.studentCount.toLocaleString('id-ID')}</span>
                    <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${(b.studentCount / maksSiswa) * 100}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                </td>
                {fokus !== 'tahsin' && (
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {!b.target.berlaku || terukur === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className={cn('font-semibold', b.target.below / terukur >= 0.4 ? 'text-destructive' : b.target.below / terukur >= 0.2 ? 'text-warning' : 'text-success')}>
                          {Math.round((b.target.below / terukur) * 100)}%
                        </span>
                        <span className="ml-1 text-[11px] text-muted-foreground">({b.target.below})</span>
                      </>
                    )}
                  </td>
                )}
                {fokus !== 'tahsin' && (
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {u ? <>{u.totalJuz.toLocaleString('id-ID')} <span className="text-[11px] text-muted-foreground">· {u.siswaTeruji} siswa</span></> : <span className="text-muted-foreground">—</span>}
                  </td>
                )}
                {fokus !== 'tahfidz' && (
                  <td className="py-2.5 text-right tabular-nums">
                    {d && d.siswa.length > 0 ? (
                      <>
                        {d.siswa.length}
                        {d.belumDiajukan > 0 && <span className="ml-1 text-[11px] text-destructive">({d.belumDiajukan} belum)</span>}
                      </>
                    ) : <span className="text-muted-foreground">0</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {fokus !== 'tahsin' && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Di bawah target = persen dari siswa yang terukur; &ldquo;—&rdquo; berarti unit itu belum punya rencana target.
        </p>
      )}
    </div>
  )
}

function TautanLaporan({ href, icon, judul, ket }: { href: string; icon: React.ReactNode; judul: string; ket: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{judul} →</p>
        <p className="text-xs text-muted-foreground">{ket}</p>
      </div>
    </Link>
  )
}
