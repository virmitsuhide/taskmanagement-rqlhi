import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check, X, AlertTriangle } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewUnitAnalytics, getAnalyticsJenjang, getAnalyticsProgramScope, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getKelengkapan, type KelengkapanRow } from '@/lib/data/kelengkapan'
import { getKelengkapanMingguan, type PekanHalaqoh, type Pekan } from '@/lib/data/kelengkapan-mingguan'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { sesiJam } from '@/lib/rq/sesi'
import { cn } from '@/lib/utils'
import type { Jenjang } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Kelengkapan pengisian capaian bulanan — halaqoh mana yang gurunya belum
 * mengisi bulan ini.
 *
 * Terbuka untuk manajemen dan koordinator, dengan cakupan jenjang mengikuti
 * getAnalyticsJenjang: koor SD hanya melihat SD, koor SMP hanya SMP. Yang
 * perlu menagih pengisian memang koordinator unitnya.
 */
export default async function KelengkapanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const scope = getAnalyticsJenjang(session.role)
  const { rows, trend } = await getKelengkapan(period, scope, getAnalyticsProgramScope(session.role))

  const aktif = rows.filter(r => r.totalSiswa > 0)
  // Status per pekan — definisi "terisi" sama (setoran per sesi), hanya
  // dibagi per pekan Senin–Ahad dalam bulan terpilih.
  const mingguan = await getKelengkapanMingguan(period, aktif.map(r => r.halaqohId))
  const kosong = aktif.filter(r => r.terisi === 0)
  const sebagian = aktif.filter(r => r.terisi > 0 && r.terisi < r.totalSiswa)
  const lengkap = aktif.filter(r => r.totalSiswa > 0 && r.terisi === r.totalSiswa)

  const totalSiswa = aktif.reduce((t, r) => t + r.totalSiswa, 0)
  const totalTerisi = aktif.reduce((t, r) => t + r.terisi, 0)
  const persen = totalSiswa ? Math.round((totalTerisi / totalSiswa) * 100) : 0

  // Pembanding bulan sebelumnya — diambil dari tren yang sudah dimuat.
  const idx = trend.findIndex(t => t.period === period)
  const sebelum = idx > 0 ? trend[idx - 1] : null
  const selisih = sebelum && sebelum.terisi > 0 ? persen - sebelum.percent : null

  // Per unit (jenjang): dijumlah dari baris halaqoh.
  const perUnit = new Map<Jenjang, { siswa: number; terisi: number }>()
  for (const r of aktif) {
    const u = perUnit.get(r.jenjang) ?? { siswa: 0, terisi: 0 }
    u.siswa += r.totalSiswa
    u.terisi += r.terisi
    perUnit.set(r.jenjang, u)
  }
  const units = [...perUnit.entries()].map(([j, u]) => ({
    jenjang: j,
    persen: u.siswa ? Math.round((u.terisi / u.siswa) * 100) : 0,
    terisi: u.terisi,
    siswa: u.siswa,
  }))

  // Terendah dulu — yang paling perlu ditagih di atas.
  const urut = [...aktif].sort((a, b) => a.percent - b.percent || a.terisi - b.terisi)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelengkapan Pengisian"
        showBack
        ownH1
      />

      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Analitik · kelengkapan pengisian
            </p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[38px]">
              {aktif.length === 0 ? (
                <>Kelengkapan pengisian capaian</>
              ) : (
                <>
                  Capaian {monthName(period)} <em className="text-primary">{persen}% terisi</em>
                  {selisih !== null && selisih !== 0 && sebelum && (
                    <span className="text-muted-foreground">
                      {' '}— {selisih > 0 ? 'naik' : 'turun'} {Math.abs(selisih)} poin dari {monthName(sebelum.period)}
                    </span>
                  )}
                </>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Halaqoh mana yang belum diisi gurunya · {formatPeriod(period)}
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {aktif.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center text-sm text-muted-foreground">
            Belum ada halaqoh berisi siswa pada lingkup Anda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile
                label="Siswa terisi"
                value={<>{persen}<span className="text-lg">%</span></>}
                hint={`${totalTerisi} dari ${totalSiswa} siswa`}
                tone="primary"
              />
              <Tile
                label="Halaqoh lengkap"
                value={String(lengkap.length)}
                hint={`dari ${aktif.length} halaqoh`}
              />
              <Tile
                label="Terlambat > 2 hari"
                value={String(mingguan.terlambat)}
                hint={`dari ${mingguan.totalCatatan} catatan setoran · ${sebagian.length} halaqoh terisi sebagian`}
                tone={mingguan.terlambat > 0 ? 'warn' : undefined}
              />
              <Tile
                label="Belum diisi sama sekali"
                value={String(kosong.length)}
                hint="halaqoh bulan ini"
                tone={kosong.length > 0 ? 'danger' : undefined}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              {/* Pola antar bulan sering lebih menjelaskan daripada angka satu
                  bulan: bulan yang kosong merata biasanya berarti belum waktunya
                  diisi, bukan gurunya lalai. */}
              <section className="rounded-2xl border bg-card p-5 lg:col-span-8">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-heading text-xl">Tren kelengkapan</h2>
                  <span className="text-xs text-muted-foreground">% siswa terisi per bulan</span>
                </div>
                {trend.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Belum ada data bulan sebelumnya.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <div className="flex min-w-max items-end gap-2 border-b pb-0 sm:min-w-0">
                      {trend.map(t => {
                        const aktifBulan = t.period === period
                        return (
                          <div key={t.period} className="flex min-w-[44px] flex-1 flex-col items-center">
                            <span className={cn('mb-1.5 text-xs font-bold tabular-nums', aktifBulan ? 'text-foreground' : 'text-muted-foreground')}>
                              {t.terisi === 0 ? '—' : `${t.percent}%`}
                            </span>
                            <div className="flex h-36 w-full items-end justify-center">
                              <div
                                className={cn('w-full max-w-[44px] rounded-t-md', aktifBulan ? 'bg-[#0E3531] dark:bg-primary' : 'bg-primary/80')}
                                style={{ height: `${Math.max(t.percent, t.terisi > 0 ? 3 : 0)}%` }}
                                title={t.terisi === 0 ? 'belum ada' : `${t.terisi} siswa · ${t.percent}%`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex min-w-max gap-2 pt-2 sm:min-w-0">
                      {trend.map(t => (
                        <span key={t.period} className="min-w-[44px] flex-1 text-center text-xs text-muted-foreground">
                          {monthName(t.period).slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border bg-card p-5 lg:col-span-4">
                <h2 className="font-heading text-xl">Per unit</h2>
                <div className="mt-4 space-y-4">
                  {units.map(u => (
                    <div key={u.jenjang}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-bold">{JENJANG_LABELS[u.jenjang]}</span>
                        <span className={cn('font-bold tabular-nums', u.persen < 85 ? 'text-accent-warm' : 'text-foreground')}>
                          {u.persen}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', u.persen < 85 ? 'bg-accent-warm' : 'bg-primary')}
                          style={{ width: `${u.persen}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{u.terisi} dari {u.siswa} siswa</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-3 pt-5">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-heading text-xl">Per halaqoh</h2>
                  <span className="text-xs text-muted-foreground">terendah dulu</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Dot status="lengkap" small /> lengkap tepat waktu</span>
                  <span className="inline-flex items-center gap-1"><Dot status="sebagian" small /> sebagian / terlambat</span>
                  <span className="inline-flex items-center gap-1"><Dot status="belum" small /> tidak ada setoran</span>
                </div>
              </div>
              <p className="px-5 pb-3 text-[11px] text-muted-foreground">
                Per pekan (Senin–Ahad): siswa terisi bila punya setoran tahsin/tahfidz pekan itu.
                Terlambat = dicatat lebih dari 2 hari setelah tanggal setoran. Capaian akhir
                bulanan tidak bertanggal, jadi hanya ikut di kolom Terisi &amp; Total.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-y text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="px-5 py-2.5 font-bold">Halaqoh</th>
                      <th className="px-3 py-2.5 font-bold">Pengampu</th>
                      {mingguan.pekan.map((p, i) => (
                        <th key={p.dari} className="px-2 py-2.5 text-center font-bold" title={rentang(p)}>
                          Pek {i + 1}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 font-bold">Terisi</th>
                      <th className="px-5 py-2.5 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urut.map(row => (
                      <BarisHalaqoh
                        key={row.halaqohId}
                        row={row}
                        pekan={mingguan.pekan}
                        perPekan={mingguan.perHalaqoh[row.halaqohId] ?? []}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {rows.length > aktif.length && (
              <p className="text-xs text-muted-foreground">
                {rows.length - aktif.length} halaqoh belum punya siswa — tidak dihitung karena
                tidak ada yang bisa diisi gurunya.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type Status = 'lengkap' | 'sebagian' | 'belum'

function statusOf(r: KelengkapanRow): Status {
  if (r.terisi === 0) return 'belum'
  if (r.terisi < r.totalSiswa) return 'sebagian'
  return 'lengkap'
}

function rentang(p: Pekan): string {
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return p.dari === p.sampai ? f(p.dari) : `${f(p.dari)} – ${f(p.sampai)}`
}

function statusPekan(w: PekanHalaqoh): Status {
  return w.status === 'kosong' ? 'belum' : w.status
}

function judulPekan(p: Pekan, w: PekanHalaqoh): string {
  const bagian = [`${rentang(p)}: ${w.terisi}/${w.total} siswa setor`]
  if (w.terlambat > 0) bagian.push(`${w.terlambat} catatan terlambat`)
  return bagian.join(' · ')
}

function BarisHalaqoh({
  row, pekan, perPekan,
}: {
  row: KelengkapanRow
  pekan: Pekan[]
  perPekan: PekanHalaqoh[]
}) {
  const s = statusOf(row)
  return (
    <tr className="border-b last:border-0">
      <td className="px-5 py-3">
        <Link href={`/halaqoh/${row.halaqohId}`} className="font-bold hover:underline">
          {row.halaqohName}
        </Link>
        <p className="text-xs text-muted-foreground">
          {[JENJANG_LABELS[row.jenjang], row.sesi ? sesiJam(row.sesi) : null].filter(Boolean).join(' · ')}
        </p>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{row.pengampu}</td>
      {pekan.map((p, i) => {
        const w = perPekan[i]
        return (
          <td key={p.dari} className="px-2 py-3 text-center">
            {w ? (
              <span title={judulPekan(p, w)} className="inline-flex">
                <Dot status={statusPekan(w)} />
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </td>
        )
      })}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', s === 'lengkap' ? 'bg-primary' : s === 'sebagian' ? 'bg-accent-warm' : 'bg-destructive')}
              style={{ width: `${row.percent}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{row.terisi}/{row.totalSiswa}</span>
        </div>
      </td>
      <td
        className={cn(
          'px-5 py-3 text-right font-bold tabular-nums',
          s === 'lengkap' ? 'text-primary' : s === 'sebagian' ? 'text-accent-warm' : 'text-destructive',
        )}
      >
        {row.percent}%
      </td>
    </tr>
  )
}

function Dot({ status, small }: { status: Status; small?: boolean }) {
  const size = small ? 'h-3.5 w-3.5' : 'h-6 w-6'
  const icon = small ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
  if (status === 'lengkap') {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground', size)} aria-label="lengkap">
        <Check className={icon} strokeWidth={3} />
      </span>
    )
  }
  if (status === 'sebagian') {
    return (
      <span className={cn('inline-flex items-center justify-center rounded-md bg-accent-warm text-white', size)} aria-label="terisi sebagian">
        <AlertTriangle className={icon} strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md bg-destructive text-white', size)} aria-label="belum diisi">
      <X className={icon} strokeWidth={3} />
    </span>
  )
}

function Tile({
  label, value, hint, tone,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'primary' | 'warn' | 'danger'
}) {
  const toneClass =
    tone === 'danger' ? 'text-destructive'
      : tone === 'warn' ? 'text-accent-warm'
        : tone === 'primary' ? 'text-primary'
          : ''
  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-heading text-4xl leading-none tabular-nums', toneClass)}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
