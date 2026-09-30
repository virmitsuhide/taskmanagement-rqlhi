import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, getAnalyticsProgramScope, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getKurikulum, type AngkatanRow } from '@/lib/data/kurikulum'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { statusTarget } from '@/lib/rq/level'
import { cn } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/** Skala teal terang → gelap untuk batang sebaran level (urut tangga level). */
const SKALA = ['#E4DED0', '#B8D4CB', '#7FB3A5', '#2F7A6B', '#236B5E', '#1A5A4F', '#15463F', '#0E3531', '#08241F']

/** Warna sel peta: ≥90 / 80–89 / 70–79 / < 70. */
function nadaSel(p: number): string {
  if (p >= 90) return 'bg-[#0E3531] text-white dark:bg-primary dark:text-primary-foreground'
  if (p >= 80) return 'bg-[#B8D4CB] text-[#0E3531]'
  if (p >= 70) return 'bg-accent-warm-wash text-accent-warm'
  return 'bg-destructive-wash text-destructive'
}

function namaAngkatan(r: AngkatanRow) {
  return `${JENJANG_LABELS[r.jenjang]} ${r.tingkat}`
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
  const program = getAnalyticsProgramScope(session.role)
  const { periods, rows } = await getKurikulum(period, scope, program)

  const semuaUnit = canViewAnalytics(session.role)
  const lingkup = semuaUnit
    ? 'seluruh unit'
    : program ? 'QULS SD' : scope.map(j => JENJANG_LABELS[j]).join(' · ')
  const totalSiswa = rows.reduce((t, r) => t + r.totalSiswa, 0)
  const totalTercapai = rows.reduce(
    (t, r) => t + (r.bulanan.find(b => b.period === period)?.tercapai ?? 0), 0,
  )
  const belumBertarget = rows.filter(r => !r.targetTahsin).length

  // Angkatan yang bulan terpilih tercatat tapi di bawah 80% — judul & catatan.
  const kini = (r: AngkatanRow) => r.bulanan.find(b => b.period === period)
  const perhatian = rows
    .filter(r => { const k = kini(r); return k && k.tercatat > 0 && k.percent < 80 })
    .sort((a, b) => (kini(a)?.percent ?? 0) - (kini(b)?.percent ?? 0))

  // Catatan yang bisa diturunkan dari data yang sudah dimuat.
  const catatan: { nada: 'danger' | 'warn' | 'good'; judul: string; isi: string }[] = []
  for (const r of perhatian.slice(0, 3)) {
    const k = kini(r)!
    const idx = r.bulanan.findIndex(b => b.period === period)
    const lalu = idx > 0 ? r.bulanan[idx - 1] : null
    const turun = lalu && lalu.tercatat > 0 && lalu.percent > k.percent
    catatan.push({
      nada: k.percent < 70 ? 'danger' : 'warn',
      judul: namaAngkatan(r),
      isi: turun
        ? `turun ke ${k.percent}% di ${monthName(period)} (dari ${lalu!.percent}% di ${monthName(lalu!.period)}).`
        : `${k.percent}% siswa mencapai target ${r.targetTahsin || ''} di ${monthName(period)}.`,
    })
  }
  const stabil = rows
    .filter(r => { const k = kini(r); return k && k.tercatat > 0 && k.percent >= 90 })
    .sort((a, b) => (kini(b)?.percent ?? 0) - (kini(a)?.percent ?? 0))[0]
  if (stabil) {
    catatan.push({
      nada: 'good',
      judul: namaAngkatan(stabil),
      isi: `paling tinggi bulan ini (${kini(stabil)!.percent}%).`,
    })
  }
  if (belumBertarget > 0) {
    catatan.push({
      nada: 'warn',
      judul: `${belumBertarget} angkatan`,
      isi: 'belum punya target semester ini — ketercapaiannya terhitung nol sampai Kumik menetapkannya.',
    })
  }

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Capaian Pembelajaran Al-Qur'an"
        showBack
        ownH1
      />

      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Analitik · kurikulum · {lingkup}
            </p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">
              {rows.length === 0 ? (
                <>Capaian Pembelajaran Al-Qur&apos;an</>
              ) : perhatian.length > 0 ? (
                <>
                  Target kurikulum —{' '}
                  <em>{perhatian.slice(0, 2).map(namaAngkatan).join(' dan ')} perlu perhatian.</em>
                </>
              ) : (
                <>
                  Target kurikulum — <em className="text-primary">semua angkatan di atas 80%.</em>
                </>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ketercapaian target tahsin &amp; tahfidz per angkatan · {formatPeriod(period)}
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center text-sm text-muted-foreground">
            Belum ada data siswa pada lingkup Anda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Tile label="Angkatan" value={String(rows.length)} />
              <Tile label="Siswa" value={String(totalSiswa)} />
              <Tile
                label={`Capai target ${monthName(period)}`}
                value={`${totalTercapai}`}
                hint={totalSiswa ? `${Math.round((totalTercapai / totalSiswa) * 100)}% dari ${totalSiswa}` : undefined}
              />
            </div>

            {/* Rekapitulasi lintas bulan — bentuk tabel 2.1.1 pada laporan. */}
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pb-3 pt-5">
                <h2 className="font-heading text-xl">Siswa yang memenuhi target bulanan</h2>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <Legenda kelas="bg-[#0E3531] dark:bg-primary" label="≥ 90%" />
                  <Legenda kelas="bg-[#B8D4CB]" label="80–89" />
                  <Legenda kelas="bg-accent-warm-wash border border-accent-warm/30" label="70–79" />
                  <Legenda kelas="bg-destructive-wash border border-destructive/30" label="< 70" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-x-2 border-spacing-y-0 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-2.5 pl-3 font-bold">Angkatan · target</th>
                      {periods.map(p => (
                        <th key={p} className={cn('py-2.5 text-center font-bold', p === period && 'text-foreground')}>
                          {monthName(p).slice(0, 3)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={`${row.jenjang}-${row.tingkat}`}>
                        <td className="whitespace-nowrap border-t py-2.5 pl-3 pr-2">
                          <p className="font-bold">{namaAngkatan(row)}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.targetTahsin || <span className="text-accent-warm">target belum diatur</span>}
                            {row.targetJuz && ` · Juz ${row.targetJuz}`}
                          </p>
                        </td>
                        {row.bulanan.map(b => (
                          <td key={b.period} className="border-t py-2">
                            {b.tercatat === 0 ? (
                              <div className="h-10 min-w-[56px] rounded-lg border border-dashed" title="belum ada catatan" />
                            ) : (
                              <div
                                className={cn(
                                  'flex h-10 min-w-[56px] flex-col items-center justify-center rounded-lg font-bold tabular-nums leading-tight',
                                  nadaSel(b.percent),
                                  b.period === period && 'ring-2 ring-offset-1 ring-primary/40 ring-offset-card',
                                )}
                                title={`${b.tercapai}/${row.totalSiswa} siswa`}
                              >
                                <span>{b.percent}%</span>
                                <span className="text-[10px] font-medium opacity-75">{b.tercapai}/{row.totalSiswa}</span>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 pb-5 pt-3 text-xs text-muted-foreground">
                Penyebutnya jumlah siswa angkatan, bukan yang tercatat — sama seperti laporan.
                Bulan yang gurunya belum mengisi wajar terlihat rendah; lihat halaman{' '}
                <Link href={`/dashboard/analitik/kelengkapan?periode=${period}`} className="font-semibold text-primary hover:underline">
                  Kelengkapan Pengisian
                </Link>{' '}
                untuk memastikan sebabnya.
              </p>
            </section>

            {catatan.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="font-heading text-xl">Yang perlu diperhatikan</h2>
                <ul className="mt-2 divide-y">
                  {catatan.map((c, i) => (
                    <li key={i} className="flex gap-3 py-3 text-sm">
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          c.nada === 'danger' ? 'bg-destructive' : c.nada === 'warn' ? 'bg-accent-warm' : 'bg-primary',
                        )}
                      />
                      <span><b>{c.judul}</b> {c.isi}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sebaran per angkatan — bentuk tabel per kelas pada laporan. */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {rows.map(row => (
                <Sebaran key={`sebaran-${row.jenjang}-${row.tingkat}`} row={row} period={period} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Sebaran({ row, period }: { row: AngkatanRow; period: string }) {
  const kosong = row.sebaran.every(s => s.jumlah === 0)
  const total = row.sebaran.reduce((t, s) => t + s.jumlah, 0)
  const dibawah = row.sebaran
    .filter(s => statusTarget(s.level, row.targetTahsin) === 'belum')
    .reduce((t, s) => t + s.jumlah, 0)
  const warna = (i: number) => SKALA[Math.min(i, SKALA.length - 1)]

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl">Sebaran level · {JENJANG_LABELS[row.jenjang]} Kelas {row.tingkat}</h2>
        <p className="text-xs text-muted-foreground">
          {row.totalSiswa} siswa · target {row.targetTahsin || '—'}
          {row.takTerbaca > 0 && ` · ${row.takTerbaca} catatan tak terbaca`}
        </p>
      </div>

      {kosong ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Belum ada catatan capaian untuk {formatPeriod(period)}.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-5 overflow-hidden rounded-md bg-muted">
            {row.sebaran.map((s, i) => s.jumlah > 0 && (
              <div
                key={s.level}
                style={{ width: `${(s.jumlah / total) * 100}%`, background: warna(i) }}
                title={`${s.level}: ${s.jumlah}`}
              />
            ))}
          </div>
          <ul className="mt-3 divide-y text-sm">
            {row.sebaran.map((s, i) => {
              const status = statusTarget(s.level, row.targetTahsin)
              const persen = row.totalSiswa ? Math.round((s.jumlah / row.totalSiswa) * 100) : 0
              return (
                <li key={s.level} className="flex items-center gap-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: warna(i) }} />
                  <span className="min-w-0 flex-1">
                    {s.level}
                    {status === 'sesuai' && <span className="ml-1.5 text-[10px] font-semibold text-primary">target</span>}
                  </span>
                  <span className="w-10 text-right font-bold tabular-nums">{s.jumlah}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{persen}%</span>
                </li>
              )
            })}
          </ul>
          {dibawah > 0 && (
            <p className="mt-2 text-xs font-bold text-accent-warm">
              {dibawah} anak masih di bawah target {row.targetTahsin}.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Legenda({ kelas, label }: { kelas: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-sm', kelas)} />
      {label}
    </span>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-3xl leading-none tabular-nums md:text-4xl">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
