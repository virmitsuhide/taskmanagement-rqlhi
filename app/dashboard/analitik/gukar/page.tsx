import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookMarked, BookOpen, Building2, CalendarRange, ShieldCheck, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewGukarRecap } from '@/lib/auth/permissions'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import {
  getGukarPerhatian, getGukarRecap, getGukarTrend,
  type GukarPerhatian, type GukarRecapRow, type GukarTrendPoint, type UnitBulan,
} from '@/lib/data/gukar'
import { getKesiapanGukar } from '@/lib/data/gukar-standar'
import { matriksCapaianGukar } from '@/lib/data/gukar-capaian-unit'
import { BELUM_TERCATAT, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { GukarRecapTable } from '@/components/gukar/GukarRecapTable'
import { GukarPerhatianPanel } from '@/components/gukar/GukarPerhatianPanel'
import { MatriksCapaianTable } from '@/components/dashboard/MatriksCapaianTable'
import { DashTop, Panel } from '@/components/dashboard/kit'
import { Seksi, SeksiNav, Kunci, type InfoSeksi } from '@/components/analitik/seksi'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { cn } from '@/lib/utils'
import { GUKAR_TARGET_HADIR } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

const S = {
  bulan: { id: 'bulan-ini', nomor: 1, label: 'Bulan Ini' },
  capaian: { id: 'capaian-unit', nomor: 2, label: 'Capaian per Unit' },
  semester: { id: 'semester', nomor: 3, label: 'Akumulasi Semester' },
} satisfies Record<string, InfoSeksi>

/**
 * Analitik Halaqoh Qur'an Guru & Karyawan — SDM dan Kepala RQ.
 *
 * Satu-satunya tempat analitik gukar: sejak halaman Analitik RQ menjadi satu
 * halaman panjang, seksi gukar-nya dipindah ke sini supaya analitik siswa
 * dan analitik pegawai tidak bercampur — pesertanya berbeda, unitnya
 * berbeda, dan pemiliknya pun berbeda (SDM).
 *
 * Tiga seksi, dari yang paling mendesak:
 *   ① Bulan Ini          — siapa yang perlu didampingi, keaktifan per unit & kelompok
 *   ② Capaian per Unit   — unit × tahap tahsin, unit × juz (s.d. bulan terpilih)
 *   ③ Akumulasi Semester — tren kehadiran, per kelompok, rincian per peserta
 *
 * Pengampu tidak diarahkan ke sini: ia cukup melihat kelompoknya sendiri di
 * portal guru.
 */
export default async function GukarAnalitikPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewGukarRecap(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const term = await getCurrentTerm()
  const [rows, trend, perhatian, kesiapan] = term
    ? await Promise.all([
      getGukarRecap(term.id, period), getGukarTrend(term.id, period),
      getGukarPerhatian(term.id, period), getKesiapanGukar(term.id, period),
    ])
    : [[] as GukarRecapRow[], [] as GukarTrendPoint[], null as GukarPerhatian | null, null]

  const target = Math.round(GUKAR_TARGET_HADIR * 100)
  const bulanTeks = formatPeriod(period)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik Halaqoh Qur'an Gukar" showBack ownH1 />

      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <DashTop
          eyebrow="Pembinaan Guru & Karyawan"
          title="Analitik Halaqoh Qur'an Gukar"
          context={<>{term ? formatTerm(term) : 'Belum ada semester berjalan'} · {bulanTeks}</>}
          filters={<PeriodPicker period={period} />}
        />

        {!term || !perhatian || rows.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            {!term
              ? 'Belum ada semester berjalan. Tetapkan dulu di panel Tahun Ajaran.'
              : 'Belum ada kelompok pembinaan pada semester ini.'}
          </p>
        ) : (
          <>
            <SeksiNav seksi={Object.values(S)} />
            <SeksiBulanIni data={perhatian} period={period} target={target} />
            {kesiapan && <SeksiCapaianUnit matriks={matriksCapaianGukar(kesiapan.peserta)} bulan={bulanTeks} />}
            <SeksiSemester rows={rows} trend={trend} target={target} period={period} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── ① Bulan ini ────────────────────────────────────────────────────────────

function SeksiBulanIni({ data, period, target }: { data: GukarPerhatian; period: string; target: number }) {
  const hadir = data.perUnit.reduce((n, u) => n + u.hadir, 0)
  const slot = data.perUnit.reduce((n, u) => n + u.slot, 0)
  const aktif = data.perUnit.reduce((n, u) => n + u.aktif, 0)
  const perlu = data.peserta.filter(p => p.status !== 'belum_direkap').length
  const kelompokKosong = data.kelompok.filter(k => k.direkap === 0).length
  const persenHadir = slot ? Math.round((hadir / slot) * 100) : null
  const kelompok = [...data.kelompok].sort((a, b) =>
    (a.slot ? a.percent : -1) - (b.slot ? b.percent : -1) || a.nama.localeCompare(b.nama))

  return (
    <Seksi
      info={S.bulan}
      judul="Bulan Ini"
      pertanyaan="Siapa yang perlu didampingi, dan unit mana yang tertinggal?"
      catatan={formatPeriod(period)}
      kunci={
        <>
          <Kunci label="Aktif" nilai={`${aktif}/${data.totalPeserta}`} />
          <Kunci label="Kehadiran" nilai={persenHadir === null ? '—' : `${persenHadir}%`}
            nada={persenHadir === null ? 'netral' : persenHadir >= target ? 'baik' : 'waspada'} />
          <Kunci label="Perlu perhatian" nilai={perlu} nada={perlu > 0 ? 'bahaya' : 'baik'} />
          <Kunci label="Kelompok blm rekap" nilai={kelompokKosong} nada={kelompokKosong > 0 ? 'waspada' : 'baik'} />
        </>
      }
    >
      <GukarPerhatianPanel data={data} bulan={formatPeriod(period)} berjalan={period === currentPeriod()} target={target} />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <Panel
          className="lg:col-span-7"
          title="Keaktifan per Unit"
          icon={<Building2 className="h-4 w-4" />}
          sub="Aktif = hadir minimal sekali bulan ini · % hadir dari sesi yang sudah direkap"
        >
          <TabelUnit rows={data.perUnit} target={target} />
        </Panel>

        <Panel
          className="lg:col-span-5"
          title="Kehadiran per Kelompok"
          icon={<Users className="h-4 w-4" />}
          sub={`Terendah di atas · garis = target ${target}%`}
        >
          <ul className="space-y-2">
            {kelompok.map(k => (
              <li key={k.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_3.5rem] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{k.pengampu}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{k.nama} · {k.unit}</p>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                  {k.slot > 0 && (
                    <div className="h-full rounded-full"
                      style={{ width: `${k.percent}%`, background: k.percent >= target ? 'var(--primary)' : 'var(--warning)' }} />
                  )}
                  <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${target}%` }} aria-hidden />
                </div>
                <span className="text-right text-xs tabular-nums">
                  {k.slot > 0
                    ? <><span className="font-semibold">{k.percent}%</span><span className="block text-[10px] text-muted-foreground">{k.aktif}/{k.peserta}</span></>
                    : <span className="text-destructive">blm rekap</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Seksi>
  )
}

/** Bentuk tabel 3.3 Laporan SDM — unit terbesar di atas. */
function TabelUnit({ rows, target }: { rows: UnitBulan[]; target: number }) {
  const total = rows.reduce(
    (t, u) => ({
      peserta: t.peserta + u.peserta, aktif: t.aktif + u.aktif, belumMengaji: t.belumMengaji + u.belumMengaji,
      hadir: t.hadir + u.hadir, slot: t.slot + u.slot, direkap: t.direkap + u.direkap,
    }),
    { peserta: 0, aktif: 0, belumMengaji: 0, hadir: 0, slot: 0, direkap: 0 },
  )
  const baris = (label: string, u: typeof total, tebal = false) => {
    const persenAktif = u.peserta ? Math.round((u.aktif / u.peserta) * 100) : 0
    const persenHadir = u.slot ? Math.round((u.hadir / u.slot) * 100) : null
    const td = cn('py-1.5 text-right tabular-nums', tebal ? 'border-t-2 font-semibold' : 'border-t')
    return (
      <tr key={label}>
        <td className={cn('truncate py-1.5 pr-2', tebal ? 'border-t-2 font-semibold' : 'border-t font-medium')} title={label}>{label}</td>
        <td className={td}>{u.peserta}</td>
        <td className={td}>{u.aktif}</td>
        <td className={cn(td, 'hidden sm:table-cell')}>{u.peserta - u.aktif}</td>
        <td className={td}>
          {u.belumMengaji > 0 ? <span className="text-destructive">{u.belumMengaji}</span> : <span className="text-muted-foreground">0</span>}
        </td>
        <td className={td}>
          <span className={persenAktif >= target ? 'text-success' : 'text-warning'}>{persenAktif}%</span>
        </td>
        <td className={td}>
          {persenHadir === null
            ? <span className="text-muted-foreground" title="Belum ada kehadiran yang direkap">—</span>
            : <span className={persenHadir >= target ? 'text-success' : 'text-warning'}>{persenHadir}%</span>}
        </td>
      </tr>
    )
  }
  return (
    <table className="w-full table-fixed text-xs sm:text-sm">
      <thead>
        <tr className="text-left text-[10px] text-muted-foreground sm:text-[11px]">
          <th className="pb-2 pr-2 font-medium">Unit</th>
          <th className="w-9 pb-2 text-right font-medium sm:w-12">N</th>
          <th className="w-10 pb-2 text-right font-medium sm:w-14">Aktif</th>
          <th className="hidden w-14 pb-2 text-right font-medium sm:table-cell">Tdk aktif</th>
          <th className="w-12 pb-2 text-right font-medium sm:w-16" title="Belum mengaji">Blm ngaji</th>
          <th className="w-12 pb-2 text-right font-medium sm:w-16">% Aktif</th>
          <th className="w-12 pb-2 text-right font-medium sm:w-16">% Hadir</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(u => baris(u.unit, u))}
        {rows.length > 1 && baris('Total', total, true)}
      </tbody>
    </table>
  )
}

// ─── ② Capaian per unit ─────────────────────────────────────────────────────

function SeksiCapaianUnit({ matriks, bulan }: { matriks: { tahsin: MatriksCapaian; tahfidz: MatriksCapaian }; bulan: string }) {
  const persen = (m: MatriksCapaian) => {
    const i = m.kolom.indexOf(BELUM_TERCATAT)
    const tercatat = m.total - (i === -1 ? 0 : m.jumlahKolom[i])
    return tercatat > 0 ? `${Math.round((m.maju / tercatat) * 100)}%` : '—'
  }
  const belum = (m: MatriksCapaian) => {
    const i = m.kolom.indexOf(BELUM_TERCATAT)
    return i === -1 ? 0 : m.jumlahKolom[i]
  }
  const kosong = 'Belum ada peserta pembinaan pada semester ini.'

  return (
    <Seksi
      info={S.capaian}
      judul="Capaian per Unit"
      pertanyaan="Sampai tahap tahsin dan juz mana guru & karyawan tiap unit?"
      catatan={`capaian terakhir tercatat s.d. ${bulan}`}
      kunci={
        <>
          <Kunci label="Tahsin ≥ Jilid 6" nilai={persen(matriks.tahsin)} />
          <Kunci label="Tahfidz ≥ 1 juz" nilai={persen(matriks.tahfidz)} />
          <Kunci label="Belum tercatat" nilai={`${belum(matriks.tahsin)} · ${belum(matriks.tahfidz)}`}
            nada={belum(matriks.tahsin) + belum(matriks.tahfidz) > 0 ? 'waspada' : 'baik'} />
        </>
      }
    >
      <Panel title="Capaian Tahsin per Unit" icon={<BookOpen className="h-4 w-4" />}
        sub="Tahap tahsin terakhir tiap orang · Syajaroh dihitung terpisah, tidak dipetakan ke jilid UMMI"
        action={{ href: '/dashboard/analitik/gukar/standar', label: 'Standar kepegawaian' }}>
        <MatriksCapaianTable matriks={matriks.tahsin} kosong={kosong} kepalaBaris="Unit" satuan="orang" />
      </Panel>
      <Panel title="Capaian Tahfidz per Unit" icon={<BookMarked className="h-4 w-4" />}
        sub="Juz yang sedang dihafal · urutan hafalan 30 → 26, lalu 1 dst. · “Lainnya” = tercatat tapi juz-nya tak terbaca">
        <MatriksCapaianTable matriks={matriks.tahfidz} kosong={kosong} kepalaBaris="Unit" satuan="orang" />
      </Panel>
    </Seksi>
  )
}

// ─── ③ Akumulasi semester ───────────────────────────────────────────────────

function SeksiSemester({ rows, trend, target, period }: {
  rows: GukarRecapRow[]
  trend: GukarTrendPoint[]
  target: number
  period: string
}) {
  const tercatat = rows.filter(r => r.slot > 0)
  const memenuhi = tercatat.filter(r => r.percent >= target)
  const belowTarget = tercatat.filter(r => r.percent < target).sort((a, b) => a.percent - b.percent)
  const totalHadir = rows.reduce((t, r) => t + r.hadir, 0)
  const totalSlot = rows.reduce((t, r) => t + r.slot, 0)
  const rata = totalSlot ? Math.round((totalHadir / totalSlot) * 100) : null
  const perGroup = groupBy(rows, r => r.groupName, target)
  const puncak = Math.max(...trend.map(t => t.hadir), 1)

  return (
    <Seksi
      info={S.semester}
      judul="Akumulasi Semester"
      pertanyaan="Bagaimana kehadiran sepanjang semester sejauh ini?"
      catatan={`s.d. ${formatPeriod(period)}`}
      kunci={
        <>
          <Kunci label="Rata-rata hadir" nilai={rata === null ? '—' : `${rata}%`}
            nada={rata === null ? 'netral' : rata >= target ? 'baik' : 'waspada'} />
          <Kunci label={`Capai ≥ ${target}%`} nilai={tercatat.length ? `${memenuhi.length}/${tercatat.length}` : '—'} />
          <Kunci label={`Di bawah ${target}%`} nilai={belowTarget.length} nada={belowTarget.length > 0 ? 'waspada' : 'baik'} />
        </>
      }
    >
      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* Lubang pencatatan sama pentingnya dengan capaiannya: bulan yang
            kosong berarti pengampunya belum mengisi, bukan peserta absen. */}
        <Panel className="lg:col-span-4" title="Tren Kehadiran" icon={<CalendarRange className="h-4 w-4" />}
          sub="Bulan kosong = belum direkap, bukan absen">
          <div className="space-y-2">
            {trend.map(t => (
              <div key={t.period} className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-xs text-muted-foreground">{monthName(t.period).slice(0, 3)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(t.hadir / puncak) * 100}%`, background: 'var(--primary)' }} />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {t.tercatat === 0 ? 'belum' : `${t.hadir}/${t.slot} · ${t.percent}%`}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-8" title="Per Kelompok" icon={<Users className="h-4 w-4" />}
          sub="Akumulasi semester · kelompok terbesar di atas">
          <Breakdown rows={perGroup} target={target} />
        </Panel>
      </div>

      {belowTarget.length > 0 && (
        <Panel title={`Kehadiran Semester di Bawah ${target}%`} icon={<ShieldCheck className="h-4 w-4" />}
          sub={`${belowTarget.length} peserta, dari yang paling rendah`}>
          <ul className="grid gap-x-6 divide-y sm:grid-cols-2 sm:divide-y-0">
            {belowTarget.slice(0, 20).map(row => (
              <li key={row.participant.id} className="flex items-center justify-between gap-3 py-1.5 sm:border-b">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.participant.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{row.groupName} · {row.pengampuName}</p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-warning">{row.percent}%</span>
              </li>
            ))}
          </ul>
          {belowTarget.length > 20 && (
            <p className="mt-2 text-xs text-muted-foreground">…dan {belowTarget.length - 20} peserta lain di tabel rincian.</p>
          )}
        </Panel>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Rincian Seluruh Peserta</h3>
        <GukarRecapTable rows={rows} target={target} />
      </section>

      <p className="text-[11px] text-muted-foreground">
        Kesiapan terhadap ambang Peraturan Kepegawaian Yayasan:{' '}
        <Link href="/dashboard/analitik/gukar/standar" className="text-primary hover:underline">Standar Kepegawaian →</Link>
      </p>
    </Seksi>
  )
}

interface BreakdownRow {
  label: string
  peserta: number
  hadir: number
  slot: number
  percent: number
  halaman: number
  memenuhi: number
  tercatat: number
}

/** Ringkas baris rekap menurut satu penggolong. */
function groupBy(
  rows: GukarRecapRow[],
  keyOf: (row: GukarRecapRow) => string,
  target: number,
): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>()

  for (const row of rows) {
    const label = keyOf(row)
    const entry = map.get(label) ?? {
      label, peserta: 0, hadir: 0, slot: 0, percent: 0, halaman: 0, memenuhi: 0, tercatat: 0,
    }
    entry.peserta += 1
    entry.hadir += row.hadir
    entry.slot += row.slot
    entry.halaman += row.halaman
    if (row.slot > 0) {
      entry.tercatat += 1
      if (row.percent >= target) entry.memenuhi += 1
    }
    map.set(label, entry)
  }

  for (const entry of map.values()) {
    entry.percent = entry.slot ? Math.round((entry.hadir / entry.slot) * 100) : 0
  }

  return [...map.values()].sort((a, b) => b.peserta - a.peserta)
}

function Breakdown({ rows, target }: { rows: BreakdownRow[]; target: number }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-left text-[11px] text-muted-foreground">
          <th className="py-2 pr-2 font-medium">Kelompok</th>
          <th className="w-14 py-2 text-right font-medium">Peserta</th>
          <th className="hidden w-16 py-2 text-right font-medium sm:table-cell">Hadir</th>
          <th className="w-12 py-2 text-right font-medium">%</th>
          <th className="w-14 py-2 text-right font-medium">≥ {target}%</th>
          <th className="hidden w-16 py-2 pl-2 text-right font-medium md:table-cell">Halaman</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label} className="border-b last:border-0">
            <td className="truncate py-1.5 pr-2" title={row.label}>{row.label}</td>
            <td className="py-1.5 text-right tabular-nums">{row.peserta}</td>
            <td className="hidden py-1.5 text-right tabular-nums text-muted-foreground sm:table-cell">
              {row.slot ? `${row.hadir}/${row.slot}` : '—'}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {row.slot ? <span className={row.percent >= target ? 'text-success' : 'text-warning'}>{row.percent}%</span> : '—'}
            </td>
            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
              {row.tercatat ? `${row.memenuhi}/${row.tercatat}` : '—'}
            </td>
            <td className="hidden py-1.5 pl-2 text-right tabular-nums md:table-cell">{row.halaman || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
