import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherStudents } from '@/lib/data/teacher'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { Users } from 'lucide-react'

const DAY_MS = 1000 * 60 * 60 * 24

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / DAY_MS)
}

function lastLabel(dateStr: string | null): { text: string; tone: 'ok' | 'warn' | 'danger' | 'none' } {
  const d = daysAgo(dateStr)
  if (d === null) return { text: 'Belum pernah setor', tone: 'none' }
  if (d === 0) return { text: 'Setor hari ini', tone: 'ok' }
  if (d === 1) return { text: 'Setor kemarin', tone: 'ok' }
  if (d <= 3) return { text: `${d} hari lalu`, tone: 'warn' }
  return { text: `${d} hari lalu`, tone: 'danger' }
}

export default async function GuruSiswaPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const students = await getTeacherStudents(session.teacherId)

  // Group per halaqoh
  const byHalaqoh = new Map<string, { name: string; students: typeof students }>()
  for (const s of students) {
    const key = s.halaqoh_id ?? 'none'
    const name = s.halaqoh_name ?? 'Tanpa Halaqoh'
    if (!byHalaqoh.has(key)) byHalaqoh.set(key, { name, students: [] })
    byHalaqoh.get(key)!.students.push(s)
  }

  return (
    <div className="min-h-screen" style={{ background: '#fafaf7' }}>
      <TeacherHeader fullName={session.fullName} active="siswa" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Siswa Saya
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {students.length} siswa di {byHalaqoh.size} halaqoh
          </p>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">Belum ada siswa</p>
            <p className="text-xs text-muted-foreground mt-1">
              Anda belum ditugaskan sebagai wali/pengampu halaqoh manapun.
              Hubungi admin untuk assign halaqoh.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byHalaqoh.entries()].map(([key, group]) => (
              <section key={key}>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  📿 {group.name}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({group.students.length} siswa)
                  </span>
                </h2>
                <div className="rounded-xl border bg-white divide-y">
                  {group.students.map(s => {
                    const last = lastLabel(s.last_setoran_date)
                    return (
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
                          <p className="text-xs text-muted-foreground truncate">
                            {s.current_method_name && s.current_jilid_label
                              ? `${s.current_method_name} ${s.current_jilid_label} · hal. ${s.current_jilid_page ?? '—'}`
                              : 'Belum ada data tahsin'}
                            {s.kelas ? ` · Kelas ${s.kelas}` : ''}
                          </p>
                        </div>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                          style={
                            last.tone === 'ok' ? { background: '#dcfce7', color: '#15803d' }
                            : last.tone === 'warn' ? { background: '#fef9c3', color: '#a16207' }
                            : last.tone === 'danger' ? { background: '#fee2e2', color: '#b91c1c' }
                            : { background: '#f3f1ec', color: '#6b6b6b' }
                          }
                        >
                          {last.text}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
