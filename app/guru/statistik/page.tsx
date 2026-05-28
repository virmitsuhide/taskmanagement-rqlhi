import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import {
  getTeacherWeeklyStats,
  getTeacherHalaqohSummary,
  getTeacherDailyActivity,
  getStudentsNeedingAttention,
} from '@/lib/data/teacher-stats'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { AlertTriangle } from 'lucide-react'

const JENJANG_LABELS: Record<string, string> = { paud: 'PAUD', sd: 'SD', smp: 'SMP', sma: 'SMA' }

export default async function GuruStatistikPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const [weekly, halaqohSummary, daily, attention] = await Promise.all([
    getTeacherWeeklyStats(session.teacherId),
    getTeacherHalaqohSummary(session.teacherId),
    getTeacherDailyActivity(session.teacherId, 7),
    getStudentsNeedingAttention(session.teacherId, 3),
  ])

  const maxDaily = Math.max(1, ...daily.map(d => d.tahsin + d.tahfidz))

  return (
    <div className="min-h-screen" style={{ background: '#fafaf7' }}>
      <TeacherHeader fullName={session.fullName} active="statistik" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Statistik</p>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Statistik Mengajar
          </h1>
        </div>

        {/* Stat pekan ini */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BigStat num={weekly.tahsinCount} label="Setoran Tahsin" sub="pekan ini" />
          <BigStat num={weekly.tahfidzCount} label="Setoran Tahfidz" sub="pekan ini" />
          <BigStat num={weekly.jilidPromotions} label="Naik Jilid" sub="pekan ini" accent />
          <BigStat num={weekly.juzPromotions} label="Naik Juz" sub="pekan ini" accent />
        </div>

        {/* Sparkline 7 hari */}
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-sm font-semibold mb-4">Aktivitas Setoran (7 Hari Terakhir)</h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {daily.map(d => {
              const total = d.tahsin + d.tahfidz
              const tahsinH = (d.tahsin / maxDaily) * 100
              const tahfidzH = (d.tahfidz / maxDaily) * 100
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex-1 w-full flex flex-col justify-end gap-0.5" style={{ minHeight: 0 }}>
                    {d.tahfidz > 0 && (
                      <div className="w-full rounded-t" style={{ height: `${tahfidzH}%`, background: '#15803d', minHeight: 3 }} title={`${d.tahfidz} tahfidz`} />
                    )}
                    {d.tahsin > 0 && (
                      <div className="w-full rounded-t" style={{ height: `${tahsinH}%`, background: '#b8860b', minHeight: 3 }} title={`${d.tahsin} tahsin`} />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  <span className="text-[11px] font-semibold">{total || ''}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#b8860b' }} /> Tahsin</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#15803d' }} /> Tahfidz</span>
          </div>
        </section>

        {/* Breakdown per halaqoh */}
        {halaqohSummary.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">Ringkasan per Halaqoh</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {halaqohSummary.map(h => {
                const pct = h.studentCount > 0 ? Math.round((h.setorTodayCount / h.studentCount) * 100) : 0
                return (
                  <div key={h.id} className="rounded-xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{h.name}</p>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {JENJANG_LABELS[h.jenjang] ?? h.jenjang}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {h.studentCount} siswa · {h.setorTodayCount} setor hari ini ({pct}%)
                    </p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#15803d' : '#b8860b' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Siswa perlu perhatian */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Perlu Perhatian
            <span className="text-xs font-normal text-muted-foreground">(belum setor ≥ 3 hari)</span>
          </h2>
          {attention.length === 0 ? (
            <div className="rounded-xl border bg-white py-8 text-center text-sm text-muted-foreground">
              🎉 Semua siswa aktif setor. Tidak ada yang terlewat.
            </div>
          ) : (
            <div className="rounded-xl border bg-white divide-y">
              {attention.map(s => (
                <Link
                  key={s.id}
                  href={`/guru/siswa/${s.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                    {s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.halaqoh_name ?? '—'}</p>
                  </div>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                    style={s.daysSinceLastSetoran === null
                      ? { background: '#fee2e2', color: '#b91c1c' }
                      : { background: '#fef9c3', color: '#a16207' }}
                  >
                    {s.daysSinceLastSetoran === null ? 'Belum pernah' : `${s.daysSinceLastSetoran} hari`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function BigStat({ num, label, sub, accent }: { num: number; label: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-4" style={accent && num > 0 ? { background: '#dcfce7', borderColor: '#bbf7d0' } : undefined}>
      <div
        className="text-3xl font-extrabold leading-none"
        style={{ fontFamily: 'var(--font-playfair), serif', color: accent && num > 0 ? '#15803d' : '#1a1a1a' }}
      >
        {num}
      </div>
      <div className="text-xs font-medium mt-1.5">{label}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{sub}</div>
    </div>
  )
}
