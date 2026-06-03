import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, JENJANG_LABELS } from '@/lib/auth/permissions'
import { getRqAnalytics } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Users, GraduationCap, BookMarked, Sparkles, BookOpen, AlertTriangle, CheckSquare } from 'lucide-react'
import type { TaskStatus } from '@/types'

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do', in_progress: 'Dikerjakan', submitted: 'Review', done: 'Selesai', returned: 'Dikembalikan',
}
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  todo: '#94a3b8', in_progress: '#2563eb', submitted: '#d97706', done: '#16a34a', returned: '#dc2626',
}

export default async function AnalitikPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/dashboard')

  const a = await getRqAnalytics()
  const maxJenjang = Math.max(1, ...a.overview.studentsByJenjang.map(j => j.count))
  const maxHalaqoh = Math.max(1, ...a.halaqohLeaderboard.map(h => h.setoranThisWeek))

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik RQ" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Ringkasan Seluruh RQ</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik Rumah Qur&apos;an</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agregat lintas divisi &amp; halaqoh · {a.monthLabel}</p>
        </div>

        <Link
          href="/dashboard/analitik/tahsin-tahfidz"
          className="flex items-center justify-between rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Analitik Tahsin &amp; Tahfidz →</p>
              <p className="text-xs text-muted-foreground">Sebaran metode, tahap, nilai (bintang) &amp; hafalan per juz</p>
            </div>
          </div>
        </Link>

        {/* KPI utama */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<Users className="h-4 w-4" />} label="Siswa Aktif" value={a.overview.activeStudents} />
          <Kpi icon={<GraduationCap className="h-4 w-4" />} label="Guru Aktif" value={a.overview.activeTeachers} />
          <Kpi icon={<BookMarked className="h-4 w-4" />} label="Halaqoh Aktif" value={a.overview.activeHalaqoh} />
          <Kpi icon={<Sparkles className="h-4 w-4" />} label="Total Ayat Dihafal" value={a.totalAyatHafal} />
        </div>

        {/* Capaian bulan ini */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Capaian Bulan Ini ({a.monthLabel})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Metric label="Setoran Tahsin" value={a.monthly.tahsinSetoran} />
            <Metric label="Setoran Tahfidz" value={a.monthly.tahfidzSetoran} />
            <Metric label="Kenaikan Jilid" value={a.monthly.jilidPromotions} accent />
            <Metric label="Kenaikan Juz" value={a.monthly.juzPromotions} accent />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            <Sparkles className="h-3 w-3 inline mr-1" />
            {a.juzMutqinTotal} juz sudah ditandai mutqin di seluruh RQ.
          </p>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Distribusi jenjang */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Distribusi Siswa per Jenjang
            </h2>
            {a.overview.studentsByJenjang.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data siswa.</p>
            ) : (
              <div className="space-y-3">
                {a.overview.studentsByJenjang.map(j => (
                  <div key={j.jenjang}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{JENJANG_LABELS[j.jenjang]}</span>
                      <span className="text-muted-foreground">{j.count} siswa</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(j.count / maxJenjang) * 100}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Status task */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Status Task ({a.tasks.total})
            </h2>
            {a.tasks.total === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada task.</p>
            ) : (
              <div className="space-y-2.5">
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map(st => {
                  const count = a.tasks.byStatus[st]
                  const pct = Math.round((count / a.tasks.total) * 100)
                  return (
                    <div key={st}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: TASK_STATUS_COLOR[st] }} />
                          {TASK_STATUS_LABELS[st]}
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TASK_STATUS_COLOR[st] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/tasks/board" className="text-xs text-primary hover:underline mt-3 inline-block">Buka papan task →</Link>
          </section>
        </div>

        {/* Leaderboard halaqoh */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Halaqoh Paling Aktif (Pekan Ini)
          </h2>
          {a.halaqohLeaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada halaqoh.</p>
          ) : (
            <div className="space-y-3">
              {a.halaqohLeaderboard.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <Link href={`/halaqoh/${h.id}`} className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate hover:underline">
                        {h.name} <span className="text-muted-foreground">· {JENJANG_LABELS[h.jenjang]} · {h.studentCount} siswa</span>
                      </span>
                      <span className="text-muted-foreground shrink-0 ml-2">{h.setoranThisWeek} setoran</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(h.setoranThisWeek / maxHalaqoh) * 100}%`, background: 'var(--primary)' }} />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Siswa perlu perhatian */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Siswa Perlu Perhatian
            <span className="text-xs font-normal text-muted-foreground">(belum setor ≥ 7 hari, se-RQ)</span>
          </h2>
          {a.attention.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">🎉 Semua siswa aktif setor pekan ini.</p>
          ) : (
            <div className="divide-y">
              {a.attention.map(s => (
                <Link key={s.id} href={`/siswa/${s.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.halaqoh_name ?? 'Tanpa halaqoh'}</p>
                  </div>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                    style={s.daysSince === null ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#fef9c3', color: '#a16207' }}
                  >
                    {s.daysSince === null ? 'Belum pernah' : `${s.daysSince} hari`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="text-2xl font-bold mt-1.5 leading-none">{value.toLocaleString('id-ID')}</p>
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
