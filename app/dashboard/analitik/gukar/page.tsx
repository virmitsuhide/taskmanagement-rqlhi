import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookMarked, ShieldCheck, TrendingUp, UserCheck, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewGukarRecap } from '@/lib/auth/permissions'
import { getCurrentTerm, formatTerm } from '@/lib/data/terms'
import { getGukarRecap, getGukarTrend, type GukarRecapRow } from '@/lib/data/gukar'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { GukarRecapTable } from '@/components/gukar/GukarRecapTable'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { GUKAR_TARGET_HADIR } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Analitik Halaqoh Qur'an Guru & Karyawan — SDM dan Kepala RQ.
 *
 * SDM sebagai pemilik program, Kepala RQ karena laporan bulanan ke BPH memuat
 * pembinaan guru. Pengampu tidak diarahkan ke sini: ia cukup melihat
 * kelompoknya sendiri di portal guru.
 */
export default async function GukarAnalitikPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewGukarRecap(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const term = await getCurrentTerm()
  const [rows, trend] = term
    ? await Promise.all([getGukarRecap(term.id, period), getGukarTrend(term.id, period)])
    : [[] as GukarRecapRow[], []]

  const target = Math.round(GUKAR_TARGET_HADIR * 100)
  const tercatat = rows.filter(r => r.slot > 0)
  const memenuhi = tercatat.filter(r => r.percent >= target)
  const belowTarget = tercatat
    .filter(r => r.percent < target)
    .sort((a, b) => a.percent - b.percent)

  const totalHadir = rows.reduce((t, r) => t + r.hadir, 0)
  const totalSlot = rows.reduce((t, r) => t + r.slot, 0)
  const rataKehadiran = totalSlot ? Math.round((totalHadir / totalSlot) * 100) : 0

  const perGroup = groupBy(rows, r => r.groupName, target)
  const perUnit = groupBy(rows, r => r.participant.unit || 'Tanpa unit', target)
  const puncakTren = Math.max(...trend.map(t => t.hadir), 1)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Analitik Halaqoh Qur'an Gukar"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">
              Pembinaan Guru &amp; Karyawan
            </p>
            <h1 className="text-2xl font-bold leading-tight">Analitik Halaqoh Qur&apos;an Gukar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {term ? formatTerm(term) : 'Belum ada semester berjalan'} · akumulasi s.d. {formatPeriod(period)}
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {/* Kehadiran menjawab "apakah programnya berjalan"; kesiapan standar
            menjawab "apakah orangnya memenuhi syarat kepegawaian". Dua
            pertanyaan berbeda, jadi dua halaman — tapi pintunya berdampingan. */}
        <Link
          href="/dashboard/analitik/gukar/standar"
          className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Kesiapan Standar Kepegawaian →</p>
            <p className="text-xs text-muted-foreground">
              Capaian tahsin &amp; tahfidz dibanding ambang Peraturan Kepegawaian Yayasan
            </p>
          </div>
        </Link>

        {!term || rows.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            {!term
              ? 'Belum ada semester berjalan. Tetapkan dulu di panel Tahun Ajaran.'
              : 'Belum ada kelompok pembinaan pada semester ini.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi icon={<Users className="h-4 w-4" />} label="Peserta" value={String(rows.length)} />
              <Kpi icon={<BookMarked className="h-4 w-4" />} label="Kelompok" value={String(perGroup.length)} />
              <Kpi
                icon={<UserCheck className="h-4 w-4" />}
                label={`Capai ≥ ${target}%`}
                value={`${memenuhi.length}`}
                hint={tercatat.length ? `dari ${tercatat.length} tercatat` : 'belum ada catatan'}
              />
              <Kpi
                icon={<TrendingUp className="h-4 w-4" />}
                label="Rata-rata hadir"
                value={`${rataKehadiran}%`}
                hint={totalSlot ? `${totalHadir} dari ${totalSlot} pekan` : '—'}
              />
            </div>

            {/* Lubang pencatatan sama pentingnya dengan capaiannya: bulan yang
                kosong berarti pengampunya belum mengisi, bukan peserta absen. */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">Tren Kehadiran per Bulan</h2>
              <div className="space-y-2">
                {trend.map(point => (
                  <div key={point.period} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {monthName(point.period)}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary/70"
                        style={{ width: `${Math.round((point.hadir / puncakTren) * 100)}%` }}
                      />
                    </div>
                    <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {point.tercatat === 0
                        ? 'belum dicatat'
                        : `${point.hadir}/${point.slot} · ${point.percent}%`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">Per Kelompok</h2>
              <Breakdown rows={perGroup} target={target} labelHead="Kelompok" />
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">Per Unit</h2>
              <Breakdown rows={perUnit} target={target} labelHead="Unit" />
            </section>

            {belowTarget.length > 0 && (
              <section className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold">
                  Perlu Perhatian — kehadiran di bawah {target}%
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  {belowTarget.length} peserta, diurutkan dari yang paling rendah.
                </p>
                <ul className="divide-y">
                  {belowTarget.slice(0, 20).map(row => (
                    <li key={row.participant.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm">{row.participant.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.groupName} · {row.pengampuName}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                        {row.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
                {belowTarget.length > 20 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    …dan {belowTarget.length - 20} peserta lain. Lihat tabel lengkap di bawah.
                  </p>
                )}
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Rincian Seluruh Peserta</h2>
              <GukarRecapTable rows={rows} target={target} />
            </section>
          </>
        )}
      </div>
    </div>
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

/** Ringkas baris rekap menurut satu penggolong (kelompok atau unit). */
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

function Breakdown({
  rows, target, labelHead,
}: {
  rows: BreakdownRow[]
  target: number
  labelHead: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-2 font-medium">{labelHead}</th>
            <th className="py-2 px-2 text-right font-medium">Peserta</th>
            <th className="py-2 px-2 text-right font-medium">Hadir</th>
            <th className="py-2 px-2 text-right font-medium">%</th>
            <th className="py-2 px-2 text-right font-medium">≥ {target}%</th>
            <th className="py-2 pl-2 text-right font-medium">Halaman</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-1.5 pr-2">{row.label}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{row.peserta}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {row.slot ? `${row.hadir}/${row.slot}` : '—'}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {row.slot ? (
                  <span className={row.percent >= target ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {row.percent}%
                  </span>
                ) : '—'}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                {row.tercatat ? `${row.memenuhi}/${row.tercatat}` : '—'}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">{row.halaman || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Kpi({
  icon, label, value, hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}
      >
        {icon}
      </span>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
