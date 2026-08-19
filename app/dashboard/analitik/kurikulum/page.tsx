import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getKurikulum } from '@/lib/data/kurikulum'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { statusTarget } from '@/lib/rq/level'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Capaian Pembelajaran Al-Qur'an per angkatan — bentuk bab 02 Laporan Eksekutif.
 *
 * Cakupannya mengikuti getAnalyticsJenjang: Kumik dan Kepala RQ melihat
 * seluruh unit, koordinator hanya unitnya sendiri. Aturan itu sudah dipakai
 * analitik lain, jadi tidak dibuat aturan baru yang bisa menyimpang darinya.
 */
export default async function KurikulumPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const scope = getAnalyticsJenjang(session.role)
  const { periods, rows } = await getKurikulum(period, scope)

  const semuaUnit = canViewAnalytics(session.role)
  const totalSiswa = rows.reduce((t, r) => t + r.totalSiswa, 0)
  const totalTercapai = rows.reduce(
    (t, r) => t + (r.bulanan.find(b => b.period === period)?.tercapai ?? 0), 0,
  )
  const belumBertarget = rows.filter(r => !r.targetTahsin).length

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Capaian Pembelajaran Al-Qur'an"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">
              {semuaUnit
                ? 'Seluruh Unit'
                : `Unit ${scope.map(j => JENJANG_LABELS[j]).join(' · ')}`}
            </p>
            <h1 className="text-2xl font-bold leading-tight">Capaian Pembelajaran Al-Qur&apos;an</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ketercapaian target tahsin &amp; tahfidz per angkatan · {formatPeriod(period)}
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Belum ada data siswa pada lingkup Anda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Angkatan" value={String(rows.length)} />
              <Kpi label="Siswa" value={String(totalSiswa)} />
              <Kpi
                label={`Capai target ${monthName(period)}`}
                value={`${totalTercapai}`}
                hint={totalSiswa ? `${Math.round((totalTercapai / totalSiswa) * 100)}% dari ${totalSiswa}` : undefined}
              />
            </div>

            {belumBertarget > 0 && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                {belumBertarget} angkatan belum punya target semester ini — ketercapaiannya
                terhitung nol sampai Kumik menetapkannya.
              </p>
            )}

            {/* Rekapitulasi lintas bulan — bentuk tabel 2.1.1 pada laporan. */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Rekapitulasi Ketercapaian Target</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Jumlah siswa yang mencapai target, dibandingkan seluruh siswa angkatan.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Angkatan</th>
                      <th className="py-2 px-2 font-medium">Target</th>
                      {periods.map(p => (
                        <th key={p} className="py-2 px-2 text-right font-medium">{monthName(p).slice(0, 3)}</th>
                      ))}
                      <th className="py-2 pl-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const kini = row.bulanan.find(b => b.period === period)
                      return (
                        <tr key={`${row.jenjang}-${row.tingkat}`} className="border-b last:border-0">
                          <td className="py-2 pr-2 font-medium whitespace-nowrap">
                            {JENJANG_LABELS[row.jenjang]} {row.tingkat}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                            {row.targetTahsin || <span className="text-amber-600">belum diatur</span>}
                            {row.targetJuz && <span className="text-xs"> · juz {row.targetJuz}</span>}
                          </td>
                          {row.bulanan.map(b => (
                            <td key={b.period} className="py-2 px-2 text-right tabular-nums">
                              {b.tercatat === 0
                                ? <span className="text-muted-foreground">—</span>
                                : `${b.tercapai}/${row.totalSiswa}`}
                            </td>
                          ))}
                          <td className="py-2 pl-2 text-right tabular-nums font-medium">
                            {kini?.tercatat ? `${kini.percent}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Penyebutnya jumlah siswa angkatan, bukan yang tercatat — sama seperti laporan.
                Bulan yang gurunya belum mengisi wajar terlihat rendah; lihat halaman
                Kelengkapan Pengisian untuk memastikan sebabnya.
              </p>
            </section>

            {/* Sebaran per angkatan — bentuk tabel per kelas pada laporan. */}
            {rows.map(row => (
              <section key={`sebaran-${row.jenjang}-${row.tingkat}`} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {JENJANG_LABELS[row.jenjang]} Kelas {row.tingkat}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {row.totalSiswa} siswa · target {row.targetTahsin || '—'}
                    {row.takTerbaca > 0 && ` · ${row.takTerbaca} catatan tak terbaca`}
                  </p>
                </div>

                {row.sebaran.every(s => s.jumlah === 0) ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Belum ada catatan capaian untuk {formatPeriod(period)}.
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {row.sebaran.map(s => {
                      const status = statusTarget(s.level, row.targetTahsin)
                      const lebar = row.totalSiswa ? Math.round((s.jumlah / row.totalSiswa) * 100) : 0
                      return (
                        <div key={s.level} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-xs">
                            {s.level}
                            {status === 'sesuai' && (
                              <span className="ml-1 text-[10px] text-primary">target</span>
                            )}
                          </span>
                          <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                            <div
                              className={`h-full rounded ${
                                status === 'belum' ? 'bg-amber-500/60'
                                  : status === 'sesuai' ? 'bg-primary/70'
                                    : 'bg-emerald-500/60'
                              }`}
                              style={{ width: `${lebar}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {s.jumlah}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
