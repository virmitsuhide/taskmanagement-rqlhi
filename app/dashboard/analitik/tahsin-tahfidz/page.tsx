import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getTahsinTahfidzAnalytics } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { StarValue } from '@/components/StarValue'
import { Users, GraduationCap, Sparkles, BookOpen, Trophy, CheckCircle2, RefreshCw } from 'lucide-react'

const METHOD_COLOR: Record<string, string> = {
  UMMI: '#0ea5e9', KIBAR: '#8b5cf6', Syajaroh: '#10b981',
}

export default async function AnalitikTahsinTahfidzPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/dashboard')

  const a = await getTahsinTahfidzAnalytics()
  const maxJenjang = Math.max(1, ...a.byJenjang.map(j => j.count))
  const maxMethod = Math.max(1, ...a.byMethod.map(m => m.count))
  const maxJuz = Math.max(1, ...a.juzHistogram.map(j => j.students))
  const lulusRate = a.tahsinMonth.setoran > 0 ? Math.round((a.tahsinMonth.lulus / a.tahsinMonth.setoran) * 100) : 0

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik Tahsin & Tahfidz" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Capaian Qur&apos;ani Seluruh RQ</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik Tahsin &amp; Tahfidz</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agregat lintas halaqoh · {a.monthLabel} ·{' '}
            <Link href="/dashboard/analitik" className="text-primary hover:underline">← Analitik RQ umum</Link>
          </p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<Users className="h-4 w-4" />} label="Siswa Aktif" value={a.totals.activeStudents} />
          <Kpi icon={<Trophy className="h-4 w-4" />} label="Lulus Tahsin" value={a.totals.lulusTahsin} accent />
          <Kpi icon={<Sparkles className="h-4 w-4" />} label="Total Ayat Hafal" value={a.totals.totalAyatHafal} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Juz Mutqin" value={a.totals.juzMutqin} />
        </div>

        {/* Capaian bulan ini: tahsin & tahfidz */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Tahsin ({a.monthLabel})</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Metric label="Setoran" value={a.tahsinMonth.setoran} />
              <Metric label="Lulus" value={a.tahsinMonth.lulus} accent />
              <Metric label="Ulang" value={a.tahsinMonth.ulang} />
            </div>
            {a.tahsinMonth.setoran > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Rasio lulus</span><span className="font-medium">{lulusRate}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${lulusRate}%`, background: '#16a34a' }} /></div>
              </div>
            )}
            <ScoreRows avg={a.tahsinMonth.avg} />
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Tahfidz ({a.monthLabel})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Metric label="Ziyadah" value={a.tahfidzMonth.ziyadah} accent />
              <Metric label="Murojaah Baru" value={a.tahfidzMonth.murojaahBaru} />
              <Metric label="Murojaah Lama" value={a.tahfidzMonth.murojaahLama} />
              <Metric label="Tasmi'" value={a.tahfidzMonth.tasmi} />
            </div>
            <ScoreRows avg={a.tahfidzMonth.avg} />
          </section>
        </div>

        {/* Distribusi metode & unit */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Siswa per Metode</h2>
            {a.byMethod.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {a.byMethod.map(m => (
                  <Bar key={m.method} label={m.method} value={m.count} max={maxMethod} suffix="siswa" color={METHOD_COLOR[m.method] ?? 'var(--primary)'} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Siswa per Unit</h2>
            {a.byJenjang.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {a.byJenjang.map(j => (
                  <Bar key={j.jenjang} label={JENJANG_LABELS[j.jenjang]} value={j.count} max={maxJenjang} suffix="siswa" color="var(--primary)" />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Distribusi level per metode */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Sebaran Siswa per Tahap</h2>
          <p className="text-xs text-muted-foreground mb-4">Jumlah siswa aktif di tiap jilid/tahap setiap metode.</p>
          {a.levelDistribution.length === 0 ? <Empty /> : (
            <div className="grid md:grid-cols-3 gap-5">
              {a.levelDistribution.map(m => {
                const maxLvl = Math.max(1, ...m.levels.map(l => l.count))
                return (
                  <div key={m.method}>
                    <p className="text-xs font-semibold mb-2" style={{ color: METHOD_COLOR[m.method] ?? undefined }}>{m.method}</p>
                    <div className="space-y-1.5">
                      {m.levels.map(l => (
                        <div key={l.order_num} className="flex items-center gap-2">
                          <span className="text-[11px] w-28 shrink-0 truncate" title={l.label}>
                            {l.isTerminal ? '🎓 ' : ''}{l.label}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(l.count / maxLvl) * 100}%`, background: l.isTerminal ? '#16a34a' : l.isQuran ? '#0ea5e9' : (METHOD_COLOR[m.method] ?? 'var(--primary)') }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground w-5 text-right tabular-nums">{l.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Sebaran hafalan per juz */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Sebaran Hafalan per Juz</h2>
          <p className="text-xs text-muted-foreground mb-4">Berapa siswa yang capaian juz tertingginya ada di tiap juz.</p>
          {a.juzHistogram.length === 0 ? <Empty /> : (
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 30 }, (_, i) => 30 - i).map(juz => {
                const found = a.juzHistogram.find(j => j.juz === juz)
                const count = found?.students ?? 0
                return (
                  <div key={juz} className="flex-1 flex flex-col items-center justify-end h-full" title={`Juz ${juz}: ${count} siswa`}>
                    <div className="w-full rounded-t" style={{ height: `${(count / maxJuz) * 100}%`, minHeight: count > 0 ? 4 : 0, background: 'var(--primary)' }} />
                    {juz % 5 === 0 && <span className="text-[8px] text-muted-foreground mt-0.5">{juz}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ScoreRows({ avg }: { avg: { fashohah: number | null; tajwid: number | null; kelancaran: number | null } }) {
  const rows: [string, number | null][] = [['Fashohah', avg.fashohah], ['Tajwid', avg.tajwid], ['Kelancaran', avg.kelancaran]]
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Rata-rata nilai</p>
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-xs">{label}</span>
          <StarValue value={val} size={15} />
        </div>
      ))}
    </div>
  )
}

function Bar({ label, value, max, suffix, color }: { label: string; value: number; max: number; suffix: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value} {suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function Empty() { return <p className="text-sm text-muted-foreground">Belum ada data.</p> }

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-2xl font-bold mt-1.5 leading-none" style={accent && value > 0 ? { color: '#15803d' } : undefined}>{value.toLocaleString('id-ID')}</p>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={accent && value > 0 ? { background: '#dcfce7' } : { background: 'var(--muted)' }}>
      <p className="text-2xl font-bold leading-none" style={{ color: accent && value > 0 ? '#15803d' : undefined }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
