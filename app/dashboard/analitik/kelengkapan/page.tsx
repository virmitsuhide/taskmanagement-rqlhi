import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewUnitAnalytics, getAnalyticsJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getKelengkapan } from '@/lib/data/kelengkapan'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { currentPeriod, formatPeriod, isValidPeriod, monthName } from '@/lib/finance/period'
import { sesiJam } from '@/lib/rq/sesi'

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
  const { rows, trend } = await getKelengkapan(period, scope)

  const aktif = rows.filter(r => r.totalSiswa > 0)
  const kosong = aktif.filter(r => r.terisi === 0)
  const sebagian = aktif.filter(r => r.terisi > 0 && r.terisi < r.totalSiswa)
  const lengkap = aktif.filter(r => r.totalSiswa > 0 && r.terisi === r.totalSiswa)

  const totalSiswa = aktif.reduce((t, r) => t + r.totalSiswa, 0)
  const totalTerisi = aktif.reduce((t, r) => t + r.terisi, 0)
  const puncak = Math.max(...trend.map(t => t.terisi), 1)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelengkapan Pengisian"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Pengawasan</p>
            <h1 className="text-2xl font-bold leading-tight">Kelengkapan Pengisian Capaian</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Halaqoh mana yang belum diisi gurunya · {formatPeriod(period)}
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        {aktif.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Belum ada halaqoh berisi siswa pada lingkup Anda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Belum diisi sama sekali"
                value={String(kosong.length)}
                hint={`dari ${aktif.length} halaqoh`}
                tone={kosong.length > 0 ? 'danger' : 'good'}
              />
              <Kpi
                icon={<ClipboardList className="h-4 w-4" />}
                label="Terisi sebagian"
                value={String(sebagian.length)}
                tone={sebagian.length > 0 ? 'warn' : 'neutral'}
              />
              <Kpi
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Lengkap"
                value={String(lengkap.length)}
                tone="good"
              />
              <Kpi
                icon={<ClipboardList className="h-4 w-4" />}
                label="Siswa terisi"
                value={`${totalTerisi}/${totalSiswa}`}
                hint={totalSiswa ? `${Math.round((totalTerisi / totalSiswa) * 100)}%` : '—'}
              />
            </div>

            {/* Pola antar bulan sering lebih menjelaskan daripada angka satu
                bulan: bulan yang kosong merata biasanya berarti belum waktunya
                diisi, bukan gurunya lalai. */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">Pengisian per Bulan</h2>
              <div className="space-y-2">
                {trend.map(t => (
                  <div key={t.period} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">{monthName(t.period)}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary/70"
                        style={{ width: `${Math.round((t.terisi / puncak) * 100)}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {t.terisi === 0 ? 'belum ada' : `${t.terisi} siswa · ${t.percent}%`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Rincian per Halaqoh</h2>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Diurutkan dari yang paling perlu ditagih.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Halaqoh</th>
                      <th className="py-2 px-2 font-medium">Pengampu</th>
                      <th className="py-2 px-2 font-medium">Unit</th>
                      <th className="py-2 px-2 text-right font-medium">Terisi</th>
                      <th className="py-2 pl-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aktif.map(row => (
                      <tr key={row.halaqohId} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <Link href={`/halaqoh/${row.halaqohId}`} className="font-medium hover:underline">
                            {row.halaqohName}
                          </Link>
                          {row.sesi && (
                            <p className="text-xs text-muted-foreground">{sesiJam(row.sesi)}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{row.pengampu}</td>
                        <td className="py-2 px-2 text-muted-foreground">{JENJANG_LABELS[row.jenjang]}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {row.terisi}/{row.totalSiswa}
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          <StatusBadge terisi={row.terisi} total={row.totalSiswa} percent={row.percent} />
                        </td>
                      </tr>
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

function StatusBadge({ terisi, total, percent }: { terisi: number; total: number; percent: number }) {
  if (terisi === 0) {
    return <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">belum</span>
  }
  if (terisi < total) {
    return (
      <span className="rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
        {percent}%
      </span>
    )
  }
  return (
    <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
      lengkap
    </span>
  )
}

function Kpi({
  icon, label, value, hint, tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'good' | 'warn' | 'danger'
}) {
  const toneClass =
    tone === 'danger' ? 'text-destructive'
      : tone === 'warn' ? 'text-warning'
        : tone === 'good' ? 'text-success'
          : ''

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className={`mt-1.5 text-2xl font-bold leading-none tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
