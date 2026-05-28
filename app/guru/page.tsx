import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherStudents } from '@/lib/data/teacher'
import { getTeacherWeeklyStats, getTeacherHalaqohSummary } from '@/lib/data/teacher-stats'
import { TeacherHeader } from '@/components/layout/TeacherHeader'

const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAY_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const DAY_MS = 1000 * 60 * 60 * 24

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - d.getTime()) / DAY_MS)
}

export default async function TeacherHomePage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const now = new Date()
  const dateLabel = `${DAY_ID[now.getDay()]}, ${now.getDate()} ${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`

  const [students, weekly, halaqohSummary] = await Promise.all([
    getTeacherStudents(session.teacherId),
    getTeacherWeeklyStats(session.teacherId),
    getTeacherHalaqohSummary(session.teacherId),
  ])
  const todayStr = now.toISOString().slice(0, 10)
  const setorHariIni = students.filter(s => s.last_setoran_date === todayStr).length
  const belumSetor = students.filter(s => daysAgo(s.last_setoran_date) !== 0)
  // Antrian: prioritaskan yang paling lama belum setor
  const antrian = [...belumSetor].sort((a, b) => {
    const da = daysAgo(a.last_setoran_date); const db = daysAgo(b.last_setoran_date)
    if (da === null) return -1
    if (db === null) return 1
    return db - da
  }).slice(0, 8)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <TeacherHeader fullName={session.fullName} active="dashboard" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">{dateLabel}</p>
          <h1
            className="text-3xl font-extrabold mt-1.5 tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Assalamu&apos;alaikum,{' '}
            <span style={{ borderBottom: '3px solid var(--accent-warm)', paddingBottom: 2 }}>{session.fullName}</span>
          </h1>
        </div>

        {/* Stat */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard num={students.length} label="Total Siswa" />
          <StatCard num={setorHariIni} label="Sudah Setor" tone="ok" />
          <StatCard num={students.length - setorHariIni} label="Belum Setor" tone="warm" />
        </div>

        {/* Quick action */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <QuickAction href="/guru/setoran/tahsin/baru" emoji="📖" title="Setor Tahsin" desc="Catat bacaan jilid harian" />
          <QuickAction href="/guru/setoran/tahfidz/baru" emoji="✨" title="Setor Tahfidz" desc="Hafalan baru / muroja'ah" />
          <QuickAction href="/guru/siswa" emoji="👥" title="Siswa Saya" desc="Lihat semua siswa & progress" />
        </div>

        {/* 2 kolom: antrian + sidebar statistik */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* Antrian setoran */}
          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-base font-semibold">Antrian Setoran Hari Ini</h2>
              <Link href="/guru/siswa" className="text-xs text-muted-foreground hover:underline">Lihat semua →</Link>
            </div>

            {students.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white py-10 text-center text-sm text-muted-foreground">
                Anda belum mengampu halaqoh manapun. Hubungi admin untuk assign halaqoh.
              </div>
            ) : antrian.length === 0 ? (
              <div className="rounded-xl border bg-white py-10 text-center text-sm text-muted-foreground">
                🎉 Semua siswa sudah setor hari ini. Barakallahu fiik!
              </div>
            ) : (
              <div className="rounded-xl border bg-white divide-y">
                {antrian.map(s => {
                  const d = daysAgo(s.last_setoran_date)
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                        {s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.current_method_name && s.current_jilid_label
                            ? `${s.current_method_name} ${s.current_jilid_label} · hal. ${s.current_jilid_page ?? '—'}`
                            : 'Belum ada data tahsin'}
                          {d !== null && d > 3 && <span style={{ color: '#b91c1c' }}> · {d} hari belum setor</span>}
                        </p>
                      </div>
                      <Link
                        href={`/guru/setoran/tahsin/baru?student=${s.id}`}
                        className="text-xs px-3 py-1.5 rounded-md text-white shrink-0"
                        style={{ background: 'var(--primary)' }}
                      >
                        Setor
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Sidebar statistik */}
          <aside className="space-y-4">
            {/* Aktivitas pekan ini */}
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">📈 Aktivitas Pekan Ini</h3>
                <Link href="/guru/statistik" className="text-[11px] text-muted-foreground hover:underline">Detail →</Link>
              </div>
              <div className="space-y-2">
                <StatRow label="Setoran Tahsin" value={weekly.tahsinCount} />
                <StatRow label="Setoran Tahfidz" value={weekly.tahfidzCount} />
                <StatRow label="Kenaikan Jilid" value={weekly.jilidPromotions} accent={weekly.jilidPromotions > 0} />
                <StatRow label="Kenaikan Juz" value={weekly.juzPromotions} accent={weekly.juzPromotions > 0} />
              </div>
            </div>

            {/* Ringkasan halaqoh */}
            {halaqohSummary.length > 0 && (
              <div className="rounded-xl border bg-white p-4">
                <h3 className="text-sm font-semibold mb-3">📿 Halaqoh Saya</h3>
                <div className="space-y-3">
                  {halaqohSummary.map(h => {
                    const pct = h.studentCount > 0 ? Math.round((h.setorTodayCount / h.studentCount) * 100) : 0
                    return (
                      <div key={h.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate">{h.name}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">{h.setorTodayCount}/{h.studentCount} setor</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#15803d' : 'var(--primary)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>

      </main>
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-dashed last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold" style={{ color: accent ? '#15803d' : 'var(--foreground)' }}>{value}</span>
    </div>
  )
}

function StatCard({ num, label, tone }: { num: number; label: string; tone?: 'ok' | 'warm' }) {
  const style =
    tone === 'ok' ? { background: '#dcfce7', borderColor: '#bbf7d0' }
    : tone === 'warm' ? { background: 'var(--primary-wash)', borderColor: 'var(--border)' }
    : { background: 'white', borderColor: 'var(--border)' }
  const numColor = tone === 'ok' ? '#15803d' : tone === 'warm' ? 'var(--primary)' : 'var(--foreground)'
  return (
    <div className="rounded-xl border p-4" style={style}>
      <div className="text-3xl font-extrabold leading-none" style={{ fontFamily: 'var(--font-playfair), serif', color: numColor }}>
        {num}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5">{label}</div>
    </div>
  )
}

function QuickAction({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-white p-4 hover:border-[var(--primary)] transition-colors">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: 'var(--primary-wash)' }}>
        {emoji}
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </Link>
  )
}
