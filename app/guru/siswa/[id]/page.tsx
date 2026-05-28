import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { Button } from '@/components/ui/button'
import { BookOpen, CheckCircle2 } from 'lucide-react'
import type { Jenjang } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ setoran?: string }>
}

const JENJANG_LABELS: Record<string, string> = { paud: 'PAUD', sd: 'SD', smp: 'SMP', sma: 'SMA' }

function avg(...vals: (number | null)[]): string {
  const nums = vals.filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return '—'
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
}

export default async function GuruStudentDetailPage({ params, searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { id } = await params
  const { setoran } = await searchParams

  const allowed = await canTeacherAccessStudent(session.teacherId, id)
  if (!allowed) redirect('/guru/siswa')

  const supabase = createServerClient()
  const { data: studentRaw } = await supabase
    .from('students')
    .select(`
      id, full_name, nis, gender, kelas, jenjang, current_jilid_page,
      halaqoh:halaqoh(id, name),
      current_method:tahsin_methods!students_current_method_id_fkey(id, name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(id, label)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!studentRaw) notFound()

  const student = studentRaw as unknown as {
    id: string; full_name: string; nis: string | null; gender: 'L' | 'P' | null
    kelas: string | null; jenjang: string; current_jilid_page: number | null
    halaqoh: { id: string; name: string } | null
    current_method: { id: string; name: string } | null
    current_jilid: { id: string; label: string } | null
  }

  // Riwayat 15 setoran tahsin terakhir
  const { data: logs } = await supabase
    .from('tahsin_logs')
    .select('id, setoran_date, halaman, baris_dari, baris_ke, nilai_makhraj, nilai_tajwid, nilai_kelancaran, status, catatan, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
    .eq('student_id', id)
    .order('setoran_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(15)

  // Riwayat kenaikan jilid
  const { data: promotions } = await supabase
    .from('jilid_promotions')
    .select('id, promotion_date, from_jilid:jilid_levels!jilid_promotions_from_jilid_id_fkey(label), to_jilid:jilid_levels!jilid_promotions_to_jilid_id_fkey(label)')
    .eq('student_id', id)
    .order('promotion_date', { ascending: false })

  const initials = student.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  const setoranUrl = `/guru/setoran/tahsin/baru?student=${id}`

  return (
    <div className="min-h-screen" style={{ background: '#fafaf7' }}>
      <TeacherHeader fullName={session.fullName} active="siswa" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <Link href="/guru/siswa" className="text-xs text-muted-foreground hover:underline">← Daftar Siswa</Link>

        {setoran === 'ok' && (
          <div className="rounded-lg border-2 border-green-300 bg-green-50 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Setoran berhasil disimpan. Barakallahu fiik!
          </div>
        )}

        {/* Hero */}
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: '#b8860b', fontFamily: 'var(--font-playfair), serif' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-[180px]">
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                {student.full_name}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {JENJANG_LABELS[student.jenjang as Jenjang]}
                {student.kelas ? ` · Kelas ${student.kelas}` : ''}
                {student.halaqoh?.name ? ` · ${student.halaqoh.name}` : ''}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg" style={{ background: '#fdf6e3', color: '#b8860b' }}>
                <BookOpen className="h-4 w-4" />
                {student.current_method?.name && student.current_jilid?.label
                  ? `${student.current_method.name} ${student.current_jilid.label} · hal. ${student.current_jilid_page ?? '—'}`
                  : 'Belum ada data tahsin'}
              </div>
            </div>
            <Button asChild style={{ background: '#b8860b', borderColor: '#b8860b' }}>
              <Link href={setoranUrl}>+ Setor Tahsin</Link>
            </Button>
          </div>
        </div>

        {/* Riwayat setoran */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Riwayat Setoran Tahsin</h2>
          {!logs || logs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-white py-8 text-center text-sm text-muted-foreground">
              Belum ada setoran tercatat.
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={setoranUrl}>Catat setoran pertama</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-white divide-y">
              {logs.map(log => {
                const jilid = (log.jilid as unknown as { label: string } | null)?.label ?? '—'
                return (
                  <div key={log.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {jilid} · hal. {log.halaman ?? '—'}
                        {log.baris_dari && log.baris_ke ? ` (baris ${log.baris_dari}-${log.baris_ke})` : ''}
                      </p>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                        style={log.status === 'lulus'
                          ? { background: '#dcfce7', color: '#15803d' }
                          : { background: '#fef9c3', color: '#a16207' }}
                      >
                        {log.status === 'lulus' ? 'Lulus' : 'Ulang'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.setoran_date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}⭐ {avg(log.nilai_makhraj, log.nilai_tajwid, log.nilai_kelancaran)}
                      {' '}(M {log.nilai_makhraj ?? '–'}/T {log.nilai_tajwid ?? '–'}/L {log.nilai_kelancaran ?? '–'})
                    </p>
                    {log.catatan && (
                      <p className="text-xs italic text-muted-foreground mt-1">“{log.catatan}”</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Riwayat kenaikan jilid */}
        {promotions && promotions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">🎉 Kenaikan Jilid</h2>
            <div className="rounded-xl border bg-white divide-y">
              {promotions.map(p => {
                const from = (p.from_jilid as unknown as { label: string } | null)?.label ?? '?'
                const to = (p.to_jilid as unknown as { label: string } | null)?.label ?? '?'
                return (
                  <div key={p.id} className="p-3 text-sm flex items-center justify-between">
                    <span className="font-medium" style={{ color: '#15803d' }}>{from} → {to}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.promotion_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
