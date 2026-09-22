import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, canViewGukarRecap, canViewUnitAnalytics, getAnalyticsJenjang } from '@/lib/auth/permissions'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import {
  getRqAnalytics, getUnitHafalanBoards, getSetoranTrend, getHafalanUjianPerUnit, getSiswaDrill,
  type HafalanBoard,
} from '@/lib/data/analytics'
import { drillTahsinSemua, ujianSemua } from '@/lib/data/analitik-cache'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { SetoranTrendChart } from '@/components/dashboard/SetoranTrendChart'
import {
  DashTop, Panel, Slicer, MonthStepper, KpiCard, hrefDengan, persenUbah,
} from '@/components/dashboard/kit'
import { Seksi, SeksiNav, SeksiMemuat, type InfoSeksi } from '@/components/analitik/seksi'
import { PanelTindakLanjut } from '@/components/analitik/PanelTindakLanjut'
import { SeksiCapaian } from '@/components/analitik/SeksiCapaian'
import { SeksiTarget } from '@/components/analitik/SeksiTarget'
import { SeksiUjianDrill } from '@/components/analitik/SeksiUjianDrill'
import { SeksiKelengkapan } from '@/components/analitik/SeksiKelengkapan'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'
import {
  Users, BookMarked, BookOpen, Target, TrendingUp, Trophy, Layers, Repeat, ListChecks,
} from 'lucide-react'

type Fokus = 'semua' | 'tahsin' | 'tahfidz'

interface PageProps {
  searchParams: Promise<{ bulan?: string; unit?: string; fokus?: string }>
}

const PATH = '/dashboard/analitik'

const S = {
  ringkasan: { id: 'ringkasan', nomor: 1, label: 'Ringkasan' },
  capaian: { id: 'capaian', nomor: 2, label: 'Capaian per Kelas' },
  target: { id: 'target', nomor: 3, label: 'Target Tahfidz' },
  ujian: { id: 'ujian', nomor: 4, label: 'Ujian & Drill' },
  kelengkapan: { id: 'kelengkapan', nomor: 5, label: 'Kelengkapan' },
} satisfies Record<string, InfoSeksi>

/**
 * Dashboard analitik — SATU halaman laporan panjang, untuk manajemen dan
 * koordinator unit (koor SD/SMP melihat halaman yang sama, dikunci ke unitnya).
 *
 * Sebelumnya isi analitik tersebar di tujuh halaman. Kini semuanya dibaca
 * berurutan di sini, dalam lima seksi bernomor, dengan filter yang sama
 * (bulan · unit · program) di URL:
 *
 *   ① Ringkasan         — setoran & kenaikan bulan ini, tren, peringkat
 *   ② Capaian per Kelas — kelas × jilid / juz, ketercapaian target tahsin
 *   ③ Target Tahfidz    — posisi vs target program
 *   ④ Ujian & Drill     — yang menunggu ujian, juz yang sudah lulus
 *   ⑤ Kelengkapan       — halaqoh yang belum diisi guru
 *
 * Pembinaan guru & karyawan sengaja TIDAK di sini — lihat /dashboard/analitik/gukar.
 *
 * Aturan tak tertulis halaman ini: SATU informasi, SATU tempat. Panel
 * "Perlu Tindak Lanjut" di seksi ① hanya menghitung dan menautkan, tidak
 * mengulang rincian seksi di bawahnya.
 *
 * Seksi ②–⑤ masing-masing dibungkus Suspense: seksi yang kuerinya cepat
 * tampil lebih dulu, bukan menunggu seksi yang paling lambat. Datanya
 * dibagi lewat lib/data/analitik-cache.ts supaya ringkasan dan seksi tidak
 * mengulang kueri yang sama. Halaman rincian lama tetap ada sebagai tempat
 * daftar per siswa dan pengaturan, dan tetap dipakai koordinator unit.
 */
export default async function AnalitikPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const sp = await searchParams

  /*
    Koordinator melihat halaman yang SAMA dengan manajemen, hanya dipersempit
    ke unitnya sendiri (getAnalyticsJenjang — aturan yang sama dengan halaman
    rincian lain). Unitnya dikunci di sini, di server: ?unit= dari URL tidak
    bisa membuka unit lain, dan tidak ada pilihan "Semua".
  */
  const penuh = canViewAnalytics(session.role)
  const unitBoleh = penuh ? UNIT_ORDER : UNIT_ORDER.filter(j => getAnalyticsJenjang(session.role).includes(j))
  const unitDiminta = unitBoleh.includes(sp.unit as Jenjang) ? (sp.unit as Jenjang) : null
  const jenjang: Jenjang | null = penuh ? unitDiminta : (unitDiminta ?? unitBoleh[0] ?? null)
  if (!penuh && !jenjang) redirect('/dashboard')
  const fokus: Fokus = sp.fokus === 'tahsin' || sp.fokus === 'tahfidz' ? sp.fokus : 'semua'
  const bulanDiminta = /^\d{4}-\d{2}$/.test(sp.bulan ?? '') ? sp.bulan! : null
  const lihatGukar = canViewGukarRecap(session.role)

  const [a, semuaBoards, trend, semuaUjian, semuaDrill] = await Promise.all([
    getRqAnalytics({ bulan: bulanDiminta, jenjang }),
    getUnitHafalanBoards(),
    getSetoranTrend(12, jenjang),
    ujianSemua(),
    drillTahsinSemua(),
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

  const boards = jenjang ? semuaBoards.filter(b => b.jenjang === jenjang) : semuaBoards
  const target = ringkasTarget(boards)
  const aktif = a.overview.activeStudents
  const cakupan = jenjang ? UNIT_LABELS[jenjang] : 'Seluruh RQ'
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
  const drillTahsinTotal = semuaDrill.filter(u => !jenjang || u.jenjang === jenjang).reduce((n, u) => n + u.siswa.length, 0)

  const top = papanTeratas(boards)
  const seksi = Object.values(S).filter(s =>
    s.id !== 'target' || tampilTahfidz)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik RQ" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">

        {/* ── Z · garis atas halaman: judul ► filter ── */}
        <DashTop
          eyebrow={penuh ? 'Dashboard Manajemen' : 'Dashboard Koordinator'}
          title="Analitik Rumah Qur'an"
          context={<>{cakupan} · {a.monthLabel}{a.isRunningMonth && ' (berjalan)'}</>}
          filters={
            <>
              <MonthStepper label="Bulan" current={a.monthLabel} prevHref={bulanHref(iBulan - 1)} nextHref={bulanHref(iBulan + 1)} />
              <Slicer
                label="Unit"
                options={[
                  ...(penuh ? [{ label: 'Semua', href: href({ unit: undefined }), active: !jenjang }] : []),
                  ...unitBoleh.map(j => ({
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

        <SeksiNav seksi={seksi} />

        {/* ── ① Ringkasan ── */}
        <Seksi info={S.ringkasan} judul="Ringkasan" pertanyaan="Bagaimana setoran dan kenaikan siswa bulan ini?" catatan={a.monthLabel}>
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
                sub="Rincian di seksi Ujian & Drill"
              />
            )}
            {fokus === 'tahfidz' && (
              <KpiCard
                icon={<Target className="h-3.5 w-3.5" />}
                label="Sesuai / melampaui target"
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

          {/* Z · garis tengah: tren (utama) ► pekerjaan rumah */}
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <SetoranTrendChart trend={trend} highlightKey={a.monthKey} fokus={fokus} />
            </div>
            <Suspense fallback={<PanelMemuat className="lg:col-span-4" />}>
              <PanelTindakLanjut className="lg:col-span-4" jenjang={jenjang} fokus={fokus} bulan={a.monthKey} />
            </Suspense>
          </div>

          {/* Z · garis bawah: perbandingan unit ► peringkat */}
          <div className="grid items-start gap-5 lg:grid-cols-12">
            {unitBoleh.length > 1 && (
            <Panel
              className="lg:col-span-7"
              title="Perbandingan Unit"
              icon={<Layers className="h-4 w-4" />}
              sub="Klik nama unit untuk menyaring seluruh halaman."
            >
              <PerbandinganUnit
                boards={semuaBoards.filter(b => unitBoleh.includes(b.jenjang))}
                ujian={semuaUjian}
                drill={semuaDrill}
                aktifUnit={jenjang}
                hrefUnit={j => href({ unit: j })}
                fokus={fokus}
              />
            </Panel>
            )}

            <Panel
              className={unitBoleh.length > 1 ? 'lg:col-span-5' : 'lg:col-span-12'}
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
        </Seksi>

        <Suspense fallback={<SeksiMemuat info={S.capaian} judul="Capaian per Kelas" />}>
          <SeksiCapaian info={S.capaian} jenjang={jenjang} fokus={fokus} bulan={a.monthKey} />
        </Suspense>

        {tampilTahfidz && (
          <Suspense fallback={<SeksiMemuat info={S.target} judul="Target Tahfidz" />}>
            <SeksiTarget info={S.target} jenjang={jenjang} />
          </Suspense>
        )}

        <Suspense fallback={<SeksiMemuat info={S.ujian} judul="Ujian & Drill" />}>
          <SeksiUjianDrill info={S.ujian} jenjang={jenjang} fokus={fokus} />
        </Suspense>

        <Suspense fallback={<SeksiMemuat info={S.kelengkapan} judul="Kelengkapan Pengisian" />}>
          <SeksiKelengkapan info={S.kelengkapan} jenjang={jenjang} bulan={a.monthKey} />
        </Suspense>

        {/* Pembinaan guru & karyawan punya halaman sendiri: pesertanya
            pegawai, unitnya bukan jenjang siswa, dan pemiliknya SDM. */}
        {lihatGukar && (
          <Link href={`/dashboard/analitik/gukar${bulanDiminta ? `?periode=${bulanDiminta}` : ''}`}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              <BookMarked className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Analitik Halaqoh Qur&apos;an Guru &amp; Karyawan →</span>
              <span className="block text-xs text-muted-foreground">Nama yang perlu didampingi, capaian tahsin &amp; tahfidz per unit, kehadiran semester</span>
            </span>
          </Link>
        )}

        <p className="border-t pt-4 text-[11px] text-muted-foreground">
          Rincian per program dan per siswa:{' '}
          <Link href="/dashboard/analitik/unit" className="text-primary hover:underline">Analitik per Unit &amp; Program</Link>
          {' · '}
          <Link href="/dashboard/analitik/target-tahfidz" className="text-primary hover:underline">Target Tahfidz per Kelas</Link>
          {' · '}
          <Link href="/dashboard/analitik/kurikulum" className="text-primary hover:underline">Capaian per Angkatan</Link>
        </p>
      </div>
    </div>
  )
}

function PanelMemuat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)} aria-busy="true">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ListChecks className="h-4 w-4" /> Perlu Tindak Lanjut
      </p>
      <div className="space-y-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/60" />)}
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
